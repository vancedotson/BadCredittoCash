"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STAGES_IN_ORDER, STAGE_LABELS, type Stage } from "@/lib/stages";
import { SEGMENTS_IN_ORDER, SEGMENT_LABELS, type Segment } from "@/lib/segments";
import { CONTACT_VIEWS, readContactViews, type SavedContactView } from "@/lib/contacts-display";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust";
const button = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-mist bg-card px-4 py-2 text-sm font-medium text-heading transition-colors hover:bg-cloud disabled:opacity-50 ${focus}`;
const field = "min-h-11 w-full min-w-0 rounded-lg border border-mist bg-card px-3 py-2 text-base text-body outline-none focus:border-trust focus:ring-2 focus:ring-trust/15 disabled:opacity-50 sm:text-sm";
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function ToolbarIcon({ kind }: { kind: "search" | "filter" | "bookmark" | "close" }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === "search" ? <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></> : kind === "filter" ? <><path d="M4 6h16M7 12h10M10 18h4" /><circle cx="8" cy="6" r="1.5" fill="currentColor" /><circle cx="15" cy="12" r="1.5" fill="currentColor" /></> : kind === "bookmark" ? <path d="M6 3h12v18l-6-4-6 4V3Z" /> : <path d="m6 6 12 12M6 18 18 6" />}</svg>;
}

export function ContactsToolbar({ query, owners, tags, sources, sessions = [] }: { query: string; owners: string[]; tags: string[]; sources: string[]; sessions?: Array<{ id: string; title: string; startsAt: string; timezone?: string }> }) {
  const router = useRouter();
  const params = new URLSearchParams(query);
  const [pending, startTransition] = useTransition();
  const interactive = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [saved, setSaved] = useState<SavedContactView[]>([]);
  const [newViewName, setNewViewName] = useState("");
  const [storageMessage, setStorageMessage] = useState("");
  const viewsContainer = useRef<HTMLDivElement>(null);
  const viewsTrigger = useRef<HTMLButtonElement>(null);
  const viewNameInput = useRef<HTMLInputElement>(null);
  const disabled = pending || !interactive;

  useEffect(() => {
    const frame = requestAnimationFrame(() => { try { setSaved(readContactViews(localStorage.getItem("crm-contact-views"))); } catch { /* Storage may be unavailable. */ } });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!viewsOpen) return;
    viewNameInput.current?.focus();
    const pointer = (event: PointerEvent) => { if (!viewsContainer.current?.contains(event.target as Node)) setViewsOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setViewsOpen(false); viewsTrigger.current?.focus(); } };
    document.addEventListener("pointerdown", pointer); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", pointer); document.removeEventListener("keydown", key); };
  }, [viewsOpen]);

  function navigate(next: URLSearchParams) {
    if (disabled) return;
    next.delete("page");
    startTransition(() => router.push(`/crm/contacts?${next.toString()}`, { scroll: false }));
  }
  function push(next: Record<string, string>) {
    const updated = new URLSearchParams(query);
    for (const [key, value] of Object.entries(next)) { if (value) updated.set(key, value); else updated.delete(key); }
    navigate(updated);
  }
  function persist(next: SavedContactView[]) {
    setSaved(next);
    try { localStorage.setItem("crm-contact-views", JSON.stringify(next)); setStorageMessage("Saved on this browser."); }
    catch { setStorageMessage("Browser storage is unavailable. This view is available until you leave this page."); }
  }
  function reset() {
    const next = new URLSearchParams(query);
    for (const key of ["q", "stage", "segment", "source", "owner", "tag", "funnel", "sessionId"]) next.delete(key);
    next.set("view", "all"); navigate(next);
  }
  const value = (key: string) => params.get(key) ?? "";
  const view = value("view") || "all";
  const activeChips: { key: string; label: string }[] = [];
  const addChip = (key: string, label: string, display = value(key)) => { if (value(key)) activeChips.push({ key, label: `${label}: ${display}` }); };
  addChip("q", "Search"); addChip("stage", "Stage", STAGE_LABELS[value("stage") as Stage]);
  addChip("segment", "Segment", SEGMENT_LABELS[value("segment") as Segment]);
  addChip("source", "Source"); addChip("owner", "Owner", value("owner") === "__none__" ? "Unassigned" : value("owner")); addChip("tag", "Tag", `#${value("tag")}`);
  addChip("funnel", "Funnel", value("funnel") === "live" ? "Live webinar" : "Evergreen");
  addChip("sessionId", "Session", sessions.find((session) => session.id === value("sessionId"))?.title ?? value("sessionId"));
  if (view !== "all") activeChips.push({ key: "view", label: `View: ${CONTACT_VIEWS.find((item) => item.key === view)?.label}` });
  const filterCount = activeChips.filter((chip) => !["q", "view"].includes(chip.key)).length;
  const extras = (key: string, options: string[]) => value(key) && !options.includes(value(key)) ? <option value={value(key)}>{value(key)}</option> : null;

  return <div aria-busy={pending}>
    <div className="px-4 pt-4 sm:px-5 sm:pt-5">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
        <form onSubmit={(event) => { event.preventDefault(); push({ q: String(new FormData(event.currentTarget).get("q") ?? "").trim() }); }} className="relative col-span-2 flex min-w-0 flex-1 items-center">
          <span className="pointer-events-none absolute left-3.5 text-slate"><ToolbarIcon kind="search" /></span>
          <input key={value("q")} name="q" defaultValue={value("q")} placeholder="Search name or email…" aria-label="Search" disabled={disabled} className={`${field} bg-cloud/45 pr-12 pl-11`} />
          <button type="submit" disabled={disabled} aria-label="Search contacts" className={`absolute right-1 flex h-9 w-9 items-center justify-center rounded-md text-slate hover:bg-mist/50 hover:text-heading disabled:opacity-50 ${focus}`}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 12h15m-5-5 5 5-5 5" /></svg></button>
        </form>
        <button type="button" disabled={!interactive} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-controls="contact-filter-fields" className={`${button} ${filtersOpen ? "border-trust/40 bg-cloud" : ""}`}><ToolbarIcon kind="filter" />Filters{filterCount ? <span className="rounded-full bg-mist/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">{filterCount}</span> : null}</button>
        <div ref={viewsContainer} className="relative min-w-0">
          <button ref={viewsTrigger} type="button" disabled={!interactive} aria-expanded={viewsOpen} aria-controls="contact-saved-views" onClick={() => setViewsOpen((open) => !open)} className={`${button} w-full whitespace-nowrap`}><ToolbarIcon kind="bookmark" />Saved views<svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m5 7 5 5 5-5" /></svg></button>
          {viewsOpen ? <div id="contact-saved-views" role="region" aria-label="Saved contact views" className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-4rem)] rounded-xl border border-mist bg-card p-4 shadow-xl">
            <h2 className="text-sm font-semibold text-heading">Your saved views</h2><p className="mt-1 text-xs leading-relaxed text-slate">Keep useful filters together. Saved in this browser.</p>
            <div className="my-3 max-h-48 space-y-1 overflow-y-auto">
              {saved.length === 0 ? <p className="rounded-lg bg-cloud p-3 text-xs text-slate">No saved views yet.</p> : saved.map((item) => <div key={item.name} className="flex min-w-0 items-center gap-1 rounded-lg hover:bg-cloud">
                <button type="button" disabled={disabled} onClick={() => { navigate(new URLSearchParams(item.query)); setViewsOpen(false); viewsTrigger.current?.focus(); }} className={`min-h-11 min-w-0 flex-1 truncate rounded-lg px-2 text-left text-sm text-heading ${focus}`}>{item.name}</button>
                <button type="button" aria-label={`Delete view ${item.name}`} onClick={() => persist(saved.filter((candidate) => candidate.name !== item.name))} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate hover:bg-mist/50 ${focus}`}><ToolbarIcon kind="close" /></button>
              </div>)}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); const name = newViewName.trim(); if (!name) return; const next = new URLSearchParams(query); next.delete("page"); persist([...saved.filter((item) => item.name !== name), { name, query: next.toString() }].slice(-50)); setNewViewName(""); }} className="border-t border-mist pt-3">
              <label className="text-xs font-medium text-heading" htmlFor="contact-view-name">View name</label>
              <input ref={viewNameInput} id="contact-view-name" value={newViewName} onChange={(event) => setNewViewName(event.target.value)} maxLength={60} required placeholder="e.g. Leads to follow up" className={`${field} mt-2`} />
              <button type="submit" disabled={disabled || !newViewName.trim()} className={`mt-2 min-h-10 w-full rounded-lg bg-gold px-3 text-sm font-semibold text-ink hover:bg-gold/85 disabled:opacity-50 ${focus}`}>Save view</button>
              <p role="status" className="mt-2 text-xs leading-relaxed text-slate">{storageMessage}</p>
            </form>
          </div> : null}
        </div>
      </div>

      {filtersOpen ? <div id="contact-filter-fields" className="mt-4 rounded-xl border border-mist bg-cloud/55 p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-heading">Refine your contacts</h2><button type="button" onClick={() => setFiltersOpen(false)} className={`rounded px-2 py-1 text-xs text-slate hover:text-heading ${focus}`}>Hide filters</button></div>
        <fieldset disabled={disabled} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5 text-xs font-medium text-slate"><span>Stage</span><select value={value("stage")} onChange={(event) => push({ stage: event.target.value })} className={field} aria-label="Stage"><option value="">All stages</option>{STAGES_IN_ORDER.map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-medium text-slate"><span>Segment</span><select value={value("segment")} onChange={(event) => push({ segment: event.target.value })} className={field} aria-label="Segment"><option value="">All segments</option>{SEGMENTS_IN_ORDER.map((segment) => <option key={segment} value={segment}>{SEGMENT_LABELS[segment]}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-medium text-slate"><span>Source</span><select value={value("source")} onChange={(event) => push({ source: event.target.value })} className={field} aria-label="Source"><option value="">All sources</option>{extras("source", sources)}{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-medium text-slate"><span>Owner</span><select value={value("owner")} onChange={(event) => push({ owner: event.target.value })} className={field} aria-label="Owner"><option value="">All owners</option><option value="__none__">Unassigned</option>{extras("owner", ["__none__", ...owners])}{owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-medium text-slate"><span>Funnel</span><select value={value("funnel")} onChange={(event) => push(event.target.value !== "live" ? { funnel: event.target.value, sessionId: "" } : { funnel: event.target.value })} className={field} aria-label="Funnel"><option value="">All funnels</option><option value="evergreen">Evergreen</option><option value="live">Live webinar</option></select></label>
          <label className="space-y-1.5 text-xs font-medium text-slate xl:col-span-2"><span>Session</span><select value={value("sessionId")} onChange={(event) => push(event.target.value ? { sessionId: event.target.value, funnel: "live" } : { sessionId: "" })} className={field} aria-label="Session"><option value="">All sessions</option>{extras("sessionId", sessions.map((session) => session.id))}{sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {new Date(session.startsAt).toLocaleDateString("en-US", { timeZone: session.timezone || "UTC" })}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-medium text-slate"><span>Tag</span><select value={value("tag")} onChange={(event) => push({ tag: event.target.value })} className={field} aria-label="Tag"><option value="">All tags</option>{extras("tag", tags)}{tags.map((tag) => <option key={tag} value={tag}>#{tag}</option>)}</select></label>
        </fieldset>
      </div> : null}

      <div role="group" aria-label="Contact views" className="mt-4 flex gap-1 overflow-x-auto sm:gap-3">
        {CONTACT_VIEWS.map((item) => <button key={item.key} type="button" disabled={disabled} aria-pressed={view === item.key} title={item.description} onClick={() => push({ view: item.key })} className={`relative min-h-12 shrink-0 whitespace-nowrap border-b-[3px] px-2.5 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-trust disabled:opacity-50 ${view === item.key ? "border-trust font-semibold text-heading dark:border-gold" : "border-transparent text-slate hover:border-mist hover:text-heading"}`}>{item.label}</button>)}
      </div>
      {activeChips.length ? <div className="flex flex-wrap items-center gap-2 border-t border-mist py-3">
        {activeChips.map((chip) => <button key={chip.key} type="button" disabled={disabled} aria-label={`Remove ${chip.label}`} onClick={() => push(chip.key === "view" ? { view: "all" } : chip.key === "funnel" ? { funnel: "", sessionId: "" } : { [chip.key]: "" })} className={`inline-flex min-h-8 max-w-full items-center gap-2 rounded-md border border-mist bg-cloud px-2.5 py-1.5 text-xs text-heading hover:bg-mist/50 disabled:opacity-50 ${focus}`}><span className="truncate">{chip.label}</span><span className="shrink-0 text-slate" aria-hidden="true">×</span></button>)}
        <button type="button" disabled={disabled} onClick={reset} className={`min-h-8 rounded px-2 text-xs font-medium text-slate underline decoration-mist underline-offset-4 hover:text-heading ${focus}`}>Clear all</button>
      </div> : null}
    </div>
    <span aria-live="polite" className="sr-only">{pending ? "Updating contacts…" : ""}</span>
  </div>;
}

export function ContactsPageSize({ query, pageSize }: { query: string; pageSize: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const interactive = useSyncExternalStore(subscribe, clientReady, serverReady);
  return <label className="flex items-center gap-2 text-xs text-slate"><span className="hidden sm:inline">Rows per page</span><select aria-label="Page size" value={pageSize} disabled={pending || !interactive} onChange={(event) => { const params = new URLSearchParams(query); params.set("pageSize", event.target.value); params.delete("page"); startTransition(() => router.push(`/crm/contacts?${params.toString()}`, { scroll: false })); }} className="min-h-10 rounded-lg border border-mist bg-card px-2 py-2 text-sm text-body outline-none focus:border-trust focus:ring-2 focus:ring-trust/15 disabled:opacity-50">{[...new Set([25, 50, 100, 200, pageSize])].sort((a, b) => a - b).map((size) => <option key={size} value={size}>{size} / page</option>)}</select></label>;
}
