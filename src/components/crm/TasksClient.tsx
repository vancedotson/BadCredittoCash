"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { TaskWithContact, ContactOption } from "@/lib/store";
import {
  PRIORITIES, PRIORITY_LABELS, PRIORITY_RANK, PRIORITY_DOT,
  TASK_TYPES, TYPE_LABELS, TYPE_ICON, RECURRENCES, RECURRENCE_LABELS,
  type TaskPriority, type TaskType, type Recurrence,
} from "@/lib/tasks";
import { PhoneIcon, BellIcon, RefreshIcon, DocumentIcon, CheckIcon } from "@/components/marketing-v2/Icons";

const inputClass = "rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none transition-colors placeholder:text-slate focus:border-trust";
const DAY = 86400000;

async function api(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const payload = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? "The server could not complete this task action.");
  }
  return res.json();
}

function todayStart(): number { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(); }

type Bucket = "overdue" | "today" | "upcoming";
function dueInfo(dueDate?: string): { text: string; tone: "red" | "warn" | "neutral"; bucket: Bucket } {
  if (!dueDate) return { text: "No date", tone: "neutral", bucket: "upcoming" };
  const d = new Date(dueDate);
  const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((ds - todayStart()) / DAY);
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  const time = hasTime ? " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
  if (diff < 0) return { text: `${-diff}d overdue`, tone: "red", bucket: "overdue" };
  if (diff === 0) return { text: "Today" + time, tone: "warn", bucket: "today" };
  if (diff === 1) return { text: "Tomorrow" + time, tone: "neutral", bucket: "upcoming" };
  return { text: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + time, tone: "neutral", bucket: "upcoming" };
}
function dueToneClass(t: "red" | "warn" | "neutral") { return t === "red" ? "text-red" : t === "warn" ? "text-gold-deep" : "text-slate"; }
function toDateInput(iso?: string) { if (!iso) return ""; const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function toTimeInput(iso?: string) { if (!iso) return ""; const d = new Date(iso); if (d.getHours() === 0 && d.getMinutes() === 0) return ""; return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }

function TypeIcon({ type, className = "h-4 w-4" }: { type?: TaskType; className?: string }) {
  const key = TYPE_ICON[type ?? "other"];
  const C = key === "phone" ? PhoneIcon : key === "mail" ? BellIcon : key === "refresh" ? RefreshIcon : key === "document" ? DocumentIcon : CheckIcon;
  return <C className={className} />;
}

// ---------------------------------------------------------------------------

export function TasksClient({ tasks, contacts, owners }: { tasks: TaskWithContact[]; contacts: ContactOption[]; owners: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [ownerF, setOwnerF] = useState("");
  const [prioF, setPrioF] = useState("");
  const [typeF, setTypeF] = useState("");
  const [view, setView] = useState<"due" | "today" | "contact">("due");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const [modal, setModal] = useState<{ mode: "add" | "edit"; task?: TaskWithContact } | null>(null);
  const [actionError, setActionError] = useState<{ message: string; retry: () => void } | null>(null);

  function reportActionError(caught: unknown, retry: () => void) {
    setActionError({
      message: caught instanceof Error ? caught.message : "The task could not be updated.",
      retry,
    });
  }

  const filtered = useMemo(() => {
    let list = tasks;
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((t) => t.title.toLowerCase().includes(s) || t.contactName.toLowerCase().includes(s));
    if (ownerF) list = list.filter((t) => (ownerF === "__none__" ? !t.owner : t.owner === ownerF));
    if (prioF) list = list.filter((t) => (t.priority ?? "normal") === prioF);
    if (typeF) list = list.filter((t) => (t.type ?? "follow_up") === typeF);
    return list;
  }, [tasks, q, ownerF, prioF, typeF]);

  const sortSmart = (a: TaskWithContact, b: TaskWithContact) =>
    PRIORITY_RANK[a.priority ?? "normal"] - PRIORITY_RANK[b.priority ?? "normal"] ||
    (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");

  const open = filtered.filter((t) => !t.done);
  const done = filtered.filter((t) => t.done).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const bucketOf = (t: TaskWithContact) => dueInfo(t.dueDate).bucket;
  const overdue = open.filter((t) => bucketOf(t) === "overdue").sort(sortSmart);
  const dueToday = open.filter((t) => bucketOf(t) === "today").sort(sortSmart);
  const upcoming = open.filter((t) => bucketOf(t) === "upcoming").sort(sortSmart);

  // mutations
  async function toggle(id: string) {
    setActionError(null);
    try {
      await api("/api/crm/task", "PATCH", { id });
      router.refresh();
    } catch (caught) {
      reportActionError(caught, () => void toggle(id));
    }
  }
  async function del(id: string) {
    if (!window.confirm("Permanently delete this task? This cannot be undone.")) return;
    setActionError(null);
    try {
      await api("/api/crm/task", "DELETE", { id, confirm: "DELETE" });
      router.refresh();
    } catch (caught) {
      reportActionError(caught, () => void del(id));
    }
  }
  async function snooze(ids: string[], days: number) {
    setActionError(null);
    try {
      const base = new Date(todayStart() + days * DAY);
      const iso = base.toISOString();
      await Promise.all(ids.map((id) => api("/api/crm/task", "PATCH", { id, dueDate: iso })));
      setSelected(new Set()); router.refresh();
    } catch (caught) {
      reportActionError(caught, () => void snooze(ids, days));
    }
  }
  async function complete(ids: string[]) {
    setActionError(null);
    try {
      await Promise.all(ids.map((id) => api("/api/crm/task", "PATCH", { id, done: true })));
      setSelected(new Set()); router.refresh();
    } catch (caught) {
      reportActionError(caught, () => void complete(ids));
    }
  }
  async function delMany(ids: string[]) {
    if (!ids.length || !window.confirm(
      `Permanently delete ${ids.length} task${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
    )) return;
    setActionError(null);
    try {
      await Promise.all(ids.map((id) => api("/api/crm/task", "DELETE", { id, confirm: "DELETE" })));
      setSelected(new Set());
      router.refresh();
    } catch (caught) {
      reportActionError(caught, () => void delMany(ids));
    }
  }

  function toggleSel(id: string) { setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  const rowProps = { selected, onSelect: toggleSel, onToggle: toggle, onEdit: (t: TaskWithContact) => setModal({ mode: "edit", task: t }), onDelete: del, onSnooze: (id: string, d: number) => snooze([id], d) };

  const renderGroup = (title: string, tone: string, items: TaskWithContact[], collapsible = false) => {
    const hidden = collapsible && !showDone;
    return (
      <div className="rounded-2xl border border-mist bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <h2 className={`text-lg font-semibold ${tone}`}>{title}</h2>
          <span className="rounded-full bg-mist/70 px-2 py-0.5 text-xs font-medium tabular-nums text-slate">{items.length}</span>
          {collapsible ? (
            <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={!hidden} className="ml-auto text-sm text-trust hover:underline">{hidden ? "Show" : "Hide"}</button>
          ) : null}
        </div>
        {hidden ? null : (
          <ul className="space-y-2">
            {items.length === 0 ? <li className="text-sm text-slate">Nothing here.</li> : items.map((t) => <li key={t.id}><TaskRow task={t} {...rowProps} /></li>)}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {actionError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red/30 bg-red/5 px-4 py-3 text-sm text-red">
          <span className="flex-1">{actionError.message} No task changes were hidden.</span>
          <button type="button" onClick={actionError.retry} className="rounded-lg border border-red/30 bg-card px-3 py-1.5 font-semibold hover:bg-cloud">Try again</button>
          <button type="button" onClick={() => setActionError(null)} className="px-1" aria-label="Dismiss task error">×</button>
        </div>
      ) : null}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks or contacts…" aria-label="Search tasks" className={`${inputClass} min-w-[180px] flex-1`} />
        <select value={ownerF} onChange={(e) => setOwnerF(e.target.value)} className={inputClass} aria-label="Owner">
          <option value="">All owners</option><option value="__none__">Unassigned</option>
          {owners.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={prioF} onChange={(e) => setPrioF(e.target.value)} className={inputClass} aria-label="Priority">
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </select>
        <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className={inputClass} aria-label="Type">
          <option value="">All types</option>
          {TASK_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <div className="flex rounded-lg border border-mist bg-card p-0.5 text-sm">
          {(["due", "today", "contact"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`rounded-md px-2.5 py-1.5 capitalize ${view === v ? "bg-navy text-white" : "text-slate"}`}>
              {v === "due" ? "By due" : v === "today" ? "Today" : "By contact"}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setModal({ mode: "add" })} className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-gold-deep">+ Add task</button>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-mist bg-sky px-4 py-2.5 text-sm">
          <span className="font-medium text-trust">{selected.size} selected</span>
          <button type="button" onClick={() => complete([...selected])} className="rounded-lg bg-green px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">Complete</button>
          <button type="button" onClick={() => snooze([...selected], 1)} className="rounded-lg border border-mist bg-card px-3 py-1.5 text-xs text-body hover:bg-cloud">Snooze → tomorrow</button>
          <button type="button" onClick={() => delMany([...selected])} className="rounded-lg border border-mist bg-card px-3 py-1.5 text-xs text-red hover:bg-cloud">Delete</button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-slate hover:text-heading">Clear</button>
        </div>
      ) : null}

      {/* Views */}
      {view === "due" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {renderGroup("Overdue", "text-red", overdue)}
          {renderGroup("Due today", "text-heading", dueToday)}
          {renderGroup("Upcoming", "text-heading", upcoming)}
          {renderGroup("Done", "text-slate", done, true)}
        </div>
      ) : view === "today" ? (
        <div className="max-w-2xl">
          {renderGroup("Today & overdue", "text-heading", [...overdue, ...dueToday])}
        </div>
      ) : (
        <ByContact tasks={open.sort(sortSmart)} rowProps={rowProps} />
      )}

      {modal ? <TaskModal mode={modal.mode} task={modal.task} contacts={contacts} owners={owners} onClose={() => setModal(null)} onSaved={() => { setModal(null); router.refresh(); }} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

type RowProps = {
  selected: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onEdit: (t: TaskWithContact) => void;
  onDelete: (id: string) => void;
  onSnooze: (id: string, days: number) => void;
};

function ByContact({ tasks, rowProps }: { tasks: TaskWithContact[]; rowProps: RowProps }) {
  const groups = new Map<string, { name: string; id: string; items: TaskWithContact[] }>();
  for (const t of tasks) {
    const g = groups.get(t.contactId) ?? { name: t.contactName, id: t.contactId, items: [] };
    g.items.push(t); groups.set(t.contactId, g);
  }
  const list = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {list.length === 0 ? <p className="text-sm text-slate">No open tasks.</p> : list.map((g) => (
        <div key={g.id} className="rounded-2xl border border-mist bg-card p-5">
          <Link href={`/crm/contacts/${g.id}`} className="mb-3 block font-heading text-sm font-semibold text-heading hover:text-trust">{g.name}</Link>
          <ul className="space-y-2">{g.items.map((t) => <li key={t.id}><TaskRow task={t} {...rowProps} /></li>)}</ul>
        </div>
      ))}
    </div>
  );
}

function TaskRow({ task, selected, onSelect, onToggle, onEdit, onDelete, onSnooze }: { task: TaskWithContact } & RowProps) {
  const [menu, setMenu] = useState(false);
  const due = dueInfo(task.dueDate);
  return (
    <div className="relative flex items-start gap-2.5 rounded-lg border border-mist bg-card px-3 py-2.5" style={{ borderLeft: `3px solid ${PRIORITY_DOT[task.priority ?? "normal"]}` }}>
      <input type="checkbox" checked={selected.has(task.id)} onChange={() => onSelect(task.id)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-trust" aria-label={`Select ${task.title}`} />
      <button type="button" onClick={() => onToggle(task.id)} aria-label={task.done ? "Mark not done" : "Mark done"} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${task.done ? "border-green bg-green text-white" : "border-mist bg-card text-transparent hover:border-trust"}`}>
        <CheckIcon className="h-3 w-3" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-slate"><TypeIcon type={task.type} className="h-3.5 w-3.5" /></span>
          <button type="button" onClick={() => onEdit(task)} className={`min-w-0 truncate text-left text-sm ${task.done ? "text-slate line-through" : "text-body hover:text-trust"}`}>{task.title}</button>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate">
          <Link href={`/crm/contacts/${task.contactId}`} className="hover:text-trust hover:underline">{task.contactName}</Link>
          {task.dueDate || !task.done ? <span className={dueToneClass(due.tone)}>· {due.text}</span> : null}
          {task.owner ? <span>· {task.owner}</span> : null}
          {task.recurrence && task.recurrence !== "none" ? <span className="inline-flex items-center gap-0.5">· <RefreshIcon className="h-3 w-3" />{RECURRENCE_LABELS[task.recurrence]}</span> : null}
        </div>
      </div>
      <button type="button" onClick={() => setMenu((m) => !m)} aria-label={`Actions for ${task.title}`} className="shrink-0 px-1 text-slate hover:text-heading">&#8942;</button>
      {menu ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute right-2 top-9 z-20 w-44 rounded-xl border border-mist bg-card py-1 text-sm shadow-card">
            {[
              { label: "Edit", fn: () => onEdit(task) },
              { label: "Snooze → tomorrow", fn: () => onSnooze(task.id, 1) },
              { label: "Snooze → next week", fn: () => onSnooze(task.id, 7) },
            ].map((a) => (
              <button key={a.label} type="button" onClick={() => { a.fn(); setMenu(false); }} className="block w-full px-3 py-1.5 text-left text-body hover:bg-cloud">{a.label}</button>
            ))}
            <button type="button" onClick={() => { onDelete(task.id); setMenu(false); }} className="block w-full px-3 py-1.5 text-left text-red hover:bg-cloud">Delete</button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function TaskModal({ mode, task, contacts, owners, onClose, onSaved }: { mode: "add" | "edit"; task?: TaskWithContact; contacts: ContactOption[]; owners: string[]; onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState(task?.email ?? contacts[0]?.email ?? "");
  const [title, setTitle] = useState(task?.title ?? "");
  const [type, setType] = useState<TaskType>(task?.type ?? "follow_up");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "normal");
  const [owner, setOwner] = useState(task?.owner ?? "");
  const [date, setDate] = useState(toDateInput(task?.dueDate));
  const [time, setTime] = useState(toTimeInput(task?.dueDate));
  const [recurrence, setRecurrence] = useState<Recurrence>(task?.recurrence ?? "none");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const field = "w-full rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none focus:border-trust";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !email) { setErr("A contact and a title are required."); return; }
    const dueDate = date ? new Date(`${date}T${time || "00:00"}`).toISOString() : "";
    setPending(true); setErr(null);
    try {
      if (mode === "add") await api("/api/crm/task", "POST", { email, title: title.trim(), type, priority, owner, dueDate, recurrence, notes });
      else await api("/api/crm/task", "PATCH", { id: task!.id, title: title.trim(), type, priority, owner, dueDate, recurrence, notes });
      onSaved();
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : "Could not save the task. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-navy/40 p-4" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby="task-modal-title" onSubmit={submit} className="w-full max-w-md rounded-2xl border border-mist bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 id="task-modal-title" className="text-lg font-semibold text-heading">{mode === "add" ? "Add task" : "Edit task"}</h3>
        <div className="mt-4 space-y-3">
          {mode === "add" ? (
            <select value={email} onChange={(e) => setEmail(e.target.value)} className={field} aria-label="Contact">
              {contacts.map((c) => <option key={c.id} value={c.email}>{c.name}</option>)}
            </select>
          ) : (
            <div className="text-sm text-slate">Contact: <span className="text-body">{task?.contactName}</span></div>
          )}
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" aria-label="Task title" className={field} />
          <div className="flex gap-3">
            <select value={type} onChange={(e) => setType(e.target.value as TaskType)} aria-label="Task type" className={field}>{TASK_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} aria-label="Priority" className={field}>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</select>
          </div>
          <div className="flex gap-3">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} aria-label="Due date" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} aria-label="Due time" />
          </div>
          <div className="flex gap-3">
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className={field} aria-label="Owner"><option value="">Unassigned</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)} aria-label="Recurrence" className={field}>{RECURRENCES.map((r) => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}</select>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" aria-label="Notes" rows={2} className={`${field} resize-none`} />
          {err ? <p className="text-sm text-red">{err}</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-mist px-3 py-2 text-sm text-body hover:bg-cloud">Cancel</button>
          <button type="submit" disabled={pending} className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink hover:bg-gold-deep disabled:opacity-50">{pending ? "Saving…" : "Save task"}</button>
        </div>
      </form>
    </div>
  );
}
