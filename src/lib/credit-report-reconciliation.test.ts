import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), exists: vi.fn(), remove: vi.fn(),
}));
vi.mock("./supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: mocks.from,
    storage: { from: () => ({ exists: mocks.exists, remove: mocks.remove }) },
  }),
}));

import { reconcileCreditReportArtifacts } from "./credit-report-reconciliation";

const attempt = {
  attempt_id: "11111111-1111-4111-8111-111111111111",
  contact_id: "22222222-2222-4222-8222-222222222222",
  object_path: "22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/11111111-1111-4111-8111-111111111111.pdf",
  claim_token: "44444444-4444-4444-8444-444444444444",
  previous_state: "pending" as const,
};
const obsolete = {
  contact_id: attempt.contact_id,
  object_path: attempt.object_path,
  claim_token: attempt.claim_token,
};

function queryResult(data: unknown = null, error: unknown = null) {
  const chain = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle };
  mocks.from.mockReturnValue(chain);
  mocks.select.mockReturnValue(chain);
  mocks.eq.mockReturnValue(chain);
  mocks.maybeSingle.mockResolvedValue({ data, error });
}

describe("credit-report artifact reconciliation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    queryResult();
    mocks.exists.mockResolvedValue({ data: false, error: { statusCode: "404" } });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "credit_report_reconciliation_counts_v1") return { data: { attempts: 1, obsoleteObjects: 0, hasMore: false }, error: null };
      if (name === "claim_credit_report_attempts_v1") return { data: [attempt], error: null };
      if (name === "claim_credit_report_obsolete_objects_v1") return { data: [], error: null };
      if (name === "finish_credit_report_attempt_reconciliation_v1") return { data: "abandoned", error: null };
      if (name.startsWith("release_credit_report_")) return { data: true, error: null };
      return { data: null, error: null };
    });
  });

  it("dry-runs only bounded aggregate counts and never claims or contacts Storage", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "credit_report_reconciliation_counts_v1"
      ? { data: { attempts: 2, obsoleteObjects: 1, hasMore: true }, error: null }
      : { data: null, error: null });
    const result = await reconcileCreditReportArtifacts({ dryRun: true, limit: 3 });
    expect(result).toMatchObject({ dryRun: true, limit: 3, attempts: 2, obsoleteObjects: 1, hasMore: true });
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.exists).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("rejects a batch above the hard cap before any database call", async () => {
    await expect(reconcileCreditReportArtifacts({ limit: 26 })).rejects.toThrow("between 1 and 25");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("finalizes a stale objectless attempt as abandoned without deleting anything", async () => {
    const result = await reconcileCreditReportArtifacts({ limit: 1 });
    expect(mocks.exists).toHaveBeenCalledWith(attempt.object_path);
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("finish_credit_report_attempt_reconciliation_v1", {
      p_attempt_id: attempt.attempt_id, p_claim_token: attempt.claim_token, p_object_exists: false, p_object_removed: false,
    });
    expect(result.attemptsAbandoned).toBe(1);
  });

  it("removes only the exact unreferenced object and then finalizes the attempt", async () => {
    mocks.exists.mockResolvedValue({ data: true, error: null });
    const result = await reconcileCreditReportArtifacts({ limit: 1 });
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([attempt.object_path]);
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[2]);
    expect(mocks.rpc).toHaveBeenCalledWith("finish_credit_report_attempt_reconciliation_v1", expect.objectContaining({ p_object_exists: true, p_object_removed: true }));
    expect(result).toMatchObject({ attemptsAbandoned: 1, objectsRemoved: 1 });
  });

  it("never removes an object referenced by the current receipt", async () => {
    mocks.exists.mockResolvedValue({ data: true, error: null });
    queryResult({ id: attempt.attempt_id });
    mocks.rpc.mockImplementation(async (name: string) => name === "credit_report_reconciliation_counts_v1"
      ? { data: { attempts: 1, obsoleteObjects: 0, hasMore: false }, error: null }
      : name === "claim_credit_report_attempts_v1" ? { data: [attempt], error: null }
        : name === "finish_credit_report_attempt_reconciliation_v1" ? { data: "completed", error: null }
          : { data: [], error: null });
    const result = await reconcileCreditReportArtifacts({ limit: 1 });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(result.attemptsCompleted).toBe(1);
  });

  it("keeps uncertain Storage outcomes pending and releases the claim for retry", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.exists.mockResolvedValue({ data: false, error: { statusCode: "500", message: "private provider detail" } });
    const result = await reconcileCreditReportArtifacts({ limit: 1 });
    expect(mocks.rpc).toHaveBeenCalledWith("release_credit_report_attempt_reconciliation_v1", expect.objectContaining({ p_failure_code: "storage_check_failed" }));
    expect(mocks.rpc).not.toHaveBeenCalledWith("finish_credit_report_attempt_reconciliation_v1", expect.anything());
    expect(result).toMatchObject({ deferred: 1, failed: 1, attemptsAbandoned: 0 });
    expect(warning.mock.calls.flat().join(" ")).not.toContain("private provider detail");
  });

  it("retries failed exact-object removal and emits only a safe warning", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.exists.mockResolvedValue({ data: true, error: null });
    mocks.remove.mockResolvedValue({ data: null, error: { message: "private provider detail" } });
    const result = await reconcileCreditReportArtifacts({ limit: 1 });
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([attempt.object_path]);
    expect(mocks.rpc).toHaveBeenCalledWith("release_credit_report_attempt_reconciliation_v1", expect.objectContaining({ p_failure_code: "storage_remove_failed" }));
    expect(result).toMatchObject({ deferred: 1, failed: 1, attemptsAbandoned: 0 });
    expect(warning.mock.calls.flat().join(" ")).not.toContain(attempt.object_path);
    expect(warning.mock.calls.flat().join(" ")).not.toContain("private provider detail");
  });

  it("cleans a queued obsolete object by its exact key only", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "credit_report_reconciliation_counts_v1"
      ? { data: { attempts: 0, obsoleteObjects: 1, hasMore: false }, error: null }
      : name === "claim_credit_report_attempts_v1" ? { data: [], error: null }
        : name === "claim_credit_report_obsolete_objects_v1" ? { data: [obsolete], error: null }
          : name === "finish_credit_report_obsolete_object_v1" ? { data: "removed", error: null }
            : { data: true, error: null });
    mocks.exists.mockResolvedValue({ data: true, error: null });
    const result = await reconcileCreditReportArtifacts({ limit: 1 });
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([obsolete.object_path]);
    expect(result.objectsRemoved).toBe(1);
  });

  it("keeps a queued path when a current receipt references that exact object", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "credit_report_reconciliation_counts_v1"
      ? { data: { attempts: 0, obsoleteObjects: 1, hasMore: false }, error: null }
      : name === "claim_credit_report_attempts_v1" ? { data: [], error: null }
        : name === "claim_credit_report_obsolete_objects_v1" ? { data: [obsolete], error: null }
          : name === "finish_credit_report_obsolete_object_v1" ? { data: "protected_current", error: null }
            : { data: true, error: null });
    mocks.exists.mockResolvedValue({ data: true, error: null });
    queryResult({ id: "current-report" });
    const result = await reconcileCreditReportArtifacts({ limit: 1 });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("finish_credit_report_obsolete_object_v1", expect.objectContaining({ p_object_path: obsolete.object_path }));
    expect(result.protectedCurrent).toBe(1);
  });

  it("leaves a failed obsolete-object removal queued for retry", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.rpc.mockImplementation(async (name: string) => name === "credit_report_reconciliation_counts_v1"
      ? { data: { attempts: 0, obsoleteObjects: 1, hasMore: false }, error: null }
      : name === "claim_credit_report_attempts_v1" ? { data: [], error: null }
        : name === "claim_credit_report_obsolete_objects_v1" ? { data: [obsolete], error: null }
          : name === "finish_credit_report_obsolete_object_v1" ? { data: "deferred", error: null }
            : { data: true, error: null });
    mocks.exists.mockResolvedValue({ data: true, error: null });
    mocks.remove.mockResolvedValue({ data: null, error: { message: "private provider detail" } });
    const result = await reconcileCreditReportArtifacts({ limit: 1 });
    expect(mocks.rpc).toHaveBeenCalledWith("finish_credit_report_obsolete_object_v1", expect.objectContaining({ p_failure_code: "storage_remove_failed" }));
    expect(result).toMatchObject({ deferred: 1, failed: 1 });
    const exposed = JSON.stringify({ result, warnings: warning.mock.calls });
    expect(exposed).not.toContain(obsolete.object_path);
    expect(exposed).not.toContain(attempt.contact_id);
    expect(exposed).not.toContain("private provider detail");
  });

  it("does not repeat actions on a later pass after the database has no eligible claims", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "credit_report_reconciliation_counts_v1"
      ? { data: { attempts: 0, obsoleteObjects: 0, hasMore: false }, error: null }
      : { data: [], error: null });
    const first = await reconcileCreditReportArtifacts({ limit: 5 });
    const second = await reconcileCreditReportArtifacts({ limit: 5 });
    expect(first).toMatchObject({ attempts: 0, obsoleteObjects: 0 });
    expect(second).toMatchObject({ attempts: 0, obsoleteObjects: 0 });
    expect(mocks.exists).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
