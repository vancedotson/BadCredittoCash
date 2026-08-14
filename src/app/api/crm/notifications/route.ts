import { NextResponse } from "next/server";

import { requireCrmApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireCrmApiUser(request, "personal-write");
  if (auth.response) return auth.response;

  let body: { id?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action === "read" || body.action === "dismiss" ? body.action : null;
  if (!id || !action) return NextResponse.json({ error: "Notification and action are required." }, { status: 400 });

  const supabase = await createClient();
  const values = action === "read"
    ? { read_at: new Date().toISOString() }
    : { dismissed_at: new Date().toISOString(), read_at: new Date().toISOString() };
  const { error } = await supabase.from("crm_notifications").update(values).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
