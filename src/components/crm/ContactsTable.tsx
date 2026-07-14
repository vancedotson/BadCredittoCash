"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Contact } from "@/lib/store";
import { contactsToCsv } from "@/lib/csv";
import { STAGES_IN_ORDER, STAGE_LABELS, type Stage } from "@/lib/stages";
import { StageBadge, SegmentBadge } from "./ui";

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function download(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
async function api(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export function ContactsTable({ rows, allIds, owners, total }: { rows: Contact[]; allIds: string[]; owners: string[]; total: number }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [compact, setCompact] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [fly, setFly] = useState<{ c: Contact; x: number; y: number } | null>(null);
  const [bulkInput, setBulkInput] = useState<{ action: "tag" | "task"; value: string } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setCompact(localStorage.getItem("crm-contacts-compact") === "1"));
    return () => cancelAnimationFrame(raf);
  }, []);
  function toggleDensity() { setCompact((v) => { const n = !v; try { localStorage.setItem("crm-contacts-compact", n ? "1" : "0"); } catch { /* ignore */ } return n; }); }

  const sort = sp.get("sort") ?? "recent";
  const dir = sp.get("dir") ?? "desc";
  function sortBy(field: string) {
    const nd = sort === field ? (dir === "asc" ? "desc" : "asc") : "desc";
    const p = new URLSearchParams(sp.toString()); p.set("sort", field); p.set("dir", nd); p.delete("page");
    router.push(`/crm/contacts?${p.toString()}`);
  }

  const pageIds = rows.map((r) => r.id);
  const allPageSelected = rows.length > 0 && pageIds.every((id) => selected.has(id));
  const ids = allMatching ? allIds : [...selected];
  const count = ids.length;

  function toggleAll() {
    if (allPageSelected || allMatching) { setSelected(new Set()); setAllMatching(false); }
    else setSelected(new Set(pageIds));
  }
  function toggleOne(id: string) { setAllMatching(false); setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function clearSel() { setSelected(new Set()); setAllMatching(false); setBulkInput(null); }

  async function bulk(action: string, value?: string) {
    if (!count) return;
    setPending(true);
    try { await api("/api/crm/contacts/bulk", "POST", { ids, action, value }); clearSel(); router.refresh(); }
    finally { setPending(false); }
  }
  function exportSel() {
    const chosen = rows.filter((r) => selected.has(r.id));
    if (chosen.length) download(contactsToCsv(chosen), "vance-contacts-selected.csv");
  }

  const arrow = (f: string) => (sort === f ? <span className="text-trust">{dir === "asc" ? "▲" : "▼"}</span> : <span className="text-slate/40">↕</span>);
  const th = "px-4 py-3 font-medium";
  const td = compact ? "px-4 py-1.5" : "px-4 py-3";

  return (
    <div className="space-y-3">
      {/* Bulk bar */}
      {count > 0 ? (
        <div className="rounded-xl border border-mist bg-sky px-4 py-2.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-trust">{count} selected</span>
            {!allMatching && allPageSelected && total > rows.length ? (
              <button type="button" onClick={() => setAllMatching(true)} className="text-trust underline hover:opacity-80">Select all {total}</button>
            ) : null}
            <select disabled={pending} defaultValue="" onChange={(e) => { if (e.target.value) bulk("stage", e.target.value); e.target.value = ""; }} className="rounded-lg border border-mist bg-card px-2 py-1 text-xs" aria-label="Set stage">
              <option value="" disabled>Set stage…</option>{STAGES_IN_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
            <select disabled={pending} defaultValue="" onChange={(e) => { bulk("owner", e.target.value === "__none__" ? "" : e.target.value); e.target.value = ""; }} className="rounded-lg border border-mist bg-card px-2 py-1 text-xs" aria-label="Assign owner">
              <option value="" disabled>Assign owner…</option><option value="__none__">Unassigned</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <button type="button" onClick={() => setBulkInput({ action: "tag", value: "" })} className="rounded-lg border border-mist bg-card px-2 py-1 text-xs text-body hover:bg-cloud">+ Tag</button>
            <button type="button" onClick={() => setBulkInput({ action: "task", value: "" })} className="rounded-lg border border-mist bg-card px-2 py-1 text-xs text-body hover:bg-cloud">+ Task</button>
            {!allMatching ? <button type="button" onClick={exportSel} className="rounded-lg border border-mist bg-card px-2 py-1 text-xs text-body hover:bg-cloud">Export</button> : null}
            <button type="button" onClick={() => bulk("delete")} className="rounded-lg border border-mist bg-card px-2 py-1 text-xs text-red hover:bg-cloud">Delete</button>
            <button type="button" onClick={clearSel} className="text-slate hover:text-heading">Clear</button>
          </div>
          {bulkInput ? (
            <form onSubmit={(e) => { e.preventDefault(); if (bulkInput.value.trim()) bulk(bulkInput.action, bulkInput.value.trim()); setBulkInput(null); }} className="mt-2 flex gap-2">
              <input autoFocus value={bulkInput.value} onChange={(e) => setBulkInput({ ...bulkInput, value: e.target.value })} placeholder={bulkInput.action === "tag" ? "Tag to add…" : "Task title…"} className="min-w-0 flex-1 rounded-lg border border-mist bg-card px-2 py-1 text-xs outline-none focus:border-trust" />
              <button type="submit" className="rounded-lg bg-gold px-2 py-1 text-xs font-semibold text-ink hover:bg-gold-deep">Apply to {count}</button>
              <button type="button" onClick={() => setBulkInput(null)} className="text-xs text-slate">Cancel</button>
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button type="button" onClick={toggleDensity} className="text-xs text-slate hover:text-heading hover:underline">{compact ? "Comfortable rows" : "Compact rows"}</button>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-mist bg-card md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-mist bg-cloud text-xs uppercase tracking-wide text-slate">
            <tr>
              <th className="w-10 px-4 py-3"><input type="checkbox" checked={allMatching || allPageSelected} ref={(el) => { if (el) el.indeterminate = !allMatching && selected.size > 0 && !allPageSelected; }} onChange={toggleAll} className="h-4 w-4 cursor-pointer accent-trust" aria-label="Select all" /></th>
              <th className={th}><button type="button" onClick={() => sortBy("name")} className="inline-flex items-center gap-1 uppercase">Name {arrow("name")}</button></th>
              <th className={th}>Email</th>
              <th className={th}>Owner</th>
              <th className={th}><button type="button" onClick={() => sortBy("stage")} className="inline-flex items-center gap-1 uppercase">Stage {arrow("stage")}</button></th>
              <th className={th}>Segment</th>
              <th className={`${th} text-right`}><button type="button" onClick={() => sortBy("watch")} className="inline-flex items-center gap-1 uppercase">Watch {arrow("watch")}</button></th>
              <th className={th}>Next task</th>
              <th className={th}><button type="button" onClick={() => sortBy("created")} className="inline-flex items-center gap-1 uppercase">Created {arrow("created")}</button></th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-slate">No contacts match these filters.</td></tr>
            ) : rows.map((c) => {
              const checked = allMatching || selected.has(c.id);
              return (
                <tr key={c.id} className={`relative transition-colors ${checked ? "bg-sky/40" : "hover:bg-cloud"}`}
                  onMouseEnter={(e) => setFly({ c, x: e.clientX, y: e.clientY })} onMouseLeave={() => setFly(null)}>
                  <td className={td}><input type="checkbox" checked={checked} onChange={() => toggleOne(c.id)} className="h-4 w-4 cursor-pointer accent-trust" aria-label={`Select ${c.name}`} /></td>
                  <td className={`${td} font-medium`}><Link href={`/crm/contacts/${c.id}`} className="text-heading hover:text-trust hover:underline">{c.name}</Link></td>
                  <td className={`${td} text-slate`}>{c.email}</td>
                  <td className={`${td} text-slate`}>{c.owner ?? "—"}</td>
                  <td className={td}><StageBadge stage={c.stage} /></td>
                  <td className={td}><SegmentBadge segment={c.segment} /></td>
                  <td className={`${td} text-right tabular-nums text-slate`}>{c.watchPct ? `${c.watchPct}%` : "—"}</td>
                  <td className={`${td} max-w-[180px] truncate text-xs ${c.nextTask?.overdue ? "text-red" : "text-slate"}`}>{c.nextTask ? c.nextTask.title : c.openTaskCount === 0 ? "—" : ""}</td>
                  <td className={`${td} text-slate`}>{fmtDate(c.createdAt)}</td>
                  <td className={`${td} relative`}>
                    <button type="button" onClick={() => setMenu(menu === c.id ? null : c.id)} aria-label="Actions" className="px-1 text-slate hover:text-heading">⋮</button>
                    {menu === c.id ? <RowMenu c={c} owners={owners} onClose={() => setMenu(null)} onDone={() => { setMenu(null); router.refresh(); }} /> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {rows.length === 0 ? <p className="py-6 text-center text-sm text-slate">No contacts match these filters.</p> : rows.map((c) => (
          <div key={c.id} className={`rounded-xl border border-mist bg-card p-3 ${allMatching || selected.has(c.id) ? "ring-1 ring-trust" : ""}`}>
            <div className="flex items-start gap-2">
              <input type="checkbox" checked={allMatching || selected.has(c.id)} onChange={() => toggleOne(c.id)} className="mt-0.5 h-4 w-4 shrink-0 accent-trust" aria-label={`Select ${c.name}`} />
              <Link href={`/crm/contacts/${c.id}`} className="min-w-0 flex-1 truncate font-medium text-heading">{c.name}</Link>
              <span className="shrink-0 text-xs text-slate">{fmtDate(c.createdAt)}</span>
            </div>
            <div className="mt-1 truncate text-xs text-slate">{c.email}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5"><StageBadge stage={c.stage} /><SegmentBadge segment={c.segment} />{c.owner ? <span className="rounded-md bg-sky px-1.5 py-0.5 text-[11px] text-trust">{c.owner}</span> : null}</div>
          </div>
        ))}
      </div>

      {/* Hover flyout */}
      {fly ? (
        <div className="pointer-events-none fixed z-50 hidden w-64 rounded-xl border border-mist bg-card p-3 shadow-card md:block" style={{ left: Math.min(fly.x + 16, (typeof window !== "undefined" ? window.innerWidth : 1200) - 280), top: fly.y + 12 }}>
          <div className="font-medium text-heading">{fly.c.name}</div>
          <div className="text-xs text-slate">{fly.c.email}{fly.c.phone ? ` · ${fly.c.phone}` : ""}</div>
          <div className="mt-2 flex flex-wrap gap-1.5"><StageBadge stage={fly.c.stage} /><SegmentBadge segment={fly.c.segment} /></div>
          <dl className="mt-2 space-y-1 text-xs text-slate">
            <div className="flex justify-between"><dt>Watched</dt><dd className="text-body">{fly.c.watchPct}%</dd></div>
            <div className="flex justify-between"><dt>Last activity</dt><dd className="text-body">{fly.c.daysSinceActivity}d ago</dd></div>
            <div className="flex justify-between"><dt>Open tasks</dt><dd className="text-body">{fly.c.openTaskCount}</dd></div>
            {fly.c.nextTask ? <div className={fly.c.nextTask.overdue ? "text-red" : ""}>Next: {fly.c.nextTask.title}</div> : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function RowMenu({ c, owners, onClose, onDone }: { c: Contact; owners: string[]; onClose: () => void; onDone: () => void }) {
  const [task, setTask] = useState("");
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-4 top-8 z-20 w-52 rounded-xl border border-mist bg-card p-3 text-left shadow-card">
        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate">Stage</label>
        <select defaultValue={c.stage} onChange={async (e) => { await api(`/api/crm/contact/${c.id}`, "PATCH", { stage: e.target.value }); onDone(); }} className="mb-2 w-full rounded-lg border border-mist bg-card px-2 py-1.5 text-sm outline-none focus:border-trust">{STAGES_IN_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s as Stage]}</option>)}</select>
        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate">Owner</label>
        <select defaultValue={c.owner ?? ""} onChange={async (e) => { await api(`/api/crm/contact/${c.id}`, "PATCH", { owner: e.target.value }); onDone(); }} className="mb-2 w-full rounded-lg border border-mist bg-card px-2 py-1.5 text-sm outline-none focus:border-trust"><option value="">Unassigned</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate">Quick task</label>
        <div className="flex gap-1.5"><input value={task} onChange={(e) => setTask(e.target.value)} placeholder="Task…" className="min-w-0 flex-1 rounded-lg border border-mist bg-card px-2 py-1.5 text-sm outline-none focus:border-trust" /><button type="button" onClick={async () => { if (task.trim()) { await api("/api/crm/task", "POST", { email: c.email, title: task.trim() }); onDone(); } }} className="rounded-lg bg-gold px-2 py-1.5 text-xs font-semibold text-ink hover:bg-gold-deep">Add</button></div>
        <Link href={`/crm/contacts/${c.id}`} className="mt-3 block text-sm text-trust hover:underline">Open contact →</Link>
      </div>
    </>
  );
}
