import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), save: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/credit-reports", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/credit-reports")>(), findCreditReportSession: mocks.session, saveCreditReport: mocks.save, consumeCreditReportRateLimit: mocks.limit,
}));
import { POST } from "./route";
const token = "x".repeat(43);
const pdf = "%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF\n";
function request(body = pdf, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/credit-check/reports/equifax", { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/pdf", "x-report-filename": "report.pdf", "x-report-session": "session", Cookie: `vance_report_upload=${token}`, ...headers }, body });
}
function upload(req: Request, bureau = "equifax") { return POST(req, { params: Promise.resolve({ bureau }) }); }
describe("per-bureau upload API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ id: "session", tokenHash: "hash", mode: "local" });
    mocks.limit.mockResolvedValue(true);
    mocks.save.mockResolvedValue({ id: "report", bureau: "equifax", fileName: "report.pdf", uploadedAt: "2026-09-09T12:00:00Z" });
  });
  it("returns a receipt only after storage confirms the file", async () => {
    const response = await upload(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, mode: "local", report: { bureau: "equifax" } });
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not return a receipt when storage fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.save.mockRejectedValue(new Error("secret storage details"));
    const response = await upload(request());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).not.toHaveProperty("report");
    expect(JSON.stringify(body)).not.toContain("secret storage details");
    spy.mockRestore();
  });
  it("rejects unauthenticated, expired, cross-origin and absent-origin attempts", async () => {
    expect((await upload(request(pdf, { Cookie: "" }))).status).toBe(401);
    mocks.session.mockResolvedValue(null);
    expect((await upload(request())).status).toBe(401);
    expect((await upload(request(pdf, { Origin: "https://evil.example" }))).status).toBe(403);
    expect((await upload(request(pdf, { Origin: "" }))).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects wrong bureau, PDF spoofing, incomplete files and oversized uploads", async () => {
    expect((await upload(request(), "not-a-bureau")).status).toBe(400);
    expect((await upload(request("<html>not PDF</html>"))).status).toBe(400);
    expect((await upload(request(pdf.slice(0, -7)))).status).toBe(400);
    expect((await upload(request(pdf, { "Content-Type": "image/png" }))).status).toBe(415);
    expect((await upload(request(pdf, { "Content-Length": String(16 * 1024 * 1024) }))).status).toBe(413);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("honors the capability upload limit", async () => {
    mocks.limit.mockResolvedValue(false);
    expect((await upload(request())).status).toBe(429);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("blocks stale tabs from sending files into a different intake without reading their body", async () => {
    const req = request(pdf, { "x-report-session": "previous-session" });
    const reader = vi.spyOn(req.body!, "getReader");
    const response = await upload(req);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Your upload session changed. Refresh this page before sending any reports." });
    expect(reader).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
