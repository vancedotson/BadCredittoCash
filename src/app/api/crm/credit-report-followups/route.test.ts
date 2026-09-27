import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), assign: vi.fn(), record: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireCrmApiUser: mocks.auth }));
vi.mock("@/lib/credit-report-followups", () => ({
  getCreditReportFollowups: mocks.list,
  assignCreditReportFollowup: mocks.assign,
  recordCreditReportFollowupContact: mocks.record,
}));

import { GET, PATCH, POST } from "./route";

const obligationId = "c8f29a0f-0585-4b02-a5fc-e9bf2db660a5";
const actorId = "dc76c552-e1d0-49f7-8242-cb458bdb729b";
const contactId = "ef4a6410-8716-495e-b3be-70a54c8e1598";
const origin = "https://crm.example.test";

function jsonRequest(method: string, body?: unknown) {
  return new Request(`${origin}/api/crm/credit-report-followups`, {
    method,
    headers: { origin, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("private credit-report follow-up API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { sub: actorId, crmRole: "staff" }, response: null });
    mocks.list.mockResolvedValue({ items: [{ id: obligationId, contactId, receipts: [] }], assignees: [] });
    mocks.assign.mockResolvedValue(undefined);
    mocks.record.mockResolvedValue(undefined);
  });

  it("requires CRM access and marks private queue responses no-store", async () => {
    mocks.auth.mockResolvedValue({ user: null, response: Response.json({ error: "Authentication required." }, { status: 401 }) });
    const response = await GET(jsonRequest("GET"));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("lists queue data for an authenticated CRM user", async () => {
    const response = await GET(jsonRequest("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: [{ id: obligationId }] });
    expect(mocks.list).toHaveBeenCalledOnce();
  });

  it("records an audited assignment under the authenticated actor", async () => {
    const assigneeId = "2c643ffc-7a08-43e1-b04d-1261a9dd7ca6";
    const response = await PATCH(jsonRequest("PATCH", { id: obligationId, assigneeId }));
    expect(response.status).toBe(200);
    expect(mocks.assign).toHaveBeenCalledWith(obligationId, assigneeId, actorId);
  });

  it("rejects malformed assignment ids before reaching the database", async () => {
    const response = await PATCH(jsonRequest("PATCH", { id: "bad-id", assigneeId: null }));
    expect(response.status).toBe(400);
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it("records actual contact time, channel, and outcome", async () => {
    const response = await POST(jsonRequest("POST", {
      id: obligationId, contactedAt: "2026-09-27T12:30:00.000Z", channel: "phone", outcome: "no_answer",
    }));
    expect(response.status).toBe(200);
    expect(mocks.record).toHaveBeenCalledWith({
      obligationId, actorId, contactedAt: "2026-09-27T12:30:00.000Z", channel: "phone", outcome: "no_answer",
    });
  });

  it("rejects unsupported outcomes", async () => {
    const response = await POST(jsonRequest("POST", {
      id: obligationId, contactedAt: "2026-09-27T12:30:00.000Z", channel: "phone", outcome: "sent_email",
    }));
    expect(response.status).toBe(400);
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
