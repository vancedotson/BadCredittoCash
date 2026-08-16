import { NextResponse } from "next/server";
import { requireCrmApiUser } from "@/lib/auth";
import { changeTeamMemberRole, inviteTeamMember, listTeamMembers, revokeTeamMember, type CrmRole } from "@/lib/team-access";
import { recordAdminAudit } from "@/lib/audit";

const ROLES: CrmRole[] = ["admin", "staff", "readonly"];
const validRole = (value: unknown): value is CrmRole => typeof value === "string" && ROLES.includes(value as CrmRole);

export async function POST(request: Request) {
  const auth = await requireCrmApiUser(request, "admin-write");
  if (auth.response) return auth.response;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "invite") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName || !validRole(body.role)) return NextResponse.json({ error: "Name, valid email, and role are required." }, { status: 400 });
    const member = await inviteTeamMember(email, displayName, body.role);
    await recordAdminAudit({ actorId: String(auth.user.sub), action: "team.invite", entityType: "crm_user", entityId: member.userId, afterState: { email, displayName, role: body.role } });
    return NextResponse.json({ ok: true, member });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return NextResponse.json({ error: "Team member is required." }, { status: 400 });
  const members = await listTeamMembers();
  const target = members.find((member) => member.userId === userId);
  if (!target) return NextResponse.json({ error: "Team member was not found." }, { status: 404 });
  if (userId === String(auth.user.sub)) return NextResponse.json({ error: "You cannot change or revoke your own access." }, { status: 400 });

  if (action === "role" && validRole(body.role)) {
    if (target.role === "admin" && body.role !== "admin" && members.filter((member) => member.role === "admin").length <= 1) return NextResponse.json({ error: "Keep at least one administrator." }, { status: 400 });
    await changeTeamMemberRole(userId, body.role);
    await recordAdminAudit({ actorId: String(auth.user.sub), action: "team.role", entityType: "crm_user", entityId: userId, beforeState: { role: target.role }, afterState: { role: body.role } });
    return NextResponse.json({ ok: true });
  }
  if (action === "revoke") {
    if (target.role === "admin" && members.filter((member) => member.role === "admin").length <= 1) return NextResponse.json({ error: "Keep at least one administrator." }, { status: 400 });
    await recordAdminAudit({ actorId: String(auth.user.sub), action: "team.revoke", entityType: "crm_user", entityId: userId, beforeState: { email: target.email, role: target.role } });
    await revokeTeamMember(userId);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown team action." }, { status: 400 });
}
