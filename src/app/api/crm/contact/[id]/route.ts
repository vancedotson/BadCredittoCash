import { NextResponse } from "next/server";
import { ContactConflictError, getLeadById, updateLead, type Lead } from "@/lib/store";
import { STAGES_IN_ORDER, type Stage } from "@/lib/stages";
import { requireCrmApiUser } from "@/lib/auth";
import { recordAdminAudit } from "@/lib/audit";

/**
 * PATCH /api/crm/contact/[id] — update a contact's CRM fields (stage, owner,
 * tags, name, phone). Called by the client CRM components; they router.refresh()
 * after to re-pull the server-rendered views.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiUser(request, "write");
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const patch: Partial<Pick<Lead, "stage" | "owner" | "tags" | "name" | "phone" | "lostReason">> = {};
  if (typeof body.stage === "string" && STAGES_IN_ORDER.includes(body.stage as Stage)) {
    patch.stage = body.stage as Stage;
  }
  if (typeof body.owner === "string") patch.owner = body.owner.trim() || undefined;
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.phone === "string") patch.phone = body.phone.trim() || undefined;
  if (typeof body.lostReason === "string") patch.lostReason = body.lostReason.trim() || undefined;
  if (Array.isArray(body.tags)) patch.tags = body.tags.filter((t) => typeof t === "string") as string[];
  const expectedUpdatedAt = typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : "";

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const before = await getLeadById(id);
  let lead;
  try {
    lead = await updateLead(id, patch, expectedUpdatedAt);
  } catch (error) {
    if (error instanceof ContactConflictError) {
      return NextResponse.json({ error: error.message, code: "contact_conflict" }, { status: 409 });
    }
    throw error;
  }
  if (!lead) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  await recordAdminAudit({
    actorId: String(auth.user.sub),
    action: "contact.update",
    entityType: "contact",
    entityId: id,
    beforeState: before ? { name: before.name, stage: before.stage, owner: before.owner, tags: before.tags, phone: before.phone, lostReason: before.lostReason } : undefined,
    afterState: { name: lead.name, stage: lead.stage, owner: lead.owner, tags: lead.tags, phone: lead.phone, lostReason: lead.lostReason },
  });
  return NextResponse.json({ ok: true, lead });
}
