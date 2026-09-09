import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn(), remove: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: mocks.from, rpc: mocks.rpc, storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
}) }));
import { findCreditReportSession, saveCreditReport, type CreditReportSession } from "./credit-reports";

const session: CreditReportSession = { id: "891e5660-352e-4487-aeae-aeb9b9b1c100", submissionId: "891e5660-352e-4487-aeae-aeb9b9b1c101", contactId: "891e5660-352e-4487-aeae-aeb9b9b1c102", tokenHash: "a".repeat(64), mode: "live", expiresAt: "2099-01-01T00:00:00Z" };
const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF\n");
function query(data: unknown, error: unknown = null) {
  const result = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error }), upsert: vi.fn().mockResolvedValue({ data: null, error }) };
  result.select.mockReturnValue(result); result.eq.mockReturnValue(result);
  return result;
}
describe("private live report persistence", () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co"); vi.stubEnv("SUPABASE_SECRET_KEY", "test-only-key");
    mocks.upload.mockResolvedValue({ data: {}, error: null }); mocks.remove.mockResolvedValue({ data: [], error: null }); mocks.rpc.mockResolvedValue({ data: true, error: null });
  });
  afterEach(() => { vi.unstubAllEnvs(); });
  it("stores the private PDF before committing metadata, then removes only the replaced object", async () => {
    const previous = query({ object_path: "previous-private.pdf" }); const commit = query(null);
    mocks.from.mockReturnValueOnce(previous).mockReturnValueOnce(commit);
    const saved = await saveCreditReport(session, "equifax", "report.pdf", pdf);
    expect(saved.bureau).toBe("equifax");
    expect(mocks.upload).toHaveBeenCalledWith(expect.stringContaining(`${session.contactId}/${session.id}/`), pdf, expect.objectContaining({ upsert: false, contentType: "application/pdf" }));
    expect(mocks.upload.mock.invocationCallOrder[0]).toBeLessThan(commit.upsert.mock.invocationCallOrder[0]);
    expect(commit.upsert.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]);
    expect(mocks.remove).toHaveBeenCalledWith(["previous-private.pdf"]);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "begin_credit_report_upload_v1", expect.objectContaining({ p_session_id: session.id }));
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "finish_credit_report_upload_v1", expect.objectContaining({ p_attempt_id: saved.id }));
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.upload.mock.invocationCallOrder[0]);
  });
  it("does not publish metadata or remove the previous report if the file write fails", async () => {
    const previous = query({ object_path: "previous-private.pdf" });
    mocks.from.mockReturnValue(previous); mocks.upload.mockResolvedValue({ data: null, error: { message: "failed upload" } });
    await expect(saveCreditReport(session, "transunion", "report.pdf", pdf)).rejects.toThrow("could not be stored");
    expect(previous.upsert).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("preserves the previous file after metadata failure and does not delete an ambiguously committed new file", async () => {
    mocks.from.mockReturnValueOnce(query({ object_path: "previous-private.pdf" })).mockReturnValueOnce(query(null, { message: "write failed" }));
    await expect(saveCreditReport(session, "experian", "report.pdf", pdf)).rejects.toThrow("receipt could not be saved");
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenLastCalledWith("finish_credit_report_upload_v1", expect.any(Object));
  });
  it("rejects a capability for a deleted/trashed contact even while its metadata is retained", async () => {
    mocks.from.mockReturnValueOnce(query({ id: session.id, submission_id: session.submissionId, contact_id: session.contactId, token_hash: session.tokenHash, expires_at: session.expiresAt })).mockReturnValueOnce(query(null));
    expect(await findCreditReportSession("x".repeat(43))).toBeNull();
    expect(mocks.from).toHaveBeenLastCalledWith("contacts");
  });
  it("blocks storage writes when purge registration refuses the upload", async () => {
    mocks.from.mockReturnValue(query(null));
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(saveCreditReport(session, "equifax", "report.pdf", pdf)).rejects.toThrow("storage is unavailable");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("denies retained capabilities while a contact purge is in progress", async () => {
    mocks.from.mockReturnValueOnce(query({ id: session.id, submission_id: session.submissionId, contact_id: session.contactId, token_hash: session.tokenHash, expires_at: session.expiresAt }))
      .mockReturnValueOnce(query({ id: session.contactId })).mockReturnValueOnce(query({ contact_id: session.contactId }));
    expect(await findCreditReportSession("x".repeat(43))).toBeNull();
  });
});
