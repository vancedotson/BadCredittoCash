import { NextResponse } from "next/server";
import { updateLead, addTask, addTagToContact, deleteContact, getLeadById } from "@/lib/store";
import { STAGES_IN_ORDER, type Stage } from "@/lib/stages";

/**
 * POST /api/crm/contacts/bulk — apply an action to many contacts at once.
 * body: { ids: string[], action: "stage"|"owner"|"tag"|"task"|"delete", value?: string }
 */
export async function POST(request: Request) {
  let body: { ids?: unknown; action?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  const action = typeof body.action === "string" ? body.action : "";
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!ids.length || !action) return NextResponse.json({ error: "ids and action are required." }, { status: 400 });

  let affected = 0;
  for (const id of ids) {
    if (action === "stage" && STAGES_IN_ORDER.includes(value as Stage)) {
      if (await updateLead(id, { stage: value as Stage })) affected++;
    } else if (action === "owner") {
      if (await updateLead(id, { owner: value || undefined })) affected++;
    } else if (action === "tag" && value) {
      if (await addTagToContact(id, value)) affected++;
    } else if (action === "task" && value) {
      const l = await getLeadById(id);
      if (l) { await addTask(l.email, { title: value }); affected++; }
    } else if (action === "delete") {
      if (await deleteContact(id)) affected++;
    }
  }
  return NextResponse.json({ ok: true, affected });
}
