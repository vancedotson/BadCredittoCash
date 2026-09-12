"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Contact } from "@/lib/store";
import { contactsToCsv } from "@/lib/csv";
import { STAGES_IN_ORDER, STAGE_LABELS, STAGE_TONES, type Stage, type Tone } from "@/lib/stages";
import { SEGMENT_LABELS } from "@/lib/segments";
import { ContactQuickEdit } from "./ContactQuickEdit";

const secondaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-mist bg-card px-3 py-2 text-sm font-medium text-heading transition-colors hover:bg-cloud focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-50";
const field = "min-h-11 w-full rounded-lg border border-mist bg-card px-3 py-2 text-sm text-heading outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60";

function fmtDate(iso: string) {
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(date.valueOf()) ? "No date" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function download(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
async function api(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Request failed. Please try again.");
  return payload;
}
function toneClass(tone: Tone) {
  if (tone === "success") return "bg-green/10 text-green";
  if (tone === "active" || tone === "warn") return "bg-gold/15 text-gold-deep";
  if (tone === "danger") return "bg-red/10 text-red dark:text-[#ffb4aa]";
  if (tone === "info") return "bg-sky text-trust dark:text-gold-deep";
  return "bg-cloud text-slate";
}
function StagePill({ stage }: { stage: Stage }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${toneClass(STAGE_TONES[stage])}`}><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{STAGE_LABELS[stage]}</span>;
}
function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full border border-mist bg-cloud font-semibold text-slate ${small ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs"}`}>{initials(name) || "?"}</span>;
}
function Engagement({ contact, short = false }: { contact: Contact; short?: boolean }) {
  const percent = Math.max(0, Math.min(100, contact.watchPct));
  return <div className="min-w-0">
    {!short ? <p className="max-w-52 text-xs leading-5 text-heading">{SEGMENT_LABELS[contact.segment]}</p> : null}
    <div className={`${short ? "" : "mt-1.5 "}flex items-center gap-2`}>
      <span aria-hidden="true" className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-mist"><span className="block h-full rounded-full bg-trust dark:bg-gold" style={{ width: `${percent}%` }} /></span>
      <span className="whitespace-nowrap text-[11px] text-slate"><span className="font-semibold tabular-nums text-heading">{percent}%</span> evergreen watch</span>
    </div>
  </div>;
}
function NextTask({ contact }: { contact: Contact }) {
  const task = contact.nextTask;
  if (!task) return <span className="text-xs text-slate">{contact.openTaskCount ? `${contact.openTaskCount} open task${contact.openTaskCount === 1 ? "" : "s"}` : "No next task"}</span>;
  return <div className="max-w-52">
    <p title={task.title} className="line-clamp-2 text-xs font-medium leading-5 text-heading">{task.title}</p>
    <p className={`mt-1 text-[11px] ${task.overdue ? "font-medium text-red dark:text-[#ffb4aa]" : "text-slate"}`}>{task.overdue ? "Overdue" : task.dueDate ? "Due" : "No due date"}{task.dueDate ? ` · ${fmtDate(task.dueDate)}` : ""}</p>
  </div>;
}
function bulkProgressMessage(action: string, count: number) {
  const contacts = `${count} contact${count === 1 ? "" : "s"}`;
  if (action === "delete") return `Moving ${contacts} to Trash…`;
  if (action === "stage") return `Updating the stage for ${contacts}…`;
  if (action === "owner") return `Assigning ${contacts}…`;
  if (action === "tag") return `Adding the tag to ${contacts}…`;
  return `Adding the task to ${contacts}…`;
}
function bulkSuccessMessage(action: string, count: number) {
  const contacts = `${count} contact${count === 1 ? "" : "s"}`;
  if (action === "delete") return `Moved ${contacts} to Trash.`;
  if (action === "stage") return `Updated the stage for ${contacts}.`;
  if (action === "owner") return `Updated the owner for ${contacts}.`;
  if (action === "tag") return `Added the tag to ${contacts}.`;
  return `Added the task to ${contacts}.`;
}

export function ContactsTable({ rows, allIds, owners, tags, total, canWrite, canAdmin, query }: {
  rows: Contact[]; allIds: string[]; owners: string[]; tags: string[]; total: number;
  canWrite: boolean; canAdmin: boolean; query: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [compact, setCompact] = useState(false);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [bulkInput, setBulkInput] = useState<{ action: "tag" | "task"; value: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<{ action: string; count: number } | null>(null);
  const pendingRef = useRef(false);
  const [actionError, setActionError] = useState<{ message: string; retry: () => void } | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [tableScroll, setTableScroll] = useState({ left: false, right: false });

  useEffect(() => {
    if (pendingAction) return;
    const frame = requestAnimationFrame(() => {
      const available = new Set(allIds);
      setSelected((previous) => {
        const next = new Set([...previous].filter((id) => available.has(id)));
        return next.size === previous.size ? previous : next;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [allIds, pendingAction]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let saved: string | null = null;
      try { saved = localStorage.getItem("crm-contacts-compact"); } catch { /* Density also works without browser storage. */ }
      setCompact(saved === "1" || (saved !== "0" && window.matchMedia("(max-width: 1535px)").matches));
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  function toggleDensity() {
    setCompact((previous) => {
      const next = !previous;
      try { localStorage.setItem("crm-contacts-compact", next ? "1" : "0"); } catch { /* Keep the current preference for this visit. */ }
      return next;
    });
  }
  function syncTableScroll() {
    const element = tableScrollRef.current;
    if (element) setTableScroll({ left: element.scrollLeft > 2, right: element.scrollLeft < element.scrollWidth - element.clientWidth - 2 });
  }
  useEffect(() => {
    const frame = requestAnimationFrame(syncTableScroll);
    const observer = new ResizeObserver(syncTableScroll);
    if (tableScrollRef.current) observer.observe(tableScrollRef.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [rows, compact]);

  const parameters = new URLSearchParams(query);
  const sort = parameters.get("sort") ?? "recent";
  const direction = parameters.get("dir") ?? "desc";
  const pending = pendingAction !== null;
  const selectable = canWrite || canAdmin;
  const pageIds = rows.map((contact) => contact.id);
  const currentIds = new Set(allIds);
  const allPageSelected = rows.length > 0 && pageIds.every((id) => selected.has(id));
  const ids = allMatching ? allIds : [...selected].filter((id) => currentIds.has(id));
  const count = ids.length;
  const hasSelectionOnOtherPages = ids.some((id) => !pageIds.includes(id));

  function sortBy(sortField: string) {
    if (pendingRef.current) return;
    const next = new URLSearchParams(query);
    next.set("sort", sortField);
    next.set("dir", sort === sortField && direction === "desc" ? "asc" : "desc");
    next.delete("page");
    router.push(`/crm/contacts?${next.toString()}`);
  }
  function toggleAll() {
    if (pendingRef.current) return;
    setActionError(null);
    if (allPageSelected || allMatching) { setSelected(new Set()); setAllMatching(false); }
    else setSelected(new Set(pageIds));
  }
  function toggleOne(id: string) {
    if (pendingRef.current) return;
    setActionError(null);
    const previouslyAllMatching = allMatching;
    setAllMatching(false);
    setSelected((previous) => { const next = new Set(previouslyAllMatching ? allIds : previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function clearSelection() { setSelected(new Set()); setAllMatching(false); setBulkInput(null); }

  async function bulk(action: string, value?: string) {
    if (!count || pendingRef.current || !canWrite || (action === "delete" && !canAdmin)) return;
    if (action === "delete" && !window.confirm(`Move ${count} contact${count === 1 ? "" : "s"} to Trash? Their notes, tasks, bookings, and activity history will be preserved and an administrator can restore them.`)) return;
    const operationIds = [...ids];
    pendingRef.current = true;
    setPendingAction({ action, count: operationIds.length });
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await api("/api/crm/contacts/bulk", "POST", { ids: operationIds, action, value, confirm: action === "delete" ? "DELETE" : undefined });
      if (typeof result?.affected !== "number") throw new Error("The server did not confirm how many contacts were updated. Refresh the list before retrying.");
      const unaffected = operationIds.length - result.affected;
      setActionSuccess(`${bulkSuccessMessage(action, result.affected)}${unaffected > 0 ? ` ${unaffected} selected contact${unaffected === 1 ? " was" : "s were"} not updated.` : ""}`);
      clearSelection();
      router.refresh();
    } catch (error) {
      setActionError({ message: error instanceof Error ? error.message : "Could not update the selected contacts.", retry: () => { void bulk(action, value); } });
    } finally { pendingRef.current = false; setPendingAction(null); }
  }
  function exportSelected() {
    if (!canAdmin || allMatching || hasSelectionOnOtherPages || pendingRef.current) return;
    const chosen = rows.filter((contact) => selected.has(contact.id));
    if (chosen.length) download(contactsToCsv(chosen), "vance-contacts-selected.csv");
  }
  const arrow = (sortField: string) => <span aria-hidden="true" className={sort === sortField ? "text-heading" : "text-slate"}>{sort === sortField ? direction === "asc" ? "↑" : "↓" : "↕"}</span>;
  const sortState = (sortField: string) => sort === sortField ? direction === "asc" ? "ascending" as const : "descending" as const : "none" as const;
  const cell = compact ? "px-4 py-3" : "px-4 py-4";

  return <div>
    {actionError ? <div role="alert" className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red/30 bg-red/5 px-4 py-3 text-sm text-red dark:text-[#ffb4aa]">
      <span>{actionError.message} Your selection is still here.</span>
      <span className="flex items-center gap-3"><button type="button" disabled={pending} onClick={actionError.retry} className="min-h-10 font-semibold underline">Try again</button><button type="button" disabled={pending} onClick={() => setActionError(null)} aria-label="Dismiss error" className="h-10 w-10 text-lg">×</button></span>
    </div> : null}
    {actionSuccess ? <div role="status" className="m-4 flex items-center justify-between gap-3 rounded-xl border border-green/30 bg-green/10 px-4 py-3 text-sm text-green"><span>{actionSuccess}</span><button type="button" onClick={() => setActionSuccess(null)} aria-label="Dismiss confirmation" className="h-10 w-10 shrink-0 text-lg">×</button></div> : null}

    {count > 0 ? <div aria-busy={pending} className="m-4 rounded-xl border border-mist bg-cloud p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <strong className="font-semibold text-heading">{count} selected{allMatching ? " across all matching results" : hasSelectionOnOtherPages ? " across matching results" : " on this page"}</strong>
        {!allMatching && allPageSelected && total > rows.length ? <button type="button" disabled={pending} onClick={() => { setAllMatching(true); setActionError(null); }} className="min-h-10 font-medium text-trust underline dark:text-gold-deep">Select all {total} matching contacts</button> : null}
        <button type="button" disabled={pending} onClick={() => { clearSelection(); setActionError(null); }} className="ml-auto min-h-10 text-slate underline disabled:opacity-50">Clear selection</button>
      </div>
      {pendingAction ? <div role="status" aria-live="polite" className="mb-3 flex items-center gap-2 text-sm font-medium text-heading"><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-mist border-t-heading" />{bulkProgressMessage(pendingAction.action, pendingAction.count)}</div> : null}
      <fieldset disabled={pending} className="flex flex-wrap gap-2 disabled:opacity-60"><legend className="sr-only">Actions for selected contacts</legend>
        {canWrite ? <>
          <select defaultValue="" aria-label="Set stage" onChange={(event) => { if (event.target.value) void bulk("stage", event.target.value); event.target.value = ""; }} className={`${secondaryButton} max-w-full`}><option value="" disabled>Set stage…</option>{STAGES_IN_ORDER.map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}</select>
          <select defaultValue="" aria-label="Assign owner" onChange={(event) => { void bulk("owner", event.target.value === "__none__" ? "" : event.target.value); event.target.value = ""; }} className={`${secondaryButton} max-w-full`}><option value="" disabled>Assign owner…</option><option value="__none__">Unassigned</option>{owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select>
          <button type="button" onClick={() => setBulkInput({ action: "tag", value: "" })} className={secondaryButton}>Add tag</button>
          <button type="button" onClick={() => setBulkInput({ action: "task", value: "" })} className={secondaryButton}>Add task</button>
        </> : null}
        {canAdmin && !allMatching && !hasSelectionOnOtherPages ? <button type="button" onClick={exportSelected} className={secondaryButton}>Export selected</button> : null}
        {canAdmin && canWrite ? <button type="button" onClick={() => void bulk("delete")} className={`${secondaryButton} text-red dark:text-[#ffb4aa]`}>Move to Trash</button> : null}
      </fieldset>
      {bulkInput ? <form onSubmit={(event) => { event.preventDefault(); if (bulkInput.value.trim()) void bulk(bulkInput.action, bulkInput.value.trim()); }} className="mt-3 border-t border-mist pt-3">
        <label htmlFor="contacts-bulk-value" className="mb-2 block text-xs font-semibold text-heading">{bulkInput.action === "tag" ? "Tag to add" : "Task title"}</label>
        <div className="flex flex-col gap-2 sm:flex-row"><input id="contacts-bulk-value" autoFocus disabled={pending} required value={bulkInput.value} onChange={(event) => setBulkInput({ ...bulkInput, value: event.target.value })} className={`${field} min-w-0 flex-1`} /><button type="submit" disabled={pending || !bulkInput.value.trim()} className="min-h-11 shrink-0 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-gold/85 disabled:opacity-50">Apply to {count}</button><button type="button" disabled={pending} onClick={() => setBulkInput(null)} className={secondaryButton}>Cancel</button></div>
      </form> : null}
    </div> : null}

    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-mist px-4 py-2 sm:px-5">
      <span className="hidden text-xs text-slate md:block">{sort === "recent" ? "Most recent activity first" : `Sorted by ${sort === "created" ? "date added" : sort === "watch" ? "evergreen watch" : sort} · ${direction === "asc" ? "ascending" : "descending"}`}</span>
      {selectable && rows.length ? <label className="flex min-h-10 items-center gap-2 text-xs font-medium text-slate md:hidden"><input type="checkbox" disabled={pending} checked={allMatching || allPageSelected} onChange={toggleAll} className="h-4 w-4 accent-navy dark:accent-gold" />Select all on this page</label> : <span className="text-xs text-slate md:hidden">{rows.length} on this page</span>}
      <button type="button" disabled={pending} onClick={toggleDensity} className="ml-auto hidden min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-medium text-slate hover:bg-cloud hover:text-heading disabled:opacity-50 md:inline-flex"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4"><path d={compact ? "M2 4h12M2 8h12M2 12h12" : "M2 3h12v3H2zM2 10h12v3H2z"} /></svg>{compact ? "Comfortable rows" : "Compact rows"}</button>
      <div className="hidden items-center gap-1 md:flex"><button type="button" disabled={pending || !tableScroll.left} onClick={() => tableScrollRef.current?.scrollBy({ left: -360, behavior: "smooth" })} aria-label="Scroll table left" className="grid h-8 w-8 place-items-center rounded-lg border border-mist text-lg text-heading hover:bg-cloud disabled:opacity-30">‹</button><button type="button" disabled={pending || !tableScroll.right} onClick={() => tableScrollRef.current?.scrollBy({ left: 360, behavior: "smooth" })} aria-label="Scroll table right" className="grid h-8 w-8 place-items-center rounded-lg border border-mist text-lg text-heading hover:bg-cloud disabled:opacity-30">›</button></div>
    </div>

    <div ref={tableScrollRef} onScroll={syncTableScroll} className="crm-scroll hidden overflow-x-auto md:block">
      <table className="w-full min-w-[1100px] text-left text-sm"><caption className="sr-only">Contacts, owners, pipeline stages, evergreen engagement, and next tasks</caption>
        <thead className="border-b border-mist bg-cloud/70 text-[10px] uppercase tracking-[0.08em] text-slate"><tr>
          {selectable ? <th scope="col" className="sticky left-0 z-20 w-12 bg-cloud px-4 py-3"><input type="checkbox" disabled={pending || !rows.length} checked={allMatching || allPageSelected} ref={(element) => { if (element) element.indeterminate = !allMatching && count > 0 && !allPageSelected; }} onChange={toggleAll} className="h-4 w-4 cursor-pointer accent-navy dark:accent-gold" aria-label="Select all" /></th> : null}
          <th scope="col" aria-sort={sortState("name")} className={`sticky ${selectable ? "left-12" : "left-0"} z-20 min-w-60 bg-cloud px-4 py-3 font-semibold`}><button disabled={pending} type="button" onClick={() => sortBy("name")} className="inline-flex items-center gap-2 uppercase">Contact {arrow("name")}</button></th>
          <th scope="col" className="min-w-28 px-4 py-3 font-semibold">Owner</th>
          <th scope="col" aria-sort={sortState("stage")} className="min-w-32 px-4 py-3 font-semibold"><button disabled={pending} type="button" onClick={() => sortBy("stage")} className="inline-flex items-center gap-2 uppercase">Stage {arrow("stage")}</button></th>
          <th scope="col" aria-sort={sortState("watch")} className="min-w-60 px-4 py-3 font-semibold"><span className="block">Engagement</span><button disabled={pending} type="button" onClick={() => sortBy("watch")} className="mt-1 inline-flex items-center gap-1 text-[10px] font-normal normal-case">Evergreen watch {arrow("watch")}</button></th>
          <th scope="col" className="min-w-48 px-4 py-3 font-semibold">Next task</th>
          <th scope="col" aria-sort={sortState("created")} className="min-w-24 px-4 py-3 font-semibold"><button disabled={pending} type="button" onClick={() => sortBy("created")} className="inline-flex items-center gap-2 uppercase">Added {arrow("created")}</button></th>
          <th scope="col" className="sticky right-0 z-20 w-14 border-l border-mist bg-cloud px-2 py-3"><span className="sr-only">Contact actions</span></th>
        </tr></thead>
        <tbody className="divide-y divide-mist">
          {rows.length === 0 ? <tr><td colSpan={selectable ? 8 : 7}><EmptyContacts /></td></tr> : rows.map((contact) => {
            const checked = allMatching || selected.has(contact.id);
            const background = checked ? "bg-cloud" : "bg-card group-hover:bg-cloud";
            return <tr key={contact.id} className={`group transition-colors ${checked ? "bg-cloud" : "hover:bg-cloud"}`}>
              {selectable ? <td className={`${cell} sticky left-0 z-10 ${background}`}><input type="checkbox" disabled={pending} checked={checked} onChange={() => toggleOne(contact.id)} className="h-4 w-4 cursor-pointer accent-navy dark:accent-gold" aria-label={`Select ${contact.name}`} /></td> : null}
              <td className={`${cell} sticky ${selectable ? "left-12" : "left-0"} z-10 ${background}`}><div className="flex items-center gap-3"><Avatar name={contact.name} small={compact} /><div className="min-w-0"><Link href={`/crm/contacts/${contact.id}`} className="font-semibold text-heading decoration-gold underline-offset-4 hover:underline">{contact.name}</Link><p title={contact.email} className="mt-1 max-w-52 truncate text-xs text-slate">{contact.email}</p>{contact.tags?.length ? <div className="mt-1.5 flex max-w-52 flex-wrap gap-1">{contact.tags.map((tag) => <span key={tag} className="rounded bg-cloud px-1.5 py-0.5 text-[10px] font-medium text-slate">#{tag}</span>)}</div> : null}</div></div></td>
              <td className={`${cell} text-xs text-slate`}>{contact.owner ? <span className="flex items-center gap-2"><span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cloud text-[9px] font-semibold text-heading">{initials(contact.owner)}</span>{contact.owner}</span> : "Unassigned"}</td>
              <td className={cell}><StagePill stage={contact.stage} /></td>
              <td className={cell}><Engagement contact={contact} /></td>
              <td className={cell}><NextTask contact={contact} /></td>
              <td className={`${cell} whitespace-nowrap text-xs text-slate`}>{fmtDate(contact.createdAt)}</td>
              <td className={`sticky right-0 z-10 border-l border-mist px-2 ${background}`}><button type="button" disabled={pending} onClick={() => setActiveContact(contact)} aria-label={`${canWrite ? "Manage" : "View"} ${contact.name}`} className="grid h-10 w-10 place-items-center rounded-lg text-xl text-slate hover:bg-mist/50 hover:text-heading disabled:opacity-50">⋯</button></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>

    <div className="divide-y divide-mist md:hidden">
      {!rows.length ? <EmptyContacts /> : rows.map((contact) => <article key={contact.id} aria-label={contact.name} className={`p-4 ${allMatching || selected.has(contact.id) ? "bg-cloud" : "bg-card"}`}>
        <div className="flex items-start gap-3">
          {selectable ? <label className="-ml-2 -mt-1 grid h-10 w-8 shrink-0 place-items-center"><span className="sr-only">Select {contact.name}</span><input type="checkbox" disabled={pending} checked={allMatching || selected.has(contact.id)} onChange={() => toggleOne(contact.id)} className="h-4 w-4 accent-navy dark:accent-gold" /></label> : null}
          <Avatar name={contact.name} small />
          <div className="min-w-0 flex-1"><Link href={`/crm/contacts/${contact.id}`} className="font-semibold text-heading underline-offset-4 hover:underline">{contact.name}</Link><p title={contact.email} className="mt-1 truncate text-xs text-slate">{contact.email}</p></div>
          <button type="button" disabled={pending} onClick={() => setActiveContact(contact)} aria-label={`${canWrite ? "Manage" : "View"} ${contact.name}`} className="-mr-2 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xl text-slate hover:bg-cloud disabled:opacity-50">⋯</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><StagePill stage={contact.stage} /><span className="text-xs text-slate">{contact.owner ?? "Unassigned"}</span>{contact.tags?.map((tag) => <span key={tag} className="rounded bg-cloud px-1.5 py-0.5 text-[10px] text-slate">#{tag}</span>)}</div>
        <div className="mt-3 rounded-lg border border-mist bg-cloud/50 p-3"><Engagement contact={contact} /><div className="mt-3 border-t border-mist pt-3"><p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate">Next task</p><NextTask contact={contact} /></div></div>
        <p className="mt-3 text-[11px] text-slate">Added {fmtDate(contact.createdAt)} · {contact.daysSinceActivity === 0 ? "Active today" : `Active ${contact.daysSinceActivity}d ago`}</p>
      </article>)}
    </div>
    {activeContact ? <ContactQuickEdit key={activeContact.id} contact={activeContact} owners={owners} tags={tags} canWrite={canWrite} onClose={() => setActiveContact(null)} onDone={() => { setActiveContact(null); router.refresh(); }} onRefresh={() => router.refresh()} /> : null}
  </div>;
}

function EmptyContacts() {
  return <div className="px-5 py-14 text-center"><span aria-hidden="true" className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-mist bg-cloud text-slate"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg></span><p className="font-semibold text-heading">No contacts match these filters.</p><p className="mt-2 text-sm text-slate">Try a different search or clear your filters to see everyone.</p><Link href="/crm/contacts?view=all" className={`${secondaryButton} mt-5`}>Reset filters</Link></div>;
}
