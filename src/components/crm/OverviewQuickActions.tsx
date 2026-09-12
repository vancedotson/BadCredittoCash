"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ContactOption } from "@/lib/store";
import { STAGES_IN_ORDER, STAGE_LABELS, type Stage } from "@/lib/stages";
import { PRIORITIES, PRIORITY_LABELS, TASK_TYPES, TYPE_LABELS, type TaskPriority, type TaskType } from "@/lib/tasks";
import { CheckIcon, ChevronRightIcon, DocumentIcon, PersonIcon, PhoneIcon, RefreshIcon } from "@/components/marketing-v2/Icons";
import styles from "./OverviewQuickActions.module.css";

const field = "mt-2 min-h-11 w-full min-w-0 rounded-lg border border-mist bg-card px-3 py-2.5 text-base font-normal text-body outline-none transition-colors focus:border-trust focus:ring-2 focus:ring-trust/15 disabled:opacity-60 sm:text-sm";
const label = "block min-w-0 text-sm font-medium text-heading";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust";
const secondary = `inline-flex min-h-11 items-center justify-center rounded-lg border border-mist bg-card px-4 py-2.5 text-sm font-semibold text-heading transition-colors hover:bg-cloud disabled:opacity-50 ${focus}`;
const primary = `inline-flex min-h-11 items-center justify-center rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-gold/85 disabled:opacity-50 ${focus}`;
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

async function api(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export function OverviewQuickActions({ contacts, owners, canWrite = true }: { contacts: ContactOption[]; owners: string[]; canWrite?: boolean }) {
  const [modal, setModal] = useState<"contact" | "task" | null>(null);
  const interactive = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  if (!canWrite) return null;
  return (
    <>
      <div className="flex shrink-0 gap-2">
        <button type="button" disabled={!interactive} onClick={() => setModal("contact")} className={secondary}>+ Contact</button>
        <button type="button" disabled={!interactive} onClick={() => setModal("task")} className={primary}>+ Task</button>
      </div>
      {modal === "contact" ? <AddContact owners={owners} onClose={() => setModal(null)} /> : null}
      {modal === "task" ? <AddTask contacts={contacts} owners={owners} onClose={() => setModal(null)} /> : null}
    </>
  );
}

function Shell({ kind, children, onClose, onSubmit, pending, err }: { kind: "contact" | "task"; children: ReactNode; onClose: () => void; onSubmit: (e: FormEvent) => void; pending: boolean; err: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const title = kind === "contact" ? "Add contact" : "Add task";
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    element?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => {
      element?.close();
      requestAnimationFrame(() => { if (opener?.isConnected) opener.focus(); });
    };
  }, []);
  useEffect(() => { if (err) errorMessage.current?.focus(); }, [err]);

  return (
    <dialog ref={dialog} aria-labelledby="overview-action-title" aria-describedby="overview-action-description" onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }} className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-mist bg-card p-0 text-body shadow-2xl backdrop:bg-navy/45 backdrop:backdrop-blur-[3px] ${styles.dialog}`}>
      <form aria-label={title} aria-busy={pending} onSubmit={onSubmit} className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className={`flex shrink-0 items-start gap-3 border-b border-mist px-5 py-5 sm:px-7 sm:py-6 ${styles.header}`}>
          <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-deep ${styles.headerIcon}`}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {kind === "contact" ? <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2m4-14v6m-3-3h6" /></> : <><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M9 4V2h6v2m-7 9 3 3 5-6" /></>}
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="overview-action-title" className={`text-xl font-semibold tracking-tight text-heading ${styles.title}`}>{title}</h2>
            <p id="overview-action-description" className="mt-1 text-sm leading-relaxed text-slate">{kind === "contact" ? "Keep their details and next steps in one place." : "Turn your next step into a clear follow-up."}</p>
          </div>
          <button type="button" aria-label={`Close ${kind} dialog`} disabled={pending} onClick={onClose} className={`-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate transition-colors hover:bg-cloud hover:text-heading disabled:opacity-50 ${focus}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
          <fieldset disabled={pending} className="min-w-0 space-y-6">{children}</fieldset>
          {err ? <p ref={errorMessage} tabIndex={-1} role="alert" className="mt-5 rounded-lg border border-red/25 bg-red/5 px-4 py-3 text-sm leading-relaxed text-red dark:text-[#ffb4aa] outline-none">{err}</p> : null}
        </div>
        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-mist bg-cloud/50 px-5 py-4 sm:px-7">
          <button type="button" disabled={pending} onClick={onClose} className={secondary}>Cancel</button>
          <button type="submit" disabled={pending} className={primary}>{pending ? "Creating…" : kind === "contact" ? "Create contact" : "Create task"}</button>
        </footer>
      </form>
    </dialog>
  );
}

function AddContact({ owners, onClose }: { owners: string[]; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: "", email: "", phone: "", source: "manual", stage: "new" as Stage, owner: "" });
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const saving = useRef(false);
  const close = () => { if (!saving.current) onClose(); };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving.current) return;
    if (!v.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) { setErr("Name and a valid email are required."); return; }
    saving.current = true;
    setPending(true); setErr(null);
    try { await api("/api/crm/contact", "POST", v); onClose(); router.refresh(); }
    catch { saving.current = false; setErr("Could not create the contact. Your details are still here; please try again."); setPending(false); }
  }
  return (
    <Shell kind="contact" onClose={close} onSubmit={submit} pending={pending} err={err}>
      <div className={styles.details}>
        <label className={label}>
          <span className={styles.fieldHeading}>Name<span aria-hidden="true" className={styles.required}>Required</span></span>
          <input name="name" required autoComplete="name" data-initial-focus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Full name" className={`${field} ${styles.nameInput}`} />
        </label>
        <div className={styles.contactColumns}>
          <label className={label}>
            <span className={styles.fieldHeading}>Email<span aria-hidden="true" className={styles.required}>Required</span></span>
            <span className={styles.contactControl}><EmailIcon className={styles.contactControlIcon} /><input name="email" type="email" required autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} placeholder="name@example.com" className={`${field} ${styles.contactField} ${styles.iconField}`} /></span>
          </label>
          <label className={label}>Phone <span className="font-normal text-slate">(optional)</span>
            <span className={styles.contactControl}><PhoneIcon className={styles.contactControlIcon} /><input aria-label="Phone" name="phone" type="tel" autoComplete="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="Phone number" className={`${field} ${styles.contactField} ${styles.iconField}`} /></span>
          </label>
        </div>
      </div>
      <section aria-labelledby="overview-contact-crm-title" className={styles.crmDetails}>
        <div className={styles.crmHeading}>
          <span className={styles.crmIcon}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 8v4M6 16v-4h12v4" /></svg></span>
          <div><h3 id="overview-contact-crm-title" className={styles.crmTitle}>CRM details</h3><p className={styles.crmDescription}>Set their source, stage, and owner.</p></div>
        </div>
        <label className={label}>Source<input name="source" value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} className={`${field} ${styles.contactField}`} /></label>
        <div className={styles.contactColumns}>
          <label className={label}>Stage<span className={styles.contactControl}><span aria-hidden="true" className={styles.stageDot} /><select aria-label="Stage" name="stage" value={v.stage} onChange={(e) => setV({ ...v, stage: e.target.value as Stage })} className={`${field} ${styles.contactField} ${styles.iconField}`}>{STAGES_IN_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}</select></span></label>
          <label className={label}>Owner<span className={styles.contactControl}><PersonIcon className={styles.contactControlIcon} /><select aria-label="Owner" name="owner" value={v.owner} onChange={(e) => setV({ ...v, owner: e.target.value })} className={`${field} ${styles.contactField} ${styles.iconField}`}><option value="">Unassigned</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select></span></label>
        </div>
      </section>
    </Shell>
  );
}

function AddTask({ contacts, owners, onClose }: { contacts: ContactOption[]; owners: string[]; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ email: contacts[0]?.email ?? "", title: "", type: "follow_up" as TaskType, priority: "normal" as TaskPriority, owner: "", date: "" });
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const saving = useRef(false);
  const contact = contacts.find((item) => item.email === v.email);
  const initials = contact?.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const close = () => { if (!saving.current) onClose(); };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving.current) return;
    if (!v.title.trim() || !v.email) { setErr("A contact and a title are required."); return; }
    saving.current = true;
    setPending(true); setErr(null);
    try {
      await api("/api/crm/task", "POST", { email: v.email, title: v.title.trim(), type: v.type, priority: v.priority, owner: v.owner, dueDate: v.date ? new Date(`${v.date}T00:00:00`).toISOString() : "" });
      onClose(); router.refresh();
    } catch { saving.current = false; setErr("Could not create the task. Your details are still here; please try again."); setPending(false); }
  }
  return (
    <Shell kind="task" onClose={close} onSubmit={submit} pending={pending} err={err}>
      <div className={styles.details}>
        <label className={label}>
          <span className={styles.fieldHeading}>Task title<span aria-hidden="true" className={styles.required}>Required</span></span>
          <input name="title" required data-initial-focus value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="What needs to happen next?" className={`${field} ${styles.titleInput}`} />
        </label>
        <div>
          <label htmlFor="overview-task-contact" className={`${label} ${styles.fieldHeading}`}>Contact<span aria-hidden="true" className={styles.required}>Required</span></label>
          <div className={styles.contactPicker}>
            <div aria-hidden="true" className={styles.contactIdentity}>
              <span className={styles.avatar}>{initials || <PersonIcon className="h-5 w-5" />}</span>
              <span className={styles.contactText}>
                <span className={styles.contactName}>{contact?.name || "No contacts available"}</span>
                {contact ? <span className={styles.contactEmail}>{contact.email}</span> : null}
              </span>
              <ChevronRightIcon className={styles.chevron} />
            </div>
            {/* A native select retains keyboard navigation and the mobile contact picker. */}
            <select id="overview-task-contact" aria-label="Contact" aria-describedby={contact ? "overview-task-contact-email" : "overview-task-no-contacts"} name="contact" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} className={styles.contactSelect}>
              {contacts.length === 0 ? <option value="">No contacts available</option> : null}
              {contacts.map((c) => <option key={c.id} value={c.email}>{c.name}</option>)}
            </select>
          </div>
          {contact ? <span id="overview-task-contact-email" className="sr-only">{contact.email}</span> : <p id="overview-task-no-contacts" className="mt-2 text-sm text-slate">Add a contact before creating a task.</p>}
        </div>
      </div>
      <div className={styles.plan}>
        <p className={styles.sectionHeading}>Plan the follow-up</p>
        <fieldset className={styles.choiceGroup}>
          <legend className={label}>Type</legend>
          <div className={styles.typeGrid}>
            {TASK_TYPES.map((type) => (
              <label key={type} className={styles.choice}>
                <input className={styles.choiceInput} type="radio" name="type" value={type} checked={v.type === type} onChange={() => setV({ ...v, type })} />
                <span className={styles.typeChoice}><TaskTypeIcon type={type} /><span>{TYPE_LABELS[type]}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.choiceGroup}>
          <legend className={label}>Priority</legend>
          <div className={styles.priorityGrid}>
            {PRIORITIES.map((priority) => (
              <label key={priority} className={styles.choice}>
                <input className={styles.choiceInput} type="radio" name="priority" value={priority} checked={v.priority === priority} onChange={() => setV({ ...v, priority })} />
                <span className={styles.priorityChoice}><CheckIcon className={styles.priorityCheck} /><span>{PRIORITY_LABELS[priority]}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className={styles.schedule}>
          <label className={label}>Due date <span className="font-normal text-slate">(optional)</span><input aria-label="Due date" name="date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className={field} /></label>
          <label className={label}>Owner<span className={styles.ownerPicker}><PersonIcon className={styles.ownerIcon} /><select aria-label="Owner" name="owner" value={v.owner} onChange={(e) => setV({ ...v, owner: e.target.value })} className={`${field} ${styles.ownerSelect}`}><option value="">Unassigned</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select></span></label>
        </div>
      </div>
    </Shell>
  );
}

function TaskTypeIcon({ type }: { type: TaskType }) {
  if (type === "email") {
    return <EmailIcon className={styles.typeIcon} />;
  }
  const Icon = type === "call" ? PhoneIcon : type === "follow_up" ? RefreshIcon : type === "document" ? DocumentIcon : CheckIcon;
  return <Icon className={styles.typeIcon} />;
}

function EmailIcon({ className }: { className: string }) {
  return <svg viewBox="0 0 20 20" fill="none" className={className} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="14" height="11" rx="1.5" /><path d="m3.5 5 6.5 5 6.5-5" /></svg>;
}
