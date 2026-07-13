import { NextResponse } from "next/server";
import { addTask, toggleTask } from "@/lib/store";

/** POST /api/crm/task — add a task to a contact (keyed by email). */
export async function POST(request: Request) {
  let body: { email?: string; title?: string; dueDate?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const email = body.email?.trim();
  const title = body.title?.trim();
  if (!email || !title) {
    return NextResponse.json({ error: "email and title are required." }, { status: 400 });
  }
  const task = await addTask(email, title, body.dueDate?.trim() || undefined);
  return NextResponse.json({ ok: true, task });
}

/** PATCH /api/crm/task — toggle a task's done state. */
export async function PATCH(request: Request) {
  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  const task = await toggleTask(body.id);
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  return NextResponse.json({ ok: true, task });
}
