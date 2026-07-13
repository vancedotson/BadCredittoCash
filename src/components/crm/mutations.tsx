"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAGES_IN_ORDER, STAGE_LABELS } from "@/lib/stages";
import type { Stage } from "@/lib/stages";
import type { Task } from "@/lib/store";
import { CheckIcon } from "@/components/marketing-v2/Icons";

const inputClass =
  "rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none transition-colors placeholder:text-slate/60 focus:border-trust";

async function api(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

/** Stage dropdown — PATCHes the contact and refreshes the server view. */
export function StageSelect({ id, stage, compact = false }: { id: string; stage: Stage; compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <select
      value={stage}
      disabled={pending}
      onChange={async (e) => {
        setPending(true);
        try {
          await api(`/api/crm/contact/${id}`, "PATCH", { stage: e.target.value });
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
      className={`${inputClass} ${compact ? "py-1 text-xs" : ""} ${pending ? "opacity-60" : ""}`}
      aria-label="Pipeline stage"
    >
      {STAGES_IN_ORDER.map((s) => (
        <option key={s} value={s}>{STAGE_LABELS[s]}</option>
      ))}
    </select>
  );
}

/** Add-note textarea. */
export function AddNoteForm({ email }: { email: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!value.trim()) return;
        setPending(true);
        try {
          await api("/api/crm/note", "POST", { email, body: value.trim() });
          setValue("");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
      className="space-y-2"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a note…"
        rows={2}
        className={`${inputClass} w-full resize-none`}
      />
      <button
        type="submit"
        disabled={pending || !value.trim()}
        className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-gold-deep disabled:opacity-50"
      >
        {pending ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}

/** Add-task row (title + optional due date). */
export function AddTaskForm({ email }: { email: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setPending(true);
        try {
          await api("/api/crm/task", "POST", {
            email,
            title: title.trim(),
            dueDate: due ? new Date(due).toISOString() : undefined,
          });
          setTitle("");
          setDue("");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
      className="flex flex-wrap gap-2"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task…"
        className={`${inputClass} min-w-[160px] flex-1`}
      />
      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} aria-label="Due date" />
      <button
        type="submit"
        disabled={pending || !title.trim()}
        className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-gold-deep disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}

/** A task with a toggle checkbox. `showContact` renders the contact name (tasks page). */
export function TaskItem({
  task,
  contactName,
  href,
  overdue = false,
}: {
  task: Task;
  contactName?: string;
  href?: string;
  overdue?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const due = task.dueDate ? new Date(task.dueDate) : null;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        aria-label={task.done ? "Mark not done" : "Mark done"}
        onClick={async () => {
          setPending(true);
          try {
            await api("/api/crm/task", "PATCH", { id: task.id });
            router.refresh();
          } finally {
            setPending(false);
          }
        }}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
          task.done ? "border-green bg-green text-white" : "border-mist bg-card text-transparent hover:border-trust"
        }`}
      >
        <CheckIcon className="h-3 w-3" />
      </button>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm ${task.done ? "text-slate line-through" : "text-body"}`}>{task.title}</div>
        {(contactName || due) && (
          <div className="text-xs text-slate">
            {contactName ? <>{href ? <a href={href} className="hover:text-trust hover:underline">{contactName}</a> : contactName}</> : null}
            {contactName && due ? " · " : null}
            {due ? (
              <span className={overdue ? "text-red" : ""}>
                {overdue ? "Overdue " : "Due "}
                {due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
