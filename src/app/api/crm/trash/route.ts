import { NextResponse } from "next/server";
import { requireCrmApiUser } from "@/lib/auth";
import { recordAdminAudit } from "@/lib/audit";
import { restoreContact } from "@/lib/store";

export async function POST(request: Request) {
  const auth = await requireCrmApiUser(request, "admin");
  if (auth.response) return auth.response;
  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Contact id is required." }, { status: 400 });
  }
  try {
    const contact = await restoreContact(body.id);
    await recordAdminAudit({
      actorId: String(auth.user.sub),
      action: "contact.restore",
      entityType: "contact",
      entityId: contact.id,
      afterState: { name: contact.name, email: contact.email, restoredFromTrash: true },
    });
    return NextResponse.json({ ok: true, contact });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not restore contact." }, { status: 409 });
  }
}
