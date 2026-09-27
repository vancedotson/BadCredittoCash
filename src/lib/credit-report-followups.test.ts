import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), demo: vi.fn(), team: vi.fn() }));
vi.mock("./supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("./demo", () => ({ isCrmDemoMode: mocks.demo }));
vi.mock("./team-access", () => ({ listTeamMembers: mocks.team }));

import {
  assignCreditReportFollowup,
  getCreditReportFollowups,
  recordCreditReportFollowupContact,
} from "./credit-report-followups";

const obligationId = "c8f29a0f-0585-4b02-a5fc-e9bf2db660a5";
const actorId = "dc76c552-e1d0-49f7-8242-cb458bdb729b";
const assigneeId = "2c643ffc-7a08-43e1-b04d-1261a9dd7ca6";

describe("credit-report follow-up persistence adapter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.demo.mockReturnValue(false);
    mocks.team.mockResolvedValue([{ userId: "local-design-review", displayName: "Vance", role: "admin", status: "active" }]);
    mocks.rpc.mockResolvedValue({ data: true, error: null });
  });

  it("loads the private queue and eligible team members from read-only RPCs", async () => {
    const queue = { items: [{ id: obligationId, state: "open", receipts: [], attempts: [] }] };
    const assignees = [{ id: assigneeId, name: "Primary", role: "staff" }];
    mocks.rpc.mockResolvedValueOnce({ data: queue, error: null }).mockResolvedValueOnce({ data: assignees, error: null });
    await expect(getCreditReportFollowups()).resolves.toEqual({ items: queue.items, assignees });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "list_credit_report_followups_v1");
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "list_credit_report_followup_assignees_v1");
  });

  it("uses a single audited database operation for assignment", async () => {
    await assignCreditReportFollowup(obligationId, assigneeId, actorId);
    expect(mocks.rpc).toHaveBeenCalledWith("assign_credit_report_followup_v1", {
      p_obligation_id: obligationId, p_assignee_id: assigneeId, p_actor_id: actorId,
    });
  });

  it("persists actual contact time, channel, and outcome in one operation", async () => {
    mocks.rpc.mockResolvedValue({ data: "a6744e3a-9849-486c-85f6-4d667cf21b43", error: null });
    await recordCreditReportFollowupContact({
      obligationId, actorId, contactedAt: "2026-09-27T12:30:00.000Z", channel: "phone", outcome: "left_message",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("record_credit_report_followup_contact_v1", {
      p_obligation_id: obligationId, p_actor_id: actorId, p_contacted_at: "2026-09-27T12:30:00.000Z",
      p_channel: "phone", p_outcome: "left_message",
    });
  });

  it("keeps demo CRM isolated from live follow-up data", async () => {
    mocks.demo.mockReturnValue(true);
    await expect(getCreditReportFollowups()).resolves.toEqual({ items: [], assignees: [{ id: "local-design-review", name: "Vance", role: "admin" }] });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
