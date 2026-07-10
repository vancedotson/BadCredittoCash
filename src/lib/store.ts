/**
 * Data store seam.
 *
 * This is the single source of truth for the funnel's data. Right now it's an
 * in-memory stub (seeded with sample rows so the dashboard has something to
 * show). When you connect Supabase, replace ONLY the bodies of the functions
 * below — the API routes and the dashboard call these signatures and won't
 * need to change. See the Supabase reference implementation in the comments.
 *
 * NOTE: the in-memory arrays are ephemeral — they reset when the dev server
 * restarts and aren't shared across serverless instances. That's fine as a
 * placeholder; real persistence arrives with Supabase.
 */

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  utm?: Record<string, string>;
  createdAt: string; // ISO timestamp
};

export type BehaviourEvent = {
  id: string;
  event: string;
  email?: string;
  props?: Record<string, unknown>;
  createdAt: string; // ISO timestamp
};

export type DashboardStats = {
  totalLeads: number;
  leadsToday: number;
  leadsLast7Days: number;
  totalEvents: number;
};

// --------------------------------------------------------------------------
// In-memory stub (replace with Supabase). Seeded so /dashboard isn't empty.
//
// State is pinned to globalThis so every bundle (route handlers and server
// components are bundled separately by Next) shares ONE instance in dev —
// otherwise a registration written by /api/lead wouldn't show up when the
// dashboard reads. Supabase removes this concern entirely.
// --------------------------------------------------------------------------
type StoreState = {
  leads: Lead[];
  events: BehaviourEvent[];
  counter: number;
};

function seedState(): StoreState {
  return {
    leads: [
      {
        id: "lead_1001",
        name: "Ana Martins",
        email: "ana@example.com",
        source: "vance-webinar",
        utm: { utm_source: "facebook", utm_campaign: "july-webinar" },
        createdAt: "2026-07-10T09:12:00.000Z",
      },
      {
        id: "lead_1002",
        name: "James Carter",
        email: "james@example.com",
        source: "vance-webinar",
        utm: { utm_source: "youtube" },
        createdAt: "2026-07-09T16:40:00.000Z",
      },
      {
        id: "lead_1003",
        name: "Sofia Rossi",
        email: "sofia@example.com",
        phone: "+39 320 000 0000",
        source: "vance-webinar",
        utm: { utm_source: "email", utm_campaign: "newsletter" },
        createdAt: "2026-07-06T11:05:00.000Z",
      },
    ],
    events: [
      {
        id: "evt_2001",
        event: "webinar_registered",
        email: "ana@example.com",
        props: { source: "vance-webinar" },
        createdAt: "2026-07-10T09:12:01.000Z",
      },
      {
        id: "evt_2002",
        event: "cta_clicked",
        props: { location: "hero" },
        createdAt: "2026-07-10T09:11:30.000Z",
      },
      {
        id: "evt_2003",
        event: "webinar_registered",
        email: "james@example.com",
        props: { source: "vance-webinar" },
        createdAt: "2026-07-09T16:40:02.000Z",
      },
    ],
    counter: 3000,
  };
}

const globalForStore = globalThis as unknown as {
  __vanceStore?: StoreState;
};
const state: StoreState = (globalForStore.__vanceStore ??= seedState());
const { leads, events } = state;

function nextId(prefix: string): string {
  state.counter += 1;
  return `${prefix}_${state.counter}`;
}

// --------------------------------------------------------------------------
// Repository API — keep these signatures when swapping to Supabase.
// --------------------------------------------------------------------------

export async function createLead(
  input: Omit<Lead, "id" | "createdAt">,
): Promise<Lead> {
  const lead: Lead = {
    id: nextId("lead"),
    createdAt: new Date().toISOString(),
    ...input,
  };
  leads.unshift(lead);

  // --- Supabase version (uncomment once configured): ---
  // const supabase = getSupabaseServerClient();
  // const { data, error } = await supabase
  //   .from("leads")
  //   .insert(input)
  //   .select()
  //   .single();
  // if (error) throw error;
  // return data as Lead;

  return lead;
}

export async function recordEvent(
  input: Omit<BehaviourEvent, "id" | "createdAt">,
): Promise<BehaviourEvent> {
  const event: BehaviourEvent = {
    id: nextId("evt"),
    createdAt: new Date().toISOString(),
    ...input,
  };
  events.unshift(event);

  // --- Supabase version: await supabase.from("events").insert(input) ---

  return event;
}

export async function listLeads(): Promise<Lead[]> {
  // --- Supabase: supabase.from("leads").select("*").order("created_at", { ascending: false })
  return [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listEvents(limit = 20): Promise<BehaviourEvent[]> {
  return [...events]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  const leadsToday = leads.filter(
    (l) => new Date(l.createdAt).getTime() >= startOfToday,
  ).length;
  const leadsLast7Days = leads.filter(
    (l) => new Date(l.createdAt).getTime() >= sevenDaysAgo,
  ).length;

  return {
    totalLeads: leads.length,
    leadsToday,
    leadsLast7Days,
    totalEvents: events.length,
  };
}
