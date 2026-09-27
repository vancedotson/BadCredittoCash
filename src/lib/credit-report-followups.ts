import "server-only";

import { createAdminClient } from "./supabase/admin";
import { isCrmDemoMode } from "./demo";
import { listTeamMembers } from "./team-access";

export type CreditReportFollowupReceipt = { bureau: string; uploadedAt: string; dueAt: string };
export type CreditReportFollowupAttempt = {
  actorName: string;
  contactedAt: string;
  channel: "phone" | "email" | "other";
  outcome: "reached" | "no_answer" | "left_message" | "other";
  recordedAt: string;
};
export type CreditReportFollowup = {
  id: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  state: "open" | "completed";
  dueAt: string;
  assignedTo: string | null;
  assignedName: string | null;
  createdAt: string;
  completedAt: string | null;
  receipts: CreditReportFollowupReceipt[];
  attempts: CreditReportFollowupAttempt[];
};
export type CreditReportFollowupAssignee = { id: string; name: string; role: "admin" | "staff" };

function fail(message: string): never { throw new Error(message); }

export async function getCreditReportFollowups(): Promise<{
  items: CreditReportFollowup[];
  assignees: CreditReportFollowupAssignee[];
}> {
  if (isCrmDemoMode()) {
    const team = await listTeamMembers();
    return {
      items: [],
      assignees: team.filter((member) => member.status === "active" && member.role !== "readonly")
        .map((member) => ({ id: member.userId, name: member.displayName, role: member.role as "admin" | "staff" })),
    };
  }
  const admin = createAdminClient();
  const [{ data: queue, error: queueError }, { data: users, error: usersError }] = await Promise.all([
    admin.rpc("list_credit_report_followups_v1"),
    admin.rpc("list_credit_report_followup_assignees_v1"),
  ]);
  if (queueError || usersError) return fail("The private follow-up queue is unavailable.");
  const itemRows = queue && typeof queue === "object" && "items" in queue && Array.isArray(queue.items) ? queue.items : null;
  if (!itemRows || !Array.isArray(users)) return fail("The private follow-up queue returned invalid data.");
  return {
    items: itemRows as CreditReportFollowup[],
    assignees: users as CreditReportFollowupAssignee[],
  };
}

export async function assignCreditReportFollowup(obligationId: string, assigneeId: string | null, actorId: string): Promise<void> {
  if (isCrmDemoMode()) return fail("The follow-up queue is unavailable in demo mode.");
  const { data, error } = await createAdminClient().rpc("assign_credit_report_followup_v1", {
    p_obligation_id: obligationId,
    p_assignee_id: assigneeId,
    p_actor_id: actorId,
  });
  if (error || data !== true) return fail("The follow-up assignment could not be saved.");
}

export async function recordCreditReportFollowupContact(input: {
  obligationId: string;
  actorId: string;
  contactedAt: string;
  channel: "phone" | "email" | "other";
  outcome: "reached" | "no_answer" | "left_message" | "other";
}): Promise<void> {
  if (isCrmDemoMode()) return fail("The follow-up queue is unavailable in demo mode.");
  const { data, error } = await createAdminClient().rpc("record_credit_report_followup_contact_v1", {
    p_obligation_id: input.obligationId,
    p_actor_id: input.actorId,
    p_contacted_at: input.contactedAt,
    p_channel: input.channel,
    p_outcome: input.outcome,
  });
  if (error || typeof data !== "string") return fail("The contact outcome could not be recorded.");
}
