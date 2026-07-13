import Link from "next/link";
import { listContacts, type ContactFilter } from "@/lib/store";
import { PageTitle } from "@/components/crm/ui";
import { ContactsToolbar } from "@/components/crm/ContactsToolbar";
import { ContactsTable } from "@/components/crm/ContactsTable";

export const dynamic = "force-dynamic";

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = Number(str(sp.page)) || 1;
  const sort = (str(sp.sort) as ContactFilter["sort"]) ?? "recent";
  const { rows, total, pageSize } = await listContacts({
    search: str(sp.q),
    stage: str(sp.stage),
    segment: str(sp.segment),
    source: str(sp.source),
    sort,
    page,
    pageSize: 25,
  });

  // Shared filter params (without paging) for pagination + the export-all link.
  const filterParams = () => {
    const params = new URLSearchParams();
    if (str(sp.q)) params.set("q", str(sp.q)!);
    if (str(sp.stage)) params.set("stage", str(sp.stage)!);
    if (str(sp.segment)) params.set("segment", str(sp.segment)!);
    if (str(sp.source)) params.set("source", str(sp.source)!);
    if (sort !== "recent") params.set("sort", sort!);
    return params;
  };
  const pageHref = (p: number) => {
    const params = filterParams();
    params.set("page", String(p));
    return `/crm/contacts?${params.toString()}`;
  };
  const exportAllHref = `/api/crm/export?${filterParams().toString()}`;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const hasPrev = page > 1;
  const hasNext = to < total;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle title="Contacts" subtitle={`${total} contact${total === 1 ? "" : "s"}`} />
        <a
          href={exportAllHref}
          className="rounded-lg border border-mist bg-card px-3 py-2 text-sm font-medium text-body transition-colors hover:bg-cloud"
        >
          Export all CSV
        </a>
      </div>

      <ContactsToolbar />

      <ContactsTable rows={rows} />

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate">
        <span>
          {from}–{to} of {total}
        </span>
        <div className="flex gap-2">
          <Link
            href={hasPrev ? pageHref(page - 1) : "#"}
            aria-disabled={!hasPrev}
            className={`rounded-lg border border-mist px-3 py-1.5 ${hasPrev ? "text-body hover:bg-cloud" : "pointer-events-none opacity-40"}`}
          >
            Prev
          </Link>
          <Link
            href={hasNext ? pageHref(page + 1) : "#"}
            aria-disabled={!hasNext}
            className={`rounded-lg border border-mist px-3 py-1.5 ${hasNext ? "text-body hover:bg-cloud" : "pointer-events-none opacity-40"}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
