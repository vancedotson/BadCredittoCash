import { listContacts, type ContactFilter } from "@/lib/store";
import { contactsToCsv } from "@/lib/csv";

/**
 * GET /api/crm/export — download every contact matching the current filters as a
 * CSV (ignores pagination). The contacts page links here for "Export all".
 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const get = (k: string) => sp.get(k) || undefined;

  const { rows } = await listContacts({
    search: get("q"),
    stage: get("stage"),
    segment: get("segment"),
    source: get("source"),
    sort: (get("sort") as ContactFilter["sort"]) ?? "recent",
    page: 1,
    pageSize: 100000,
  });

  const csv = contactsToCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vance-contacts.csv"`,
    },
  });
}
