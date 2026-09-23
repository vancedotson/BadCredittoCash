import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), reconcile: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireCrmApiUser: mocks.auth }));
vi.mock("@/lib/credit-report-reconciliation", () => ({
  CREDIT_REPORT_RECONCILIATION_MAX_BATCH: 25,
  reconcileCreditReportArtifacts: mocks.reconcile,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost:3000/api/crm/credit-report-reconciliation", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });
}

describe("admin credit-report reconciliation endpoint", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { sub: "admin-user", crmRole: "admin" }, response: null });
    mocks.reconcile.mockResolvedValue({ dryRun: true, limit: 10, attempts: 2, attemptsCompleted: 0, attemptsAbandoned: 0, obsoleteObjects: 1, objectsRemoved: 0, protectedCurrent: 0, deferred: 0, failed: 0, hasMore: true });
  });

  it("requires admin-write authorization before running even a dry-run", async () => {
    mocks.auth.mockResolvedValue({ user: null, response: Response.json({ error: "Authentication required." }, { status: 401 }) });
    const response = await POST(request({ dryRun: true, limit: 10 }));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.auth).toHaveBeenCalledWith(expect.any(Request), "admin-write");
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("denies an ordinary authenticated read-only CRM member", async () => {
    mocks.auth.mockResolvedValue({ user: null, response: Response.json({ error: "This account has read-only access." }, { status: 403 }) });
    const response = await POST(request({ dryRun: false, limit: 1 }));
    expect(response.status).toBe(403);
    expect(mocks.auth).toHaveBeenCalledWith(expect.any(Request), "admin-write");
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("returns aggregate dry-run counts only", async () => {
    const response = await POST(request({ dryRun: true, limit: 10 }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.result).toEqual(expect.objectContaining({ attempts: 2, obsoleteObjects: 1, hasMore: true }));
    expect(JSON.stringify(payload)).not.toMatch(/object_path|contact_id|\.pdf|email|fileName/i);
    expect(mocks.reconcile).toHaveBeenCalledWith({ dryRun: true, limit: 10 });
  });

  it("enforces the hard batch limit before invoking reconciliation", async () => {
    const response = await POST(request({ dryRun: false, limit: 26 }));
    expect(response.status).toBe(400);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("permits an authorized bounded mutation and still returns only aggregate counts", async () => {
    mocks.reconcile.mockResolvedValue({ dryRun: false, limit: 25, attempts: 0, attemptsCompleted: 0, attemptsAbandoned: 1, obsoleteObjects: 0, objectsRemoved: 1, protectedCurrent: 0, deferred: 0, failed: 0, hasMore: false });
    const response = await POST(request({ dryRun: false, limit: 25 }));
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toMatch(/object_path|contact_id|\.pdf|email|fileName/i);
    expect(mocks.reconcile).toHaveBeenCalledWith({ dryRun: false, limit: 25 });
  });

  it("does not expose reconciliation failures or provider details", async () => {
    mocks.reconcile.mockRejectedValue(new Error("private storage path and provider details"));
    const response = await POST(request({ dryRun: false, limit: 1 }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private storage path");
  });
});
