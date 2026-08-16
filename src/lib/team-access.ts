import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isCrmDemoMode } from "@/lib/demo";

export type CrmRole = "admin" | "staff" | "readonly";
export type TeamMember = { userId: string; email: string; displayName: string; role: CrmRole; status: "active" | "invited" };

const demoMembers: TeamMember[] = [
  { userId: "local-design-review", email: "vance@example.com", displayName: "Vance", role: "admin", status: "active" },
  { userId: "demo-team-member", email: "team@example.com", displayName: "Team", role: "staff", status: "invited" },
];

export async function listTeamMembers(): Promise<TeamMember[]> {
  if (isCrmDemoMode()) return [...demoMembers];
  const admin = createAdminClient();
  const [{ data: memberships, error }, authResult] = await Promise.all([
    admin.from("crm_users").select("user_id, role, display_name").order("created_at"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (error) throw new Error(error.message);
  if (authResult.error) throw new Error(authResult.error.message);
  const users = new Map(authResult.data.users.map((user) => [user.id, user]));
  return (memberships ?? []).flatMap((membership) => {
    const user = users.get(membership.user_id);
    if (!user?.email) return [];
    return [{ userId: user.id, email: user.email, displayName: membership.display_name ?? user.email, role: membership.role as CrmRole, status: user.email_confirmed_at ? "active" as const : "invited" as const }];
  });
}

export async function inviteTeamMember(email: string, displayName: string, role: CrmRole): Promise<TeamMember> {
  if (isCrmDemoMode()) {
    const member = { userId: `demo-${email}`, email, displayName, role, status: "invited" as const };
    demoMembers.push(member); return member;
  }
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { display_name: displayName } });
  if (error || !data.user) throw new Error(error?.message ?? "The invitation could not be created.");
  const { error: membershipError } = await admin.from("crm_users").upsert({ user_id: data.user.id, display_name: displayName, role });
  if (membershipError) throw new Error(membershipError.message);
  return { userId: data.user.id, email, displayName, role, status: "invited" };
}

export async function changeTeamMemberRole(userId: string, role: CrmRole): Promise<void> {
  if (isCrmDemoMode()) { const member = demoMembers.find((item) => item.userId === userId); if (member) member.role = role; return; }
  const admin = createAdminClient();
  const { error } = await admin.from("crm_users").update({ role }).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function revokeTeamMember(userId: string): Promise<void> {
  if (isCrmDemoMode()) { const index = demoMembers.findIndex((item) => item.userId === userId); if (index >= 0) demoMembers.splice(index, 1); return; }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}
