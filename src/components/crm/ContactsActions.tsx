"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { STAGES_IN_ORDER, STAGE_LABELS, type Stage } from "@/lib/stages";
import { CONTACT_IMPORT_FIELDS, emptyContactMapping, mapContactRows, parseContactCsv, suggestContactMapping, type ContactColumnMapping, type ContactCsv } from "@/lib/contact-csv";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust";
const field = "mt-2 min-h-11 w-full min-w-0 rounded-lg border border-mist bg-card px-3 py-2.5 text-base font-normal text-body outline-none transition-colors focus:border-trust focus:ring-2 focus:ring-trust/15 disabled:opacity-60 sm:text-sm";
const label = "block min-w-0 text-sm font-medium text-heading";
const secondary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-mist bg-card px-4 py-2.5 text-sm font-semibold text-heading transition-colors hover:bg-cloud disabled:opacity-50 ${focus}`;
const primary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-gold/85 disabled:opacity-50 ${focus}`;
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

async function api<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed. Please try again.");
  return data as T;
}

function ActionIcon({ kind, size = 18 }: { kind: "contact" | "upload" | "download" | "check"; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "contact" ? <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2m4-14v6m-3-3h6" /></> : kind === "check" ? <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></> : <><path d="M4 15v5h16v-5M12 3v12" /><path d={kind === "upload" ? "m7 8 5-5 5 5" : "m7 10 5 5 5-5"} /></>}
  </svg>;
}

export function ContactsActions({ owners, canWrite, canAdmin, exportHref }: { owners: string[]; canWrite: boolean; canAdmin: boolean; exportHref: string }) {
  const [modal, setModal] = useState<"add" | "import" | null>(null);
  const interactive = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  if (!canWrite && !canAdmin) return null;
  return <>
    <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
      {canAdmin ? <a href={exportHref} aria-label="Export all CSV" className={secondary}><ActionIcon kind="download" />Export CSV</a> : null}
      {canAdmin ? <button type="button" disabled={!interactive} onClick={() => setModal("import")} className={secondary}><ActionIcon kind="upload" />Import CSV</button> : null}
      {canWrite ? <button type="button" disabled={!interactive} onClick={() => setModal("add")} className={`${primary} col-span-2`}>+ Add contact</button> : null}
    </div>
    {modal === "add" ? <AddContactDialog owners={owners} onClose={() => setModal(null)} /> : null}
    {modal === "import" ? <ImportContactsDialog onClose={() => setModal(null)} /> : null}
  </>;
}

function DialogShell({ kind, children, footer, onClose, onSubmit, pending, error }: { kind: "contact" | "import"; children: ReactNode; footer: ReactNode; onClose: () => void; onSubmit: (event: FormEvent) => void; pending: boolean; error: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const title = kind === "contact" ? "Add contact" : "Import contacts (CSV)";
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
  useEffect(() => { if (error) errorMessage.current?.focus(); }, [error]);
  return <dialog ref={dialog} aria-labelledby="contacts-action-title" aria-describedby="contacts-action-description" onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }} className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-mist bg-card p-0 text-body shadow-2xl backdrop:bg-navy/45 backdrop:backdrop-blur-[3px] ${kind === "import" ? "max-w-2xl" : "max-w-xl"}`}>
    <form aria-label={title} aria-busy={pending} onSubmit={onSubmit} className="flex max-h-[calc(100dvh-2rem)] flex-col">
      <header className="flex shrink-0 items-start gap-3 border-b border-mist px-5 py-5 sm:px-7 sm:py-6">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-deep"><ActionIcon kind={kind === "contact" ? "contact" : "upload"} size={21} /></span>
        <div className="min-w-0 flex-1">
          <h2 id="contacts-action-title" className="text-xl font-semibold tracking-tight text-heading">{title}</h2>
          <p id="contacts-action-description" className="mt-1 text-sm leading-relaxed text-slate">{kind === "contact" ? "Start with the essentials. Keep their details in one place." : "Match your columns, review the changes, then import."}</p>
        </div>
        <button type="button" aria-label={`Close ${kind === "contact" ? "contact" : "import"} dialog`} disabled={pending} onClick={onClose} className={`-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate transition-colors hover:bg-cloud hover:text-heading disabled:opacity-50 ${focus}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
        <fieldset disabled={pending} className="min-w-0 space-y-6">{children}</fieldset>
        {error ? <p ref={errorMessage} tabIndex={-1} role="alert" className="mt-5 rounded-lg border border-red/25 bg-red/5 px-4 py-3 text-sm leading-relaxed text-red outline-none dark:text-[#ffb4aa]">{error}</p> : null}
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-mist bg-cloud/50 px-5 py-4 sm:px-7">{footer}</footer>
    </form>
  </dialog>;
}

function AddContactDialog({ owners, onClose }: { owners: string[]; onClose: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState({ name: "", email: "", phone: "", source: "manual", stage: "new" as Stage, owner: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const close = () => { if (!saving.current) onClose(); };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    if (!value.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) { setError("Name and a valid email are required."); return; }
    saving.current = true;
    setPending(true);
    setError(null);
    try {
      await api("/api/crm/contact", value);
      onClose();
      router.refresh();
    } catch (reason) {
      saving.current = false;
      setPending(false);
      setError(`${reason instanceof Error ? reason.message : "Could not create the contact."} Your details are still here.`);
    }
  }
  return <DialogShell kind="contact" onClose={close} onSubmit={submit} pending={pending} error={error} footer={<><button type="button" disabled={pending} onClick={close} className={secondary}>Cancel</button><button type="submit" disabled={pending} className={primary}>{pending ? "Adding…" : "Add contact"}</button></>}>
    <div className="space-y-4">
      <label className={label}>Name<input name="name" required autoComplete="name" data-initial-focus value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} placeholder="Full name" className={field} /></label>
      <label className={label}>Email<input name="email" type="email" required autoComplete="email" value={value.email} onChange={(event) => setValue({ ...value, email: event.target.value })} placeholder="name@example.com" className={field} /></label>
      <label className={label}>Phone <span className="font-normal text-slate">(optional)</span><input aria-label="Phone" name="phone" type="tel" autoComplete="tel" value={value.phone} onChange={(event) => setValue({ ...value, phone: event.target.value })} placeholder="Phone number" className={field} /></label>
    </div>
    <div className="border-t border-mist pt-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate">Organization</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Source<input name="source" value={value.source} onChange={(event) => setValue({ ...value, source: event.target.value })} className={field} /></label>
        <label className={label}>Stage<select aria-label="Stage" name="stage" value={value.stage} onChange={(event) => setValue({ ...value, stage: event.target.value as Stage })} className={field}>{STAGES_IN_ORDER.map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}</select></label>
        <label className={`${label} sm:col-span-2`}>Owner<select aria-label="Owner" name="owner" value={value.owner} onChange={(event) => setValue({ ...value, owner: event.target.value })} className={field}><option value="">Unassigned</option>{owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select></label>
      </div>
    </div>
  </DialogShell>;
}

type ImportPreview = {
  summary: { total: number; valid: number; invalid: number; newContacts: number; updates: number };
  issues: Array<{ row: number; email?: string; reason: string }>;
};
type ImportResult = { imported: number; skipped: number };

function ImportContactsDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<ContactCsv>({ headers: [], rows: [] });
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ContactColumnMapping>(emptyContactMapping);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, setPending] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(false);
  const completed = useRef(false);
  const readVersion = useRef(0);
  const resultMessage = useRef<HTMLDivElement>(null);
  const close = () => { if (!request.current) onClose(); };
  useEffect(() => () => { readVersion.current++; }, []);
  useEffect(() => { if (result) resultMessage.current?.focus(); }, [result]);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    if (request.current || completed.current) return;
    const version = ++readVersion.current;
    const selected = event.target.files;
    setFile({ headers: [], rows: [] });
    setFileName("");
    setMapping(emptyContactMapping());
    setPreview(null);
    setError(null);
    setReading(false);
    if (!selected?.length) return;
    if (selected.length > 1) { setError("Choose one CSV file at a time."); return; }
    const nextFile = selected[0];
    if (nextFile.size > 2_000_000) { setError("CSV files are limited to 2 MB. Choose a smaller file."); return; }
    setReading(true);
    try {
      const text = await nextFile.text();
      if (readVersion.current !== version) return;
      const parsed = parseContactCsv(text);
      if (!parsed.headers.length || !parsed.rows.length) throw new Error("This file has no contact rows. Include a header row and at least one contact.");
      if (parsed.rows.length > 500) throw new Error("Imports are limited to 500 rows per file. Split this file into smaller imports.");
      setFile(parsed);
      setFileName(nextFile.name);
      setMapping(suggestContactMapping(parsed.headers));
    } catch (reason) {
      if (readVersion.current === version) setError(reason instanceof Error ? reason.message : "Could not read this CSV file. Choose the file again.");
    } finally {
      if (readVersion.current === version) setReading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (request.current || completed.current || reading || !file.rows.length || mapping.email === "" || (preview && preview.summary.valid === 0)) return;
    request.current = true;
    setPending(true);
    setError(null);
    try {
      const contacts = mapContactRows(file, mapping);
      if (preview) {
        const response = await api<ImportResult>("/api/crm/import", { mode: "commit", confirm: "IMPORT", contacts });
        completed.current = true;
        setResult(response);
        router.refresh();
      } else {
        setPreview(await api<ImportPreview>("/api/crm/import", { mode: "preview", contacts }));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : preview ? "Import failed. Please try again." : "Preview failed. Please try again.");
    } finally {
      request.current = false;
      setPending(false);
    }
  }

  const step = result ? 3 : preview ? 2 : file.rows.length ? 1 : 0;
  return <DialogShell kind="import" onClose={close} onSubmit={submit} pending={pending} error={error} footer={result ? <button type="button" onClick={close} className={primary}>Done</button> : <>
    <button type="button" disabled={pending} onClick={close} className={secondary}>Cancel</button>
    <button type="submit" disabled={pending || reading || !file.rows.length || mapping.email === "" || Boolean(preview && preview.summary.valid === 0)} className={primary}>{pending ? (preview ? "Importing…" : "Analyzing…") : preview ? `Import ${preview.summary.valid} valid` : "Preview import"}</button>
  </>}>
    <ol aria-label="Import steps" className="grid grid-cols-3 gap-2 rounded-xl border border-mist bg-cloud/70 p-3">
      {["Choose file", "Match columns", "Review & import"].map((name, index) => <li key={name} aria-current={step === index ? "step" : undefined} className={`flex min-w-0 flex-col items-center gap-2 text-center text-xs font-medium sm:flex-row sm:justify-center ${step >= index ? "text-heading" : "text-slate"}`}>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step > index ? "bg-trust text-white" : step === index ? "bg-gold text-ink" : "border border-mist bg-card"}`}>{step > index ? <span aria-label="Complete">✓</span> : index + 1}</span>{name}
      </li>)}
    </ol>
    {result ? <div ref={resultMessage} tabIndex={-1} role="status" className="rounded-xl border border-green/25 bg-green/5 p-5 outline-none">
      <div className="flex items-center gap-3 text-green dark:text-[#94e4b2]"><ActionIcon kind="check" size={24} /><h3 className="text-lg font-semibold">Import complete</h3></div>
      <p className="mt-3 text-sm leading-relaxed text-body">Imported {result.imported}; skipped {result.skipped}. Your contact list has been refreshed.</p>
      <p className="mt-1 text-sm text-slate">You can review the results below before closing.</p>
    </div> : <div className="rounded-xl border border-dashed border-mist bg-cloud/50 p-5">
      <label className={label}>CSV file<input type="file" accept=".csv,text/csv" data-initial-focus aria-label="Choose CSV file" aria-describedby="contact-import-file-help" onChange={onFile} className={`mt-3 block min-h-11 w-full min-w-0 text-sm text-slate file:mr-3 file:min-h-10 file:rounded-lg file:border file:border-mist file:bg-card file:px-3 file:py-2 file:font-semibold file:text-heading hover:file:bg-cloud ${focus}`} /></label>
      <p id="contact-import-file-help" className="mt-2 text-xs leading-relaxed text-slate">Up to 500 contact rows · 2 MB maximum · Include column headers.</p>
      {reading ? <p role="status" className="mt-3 text-sm text-trust dark:text-gold-deep">Reading your file…</p> : fileName ? <p className="mt-3 break-words text-sm text-heading"><span className="font-semibold">{file.rows.length} rows ready</span><span className="text-slate"> · {fileName}</span></p> : null}
    </div>}
    {file.rows.length && !result ? <section aria-labelledby="contact-import-mapping-title">
      <h3 id="contact-import-mapping-title" className="font-semibold text-heading">Match your columns</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate">We matched familiar headers. Check each field before continuing.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{CONTACT_IMPORT_FIELDS.map((importField) => <label key={importField.key} className={label}>{importField.label}
        <select value={mapping[importField.key]} onChange={(event) => { setMapping({ ...mapping, [importField.key]: event.target.value }); setPreview(null); setError(null); }} className={field}>
          <option value="">{importField.key === "email" ? "Choose email column" : "Not imported"}</option>
          {file.headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header || `Column ${index + 1}`}</option>)}
        </select>
      </label>)}</div>
      {mapping.email === "" ? <p className="mt-3 text-sm text-slate">Choose an email column to preview this import.</p> : null}
    </section> : null}
    {preview ? <section aria-labelledby="contact-import-preview-title" className="rounded-xl border border-mist bg-cloud/40 p-4 sm:p-5">
      <h3 id="contact-import-preview-title" className="font-semibold text-heading">{result ? "Preview summary" : "Review before importing"}</h3>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
        { value: preview.summary.valid, text: "Valid rows" },
        { value: preview.summary.invalid, text: "Invalid rows" },
        { value: preview.summary.newContacts, text: "New contacts" },
        { value: preview.summary.updates, text: "Updates" },
      ].map((item) => <div key={item.text} className="rounded-lg border border-mist bg-card p-3"><dt className="text-xs text-slate">{item.text}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-heading">{item.value}</dd></div>)}</dl>
      <p className="mt-4 text-sm leading-relaxed text-slate">Existing email addresses update their current contact records. New email addresses create new contacts.</p>
      {preview.summary.invalid > 0 ? <p className="mt-2 text-sm leading-relaxed text-gold-deep">{preview.summary.invalid} invalid {preview.summary.invalid === 1 ? "row" : "rows"} {result ? preview.summary.invalid === 1 ? "was skipped" : "were skipped" : "will be skipped"}.{preview.summary.valid === 0 && !result ? " Update your file or column mapping to continue." : ""}</p> : null}
      {preview.issues.length ? <div className="mt-4 border-t border-mist pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate">Rows to check{preview.summary.invalid > preview.issues.length ? ` · showing ${preview.issues.length} of ${preview.summary.invalid}` : ""}</p>
        <ul aria-label="Import row issues" tabIndex={0} className={`max-h-36 space-y-2 overflow-y-auto rounded text-sm text-body ${focus}`}>{preview.issues.map((issue) => <li key={`${issue.row}-${issue.email ?? ""}`} className="break-words"><span className="font-semibold">Row {issue.row}:</span> {issue.reason}{issue.email ? <span className="block text-xs text-slate">{issue.email}</span> : null}</li>)}</ul>
      </div> : null}
    </section> : <p className="text-sm leading-relaxed text-slate">Preview checks your rows before saving. Existing email addresses update the matching contact record.</p>}
  </DialogShell>;
}
