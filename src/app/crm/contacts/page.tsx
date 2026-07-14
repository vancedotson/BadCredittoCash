import Link from "next/link";
import { listContacts, listContactIds, getContactsSummary, listOwners, listTags, getSourceStats, getSettings, type ContactFilter, type ContactSort } from "@/lib/store";
import { STAGE_LABELS } from "@/lib/stages";
import { PageTitle } from "@/components/crm/ui";
import { ContactsToolbar } from "@/components/crm/ContactsToolbar";
import { ContactsTable } from "@/components/crm/ContactsTable";

export const dynamic = "force-dynamic";

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { prefs } = await getSettings();
  const page = Number(str(sp.page)) || 1;
  const pageSize = Number(str(sp.pageSize)) || prefs.defaultContactsPageSize;
  const defaultView = prefs.defaultContactsView !== "all" ? prefs.defaultContactsView : undefined;
  const filter: ContactFilter = {
    search: str(sp.q), stage: str(sp.stage), segment: str(sp.segment), source: str(sp.source),
    owner: str(sp.owner), tag: str(sp.tag), view: str(sp.view) ?? defaultView,
    sort: (str(sp.sort) as ContactSort) ?? "recent", dir: (str(sp.dir) as "asc" | "desc") ?? "desc",
    page, pageSize,
  };

  const [{ rows, total }, summary, allIds, owners, tags, srcStats] = await Promise.all([
    listContacts(filter), getContactsSummary(filter), listContactIds(filter), listOwners(), listTags(), getSourceStats(),
  ]);
  const sources = srcStats.map((s) => s.source);

  const filterParams = () => {
    const p = new URLSearchParams();
    for (const k of ["q", "stage", "segment", "source", "owner", "tag", "view", "sort", "dir", "pageSize"]) {
      const v = str(sp[k]); if (v) p.set(k, v);
    }
    return p;
  };
  const pageHref = (n: number) => { const p = filterParams(); p.set("page", String(n)); return `/crm/contacts?${p.toString()}`; };
  const exportAllHref = `/api/crm/export?${filterParams().toString()}`;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const topStages = summary.byStage.filter((s) => s.count > 0).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle title="Contacts" subtitle={`${total} contact${total === 1 ? "" : "s"}`} />
        <a href={exportAllHref} className="rounded-lg border border-mist bg-card px-3 py-2 text-sm font-medium text-body transition-colors hover:bg-cloud">Export all CSV</a>
      </div>

      <ContactsToolbar owners={owners} tags={tags} sources={sources} />

      {/* Filtered mini-stats */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-mist bg-cloud px-4 py-2.5 text-sm">
        <span className="text-body"><span className="font-semibold tabular-nums">{summary.total}</span> <span className="text-slate">matching</span></span>
        <span className="text-body"><span className="font-semibold tabular-nums">{summary.booked}</span> <span className="text-slate">booked</span></span>
        <span className="text-body"><span className="font-semibold tabular-nums">{summary.avgWatchPct}%</span> <span className="text-slate">avg watch</span></span>
        <span className="flex flex-wrap gap-x-3 text-xs text-slate">{topStages.map((s) => <span key={s.stage}>{STAGE_LABELS[s.stage]}: <span className="tabular-nums text-body">{s.count}</span></span>)}</span>
      </div>

      <ContactsTable rows={rows} allIds={allIds} owners={owners} total={total} />

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate">
        <span>{from}–{to} of {total}</span>
        <div className="flex gap-2">
          <Link href={page > 1 ? pageHref(page - 1) : "#"} aria-disabled={page <= 1} className={`rounded-lg border border-mist px-3 py-1.5 ${page > 1 ? "text-body hover:bg-cloud" : "pointer-events-none opacity-40"}`}>Prev</Link>
          <Link href={to < total ? pageHref(page + 1) : "#"} aria-disabled={to >= total} className={`rounded-lg border border-mist px-3 py-1.5 ${to < total ? "text-body hover:bg-cloud" : "pointer-events-none opacity-40"}`}>Next</Link>
        </div>
      </div>
    </div>
  );
}
