"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContactOption } from "@/lib/store";
import { STAGES_IN_ORDER, STAGE_LABELS, type Stage } from "@/lib/stages";
import { PRIORITIES, PRIORITY_LABELS, TASK_TYPES, TYPE_LABELS, type TaskPriority, type TaskType } from "@/lib/tasks";

const field = "w-full rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none focus:border-trust";

async function api(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export function OverviewQuickActions({ contacts, owners }: { contacts: ContactOption[]; owners: string[] }) {
  const [modal, setModal] = useState<"contact" | "task" | null>(null);
  return (
    <>
      <div className="flex gap-2">
        <button type="button" onClick={() => setModal("contact")} className="rounded-lg border border-mist bg-card px-3 py-2 text-sm font-medium text-body transition-colors hover:bg-cloud">+ Contact</button>
        <button type="button" onClick={() => setModal("task")} className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-gold-deep">+ Task</button>
      </div>
      {modal === "contact" ? <AddContact owners={owners} onClose={() => setModal(null)} /> : null}
      {modal === "task" ? <AddTask contacts={contacts} owners={owners} onClose={() => setModal(null)} /> : null}
    </>
  );
}

function Shell({ title, children, onClose, onSubmit, pending, err }: { title: string; children: React.ReactNode; onClose: () => void; onSubmit: (e: React.FormEvent) => void; pending: boolean; err: string | null }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-navy/40 p-4" onClick={onClose}>
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-mist bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-heading">{title}</h3>
        <div className="mt-4 space-y-3">{children}{err ? <p className="text-sm text-red">{err}</p> : null}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-mist px-3 py-2 text-sm text-body hover:bg-cloud">Cancel</button>
          <button type="submit" disabled={pending} className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink hover:bg-gold-deep disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

function AddContact({ owners, onClose }: { owners: string[]; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: "", email: "", phone: "", source: "manual", stage: "new" as Stage, owner: "" });
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) { setErr("Name and a valid email are required."); return; }
    setPending(true); setErr(null);
    try { await api("/api/crm/contact", "POST", v); onClose(); router.refresh(); } catch { setErr("Could not create the contact."); setPending(false); }
  }
  return (
    <Shell title="Add contact" onClose={onClose} onSubmit={submit} pending={pending} err={err}>
      <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Name" className={field} />
      <input value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} placeholder="Email" className={field} />
      <input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="Phone (optional)" className={field} />
      <div className="flex gap-3">
        <input value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} placeholder="Source" className={field} />
        <select value={v.stage} onChange={(e) => setV({ ...v, stage: e.target.value as Stage })} className={field}>{STAGES_IN_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}</select>
      </div>
      <select value={v.owner} onChange={(e) => setV({ ...v, owner: e.target.value })} className={field}><option value="">Unassigned</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select>
    </Shell>
  );
}

function AddTask({ contacts, owners, onClose }: { contacts: ContactOption[]; owners: string[]; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ email: contacts[0]?.email ?? "", title: "", type: "follow_up" as TaskType, priority: "normal" as TaskPriority, owner: "", date: "" });
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.title.trim() || !v.email) { setErr("A contact and a title are required."); return; }
    setPending(true); setErr(null);
    try {
      await api("/api/crm/task", "POST", { email: v.email, title: v.title.trim(), type: v.type, priority: v.priority, owner: v.owner, dueDate: v.date ? new Date(`${v.date}T00:00:00`).toISOString() : "" });
      onClose(); router.refresh();
    } catch { setErr("Could not create the task."); setPending(false); }
  }
  return (
    <Shell title="Add task" onClose={onClose} onSubmit={submit} pending={pending} err={err}>
      <select value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} className={field} aria-label="Contact">{contacts.map((c) => <option key={c.id} value={c.email}>{c.name}</option>)}</select>
      <input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Task title" className={field} />
      <div className="flex gap-3">
        <select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as TaskType })} className={field}>{TASK_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select>
        <select value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value as TaskPriority })} className={field}>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</select>
      </div>
      <div className="flex gap-3">
        <input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className={field} aria-label="Due date" />
        <select value={v.owner} onChange={(e) => setV({ ...v, owner: e.target.value })} className={field}><option value="">Unassigned</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select>
      </div>
    </Shell>
  );
}
