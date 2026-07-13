import { NextResponse } from "next/server";
import { addTask, updateTask, toggleTask, deleteTask } from "@/lib/store";
import { isTaskPriority, isTaskType, isRecurrence } from "@/lib/tasks";

/** POST /api/crm/task — add a task (keyed by contact email). */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!email || !title) return NextResponse.json({ error: "email and title are required." }, { status: 400 });

  const task = await addTask(email, {
    title,
    dueDate: typeof body.dueDate === "string" && body.dueDate ? body.dueDate : undefined,
    priority: isTaskPriority(body.priority) ? body.priority : undefined,
    type: isTaskType(body.type) ? body.type : undefined,
    owner: typeof body.owner === "string" ? body.owner.trim() || undefined : undefined,
    notes: typeof body.notes === "string" ? body.notes.trim() || undefined : undefined,
    recurrence: isRecurrence(body.recurrence) ? body.recurrence : undefined,
  });
  return NextResponse.json({ ok: true, task });
}

/**
 * PATCH /api/crm/task — toggle done ({ id } only), or edit/reschedule
 * ({ id, ...fields }: title, dueDate, priority, type, owner, notes, recurrence, done).
 */
export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (typeof body.dueDate === "string") patch.dueDate = body.dueDate || undefined;
  if (isTaskPriority(body.priority)) patch.priority = body.priority;
  if (isTaskType(body.type)) patch.type = body.type;
  if (typeof body.owner === "string") patch.owner = body.owner.trim() || undefined;
  if (typeof body.notes === "string") patch.notes = body.notes.trim() || undefined;
  if (isRecurrence(body.recurrence)) patch.recurrence = body.recurrence;
  if (typeof body.done === "boolean") patch.done = body.done;

  const task =
    Object.keys(patch).length === 0
      ? await toggleTask(id)
      : await updateTask(id, patch as Parameters<typeof updateTask>[1]);
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  return NextResponse.json({ ok: true, task });
}

/** DELETE /api/crm/task — remove a task ({ id }). */
export async function DELETE(request: Request) {
  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  const ok = await deleteTask(body.id);
  if (!ok) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
