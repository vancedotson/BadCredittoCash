"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { Contact, Lead } from "@/lib/store";
import { STAGES_IN_ORDER, STAGE_LABELS, type Stage } from "@/lib/stages";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust dark:focus-visible:outline-gold";
const secondary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-mist bg-card px-4 py-2 text-sm font-semibold text-heading transition-colors hover:bg-cloud disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
const field = "min-h-12 w-full min-w-0 rounded-lg border border-mist bg-card px-3 py-2.5 text-base text-heading outline-none focus:border-trust focus:ring-2 focus:ring-trust/15 disabled:opacity-60 dark:focus:border-gold sm:text-sm";
const errorClass = "rounded-lg border border-red/25 bg-red/5 px-3 py-2.5 text-sm leading-relaxed text-red outline-none dark:text-[#ffb4aa]";

async function request<T>(url: string, method: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save. Please try again.");
  return data as T;
}

function TaskIcon() {
  return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4H5v17h14V4h-4M9 3h6v4H9zM8 12l1 1 2-2M8 17l1 1 2-2M14 12h2M14 17h2" /></svg>;
}

type Draft = { stage: Stage; owner: string; tags: string[]; updatedAt?: string };

export function ContactQuickEdit({ contact, owners, tags, canWrite, onClose, onDone, onRefresh }: {
  contact: Contact; owners: string[]; tags: string[]; canWrite: boolean;
  onClose: () => void; onDone: () => void; onRefresh: () => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tagButton = useRef<HTMLButtonElement>(null);
  const tagList = useRef<HTMLDivElement>(null);
  const tagSelect = useRef<HTMLSelectElement>(null);
  const taskInput = useRef<HTMLInputElement>(null);
  const contactErrorRef = useRef<HTMLParagraphElement>(null);
  const taskErrorRef = useRef<HTMLParagraphElement>(null);
  const [baseline, setBaseline] = useState<Draft>({ stage: contact.stage, owner: contact.owner ?? "", tags: contact.tags ?? [], updatedAt: contact.updatedAt });
  const [stage, setStage] = useState(contact.stage);
  const [owner, setOwner] = useState(contact.owner ?? "");
  const [contactTags, setContactTags] = useState(contact.tags ?? []);
  const [choosingTag, setChoosingTag] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [task, setTask] = useState("");
  const [tasksAdded, setTasksAdded] = useState(0);
  const [pending, setPending] = useState<"contact" | "task" | null>(null);
  const pendingRef = useRef(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const [taskSuccess, setTaskSuccess] = useState<string | null>(null);
  const changed = stage !== baseline.stage || owner !== baseline.owner || contactTags.length !== baseline.tags.length || contactTags.some((tag) => !baseline.tags.includes(tag));
  const availableTags = tags.filter((tag) => !contactTags.includes(tag));
  const watch = Math.max(0, Math.min(100, contact.watchPct));
  const busy = pending !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    headingRef.current?.focus();
    return () => { dialog?.close(); requestAnimationFrame(() => { if (opener?.isConnected) opener.focus(); }); };
  }, []);
  useEffect(() => { if (choosingTag) tagSelect.current?.focus(); }, [choosingTag]);
  useEffect(() => { if (taskOpen) taskInput.current?.focus(); }, [taskOpen]);
  useEffect(() => { if (contactError) contactErrorRef.current?.focus(); }, [contactError]);
  useEffect(() => { if (taskError) taskErrorRef.current?.focus(); }, [taskError]);

  async function saveContact() {
    if (!canWrite || !changed || pendingRef.current) return;
    pendingRef.current = true; setPending("contact"); setContactError(null); setContactSuccess(null);
    try {
      const result = await request<{ lead: Lead }>(`/api/crm/contact/${contact.id}`, "PATCH", { stage, owner, tags: contactTags, expectedUpdatedAt: baseline.updatedAt });
      if (task.trim()) {
        // A contact save must not discard a task that has its own submit action.
        const savedStage = result.lead.stage ?? stage;
        setBaseline({ stage: savedStage, owner: result.lead.owner ?? "", tags: result.lead.tags ?? [], updatedAt: result.lead.updatedAt });
        setStage(savedStage); setOwner(result.lead.owner ?? ""); setContactTags(result.lead.tags ?? []);
        setContactSuccess("Contact changes saved. Your task draft is still here.");
        onRefresh();
      } else onDone();
    } catch (error) { setContactError(error instanceof Error ? error.message : "Could not save this contact."); }
    finally { pendingRef.current = false; setPending(null); }
  }

  async function addTask() {
    if (!canWrite || !task.trim() || pendingRef.current) return;
    pendingRef.current = true; setPending("task"); setTaskError(null); setTaskSuccess(null);
    try {
      await request("/api/crm/task", "POST", { email: contact.email, title: task.trim() });
      setTask(""); setTasksAdded((count) => count + 1);
      setTaskSuccess("Task added. Your contact edits are still here.");
      setContactSuccess(null); onRefresh();
    } catch (error) { setTaskError(error instanceof Error ? error.message : "Could not add this task."); }
    finally { pendingRef.current = false; setPending(null); }
  }

  function close() { if (!pendingRef.current) onClose(); }

  return <dialog ref={dialogRef} aria-labelledby={`${id}-title`} aria-describedby={`${id}-email`} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }} className="fixed inset-0 m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[720px] overflow-hidden rounded-2xl border border-mist bg-card p-0 text-body shadow-2xl backdrop:bg-navy/45 backdrop:backdrop-blur-[3px]">
    <div aria-busy={busy} className="flex max-h-[calc(100dvh-1.5rem)] min-w-0 flex-col">
      <header className="flex shrink-0 items-center gap-3 px-5 pt-5 pb-4 sm:gap-4 sm:px-7 sm:pt-7 sm:pb-5">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-mist bg-cloud text-base font-semibold text-slate sm:h-16 sm:w-16 sm:text-xl">{contact.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "?"}</span>
        <div className="min-w-0 flex-1"><h2 ref={headingRef} id={`${id}-title`} tabIndex={-1} className="break-words text-xl font-bold tracking-tight text-heading outline-none sm:text-2xl">{contact.name}</h2><p id={`${id}-email`} className="mt-1 break-all text-sm text-slate">{contact.email}</p>{contact.phone ? <p className="mt-1 break-words text-xs text-slate">Phone: {contact.phone}</p> : null}</div>
        <button type="button" disabled={busy} onClick={close} aria-label="Close contact actions" className={`-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center self-start rounded-lg text-slate hover:bg-cloud hover:text-heading disabled:opacity-50 ${focus}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
      </header>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-7 sm:pb-6">
        <dl aria-label="Contact summary" className="grid grid-cols-2 gap-y-4 rounded-xl border border-mist bg-cloud/65 py-4 text-xs sm:grid-cols-4 sm:gap-y-0">
          <div className="min-w-0 px-3 sm:px-4"><dt className="text-slate">Source</dt><dd className="mt-1.5 break-words text-sm font-medium text-heading">{contact.source || "Not recorded"}</dd></div>
          <div className="min-w-0 border-l border-mist px-3 sm:px-4"><dt className="text-slate">Last activity</dt><dd className="mt-1.5 text-sm font-medium text-heading">{contact.daysSinceActivity === 0 ? "Today" : `${contact.daysSinceActivity} days ago`}</dd></div>
          <div className="min-w-0 px-3 sm:border-l sm:border-mist sm:px-4"><dt className="text-slate">Evergreen watch</dt><dd className="mt-1.5 text-sm font-medium tabular-nums text-heading">{watch}%<span aria-hidden="true" className="mt-2 block h-1.5 max-w-24 overflow-hidden rounded-full bg-mist"><span className="block h-full rounded-full bg-trust dark:bg-gold" style={{ width: `${watch}%` }} /></span></dd></div>
          <div className="min-w-0 border-l border-mist px-3 sm:px-4"><dt className="text-slate">Open tasks</dt><dd className="mt-1.5 text-sm font-medium tabular-nums text-heading">{contact.openTaskCount + tasksAdded}</dd></div>
        </dl>

        {contact.nextTask ? <div className="mt-4 flex items-start gap-3 rounded-lg border-l-2 border-gold bg-cloud/50 px-3 py-2.5 text-xs"><span className="shrink-0 pt-0.5 text-slate">Next task</span><div className="min-w-0"><p className="break-words font-medium text-heading">{contact.nextTask.title}</p>{contact.nextTask.dueDate ? <p className={`mt-1 ${contact.nextTask.overdue ? "text-red dark:text-[#ffb4aa]" : "text-slate"}`}>{contact.nextTask.overdue ? "Overdue" : "Due"} · {new Date(contact.nextTask.dueDate.length === 10 ? `${contact.nextTask.dueDate}T12:00:00` : contact.nextTask.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p> : <p className="mt-1 text-slate">No due date</p>}</div></div> : null}

        {canWrite ? <>
          <form id={`${id}-edit`} onSubmit={(event) => { event.preventDefault(); void saveContact(); }} className="mt-6">
            <fieldset disabled={busy} className="min-w-0">
              <legend className="text-lg font-semibold text-heading">Contact details</legend>
              <p className="mt-1 text-sm text-slate">Update how this contact is organized.</p>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="min-w-0 text-xs font-semibold text-heading">Stage<select value={stage} onChange={(event) => { setStage(event.target.value as Stage); setContactSuccess(null); }} className={`${field} mt-2`}>{STAGES_IN_ORDER.map((item) => <option key={item} value={item}>{STAGE_LABELS[item]}</option>)}</select></label>
                <label className="min-w-0 text-xs font-semibold text-heading">Owner<select value={owner} onChange={(event) => { setOwner(event.target.value); setContactSuccess(null); }} className={`${field} mt-2`}><option value="">Unassigned</option>{[...new Set([...owners, ...(baseline.owner ? [baseline.owner] : [])])].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              </div>
              <div className="mt-5">
                <p className="text-xs font-semibold text-heading">Tags</p>
                <div ref={tagList} className="mt-2 flex flex-wrap items-center gap-2">
                  {contactTags.length ? contactTags.map((tag) => <button type="button" key={tag} aria-label={`Remove tag ${tag}`} onClick={() => { setContactTags((previous) => previous.filter((item) => item !== tag)); setContactSuccess(null); }} className={`inline-flex min-h-9 max-w-full items-center gap-2 rounded-md border border-mist bg-cloud px-2.5 py-1.5 text-xs font-medium text-heading ${focus}`}><span className="break-all">#{tag}</span><span aria-hidden="true">×</span></button>) : <span className="mr-2 text-sm text-slate">No tags yet</span>}
                  <button ref={tagButton} type="button" disabled={!availableTags.length} aria-expanded={choosingTag} aria-controls={`${id}-tags`} title={!availableTags.length ? "No other tags available" : undefined} onClick={() => setChoosingTag((open) => !open)} className={`${secondary} min-h-10 px-3 text-xs`}>+ Add tag</button>
                </div>
                {choosingTag ? <div id={`${id}-tags`} className="mt-3 max-w-xs"><label className="text-xs text-slate">Choose a tag<select ref={tagSelect} value="" onChange={(event) => { if (!event.target.value) return; setContactTags((previous) => [...new Set([...previous, event.target.value])]); setChoosingTag(false); setContactSuccess(null); requestAnimationFrame(() => { if (tagButton.current?.disabled) tagList.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus(); else tagButton.current?.focus(); }); }} className={`${field} mt-1.5`}><option value="">Choose a tag</option>{availableTags.map((tag) => <option key={tag} value={tag}>#{tag}</option>)}</select></label></div> : null}
              </div>
            </fieldset>
          </form>
          {contactError ? <p ref={contactErrorRef} role="alert" tabIndex={-1} className={`${errorClass} mt-4`}>{contactError} Your contact edits are still here.</p> : null}
          {contactSuccess ? <p role="status" className="mt-4 rounded-lg border border-green/25 bg-green/5 px-3 py-2.5 text-sm text-green">{contactSuccess}</p> : null}

          <section className="mt-6 overflow-hidden rounded-xl border border-mist bg-cloud/60" aria-label="Task creation">
            <button type="button" disabled={busy} aria-label="Add a task" aria-expanded={taskOpen} aria-controls={`${id}-task`} onClick={() => setTaskOpen((open) => !open)} className={`flex min-h-20 w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-mist/25 disabled:opacity-60 ${focus}`}><span className="shrink-0 text-slate"><TaskIcon /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-heading">Add a task</span><span className="mt-0.5 block truncate text-xs text-slate">{task.trim() && !taskOpen ? "Task draft · not added yet" : `Create a follow-up for ${contact.name.split(" ")[0]}`}</span></span><span aria-hidden="true" className="text-xl font-light text-slate">{taskOpen ? "−" : "+"}</span></button>
            {taskOpen ? <div id={`${id}-task`} className="border-t border-mist px-4 pt-4 pb-4">
              <form onSubmit={(event) => { event.preventDefault(); void addTask(); }}>
                <label htmlFor={`${id}-task-title`} className="text-xs font-semibold text-heading">Task title</label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input ref={taskInput} id={`${id}-task-title`} disabled={busy} value={task} onChange={(event) => { setTask(event.target.value); setTaskSuccess(null); }} placeholder="What needs to happen next?" className={`${field} flex-1`} /><button type="submit" disabled={busy || !task.trim()} className={`${secondary} shrink-0`}>{pending === "task" ? "Adding…" : "Add task"}</button></div>
                <p className="mt-2 text-xs leading-relaxed text-slate">Creates an open task without a due date. Add it separately from contact changes.</p>
                {task.trim() ? <p className="mt-1 text-xs text-gold-deep">This task is not added yet.</p> : null}
              </form>
              {taskError ? <p ref={taskErrorRef} role="alert" tabIndex={-1} className={`${errorClass} mt-3`}>{taskError} Your task draft is still here.</p> : null}
              {taskSuccess ? <p role="status" className="mt-3 text-sm text-green">{taskSuccess}</p> : null}
            </div> : null}
          </section>
        </> : <div className="mt-5 space-y-3"><p className="text-sm text-heading"><span className="font-semibold">{STAGE_LABELS[contact.stage]}</span> · {contact.owner || "Unassigned"}</p>{contact.tags?.length ? <p className="break-words text-xs text-slate">{contact.tags.map((tag) => `#${tag}`).join(" · ")}</p> : null}</div>}
      </div>

      <footer className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-t border-mist bg-card px-5 py-4 sm:px-7">
        <Link href={`/crm/contacts/${contact.id}`} onClick={(event) => { if (pendingRef.current) event.preventDefault(); }} aria-disabled={busy} tabIndex={busy ? -1 : undefined} className={`inline-flex min-h-11 items-center rounded text-xs font-semibold text-trust hover:underline dark:text-gold-deep sm:text-sm ${focus}`}>Open full profile <span aria-hidden="true" className="ml-1.5">↗</span></Link>
        {canWrite ? <div className="ml-auto"><p aria-live="polite" className="mb-2 text-right text-[11px] text-slate">{pending === "contact" ? "Saving contact changes…" : pending === "task" ? "Adding task…" : changed ? "Unsaved contact changes" : contactSuccess ? "All contact changes saved" : "No changes yet"}</p><div className="flex gap-2"><button type="button" disabled={busy} onClick={close} className={secondary}>Cancel</button><button type="submit" form={`${id}-edit`} disabled={busy || !changed} className={`min-h-11 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-gold/85 disabled:cursor-not-allowed disabled:opacity-45 ${focus}`}>{pending === "contact" ? "Saving…" : "Save changes"}</button></div></div> : <button type="button" onClick={close} className={secondary}>Done</button>}
      </footer>
    </div>
  </dialog>;
}
