"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Contact } from "@/lib/store";
import {
  STAGE_LABELS,
  ACTIVE_STAGES,
  CLOSED_STAGES,
  LOST_REASONS,
  type Stage,
} from "@/lib/stages";
import { SegmentBadge } from "@/components/crm/ui";
import { ChevronRightIcon } from "@/components/marketing-v2/Icons";
import { UndoNotice, type UndoNoticeState } from "@/components/crm/UndoNotice";

const inputClass =
  "rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none transition-colors placeholder:text-slate focus:border-trust";

async function api(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const payload = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? "Request failed");
  }
  return res.json();
}

function agingColor(days: number): string {
  if (days >= 7) return "var(--color-red)";
  if (days >= 3) return "var(--color-gold)";
  return "var(--color-green)";
}

// ---------------------------------------------------------------------------

export function PipelineBoard({ contacts, owners }: { contacts: Contact[]; owners: string[] }) {
  const router = useRouter();
  const [ov, setOv] = useState<Record<string, Stage>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [ownerF, setOwnerF] = useState("");
  const [sourceF, setSourceF] = useState("");
  const [sort, setSort] = useState<"recent" | "stale" | "name">("recent");
  const [collapsed, setCollapsed] = useState<Set<Stage>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const [lostIds, setLostIds] = useState<string[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [mobileStage, setMobileStage] = useState<Stage>("new");
  const [actionError, setActionError] = useState<{ message: string; retry: () => void } | null>(null);
  const [undoNotice, setUndoNotice] = useState<UndoNoticeState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollByCol(dir: number) {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  }

  const stageOf = (c: Contact): Stage => ov[c.id] ?? c.stage;
  const sourceOf = (c: Contact) => c.utm?.utm_source ?? c.source ?? "direct";
  const sources = useMemo(() => [...new Set(contacts.map(sourceOf))].sort(), [contacts]);

  const filtered = useMemo(() => {
    let list = contacts;
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((c) => c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s));
    if (ownerF) list = list.filter((c) => (ownerF === "__none__" ? !c.owner : c.owner === ownerF));
    if (sourceF) list = list.filter((c) => sourceOf(c) === sourceF);
    return list;
  }, [contacts, q, ownerF, sourceF]);

  function sortCards(cards: Contact[]): Contact[] {
    const s = [...cards];
    if (sort === "stale") s.sort((a, b) => b.stageAgeDays - a.stageAgeDays);
    else if (sort === "name") s.sort((a, b) => a.name.localeCompare(b.name));
    else s.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    return s;
  }
  const cardsIn = (stage: Stage) => sortCards(filtered.filter((c) => stageOf(c) === stage));

  async function move(ids: string[], toStage: Stage, lostReason?: string) {
    setActionError(null);
    const previous = ids.flatMap((id) => {
      const contact = contacts.find((candidate) => candidate.id === id);
      return contact ? [{ id, stage: stageOf(contact), lostReason: contact.lostReason }] : [];
    });
    setOv((p) => { const n = { ...p }; ids.forEach((id) => (n[id] = toStage)); return n; });
    setPending((p) => { const n = new Set(p); ids.forEach((id) => n.add(id)); return n; });
    try {
      const results = await Promise.all(ids.map((id) => api(`/api/crm/contact/${id}`, "PATCH", { stage: toStage, ...(lostReason ? { lostReason } : {}), expectedUpdatedAt: contacts.find((contact) => contact.id === id)?.updatedAt })));
      const latestUpdatedAt = new Map(ids.map((id, index) => [
        id,
        (results[index] as { lead?: { updatedAt?: string } }).lead?.updatedAt,
      ]));
      const undo = async (): Promise<void> => {
        setOv((current) => {
          const next = { ...current };
          previous.forEach((contact) => { next[contact.id] = contact.stage; });
          return next;
        });
        try {
          await Promise.all(previous.map((contact) => api(`/api/crm/contact/${contact.id}`, "PATCH", {
            stage: contact.stage,
            lostReason: contact.lostReason ?? "",
            ...(latestUpdatedAt.get(contact.id) ? { expectedUpdatedAt: latestUpdatedAt.get(contact.id) } : {}),
          })));
          router.refresh();
        } catch (error) {
          setOv((current) => {
            const next = { ...current };
            previous.forEach((contact) => { next[contact.id] = toStage; });
            return next;
          });
          setActionError({ message: error instanceof Error ? error.message : "Could not undo the stage move.", retry: () => { void undo(); } });
          throw error;
        }
      };
      setUndoNotice((current) => ({
        id: (current?.id ?? 0) + 1,
        message: `${ids.length} contact${ids.length === 1 ? "" : "s"} moved to ${STAGE_LABELS[toStage]}.`,
        undo,
      }));
      router.refresh();
    } catch (error) {
      setOv((p) => { const n = { ...p }; ids.forEach((id) => delete n[id]); return n; });
      setActionError({ message: error instanceof Error ? error.message : "Could not move the contact.", retry: () => { void move(ids, toStage, lostReason); } });
    } finally {
      setPending((p) => { const n = new Set(p); ids.forEach((id) => n.delete(id)); return n; });
      setSelected(new Set());
    }
  }

  function requestMove(ids: string[], toStage: Stage) {
    if (!ids.length) return;
    if (toStage === "lost") setLostIds(ids);
    else move(ids, toStage);
  }

  async function assign(id: string, owner: string) {
    setActionError(null);
    setPending((p) => new Set(p).add(id));
    try {
      await api(`/api/crm/contact/${id}`, "PATCH", { owner, expectedUpdatedAt: contacts.find((contact) => contact.id === id)?.updatedAt });
      router.refresh();
    } catch (error) {
      setActionError({ message: error instanceof Error ? error.message : "Could not assign the owner.", retry: () => { void assign(id, owner); } });
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  }

  async function quickTask(email: string, title: string) {
    setActionError(null);
    try {
      await api("/api/crm/task", "POST", { email, title });
      router.refresh();
    } catch (error) {
      setActionError({ message: error instanceof Error ? error.message : "Could not add the task.", retry: () => { void quickTask(email, title); } });
      throw error;
    }
  }

  function toggleSelect(id: string) {
    setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleCollapse(stage: Stage) {
    setCollapsed((p) => { const n = new Set(p); if (n.has(stage)) n.delete(stage); else n.add(stage); return n; });
  }

  const dropHandlers = (stage: Stage) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (overStage !== stage) setOverStage(stage); },
    onDragLeave: () => setOverStage((s) => (s === stage ? null : s)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const id = dragId ?? e.dataTransfer.getData("text/plain");
      const c = contacts.find((x) => x.id === id);
      if (c && stageOf(c) !== stage) requestMove([id], stage);
      setDragId(null); setOverStage(null);
    },
  });

  const cardProps = { owners, selected, pending, stageOf, onToggleSelect: toggleSelect, onMoveStage: (id: string, s: Stage) => requestMove([id], s), onAssign: assign, onQuickTask: quickTask, onDragStart: setDragId, onDragEnd: () => setDragId(null) };

  return (
    <div className="space-y-4">
      {undoNotice ? <UndoNotice key={undoNotice.id} notice={undoNotice} onDismiss={() => setUndoNotice(null)} /> : null}
      {actionError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red/30 bg-red/5 px-4 py-3 text-sm text-red">
          <span>{actionError.message} The board was kept safe.</span>
          <span className="flex gap-3"><button type="button" onClick={actionError.retry} className="font-semibold underline">Try again</button><button type="button" onClick={() => setActionError(null)} aria-label="Dismiss error">×</button></span>
        </div>
      ) : null}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" aria-label="Search pipeline" className={`${inputClass} min-w-[180px] flex-1`} />
        <select value={ownerF} onChange={(e) => setOwnerF(e.target.value)} className={inputClass} aria-label="Filter by owner">
          <option value="">All owners</option>
          <option value="__none__">Unassigned</option>
          {owners.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={sourceF} onChange={(e) => setSourceF(e.target.value)} className={inputClass} aria-label="Filter by source">
          <option value="">All sources</option>
          {sources.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={inputClass} aria-label="Sort">
          <option value="recent">Recent activity</option>
          <option value="stale">Stalest first</option>
          <option value="name">Name</option>
        </select>
        <button type="button" onClick={() => setAddOpen(true)} className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-gold-deep">
          + Add contact
        </button>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-mist bg-sky px-4 py-2.5 text-sm">
          <span className="font-medium text-trust">{selected.size} selected</span>
          <label className="flex items-center gap-2 text-slate">
            Move to
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) requestMove([...selected], e.target.value as Stage); e.target.value = ""; }}
              className={inputClass}
            >
              <option value="" disabled>Choose stage…</option>
              {[...ACTIVE_STAGES, ...CLOSED_STAGES].map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setSelected(new Set())} className="text-slate hover:text-heading">Clear</button>
        </div>
      ) : null}

      {/* Desktop kanban — all stages in one horizontal, scrollable row */}
      <div className="hidden md:block">
        <div className="mb-2 flex items-center justify-end gap-2">
          <button type="button" onClick={() => scrollByCol(-1)} aria-label="Scroll left" className="grid h-8 w-8 place-items-center rounded-lg border border-mist bg-card text-slate transition-colors hover:bg-cloud hover:text-heading">
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
          </button>
          <button type="button" onClick={() => scrollByCol(1)} aria-label="Scroll right" className="grid h-8 w-8 place-items-center rounded-lg border border-mist bg-card text-slate transition-colors hover:bg-cloud hover:text-heading">
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2">
          {ACTIVE_STAGES.map((stage) => (
            <Column key={stage} stage={stage} cards={cardsIn(stage)} collapsed={collapsed.has(stage)} onToggleCollapse={() => toggleCollapse(stage)} over={overStage === stage} drop={dropHandlers(stage)} cardProps={cardProps} />
          ))}
          {/* divider: active pipeline | closed outcomes */}
          <div className="w-px shrink-0 self-stretch bg-mist" aria-hidden />
          {CLOSED_STAGES.map((stage) => (
            <Column key={stage} stage={stage} cards={cardsIn(stage)} collapsed={collapsed.has(stage)} onToggleCollapse={() => toggleCollapse(stage)} over={overStage === stage} drop={dropHandlers(stage)} cardProps={cardProps} closed />
          ))}
        </div>
      </div>

      {/* Mobile — stage picker + single column */}
      <div className="md:hidden">
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {[...ACTIVE_STAGES, ...CLOSED_STAGES].map((s) => (
            <button key={s} type="button" aria-pressed={mobileStage === s} onClick={(e) => { setMobileStage(s); e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${mobileStage === s ? "bg-navy text-white" : "border border-mist bg-card text-slate"}`}>
              {STAGE_LABELS[s]}
              <span className={`rounded-full px-1.5 text-xs ${mobileStage === s ? "bg-white/20" : "bg-mist/70"}`}>{cardsIn(s).length}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {cardsIn(mobileStage).length === 0 ? (
            <p className="py-8 text-center text-sm text-slate">No contacts in {STAGE_LABELS[mobileStage]}.</p>
          ) : (
            cardsIn(mobileStage).map((c) => <PipelineCard key={c.id} c={c} {...cardProps} />)
          )}
        </div>
      </div>

      {lostIds ? <LostReasonModal count={lostIds.length} onCancel={() => setLostIds(null)} onConfirm={(reason) => { move(lostIds, "lost", reason); setLostIds(null); }} /> : null}
      {addOpen ? <AddContactModal owners={owners} onClose={() => setAddOpen(false)} onCreated={() => { setAddOpen(false); router.refresh(); }} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

type CardProps = {
  owners: string[];
  selected: Set<string>;
  pending: Set<string>;
  stageOf: (c: Contact) => Stage;
  onToggleSelect: (id: string) => void;
  onMoveStage: (id: string, s: Stage) => void;
  onAssign: (id: string, owner: string) => Promise<void>;
  onQuickTask: (email: string, title: string) => Promise<void>;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
};

function Column({
  stage, cards, collapsed, onToggleCollapse, over, drop, cardProps, closed = false,
}: {
  stage: Stage; cards: Contact[]; collapsed: boolean; onToggleCollapse: () => void;
  over: boolean; drop: ReturnType<PipelineBoardDrop>; cardProps: CardProps; closed?: boolean;
}) {
  if (collapsed) {
    return (
      <button type="button" onClick={onToggleCollapse} className="flex w-12 shrink-0 flex-col items-center gap-2 rounded-2xl border border-mist bg-cloud py-3 text-slate hover:bg-mist/40" {...drop}>
        <span className="rounded-full bg-mist/70 px-2 py-0.5 text-xs font-medium tabular-nums">{cards.length}</span>
        <span className="text-xs [writing-mode:vertical-rl]">{STAGE_LABELS[stage]}</span>
      </button>
    );
  }
  return (
    <div className={`flex ${closed ? "w-64" : "w-72"} shrink-0 flex-col rounded-2xl border bg-cloud transition-colors ${over ? "border-trust ring-2 ring-trust/30" : "border-mist"}`} {...drop}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-heading text-sm font-semibold text-heading">{STAGE_LABELS[stage]}</span>
          <span className="rounded-full bg-mist/70 px-2 py-0.5 text-xs font-medium tabular-nums text-slate">{cards.length}</span>
        </div>
        <button type="button" onClick={onToggleCollapse} aria-label={`Collapse ${STAGE_LABELS[stage]}`} className="text-slate hover:text-heading">&#8211;</button>
      </div>
      <div className="flex min-h-[60px] flex-col gap-2 px-2 pb-2">
        {cards.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-slate">Drop here</p>
        ) : (
          cards.map((c) => <PipelineCard key={c.id} c={c} {...cardProps} />)
        )}
      </div>
    </div>
  );
}
type PipelineBoardDrop = (stage: Stage) => {
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
};

function PipelineCard({ c, owners, selected, pending, stageOf, onToggleSelect, onMoveStage, onAssign, onQuickTask, onDragStart, onDragEnd }: { c: Contact } & CardProps) {
  const [menu, setMenu] = useState(false);
  const [task, setTask] = useState("");
  const [taskPending, setTaskPending] = useState(false);
  const stage = stageOf(c);
  const isPending = pending.has(c.id);
  const source = c.utm?.utm_source ?? c.source ?? "direct";

  return (
    <article
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); onDragStart(c.id); }}
      onDragEnd={onDragEnd}
      className={`relative rounded-xl border border-mist bg-card p-3 transition-opacity ${isPending ? "opacity-50" : ""}`}
      style={{ borderLeft: `3px solid ${agingColor(c.stageAgeDays)}`, cursor: "grab" }}
    >
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={selected.has(c.id)} onChange={() => onToggleSelect(c.id)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-trust" aria-label={`Select ${c.name}`} />
        <Link href={`/crm/contacts/${c.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-heading hover:text-trust">{c.name}</Link>
        <button type="button" onClick={() => setMenu((m) => !m)} aria-label="Actions" className="shrink-0 px-1 text-slate hover:text-heading">&#8942;</button>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <SegmentBadge segment={c.segment} />
        {c.owner ? <span className="rounded-md bg-sky px-1.5 py-0.5 text-[11px] font-medium text-trust">{c.owner}</span> : null}
        {(c.tags ?? []).slice(0, 1).map((t) => <span key={t} className="rounded-md bg-mist/60 px-1.5 py-0.5 text-[11px] text-slate">#{t}</span>)}
      </div>

      {/* why-now signal */}
      {c.nextTask ? (
        <div className={`mt-1.5 truncate text-xs ${c.nextTask.overdue ? "text-red" : "text-slate"}`}>
          &#9873; {c.nextTask.title}{c.nextTask.overdue ? " · overdue" : ""}
        </div>
      ) : c.daysSinceActivity >= 5 ? (
        <div className="mt-1.5 text-xs text-gold-deep">No follow-up set</div>
      ) : null}

      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate">
        <span className="truncate capitalize">{source}{c.phone ? " · has phone" : ""}</span>
        <span className="shrink-0">{c.watchPct ? `${c.watchPct}% watched` : ""}</span>
      </div>
      <div className="mt-0.5 text-[11px] text-slate">In stage {c.stageAgeDays}d · active {c.daysSinceActivity}d ago</div>

      <div className="mt-2 flex items-center gap-2">
        <select value={stage} onChange={(e) => onMoveStage(c.id, e.target.value as Stage)} className="flex-1 rounded-lg border border-mist bg-card px-2 py-1 text-xs text-body outline-none focus:border-trust" aria-label={`Move ${c.name} to another stage`}>
          {[...ACTIVE_STAGES, ...CLOSED_STAGES].map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
      </div>

      {/* actions menu */}
      {menu ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute right-2 top-9 z-20 w-52 rounded-xl border border-mist bg-card p-3 shadow-card">
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate">Assign to</label>
            <select value={c.owner ?? ""} onChange={(e) => { onAssign(c.id, e.target.value); setMenu(false); }} className="mb-3 w-full rounded-lg border border-mist bg-card px-2 py-1.5 text-sm text-body outline-none focus:border-trust">
              <option value="">Unassigned</option>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate">Quick task</label>
            <div className="flex gap-1.5">
              <input value={task} onChange={(e) => setTask(e.target.value)} placeholder="Task…" className="min-w-0 flex-1 rounded-lg border border-mist bg-card px-2 py-1.5 text-sm text-body outline-none focus:border-trust" />
              <button disabled={taskPending} type="button" onClick={async () => { if (!task.trim()) return; setTaskPending(true); try { await onQuickTask(c.email, task.trim()); setTask(""); setMenu(false); } catch { /* the board-level retry keeps the draft available */ } finally { setTaskPending(false); } }} className="rounded-lg bg-gold px-2 py-1.5 text-xs font-semibold text-ink hover:bg-gold-deep disabled:opacity-60">{taskPending ? "…" : "Add"}</button>
            </div>
            <Link href={`/crm/contacts/${c.id}`} className="mt-3 block text-sm text-trust hover:underline">Open contact &#8594;</Link>
          </div>
        </>
      ) : null}
    </article>
  );
}

function LostReasonModal({ count, onCancel, onConfirm }: { count: number; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-navy/40 p-4" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="lost-reason-title" className="w-full max-w-sm rounded-2xl border border-mist bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 id="lost-reason-title" className="text-lg font-semibold text-heading">Why lost?</h3>
        <p className="mt-1 text-sm text-slate">Marking {count === 1 ? "this contact" : `${count} contacts`} as Lost.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {LOST_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className={`rounded-lg border px-3 py-1.5 text-sm ${reason === r ? "border-trust bg-sky text-trust" : "border-mist text-body hover:bg-cloud"}`}>{r}</button>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-mist px-3 py-2 text-sm text-body hover:bg-cloud">Cancel</button>
          <button type="button" disabled={!reason} onClick={() => onConfirm(reason)} className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink hover:bg-gold-deep disabled:opacity-50">Mark lost</button>
        </div>
      </div>
    </div>
  );
}

function AddContactModal({ owners, onClose, onCreated }: { owners: string[]; onClose: () => void; onCreated: () => void }) {
  const [v, setV] = useState({ name: "", email: "", phone: "", source: "manual", stage: "new" as Stage, owner: "" });
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const field = "w-full rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none focus:border-trust";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) { setErr("Name and a valid email are required."); return; }
    setPending(true); setErr(null);
    try {
      await api("/api/crm/contact", "POST", v);
      onCreated();
    } catch {
      setErr("Could not create the contact."); setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-navy/40 p-4" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby="pipeline-add-title" onSubmit={submit} className="w-full max-w-md rounded-2xl border border-mist bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 id="pipeline-add-title" className="text-lg font-semibold text-heading">Add contact</h3>
        <div className="mt-4 space-y-3">
          <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Name" aria-label="Name" className={field} />
          <input value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} placeholder="Email" aria-label="Email" className={field} />
          <input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="Phone (optional)" aria-label="Phone" className={field} />
          <div className="flex gap-3">
            <input value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} placeholder="Source" aria-label="Source" className={field} />
            <select value={v.stage} onChange={(e) => setV({ ...v, stage: e.target.value as Stage })} aria-label="Stage" className={field}>
              {[...ACTIVE_STAGES, ...CLOSED_STAGES].map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
          <select value={v.owner} onChange={(e) => setV({ ...v, owner: e.target.value })} aria-label="Owner" className={field}>
            <option value="">Unassigned</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {err ? <p className="text-sm text-red">{err}</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-mist px-3 py-2 text-sm text-body hover:bg-cloud">Cancel</button>
          <button type="submit" disabled={pending} className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink hover:bg-gold-deep disabled:opacity-50">{pending ? "Adding…" : "Add contact"}</button>
        </div>
      </form>
    </div>
  );
}
