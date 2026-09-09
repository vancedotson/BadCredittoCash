import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), demo: vi.fn(), createClient: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(),
  maybeSingle: vi.fn(), list: vi.fn(), read: vi.fn(), purgeStarted: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireCrmApiUser: mocks.auth }));
vi.mock("@/lib/demo", () => ({ isCrmDemoMode: mocks.demo }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/credit-reports", () => ({ listCreditReportsForContact: mocks.list, readCreditReportForContact: mocks.read }));
vi.mock("@/lib/credit-report-privacy", () => ({ hasContactReportPurgeStarted: mocks.purgeStarted }));

import { GET as listReports } from "./route";
import { GET as downloadReport } from "./[reportId]/route";

const contactId = "11111111-1111-4111-8111-111111111111";
const reportId = "22222222-2222-4222-8222-222222222222";
const receipt = { id: reportId, submissionId: "33333333-3333-4333-8333-333333333333", bureau: "transunion", fileName: "My report.pdf", uploadedAt: "2026-09-09T12:00:00.000Z", byteSize: 1024 };
const request = new Request(`http://localhost:3000/api/crm/contact/${contactId}/reports`);
const context = { params: Promise.resolve({ id: contactId, reportId }) };

describe("CRM report access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.demo.mockReturnValue(false);
    mocks.purgeStarted.mockResolvedValue(false);
    mocks.auth.mockResolvedValue({ user: { sub: "crm-user", crmRole: "readonly" }, response: null });
    mocks.createClient.mockResolvedValue({ from: mocks.from });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({ data: { id: contactId }, error: null });
    mocks.list.mockResolvedValue([receipt]);
    mocks.read.mockResolvedValue({ bytes: new TextEncoder().encode("%PDF-1.7\nexample"), fileName: "My report.pdf" });
  });

  it.each([listReports, downloadReport])("blocks anonymous requests before querying contacts or storage", async (handler) => {
    mocks.auth.mockResolvedValue({ user: null, response: Response.json({ error: "Authentication required." }, { status: 401 }) });
    const response = await handler(request, context);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.auth).toHaveBeenCalledWith(request, "read");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it.each([listReports, downloadReport])("does not accept the demo's synthetic administrator", async (handler) => {
    mocks.demo.mockReturnValue(true);
    expect((await handler(request, context)).status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it.each([listReports, downloadReport])("blocks deleted or RLS-inaccessible contacts before private storage", async (handler) => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await handler(request, context)).status).toBe(404);
    expect(mocks.from).toHaveBeenCalledWith("contacts");
    expect(mocks.eq).toHaveBeenCalledWith("id", contactId);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it.each([listReports, downloadReport])("fails closed when contact authorization cannot be checked", async (handler) => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "private database details" } });
    const response = await handler(request, context);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database");
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("lists only public receipt fields for the authorized contact", async () => {
    mocks.list.mockResolvedValue([{ ...receipt, objectPath: "private/storage/path", tokenHash: "secret" }]);
    const response = await listReports(request, context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reports: [receipt] });
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(mocks.list).toHaveBeenCalledWith(contactId);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it.each([listReports, downloadReport])("blocks access as soon as permanent deletion starts", async (handler) => {
    mocks.purgeStarted.mockResolvedValue(true);
    expect((await handler(request, context)).status).toBe(409);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("scopes downloads to the contact and forces a safe PDF attachment", async () => {
    mocks.read.mockResolvedValue({ bytes: new TextEncoder().encode("%PDF-1.7\nexample"), fileName: "../folder/report\"\r\nX-Test: injection.pdf" });
    const response = await downloadReport(request, context);
    expect(response.status).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith(contactId, reportId);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="report___X-Test_ injection.pdf"');
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(await response.text()).toBe("%PDF-1.7\nexample");
  });

  it("returns 404 when a report is missing or belongs to another contact", async () => {
    mocks.read.mockResolvedValue(null);
    const response = await downloadReport(request, context);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Report not found." });
  });

  it("does not send malformed path identifiers to the database or storage", async () => {
    expect((await listReports(request, { params: Promise.resolve({ id: "../other" }) })).status).toBe(404);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect((await downloadReport(request, { params: Promise.resolve({ id: contactId, reportId: "../../private" }) })).status).toBe(404);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("returns a generic failure when storage is unavailable", async () => {
    mocks.read.mockRejectedValue(new Error("secret storage URL"));
    const response = await downloadReport(request, context);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret storage");
    expect(response.headers.get("content-disposition")).toBeNull();
  });
});
