"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CheckIcon, DocumentIcon } from "@/components/marketing-v2/Icons";
import { REPORT_BUREAUS, useReportUploadSession, type ReportBureau } from "./ReportUploadSession";

const MAX_PDF_BYTES = 15 * 1024 * 1024;
type UploadDraft = { file: File | null; sending: boolean; error: string };
const emptyDraft = (): UploadDraft => ({ file: null, sending: false, error: "" });

export function CreditReportUploads() {
  const session = useReportUploadSession();
  const [drafts, setDrafts] = useState<Record<ReportBureau, UploadDraft>>({ transunion: emptyDraft(), equifax: emptyDraft(), experian: emptyDraft() });
  const inFlight = useRef(new Set<ReportBureau>());
  const inputs = useRef<Partial<Record<ReportBureau, HTMLInputElement | null>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showSentDialog, setShowSentDialog] = useState(false);
  // Set only by a submit in this visit, so reopening the page with 3 reports
  // already on file doesn't greet the person with the popup again.
  const submittedThisVisit = useRef(false);
  const sentDialog = useRef<HTMLDialogElement>(null);
  const available = session.phase === "ready";
  const receivedCount = REPORT_BUREAUS.filter(({ id }) => session.reports.some((report) => report.bureau === id) && !drafts[id].file).length;
  const chosen = REPORT_BUREAUS.filter(({ id }) => drafts[id].file).map(({ id }) => id);
  // Every company either already received or chosen and waiting to go.
  const coveredCount = REPORT_BUREAUS.filter(({ id }) => drafts[id].file || session.reports.some((report) => report.bureau === id)).length;

  // Once a submit in this visit leaves all 3 received, give the check marks a
  // moment to land, then confirm with a popup.
  const allSentThisVisit = receivedCount === 3 && !submitting && chosen.length === 0;
  useEffect(() => {
    if (!allSentThisVisit || !submittedThisVisit.current) return;
    submittedThisVisit.current = false;
    const timer = setTimeout(() => setShowSentDialog(true), 2000);
    return () => clearTimeout(timer);
  }, [allSentThisVisit]);

  // Native <dialog> gives focus trapping, Escape-to-close and a backdrop for free.
  useEffect(() => {
    const dialog = sentDialog.current;
    if (!dialog) return;
    if (showSentDialog && !dialog.open) dialog.showModal();
    if (!showSentDialog && dialog.open) dialog.close();
  }, [showSentDialog]);

  function chooseFile(bureau: ReportBureau, file: File | undefined) {
    if (!file || inFlight.current.has(bureau)) return;
    let error = "";
    if (!/\.pdf$/i.test(file.name) || (file.type && !["application/pdf", "application/octet-stream"].includes(file.type))) error = "Choose a PDF file for this report.";
    else if (file.size === 0) error = "This file is empty. Choose the saved report PDF.";
    else if (file.size > MAX_PDF_BYTES) error = "This PDF is too large. Choose a file under 15 MB.";
    setDrafts((previous) => ({ ...previous, [bureau]: { file: error ? previous[bureau].file : file, sending: false, error } }));
    if (inputs.current[bureau]) inputs.current[bureau]!.value = "";
  }

  async function send(bureau: ReportBureau) {
    const file = drafts[bureau].file;
    if (!file || !available || inFlight.current.has(bureau)) return;
    inFlight.current.add(bureau);
    setDrafts((previous) => ({ ...previous, [bureau]: { ...previous[bureau], sending: true, error: "" } }));
    try {
      const response = await fetch(`/api/credit-check/reports/${bureau}`, {
        method: "POST",
        headers: { "Content-Type": "application/pdf", "X-Report-Filename": encodeURIComponent(file.name), "X-Report-Session": session.sessionId },
        body: file,
        signal: AbortSignal.timeout(90000),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true || result.report?.bureau !== bureau) {
        if (response.status === 401) void session.refresh();
        if (response.status === 409) session.markChanged();
        throw new Error(result.error || "We couldn't save this PDF. Please try again.");
      }
      session.recordReceipt(result.report);
      setDrafts((previous) => ({ ...previous, [bureau]: emptyDraft() }));
    } catch (problem) {
      const error = problem instanceof Error && problem.name !== "TimeoutError" && problem.name !== "TypeError"
        ? problem.message : "We couldn't confirm this upload. Your file is still selected. Press Submit to Vance to try again.";
      setDrafts((previous) => ({ ...previous, [bureau]: { ...previous[bureau], sending: false, error } }));
    } finally {
      inFlight.current.delete(bureau);
    }
  }

  /**
   * One button for all chosen files. Sent one at a time rather than in parallel:
   * each PDF can be up to 15 MB, and a failure on one company must leave the
   * others' results (and that company's selected file) intact so only the
   * failed box needs another try. Partial submits are allowed on purpose — if a
   * bureau can't verify someone's identity, they can still send the other two.
   */
  async function submitAll() {
    if (!available || submitting || chosen.length === 0) return;
    setSubmitting(true);
    submittedThisVisit.current = true;
    try {
      for (const bureau of chosen) await send(bureau);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cc-uploads">
      <p className="cc-simple-copy">Choose the matching PDF in each box, then press <strong>Submit to Vance.</strong> A check mark means that file was received.</p>
      {session.phase === "loading" && <p className="cc-upload-notice" role="status">Loading your upload slots…</p>}
      {session.phase === "missing" && <div className="cc-upload-notice" role="status" aria-live="polite" aria-atomic="true"><p>First, complete the quick check so we can attach these reports to your details. If you switched devices, use the personal link you copied.</p><Link href="/credit-check">Complete my quick check →</Link></div>}
      {session.phase === "error" && <div className="cc-upload-notice" role="alert"><p>We couldn&apos;t load your upload slots. Please try again.</p><button type="button" onClick={() => void session.refresh()}>Try again</button></div>}
      {session.phase === "changed" && <div className="cc-upload-notice" role="alert"><p>This browser switched to another quick check. Reload this page or reopen your personal link before choosing your PDFs again.</p><button type="button" onClick={() => window.location.reload()}>Reload upload page</button></div>}
      {available && session.mode === "local" && <p className="cc-upload-local">Local preview · PDFs are saved on this computer. They are not sent to Vance&apos;s live CRM.</p>}
      <div className="cc-upload-grid">
        {REPORT_BUREAUS.map(({ id, label }) => {
          const draft = drafts[id];
          const receipt = session.reports.find((report) => report.bureau === id);
          const confirmed = Boolean(receipt && !draft.file);
          return <div key={id} className={`cc-upload-card${confirmed ? " is-received" : ""}${draft.file ? " has-file" : ""}`} aria-busy={draft.sending}>
            <div className="cc-upload-symbol" aria-hidden="true">{confirmed ? <CheckIcon className="h-7 w-7" /> : <DocumentIcon className="h-7 w-7" />}</div>
            <h3 id={`cc-upload-${id}-title`}>{label}</h3>
            <p className="cc-upload-status" role="status">{draft.sending ? "Sending…" : confirmed ? session.mode === "local" ? "Saved on this computer" : "Received" : draft.file ? "Ready to send" : "Choose your report"}</p>
            <p className="cc-upload-filename" title={draft.file?.name ?? receipt?.fileName}>{draft.file?.name ?? receipt?.fileName ?? "PDF · up to 15 MB"}</p>
            {draft.file && <p className="cc-upload-size">{draft.file.size < 1024 * 1024 ? `${Math.max(1, Math.round(draft.file.size / 1024))} KB` : `${(draft.file.size / (1024 * 1024)).toFixed(1)} MB`}</p>}
            <input hidden ref={(input) => { inputs.current[id] = input; }} id={`cc-upload-${id}`} aria-label={`Choose ${label} PDF`} type="file" accept=".pdf,application/pdf" disabled={!available || submitting} onChange={(event) => chooseFile(id, event.target.files?.[0])} />
            <button className={`cc-upload-choose${draft.file || confirmed ? " is-secondary" : ""}`} type="button" disabled={!available || submitting} aria-label={`${draft.file || confirmed ? "Change" : "Choose"} ${label} PDF`} aria-describedby={draft.error ? `cc-upload-${id}-error` : undefined} onClick={() => inputs.current[id]?.click()}>{draft.file ? "Choose a different PDF" : confirmed ? "Replace PDF" : "Choose PDF"}</button>
            {draft.file && <button className="cc-upload-cancel" type="button" disabled={submitting} onClick={() => setDrafts((previous) => ({ ...previous, [id]: emptyDraft() }))}>{receipt ? "Keep previous PDF" : "Remove"}</button>}
            {draft.error && <p className="cc-upload-error" id={`cc-upload-${id}-error`} role="alert">{draft.error}</p>}
          </div>;
        })}
      </div>
      {(chosen.length > 0 || receivedCount < 3) && <div className="cc-upload-submit">
        <button className="cc-primary cc-guide-button" type="button" disabled={!available || submitting || chosen.length === 0} onClick={() => void submitAll()}>
          {submitting ? "Sending to Vance…" : chosen.length > 0 && coveredCount < 3 ? `Submit ${chosen.length} of 3 to Vance` : "Submit to Vance"} {!submitting && <ArrowRightIcon className="h-5 w-5" />}
        </button>
        <p className="cc-upload-hint">
          {chosen.length === 0
            ? "Choose at least one PDF above to submit."
            : coveredCount < 3
              ? "You can submit what you have now and add the rest later."
              : "All 3 chosen — ready to send."}
        </p>
      </div>}

      <div className={`cc-upload-total${receivedCount === 3 ? " is-complete" : ""}`} role="status">
        {receivedCount === 3 ? <><CheckIcon className="h-6 w-6" /><p><strong>{session.mode === "local" ? "All 3 PDFs saved on this computer." : "All 3 reports received. You're done!"}</strong><span>{session.mode === "local" ? "Local test complete. No reports were sent to the live CRM." : "Your reports are available to Vance for review."}</span></p></> : <><span className="cc-upload-count">{receivedCount}<small> / 3</small></span><p><strong>{receivedCount === 0 ? "Nothing sent yet." : "Keep going — send the remaining reports."}</strong><span>{receivedCount} of 3 {session.mode === "local" && available ? "saved locally" : "received"}. Choosing a file doesn&apos;t send it — press Submit to Vance.</span></p></>}
      </div>
      <p className="cc-simple-delivery-tip">Send the full credit reports, including every page. Make sure each PDF matches the company shown above.</p>

      <dialog
        ref={sentDialog}
        className="cc-sent-dialog"
        aria-labelledby="cc-sent-dialog-title"
        // Every way out (button, Escape, backdrop) goes through the dialog's own
        // close(), and its close event is the single place state is synced.
        onClose={() => setShowSentDialog(false)}
        onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
      >
        <div className="cc-sent-dialog-body">
          <div className="cc-sent-dialog-mark" aria-hidden="true"><CheckIcon className="h-8 w-8" /></div>
          <h2 id="cc-sent-dialog-title" className="v3-display">All files have been sent.</h2>
          <p>Vance will contact you within 48 hours.</p>
          {session.mode === "local" && <p className="cc-sent-dialog-local">Local preview · these PDFs were saved on this computer, not sent to the live CRM.</p>}
          <button className="cc-primary cc-guide-button" type="button" autoFocus onClick={() => sentDialog.current?.close()}>Close</button>
        </div>
      </dialog>
    </div>
  );
}
