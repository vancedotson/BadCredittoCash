import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/credit-reports", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/credit-reports")>(), findCreditReportSession: mocks.session, listCreditReports: mocks.list, consumeCreditReportRateLimit: mocks.limit,
}));
import { GET, POST } from "./route";
const token = "x".repeat(43);
const url = "http://localhost:3000/api/credit-check/reports/session";
describe("upload session capability handoff", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ mode: "local", expiresAt: new Date(Date.now() + 600_000).toISOString() });
    mocks.list.mockResolvedValue([{ bureau: "equifax", fileName: "report.pdf" }]); mocks.limit.mockResolvedValue(true);
  });
  it("requires an active session before exposing receipts or a handoff token", async () => {
    expect((await GET(new Request(url))).status).toBe(401);
    mocks.session.mockResolvedValue(null);
    expect((await GET(new Request(url, { headers: { Cookie: `vance_report_upload=${token}` } }))).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("restores saved receipts from a valid HttpOnly cookie", async () => {
    const response = await GET(new Request(url, { headers: { Cookie: `vance_report_upload=${token}` } }));
    expect(await response.json()).toMatchObject({ ok: true, handoffToken: token, reports: [{ bureau: "equifax" }] });
  });
  it("redeems a same-origin desktop handoff with a strict, HttpOnly path cookie", async () => {
    const response = await POST(new Request(url, { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify({ token }) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Path=/api/credit-check; HttpOnly; SameSite=Strict");
  });
  it("rejects forged capabilities, cross-site session reading and cross-origin redemption", async () => {
    expect((await POST(new Request(url, { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: '{"token":"forged"}' }))).status).toBe(401);
    expect((await GET(new Request(url, { headers: { Cookie: `vance_report_upload=${token}`, "Sec-Fetch-Site": "cross-site" } }))).status).toBe(403);
    expect((await POST(new Request(url, { method: "POST", headers: { Origin: "https://other.example", "Content-Type": "application/json" }, body: JSON.stringify({ token }) }))).status).toBe(403);
  });
});
