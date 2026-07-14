"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ActivityItem, ActivitySummary } from "@/lib/store";
import { displayEvent, EVENT_CATEGORIES, CATEGORY_LABELS } from "@/lib/event-display";
import { EventGlyph, toneClass } from "./ui";

const DAY = 86400000;
const inputClass = "rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none transition-colors placeholder:text-slate/60 focus:border-trust";

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
function dayLabel(iso: string) {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function relTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function absTime(iso: string) { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
function detailOf(e: ActivityItem): string {
  const p = e.props ?? {};
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if (e.event === "quiz_completed") return [s(p.concern), s(p.tried), s(p.urgency)].filter(Boolean).join(" · ");
  if (e.event === "goal_replied" && p.goal) return `"${s(p.goal)}"`;
  if (e.event === "call_booked" && p.preferredTime) return `Preferred: ${s(p.preferredTime)}`;
  if (e.event === "email_queued" && p.sequence) return `Sequence: ${s(p.sequence)}`;
  if (e.event === "webinar_registered" && p.source) return `Source: ${s(p.source)}`;
  return "";
}
function csvEscape(v: unknown) { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

export function ActivityFeed({ owners }: { owners: string[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [important, setImportant] = useState(false);
  const [owner, setOwner] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [group, setGroup] = useState<"date" | "contact">("date");
  const [live, setLive] = useState(false);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const PAGE = 40;
  function qs(offset: number) {
    const p = new URLSearchParams();
    if (search.trim()) p.set("search", search.trim());
    if (category) p.set("category", category);
    if (important) p.set("important", "1");
    if (owner) p.set("owner", owner);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    p.set("limit", String(PAGE));
    p.set("offset", String(offset));
    return p.toString();
  }

  // (re)load on filter change (debounced; setState only in the async callback)
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/crm/activity?${qs(0)}`).then((r) => r.json());
      setItems(res.items); setTotal(res.total); setSummary(res.summary); setLoading(false);
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, important, owner, from, to]);

  // live poll
  useEffect(() => {
    if (!live) return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/crm/activity?${qs(0)}`).then((r) => r.json());
      setItems(res.items); setTotal(res.total); setSummary(res.summary);
    }, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, search, category, important, owner, from, to]);

  async function loadMore() {
    const res = await fetch(`/api/crm/activity?${qs(items.length)}`).then((r) => r.json());
    setItems((prev) => [...prev, ...res.items]); setTotal(res.total);
  }
  async function refresh() {
    const res = await fetch(`/api/crm/activity?${qs(0)}`).then((r) => r.json());
    setItems(res.items); setTotal(res.total); setSummary(res.summary);
  }
  async function exportCsv() {
    const res = await fetch(`/api/crm/activity?${qs(0).replace(/limit=\d+/, "limit=100000")}`).then((r) => r.json());
    const rows = (res.items as ActivityItem[]).map((e) => [absTime(e.createdAt), e.contactName ?? "", e.email ?? "", displayEvent(e.event).label, displayEvent(e.event).category].map(csvEscape).join(","));
    const csv = ["Time,Contact,Email,Event,Category", ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "vance-activity.csv"; a.click(); URL.revokeObjectURL(url);
  }
  function toggle(id: string) { setExpanded((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  // group items
  const groups = new Map<string, ActivityItem[]>();
  for (const e of items) {
    const key = group === "date" ? dayLabel(e.createdAt) : e.contactName ?? "Anonymous";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      {summary ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-mist bg-cloud px-4 py-2.5 text-sm">
          <span className="text-body"><span className="font-semibold tabular-nums">{summary.today}</span> <span className="text-slate">today</span></span>
          <span className="text-body"><span className="font-semibold tabular-nums">{summary.thisWeek}</span> <span className="text-slate">this week</span></span>
          <span className="flex flex-wrap gap-x-3 text-xs text-slate">{summary.byCategory.filter((c) => c.count > 0).map((c) => <span key={c.category}>{c.label}: <span className="tabular-nums text-body">{c.count}</span></span>)}</span>
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contact or event…" className={`${inputClass} min-w-[180px] flex-1`} />
        <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass} aria-label="Owner"><option value="">All owners</option><option value="__none__">Unassigned</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} aria-label="From" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} aria-label="To" />
        <div className="flex rounded-lg border border-mist bg-card p-0.5 text-sm">
          {(["date", "contact"] as const).map((g) => <button key={g} type="button" onClick={() => setGroup(g)} className={`rounded-md px-2.5 py-1.5 ${group === g ? "bg-navy text-white" : "text-slate"}`}>{g === "date" ? "By date" : "By contact"}</button>)}
        </div>
        <button type="button" onClick={refresh} className={inputClass}>Refresh</button>
        <button type="button" onClick={() => setLive((v) => !v)} className={`${inputClass} ${live ? "border-green text-green" : ""}`}>{live ? "● Live" : "Go live"}</button>
        <button type="button" onClick={exportCsv} className={inputClass}>Export</button>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => { setCategory(""); }} className={`rounded-full px-3 py-1 text-sm ${!category ? "bg-navy text-white" : "border border-mist bg-card text-slate hover:bg-cloud"}`}>All</button>
        {EVENT_CATEGORIES.map((c) => <button key={c} type="button" onClick={() => setCategory(category === c ? "" : c)} className={`rounded-full px-3 py-1 text-sm ${category === c ? "bg-navy text-white" : "border border-mist bg-card text-slate hover:bg-cloud"}`}>{CATEGORY_LABELS[c]}</button>)}
        <button type="button" onClick={() => setImportant((v) => !v)} className={`rounded-full px-3 py-1 text-sm ${important ? "bg-gold text-ink" : "border border-mist bg-card text-slate hover:bg-cloud"}`}>★ Important</button>
      </div>

      {/* Feed */}
      <div className="rounded-2xl border border-mist bg-card p-5">
        {loading && items.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate">No activity matches these filters.</p>
        ) : (
          <div className="space-y-5">
            {[...groups.entries()].map(([label, rows]) => (
              <div key={label}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">{label}</div>
                <ul className="space-y-1">
                  {rows.map((e) => {
                    const d = displayEvent(e.event);
                    const det = detailOf(e);
                    const open = expanded.has(e.id);
                    return (
                      <li key={e.id}>
                        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-cloud">
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${toneClass(d.tone)}`}><EventGlyph icon={d.icon} className="h-3.5 w-3.5" /></span>
                          <span className="min-w-0 flex-1 truncate text-body">
                            {d.label}
                            {e.contactId ? <> · <Link href={`/crm/contacts/${e.contactId}`} className="text-trust hover:underline">{e.contactName}</Link></> : e.email ? <span className="text-slate"> · {e.email}</span> : <span className="text-slate"> · anonymous</span>}
                          </span>
                          {det ? <button type="button" onClick={() => toggle(e.id)} className="shrink-0 text-xs text-slate hover:text-heading">{open ? "hide" : "details"}</button> : null}
                          <span className="shrink-0 text-xs text-slate" title={absTime(e.createdAt)}>{relTime(e.createdAt)}</span>
                        </div>
                        {open && det ? <div className="ml-12 mb-1 text-xs text-slate">{det}</div> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        {items.length < total ? (
          <div className="mt-4 text-center">
            <button type="button" onClick={loadMore} className="rounded-lg border border-mist px-4 py-2 text-sm text-body hover:bg-cloud">Load more ({total - items.length} older)</button>
          </div>
        ) : items.length > 0 ? (
          <p className="mt-4 text-center text-xs text-slate">That&apos;s all {total} events.</p>
        ) : null}
      </div>
    </div>
  );
}
