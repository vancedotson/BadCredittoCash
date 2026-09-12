"use client";

import { useEffect, useState } from "react";
import type { CreditReportReceipt } from "@/lib/credit-reports";

const bureaus = [
  { id: "transunion", name: "TransUnion" },
  { id: "equifax", name: "Equifax" },
  { id: "experian", name: "Experian" },
] as const;

type ReportState = { reports: CreditReportReceipt[]; error: string; loading: boolean };

export function CreditReportsPanel({ contactId, demo = false, previewReports }: { contactId: string; demo?: boolean; previewReports?: CreditReportReceipt[] }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ReportState>({ reports: demo ? previewReports ?? [] : [], error: "", loading: !demo });

  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetch(`/api/crm/contact/${encodeURIComponent(contactId)}/reports`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { reports?: CreditReportReceipt[]; error?: string };
        if (!response.ok || !Array.isArray(payload.reports)) throw new Error(payload.error ?? "Reports could not be loaded.");
        setState({ reports: payload.reports, error: "", loading: false });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({ reports: [], error: cause instanceof Error ? cause.message : "Reports could not be loaded.", loading: false });
      });
    return () => controller.abort();
  }, [contactId, demo, attempt]);

  const received = bureaus.filter((bureau) => state.reports.some((report) => report.bureau === bureau.id)).length;

  return (
    <section id="credit-reports" aria-labelledby="credit-reports-heading" aria-busy={state.loading} className="scroll-mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="credit-reports-heading" className="text-lg font-semibold text-heading">Credit reports</h2>
        {!demo ? (
          <button
            type="button"
            disabled={state.loading}
            onClick={() => { setState((previous) => ({ ...previous, error: "", loading: true })); setAttempt((previous) => previous + 1); }}
            className="min-h-10 rounded-md border border-mist px-3 py-1.5 text-xs font-medium text-body hover:border-trust focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust dark:focus-visible:outline-gold disabled:opacity-50"
          >Refresh reports</button>
        ) : null}
      </div>
      {demo ? <p className="mt-3 rounded-lg border border-mist bg-cloud px-3 py-2 text-sm text-slate">Demo preview. Report attachments are available on live contacts after signing in. Any files shown here are samples; downloads are unavailable.</p> : null}
      {demo && !previewReports ? null : state.loading ? (
        <p className="mt-3 text-sm text-slate" role="status">Checking for uploaded reports…</p>
      ) : state.error ? (
        <p className="mt-3 text-sm text-red dark:text-[#ffb4aa]" role="alert">{state.error}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate" role="status">{demo ? "Sample status: " : ""}{received} of 3 bureau reports received.{!demo ? " Download each PDF to review it." : ""}</p>
          <ul className="mt-4 space-y-3">
            {bureaus.map((bureau) => {
              const reports = state.reports.filter((report) => report.bureau === bureau.id);
              return (
                <li key={bureau.id} className="rounded-lg border border-mist p-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <h3 className="font-semibold text-heading">{bureau.name}</h3>
                    <span className={reports.length ? "text-green" : "text-slate"}>{reports.length ? "✓ Received" : "Not received"}</span>
                  </div>
                  {reports.map((report) => (
                    <div key={report.id} className="mt-3 border-t border-mist pt-3 text-sm">
                      <p className="break-all text-body">{report.fileName}</p>
                      <p className="mt-1 text-xs text-slate">
                        <time dateTime={report.uploadedAt}>{new Date(report.uploadedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</time>
                        {" · "}{(report.byteSize / (1024 * 1024)).toFixed(1)} MB
                      </p>
                      {!demo ? <a
                        href={`/api/crm/contact/${encodeURIComponent(contactId)}/reports/${encodeURIComponent(report.id)}`}
                        className="mt-2 inline-flex min-h-10 items-center rounded-md border border-mist px-3 py-1.5 text-xs font-medium text-trust hover:border-trust focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust dark:text-[#a6cefa] dark:focus-visible:outline-gold"
                        download
                        aria-label={`Download ${bureau.name} PDF: ${report.fileName}`}
                      >Download PDF</a> : <p className="mt-2 text-xs text-slate">Sample file · Download unavailable in demo</p>}
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
