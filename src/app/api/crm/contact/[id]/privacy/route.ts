import { NextResponse } from "next/server";

import { recordAdminAudit } from "@/lib/audit";
import { requireCrmApiUser } from "@/lib/auth";
import { exportContactData, getContactPrivacyState, purgeContact, setContactSuppression } from "@/lib/contact-privacy";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiUser(request, "admin");
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const data = await exportContactData(id);
  if (!data) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  await recordAdminAudit({ actorId: String(auth.user.sub), action: "contact.privacy_export", entityType: "contact", entityId: id });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vance-contact-${id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiUser(request, "admin-write");
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  let body: { action?: unknown; confirmation?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  if (body.action === "suppress" || body.action === "unsuppress") {
    const before = await getContactPrivacyState(id);
    if (!before) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    const suppressed = body.action === "suppress";
    await setContactSuppression(id, suppressed);
    await recordAdminAudit({
      actorId: String(auth.user.sub),
      action: suppressed ? "contact.suppress" : "contact.unsuppress",
      entityType: "contact",
      entityId: id,
      beforeState: { suppressed: before.suppressed },
      afterState: { suppressed },
    });
    return NextResponse.json({ ok: true, suppressed });
  }

  if (body.action === "purge") {
    if (body.confirmation !== "DELETE CONTACT") {
      return NextResponse.json({ error: "Type DELETE CONTACT to confirm permanent deletion." }, { status: 400 });
    }
    const deleted = await purgeContact(id);
    if (!deleted) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    await recordAdminAudit({
      actorId: String(auth.user.sub),
      action: "contact.permanent_delete",
      entityType: "contact",
      entityId: id,
      afterState: { permanentlyDeleted: true },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown privacy action." }, { status: 400 });
}
