import type { ContactFilter, ContactSort } from "./store";
import { STAGES_IN_ORDER } from "./stages";
import { SEGMENTS_IN_ORDER } from "./segments";

export const CONTACT_VIEWS = [
  { key: "all", label: "All contacts", description: "Every contact matching your filters." },
  { key: "hot", label: "Hot leads", description: "Unbooked contacts with high watch progress or booking intent." },
  { key: "nofollow", label: "No follow-up", description: "Unbooked registrants and viewers with no open task." },
  { key: "booked", label: "Booked", description: "Contacts with a recorded booking event." },
  { key: "clients", label: "Clients", description: "Contacts in the Client stage." },
  { key: "week", label: "This week", description: "Contacts added in the last seven days." },
] as const;

const QUERY_KEYS = ["q", "stage", "segment", "source", "funnel", "sessionId", "owner", "tag", "view", "sort", "dir", "pageSize", "page"];
const SORTS: ContactSort[] = ["recent", "created", "name", "stage", "watch"];
type QueryInput = Record<string, string | string[] | undefined>;
function text(value: string | string[] | undefined): string { return typeof value === "string" ? value.trim() : ""; }
function positiveInteger(value: string | number | undefined, fallback: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(1, Math.trunc(n))) : fallback;
}

/** One effective state drives controls, data, pagination, exports, and saved views. */
export function resolveContactsQuery(input: QueryInput, defaults: { view: string; pageSize: number }): { query: string; filter: ContactFilter } {
  const params = new URLSearchParams();
  for (const key of QUERY_KEYS) { const value = text(input[key]); if (value) params.set(key, value); }
  const requestedView = params.get("view") ?? defaults.view;
  const view = CONTACT_VIEWS.some((item) => item.key === requestedView) ? requestedView : "all";
  const sort = SORTS.includes(params.get("sort") as ContactSort) ? params.get("sort") as ContactSort : "recent";
  const dir = params.get("dir") === "asc" ? "asc" : "desc";
  const pageSize = positiveInteger(params.get("pageSize") ?? undefined, positiveInteger(defaults.pageSize, 25, 200), 200);
  const page = positiveInteger(params.get("page") ?? undefined, 1, 1_000_000);
  if (!STAGES_IN_ORDER.some((stage) => stage === params.get("stage"))) params.delete("stage");
  if (!SEGMENTS_IN_ORDER.some((segment) => segment === params.get("segment"))) params.delete("segment");
  // The production session filter is a UUID parameter; malformed bookmarks must not reach SQL.
  if (params.has("sessionId") && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.get("sessionId")!)) params.delete("sessionId");
  if (!["live", "evergreen"].includes(params.get("funnel") ?? "")) params.delete("funnel");
  if (params.get("funnel") === "evergreen") params.delete("sessionId");
  else if (params.has("sessionId")) params.set("funnel", "live");
  if (params.get("owner") === "__all__") params.delete("owner");
  params.set("view", view); params.set("sort", sort); params.set("dir", dir); params.set("pageSize", String(pageSize));
  if (page > 1) params.set("page", String(page)); else params.delete("page");
  params.sort();
  return {
    query: params.toString(),
    filter: {
      search: params.get("q") ?? undefined, stage: params.get("stage") ?? undefined,
      segment: params.get("segment") ?? undefined, source: params.get("source") ?? undefined,
      owner: params.get("owner") ?? undefined, tag: params.get("tag") ?? undefined,
      funnel: (params.get("funnel") ?? undefined) as ContactFilter["funnel"], sessionId: params.get("sessionId") ?? undefined,
      // The URL needs an explicit All choice to override a saved default. SQL expects an empty view.
      view: view === "all" ? undefined : view, sort, dir, page, pageSize,
    },
  };
}

export function contactPageHref(query: string, page: number): string {
  const params = new URLSearchParams(query);
  if (page > 1) params.set("page", String(page)); else params.delete("page");
  return `/crm/contacts?${params.toString()}`;
}

export function contactExportHref(query: string): string {
  const params = new URLSearchParams(query);
  params.delete("page"); params.delete("pageSize");
  if (params.get("view") === "all") params.delete("view");
  return `/api/crm/export?${params.toString()}`;
}

export type SavedContactView = { name: string; query: string };
export function readContactViews(raw: string | null): SavedContactView[] {
  try {
    const data: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(data)) return [];
    const views = new Map<string, SavedContactView>();
    for (const item of data.slice(0, 50)) {
      if (!item || typeof item !== "object" || typeof item.name !== "string" || typeof item.query !== "string") continue;
      const name = item.name.trim().slice(0, 60);
      if (!name || item.query.length > 4096) continue;
      const input = Object.fromEntries(new URLSearchParams(item.query));
      delete input.page;
      const { query } = resolveContactsQuery(input, { view: "all", pageSize: 25 });
      views.set(name, { name, query });
    }
    return [...views.values()];
  } catch { return []; }
}
