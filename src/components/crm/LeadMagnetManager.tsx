"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LeadMagnetRow, LeadMagnetStatus, LeadMagnetWorkspace } from "@/lib/lead-magnet-types";
import { CreditReportsPanel } from "./CreditReportsPanel";
import { StageBadge } from "./ui";
import { CheckIcon, ChevronRightIcon, CloseIcon, DocumentIcon, RefreshIcon } from "@/components/marketing-v2/Icons";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust dark:focus-visible:outline-gold";
const button = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-mist bg-card px-4 py-2 text-sm font-semibold text-heading transition-colors hover:bg-cloud disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
const link = `text-trust hover:underline dark:text-[#a6cefa] ${focus}`;
const BUREAUS = [{ id: "transunion", name: "TransUnion" }, { id: "equifax", name: "Equifax" }, { id: "experian", name: "Experian" }] as const;
type Query = { search: string; status: LeadMagnetStatus; page: number; pageSize: number };

function href(query: Query) {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.status !== "all") params.set("status", query.status);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.pageSize !== 25) params.set("pageSize", String(query.pageSize));
  return `/crm/lead-magnet${params.size ? `?${params}` : ""}`;
}

function date(value: string) {
  return new Date(value).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function ContactIdentity({ row }: { row: LeadMagnetRow }) {
  return <div className="flex min-w-0 items-start gap-3">
    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-mist bg-cloud text-xs font-semibold text-slate">{initials(row.name)}</span>
    <div className="min-w-0">
      <Link href={`/crm/contacts/${encodeURIComponent(row.contactId)}`} className={`block truncate text-sm font-semibold ${link}`}>{row.name}</Link>
      <p className="mt-1 break-all text-xs text-slate">{row.email}</p>
      {row.phone ? <p className="mt-1 text-xs text-slate">{row.phone}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2"><StageBadge stage={row.stage} />{row.owner ? <span className="text-xs text-slate">{row.owner}</span> : null}</div>
    </div>
  </div>;
}

function Companies({ companies }: { companies: string[] }) {
  if (!companies.length) return <span className="text-xs text-slate">No companies recorded</span>;
  return <div className="max-w-56 text-xs text-slate">
    <div className="flex flex-wrap gap-1.5">{companies.slice(0, 2).map((company) => <span key={company} className="rounded-md bg-cloud px-2 py-1 leading-relaxed">{company}</span>)}</div>
    {companies.length > 2 ? <details className="mt-2"><summary className={`w-fit cursor-pointer rounded font-medium ${link}`}>+{companies.length - 2} more</summary><p className="mt-2 leading-relaxed">{companies.slice(2).join(", ")}</p></details> : null}
  </div>;
}

function ReportLinks({ row, demo }: { row: LeadMagnetRow; demo: boolean }) {
  return <div className="flex flex-wrap gap-1.5">
    {BUREAUS.map((bureau) => {
      const report = row.reports.find((item) => item.bureau === bureau.id);
      const className = `inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${report ? "border-green/20 bg-green/5 text-green" : "border-mist bg-cloud text-slate"}`;
      const content = <>{report ? <CheckIcon className="h-3.5 w-3.5" /> : <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-slate/40" />}{bureau.name}{report && !demo ? <span aria-hidden="true">↓</span> : null}</>;
      return report && !demo ? <a key={bureau.id} className={`${className} hover:bg-green/10 ${focus}`} download href={`/api/crm/contact/${encodeURIComponent(row.contactId)}/reports/${encodeURIComponent(report.id)}`} aria-label={`Download ${bureau.name} PDF for ${row.name}`} title={`${report.fileName} · ${date(report.uploadedAt)}`}>{content}</a> : <span key={bureau.id} className={className} aria-label={`${bureau.name}: ${report ? "sample received report" : "not received"}`} title={report ? "Sample only; no PDF download in demo" : "Waiting for this PDF"}>{content}</span>;
    })}
  </div>;
}

function ReportStatus({ row }: { row: LeadMagnetRow }) {
  const count = new Set(row.reports.map((report) => report.bureau)).size;
  return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${count === 3 ? "text-green" : count ? "text-gold-deep" : "text-slate"}`}>{count === 3 ? <CheckIcon className="h-4 w-4" /> : null}{count === 3 ? "All 3 received" : count ? `${count} of 3 received` : "Waiting for PDFs"}</span>;
}

export function LeadMagnetManager({ workspace, query }: { workspace: LeadMagnetWorkspace; query: Query }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<LeadMagnetRow | null>(null);
  const { rows, total, summary, demo, page, pageSize } = workspace;
  const tabs: Array<{ status: LeadMagnetStatus; label: string; count: number }> = [
    { status: "all", label: "All signups", count: summary.totalSignups },
    { status: "waiting", label: "Waiting for PDFs", count: summary.waiting },
    { status: "partial", label: "Some PDFs", count: summary.partial },
    { status: "complete", label: "All 3 received", count: summary.complete },
  ];
  function update(values: Partial<Query>) { startTransition(() => router.push(href({ ...query, page: 1, ...values }), { scroll: false })); }
  function refresh() { startTransition(() => router.refresh()); }
  const metrics = [
    { label: "Total signups", value: summary.totalSignups, hint: "People who completed the quick check" },
    { label: "New in 30 days", value: summary.newLast30Days, hint: "Based on their first signup" },
    { label: "Waiting for PDFs", value: summary.waiting, hint: "No bureau reports received yet" },
    { label: "All 3 received", value: summary.complete, hint: "Ready for you to open and review" },
  ];

  return <div className="min-w-0 space-y-6" data-testid="lead-magnet-workspace">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-xs text-slate">CRM <span className="mx-1.5" aria-hidden="true">/</span> Lead magnet</p><h1 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">Lead magnet</h1><p className="mt-2 text-sm text-slate">Your credit-check signups and their uploaded reports, in one place.</p></div>
      <div className="flex flex-wrap gap-2 sm:pt-7"><button type="button" disabled={pending} onClick={refresh} className={button}><RefreshIcon className={`h-4 w-4 ${pending ? "animate-spin motion-reduce:animate-none" : ""}`} />Refresh</button><a href="/credit-check" target="_blank" rel="noopener noreferrer" className={`${button} border-gold bg-gold text-ink hover:bg-[#e69a2b]`}>View signup page <span aria-hidden="true">↗</span></a></div>
    </header>

    {demo ? <p className="rounded-xl border border-trust/15 bg-sky px-4 py-3 text-sm leading-relaxed text-heading"><strong className="font-semibold">Demo preview.</strong> These are sample signups and report statuses. Real PDFs are only accessible in the signed-in CRM; local test uploads stay on this computer.</p> : null}

    <section aria-label="Lead magnet summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {metrics.map((metric, index) => <div key={metric.label} className="rounded-xl border border-mist bg-card p-4 sm:p-5"><p className="text-xs font-medium text-slate">{metric.label}</p><p className={`mt-2 text-3xl font-bold tracking-tight tabular-nums ${index === 3 ? "text-green" : "text-heading"}`}>{metric.value.toLocaleString("en-US")}</p><p className="mt-2 text-xs leading-relaxed text-slate">{metric.hint}</p></div>)}
    </section>

    <section className="overflow-hidden rounded-2xl border border-mist bg-card" aria-labelledby="lead-magnet-signups" aria-busy={pending}>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="lead-magnet-signups" className="text-lg font-semibold text-heading">Signups &amp; reports</h2><p className="mt-1 text-xs text-slate">One row per person. Latest signup first.</p></div><p className="text-xs text-slate">{demo ? "Sample reports · Downloads available on live contacts" : "Received PDFs are available to download."}</p></div>
        <nav aria-label="Report status" className="flex flex-wrap gap-2">{tabs.map((tab) => <button key={tab.status} type="button" disabled={pending} aria-pressed={query.status === tab.status} onClick={() => update({ status: tab.status })} className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50 ${query.status === tab.status ? "border-navy bg-navy text-white" : "border-mist bg-card text-slate hover:bg-cloud"} ${focus}`}>{tab.label}<span className={`rounded-md px-1.5 py-0.5 text-xs tabular-nums ${query.status === tab.status ? "bg-white/15" : "bg-cloud"}`}>{tab.count}</span></button>)}</nav>
        <form onSubmit={(event) => { event.preventDefault(); update({ search: String(new FormData(event.currentTarget).get("q") ?? "").trim() }); }} className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1 basis-52"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg></span><input key={query.search} name="q" type="search" defaultValue={query.search} disabled={pending} maxLength={200} placeholder="Search name or email…" aria-label="Search lead magnet signups" className={`min-h-11 w-full rounded-lg border border-mist bg-card py-2 pr-3 pl-9 text-base text-body outline-none placeholder:text-slate focus:border-trust sm:text-sm ${focus}`} /></div>
          <button type="submit" disabled={pending} className={button}>Search</button>
          {query.search || query.status !== "all" ? <button type="button" disabled={pending} onClick={() => update({ search: "", status: "all" })} className={button}>Clear filters</button> : null}
        </form>
        <p role="status" className="text-xs text-slate">{pending ? "Updating signups…" : `${total} ${total === 1 ? "person matches" : "people match"}${query.search ? ` “${query.search}”` : ""}. Totals above include all signups.`}</p>
      </div>

      {rows.length ? <>
        <div className="crm-scroll hidden overflow-x-auto xl:block"><table className="w-full text-left text-sm"><thead className="border-y border-mist bg-cloud text-xs text-slate"><tr><th className="px-5 py-3 font-medium">Contact</th><th className="px-4 py-3 font-medium">Companies selected</th><th className="px-4 py-3 font-medium">Latest signup</th><th className="px-5 py-3 font-medium">Credit report PDFs</th></tr></thead><tbody className="divide-y divide-mist">{rows.map((row) => <tr key={row.contactId} className="align-top hover:bg-cloud/40"><td className="max-w-72 px-5 py-5"><ContactIdentity row={row} /></td><td className="max-w-56 px-4 py-5"><Companies companies={row.companies} /></td><td className="whitespace-nowrap px-4 py-5"><time dateTime={row.lastSubmittedAt} title={row.lastSubmittedAt} className="text-xs text-body">{date(row.lastSubmittedAt)}</time><p className="mt-1.5 text-xs text-slate">{row.submissionCount > 1 ? `${row.submissionCount} submissions` : "First signup"}</p></td><td className="px-5 py-5"><div className="mb-2.5"><ReportStatus row={row} /></div><ReportLinks row={row} demo={demo} /><button type="button" aria-label={`View reports for ${row.name}`} onClick={() => setSelected(row)} className={`mt-2 inline-flex min-h-9 items-center gap-1 rounded text-xs font-semibold ${link}`}>View reports <ChevronRightIcon className="h-3 w-3" /></button></td></tr>)}</tbody></table></div>
        <div className="grid gap-3 border-t border-mist bg-cloud/50 p-3 md:grid-cols-2 xl:hidden">{rows.map((row) => <article key={row.contactId} className="min-w-0 rounded-xl border border-mist bg-card p-4"><ContactIdentity row={row} /><div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-mist pt-3"><p className="text-xs text-slate">Signed up {date(row.lastSubmittedAt)}</p>{row.submissionCount > 1 ? <span className="text-xs text-slate">{row.submissionCount} submissions</span> : null}</div><div className="mt-3"><Companies companies={row.companies} /></div><div className="mt-4 border-t border-mist pt-3"><div className="mb-2"><ReportStatus row={row} /></div><ReportLinks row={row} demo={demo} /><button type="button" aria-label={`View reports for ${row.name}`} onClick={() => setSelected(row)} className={`${button} mt-3 w-full`}>View reports <ChevronRightIcon className="h-3 w-3" /></button></div></article>)}</div>
      </> : <div className="flex flex-col items-center border-t border-mist px-5 py-14 text-center"><span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-cloud text-slate"><DocumentIcon className="h-7 w-7" /></span><h3 className="text-lg font-semibold text-heading">{summary.totalSignups ? "No signups match these filters" : "Your first signup starts here"}</h3><p className="mt-2 max-w-md text-sm leading-relaxed text-slate">{summary.totalSignups ? "Try another name, email, or report status." : "People who complete the credit check will appear here. Their PDFs will be attached after they choose each file and press Send PDF."}</p>{query.search || query.status !== "all" ? <button type="button" onClick={() => update({ search: "", status: "all" })} className={`${button} mt-5`}>Show all signups</button> : null}</div>}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-mist px-4 py-4 text-xs text-slate sm:px-5"><p>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : "0 signups"}</p><div className="flex items-center gap-2"><span className="mr-2">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span><button type="button" disabled={pending || page <= 1} onClick={() => update({ page: page - 1 })} className={button}>Previous</button><button type="button" disabled={pending || page * pageSize >= total} onClick={() => update({ page: page + 1 })} className={button}>Next</button></div></footer>
    </section>
    <p className="max-w-4xl text-xs leading-relaxed text-slate">Signups count people who completed the credit check at least once, including existing contacts. Report status counts the three bureaus across that person’s submissions; it confirms receipt, not a review of the contents.</p>
    {selected ? <ReportsDialog row={selected} demo={demo} onClose={() => { setSelected(null); if (!demo) refresh(); }} /> : null}
  </div>;
}

function ReportsDialog({ row, demo, onClose }: { row: LeadMagnetRow; demo: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    headingRef.current?.focus();
    return () => { dialog?.close(); requestAnimationFrame(() => { if (opener?.isConnected) opener.focus(); }); };
  }, []);
  return <dialog ref={dialogRef} aria-labelledby="lead-magnet-report-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-2xl border border-mist bg-card p-0 text-body shadow-2xl backdrop:bg-navy/50 backdrop:backdrop-blur-sm">
    <div className="flex max-h-[calc(100dvh-2rem)] flex-col"><header className="flex shrink-0 items-start justify-between gap-4 border-b border-mist px-5 py-5 sm:px-7"><div className="min-w-0"><p className="mb-1 text-xs font-medium text-slate">Lead magnet · Credit reports</p><h2 id="lead-magnet-report-title" ref={headingRef} tabIndex={-1} className="rounded text-xl font-bold text-heading outline-none">{row.name}</h2><p className="mt-1 break-all text-sm text-slate">{row.email}</p></div><button type="button" aria-label="Close reports" onClick={onClose} className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-mist bg-card text-heading hover:bg-cloud ${focus}`}><CloseIcon className="h-4 w-4" /></button></header>
      <div className="crm-scroll min-h-0 overflow-y-auto px-5 py-5 sm:px-7"><CreditReportsPanel contactId={row.contactId} demo={demo} previewReports={demo ? row.reports : undefined} /><details className="mt-5 rounded-xl border border-mist bg-cloud px-4 py-3"><summary className={`cursor-pointer rounded text-sm font-semibold text-heading ${focus}`}>Signup details</summary><dl className="mt-3 grid grid-cols-2 gap-4 text-xs"><div><dt className="text-slate">First signup</dt><dd className="mt-1 text-body">{date(row.firstSubmittedAt)}</dd></div><div><dt className="text-slate">Submissions</dt><dd className="mt-1 text-body">{row.submissionCount}</dd></div></dl><p className="mt-4 mb-2 text-xs text-slate">Companies from their latest signup</p><Companies companies={row.companies} /></details></div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-mist px-5 py-4 sm:px-7"><Link href={`/crm/contacts/${encodeURIComponent(row.contactId)}#credit-reports`} className={`inline-flex min-h-11 items-center rounded text-sm font-semibold ${link}`}>Open full contact <span className="ml-2" aria-hidden="true">↗</span></Link><button type="button" onClick={onClose} className={button}>Done</button></footer></div>
  </dialog>;
}
