import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("./supabase/server", () => ({ createClient: mocks.client }));
vi.mock("./supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("./demo", () => ({ isCrmDemoMode: () => false }));

import { getLeadById, hydrateStore, listActivity, listEvents, listEventsForEmail, listLeads } from "./store";

type Row = Record<string, unknown>;
type PageCall = { table: string; from: number; to: number; upper: [string, string] | null; order: Array<[string, boolean]> };
let tables: Record<string, Row[]>;
let calls: PageCall[];
let onPage: ((call: PageCall) => void) | undefined;
let failingTable: string | null;

function tableQuery(table: string) {
  let upper: [string, string] | null = null;
  const order: Array<[string, boolean]> = [];
  let id: string | undefined;
  const query = {
    select: () => query,
    eq: (_column: string, value: string) => { id = value; return query; },
    lte: (column: string, value: string) => { upper = [column, value]; return query; },
    order: (column: string, options: { ascending: boolean }) => { order.push([column, options.ascending]); return query; },
    maybeSingle: async () => ({ data: tables[table].find((row) => row.id === id) ?? null, error: null }),
    range: async (from: number, to: number) => {
      const call = { table, from, to, upper, order: [...order] };
      calls.push(call);
      onPage?.(call);
      if (failingTable === table && from >= 1000) return { data: null, error: { message: "Second page unavailable" } };
      let rows = [...(tables[table] ?? [])];
      if (upper) { const [column, value] = upper; rows = rows.filter((row) => String(row[column]) <= value); }
      rows.sort((a, b) => {
        for (const [column, ascending] of order) {
          const diff = String(a[column]).localeCompare(String(b[column]));
          if (diff) return ascending ? diff : -diff;
        }
        return 0;
      });
      return { data: rows.slice(from, to + 1), error: null };
    },
  };
  return query;
}

function contact(index: number): Row {
  return { id: `contact-${String(index).padStart(5, "0")}`, name: `Contact ${index}`, email: `person${index}@example.test`, stage: "new", source: "vance-webinar", created_at: "2026-01-01T12:00:00Z", updated_at: "2026-01-01T12:00:00Z", stage_changed_at: "2026-01-01T12:00:00Z", contact_tags: [] };
}

function event(index: number): Row {
  return { id: `event-${String(index).padStart(5, "0")}`, event_key: index === 0 ? "live_question_asked" : "live_presence", email: null, contact_id: "contact-00000", occurred_at: "2026-01-01T12:00:00Z", properties: { funnel: "live", sessionId: "session-a", ...(index === 0 ? { question: "Keep my early question visible." } : {}) } };
}

beforeEach(async () => {
  tables = { contacts: [], events: [], notes: [], tasks: [] };
  calls = [];
  onPage = undefined;
  failingTable = null;
  mocks.client.mockResolvedValue({ from: tableQuery });
  await hydrateStore();
  calls = [];
});

describe("complete CRM hydration", () => {
  it("retains older questions beyond 1,000 events and resolves contacts beyond the first contact page", async () => {
    tables.contacts = Array.from({ length: 1101 }, (_, index) => contact(index));
    tables.events = Array.from({ length: 2105 }, (_, index) => event(index));
    await hydrateStore();
    expect(await listLeads()).toHaveLength(1101);
    const timeline = await listEventsForEmail("person0@example.test");
    expect(timeline).toHaveLength(2105);
    expect(timeline.find((item) => item.event === "live_question_asked")?.props?.question).toBe("Keep my early question visible.");
    const activity = await listActivity({ category: "engagement", important: true });
    expect(activity.items).toHaveLength(1);
    expect(activity.items[0]).toMatchObject({ contactId: "contact-00000", contactName: "Contact 0", event: "live_question_asked" });
    expect(calls.filter((call) => call.table === "contacts").map((call) => call.from)).toEqual([0, 1000]);
    expect(calls.filter((call) => call.table === "events").map((call) => call.from)).toEqual([0, 1000, 2000]);
  });

  it("uses one timestamp boundary and deterministic tie-breaking while new events arrive", async () => {
    tables.contacts = [contact(0)];
    tables.events = Array.from({ length: 1105 }, (_, index) => event(index));
    onPage = (call) => {
      if (call.table === "events" && call.from === 0 && call.upper) tables.events.push({ ...event(9999), occurred_at: new Date(Date.parse(call.upper[1]) + 1000).toISOString() });
    };
    await hydrateStore();
    const loaded = await listEvents(5000);
    expect(loaded).toHaveLength(1105);
    expect(new Set(loaded.map((item) => item.id)).size).toBe(1105);
    expect(loaded.some((item) => item.id === "event-09999")).toBe(false);
    const eventCalls = calls.filter((call) => call.table === "events");
    expect(new Set(calls.map((call) => call.upper?.[1])).size).toBe(1);
    expect(eventCalls.every((call) => JSON.stringify(call.order) === JSON.stringify([["occurred_at", false], ["id", false]]))).toBe(true);
  });

  it.each(["contacts", "events", "notes", "tasks"])("retains the previous complete state if a later %s page fails", async (table) => {
    tables.contacts = [contact(0)];
    tables.events = [event(0)];
    await hydrateStore();
    tables.contacts = [contact(1)];
    tables.events = [event(1)];
    tables[table] = Array.from({ length: 1101 }, (_, index) => table === "contacts" ? contact(index + 2) : table === "events" ? event(index + 2) : { id: String(index), created_at: "2026-01-01T12:00:00Z" });
    failingTable = table;
    await expect(hydrateStore()).rejects.toThrow("Second page unavailable");
    expect((await listLeads()).map((lead) => lead.id)).toEqual(["contact-00000"]);
    expect((await listEvents()).map((item) => item.id)).toEqual(["event-00000"]);
  });

  it("normalizes legacy booked stages when reading a single contact", async () => {
    tables.contacts = [{ ...contact(0), stage: "call_booked" }];
    expect((await getLeadById("contact-00000"))?.stage).toBe("booked");
  });
});
