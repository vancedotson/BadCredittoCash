import { NextResponse } from "next/server";
import { addNote } from "@/lib/store";

/** POST /api/crm/note — add a note to a contact (keyed by email). */
export async function POST(request: Request) {
  let body: { email?: string; body?: string; author?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const email = body.email?.trim();
  const text = body.body?.trim();
  if (!email || !text) {
    return NextResponse.json({ error: "email and body are required." }, { status: 400 });
  }
  const note = await addNote(email, text, body.author?.trim() || "You");
  return NextResponse.json({ ok: true, note });
}
