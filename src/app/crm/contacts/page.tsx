import Link from "next/link";
import { redirect } from "next/navigation";
import { getContactsPageData, listOwners, listTags, getSettings } from "@/lib/store";
import { requireCrmUser } from "@/lib/auth";
import { STAGE_LABELS } from "@/lib/stages";
import { contactExportHref, contactPageHref, resolveContactsQuery } from "@/lib/contacts-display";
import { ContactsToolbar, ContactsPageSize } from "@/components/crm/ContactsToolbar";
import { ContactsActions } from "@/components/crm/ContactsActions";
import { ContactsTable } from "@/components/crm/ContactsTable";
import { getLiveWebinarSessions } from "@/lib/live-webinars";

export const dynamic = "force-dynamic";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [sp, { prefs }, user] = await Promise.all([searchParams, getSettings(), requireCrmUser()]);
  const { query, filter } = resolveContactsQuery(sp, { view: prefs.defaultContactsView, pageSize: prefs.defaultContactsPageSize });
  const [contactData, owners, tags, sessions] = await Promise.all([
    getContactsPageData(filter), listOwners(), listTags(), getLiveWebinarSessions(),
  ]);
  const { rows, total, summary, matchingIds: allIds, sources, page, pageSize } = contactData;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (page > lastPage) redirect(contactPageHref(query, lastPage));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const canWrite = user.crmRole !== "readonly";
  const canAdmin = user.crmRole === "admin";
  const pageButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-mist bg-card px-3 py-2 text-sm font-medium text-heading transition-colors hover:bg-cloud focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust";

  return <div data-testid="contacts-workspace" className="min-w-0 space-y-5">
    <header>
      <p className="mb-3 flex items-center gap-2 text-xs text-slate"><span>CRM</span><span aria-hidden="true">/</span><span>Contacts</span></p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">Contacts</h1><span className="rounded-full border border-mist bg-card px-3 py-1 text-xs font-medium tabular-nums text-slate">{total} contact{total === 1 ? "" : "s"}</span></div><p className="mt-2 text-sm text-slate">Find the right people. Keep the next step in sight.</p></div>
        <ContactsActions owners={owners} canWrite={canWrite} canAdmin={canAdmin} exportHref={contactExportHref(query)} />
        {!canWrite ? <span className="rounded-full border border-mist bg-card px-3 py-1.5 text-xs text-slate">Read-only access</span> : null}
      </div>
    </header>

    <section aria-label="Contact directory" className="min-w-0 rounded-2xl border border-mist bg-card shadow-[0_2px_5px_rgba(15,44,76,0.025)]">
      <ContactsToolbar query={query} owners={owners} tags={tags} sources={sources} sessions={sessions} />
      <div className="border-y border-mist bg-cloud/50 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate sm:text-sm">
            <span><strong className="font-semibold tabular-nums text-heading">{summary.total}</strong> matching</span>
            <span><strong className="font-semibold tabular-nums text-heading">{summary.booked}</strong> booked</span>
            <span><strong className="font-semibold tabular-nums text-heading">{summary.avgWatchPct}%</strong> average evergreen watch</span>
          </div>
          <span className="text-[11px] text-slate">Across all matching contacts</span>
        </div>
        <details className="mt-2 text-xs text-slate">
          <summary className="w-fit cursor-pointer rounded py-1 underline decoration-mist underline-offset-4 hover:text-heading focus-visible:outline-2 focus-visible:outline-trust">Stage breakdown &amp; metric definitions</summary>
          <div className="mt-2 flex flex-wrap gap-2">{summary.byStage.map((item) => <span key={item.stage} className="rounded-md border border-mist bg-card px-2.5 py-1.5">{STAGE_LABELS[item.stage]} <strong className="ml-1 font-semibold tabular-nums text-heading">{item.count}</strong></span>)}</div>
          <p className="mt-3 max-w-4xl leading-relaxed">Booked counts contacts with a recorded booking, regardless of their pipeline stage. Watch progress comes from the evergreen webinar. Live webinar and session filters select contacts; they do not change these evergreen watch metrics. “This week” covers contacts added in the last seven days.</p>
        </details>
      </div>
      <ContactsTable key={query} query={query} rows={rows} allIds={allIds} owners={owners} tags={tags} total={total} canWrite={canWrite} canAdmin={canAdmin} />
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-mist px-4 py-4 sm:px-5">
        <p className="text-sm tabular-nums text-slate"><span className="font-medium text-heading">{from}–{to}</span> of {total}</p>
        <div className="flex flex-wrap items-center gap-3 sm:gap-5"><ContactsPageSize query={query} pageSize={pageSize} /><nav aria-label="Contacts pagination" className="flex gap-2">
          {page > 1 ? <Link href={contactPageHref(query, page - 1)} className={pageButton}>‹ <span>Previous</span></Link> : <button type="button" disabled className={`${pageButton} cursor-default opacity-40`}>‹ <span>Previous</span></button>}
          {page < lastPage ? <Link href={contactPageHref(query, page + 1)} className={pageButton}><span>Next</span> ›</Link> : <button type="button" disabled className={`${pageButton} cursor-default opacity-40`}><span>Next</span> ›</button>}
        </nav></div>
      </footer>
    </section>
  </div>;
}
