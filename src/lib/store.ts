/**
 * Data store seam.
 *
 * The single source of truth for the funnel + CRM data. In-memory stub (seeded)
 * pinned to globalThis so every Next bundle shares one instance in dev. When you
 * connect Supabase, replace ONLY the function bodies below — signatures survive
 * the swap. Ephemeral: resets on dev-server restart.
 */

import { EVENTS } from "./events";
import { deriveSegment, SEGMENT_LABELS, SEGMENTS_IN_ORDER, type Segment } from "./segments";
import {
  stageFromEvents,
  ACTIVE_STAGES,
  STAGES_IN_ORDER,
  STAGE_PROBABILITY,
  LOST_REASONS,
  type Stage,
  type Tone,
} from "./stages";
import { type TaskPriority, type TaskType, type Recurrence } from "./tasks";
import { displayEvent, CATEGORY_LABELS, EVENT_CATEGORIES, type EventCategory } from "./event-display";

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  utm?: Record<string, string>;
  createdAt: string; // ISO timestamp
  // CRM fields (optional; default gracefully):
  stage?: Stage; // manual pipeline stage; falls back to stageFromEvents
  owner?: string;
  tags?: string[];
  updatedAt?: string;
  stageChangedAt?: string; // when stage last changed (pipeline aging/velocity)
  lostReason?: string; // captured when moved to Lost
};

export type BehaviourEvent = {
  id: string;
  event: string;
  email?: string;
  props?: Record<string, unknown>;
  createdAt: string; // ISO timestamp
};

export type Note = {
  id: string;
  email: string;
  body: string;
  author?: string;
  createdAt: string;
};

export type Task = {
  id: string;
  email: string;
  title: string;
  dueDate?: string; // ISO (date, or date+time)
  done: boolean;
  createdAt: string;
  priority?: TaskPriority; // default "normal"
  type?: TaskType; // default "follow_up"
  owner?: string;
  notes?: string;
  recurrence?: Recurrence; // default "none"
  completedAt?: string;
};

export type TaskInput = {
  title: string;
  dueDate?: string;
  priority?: TaskPriority;
  type?: TaskType;
  owner?: string;
  notes?: string;
  recurrence?: Recurrence;
};

export type DashboardStats = {
  totalLeads: number;
  leadsToday: number;
  leadsLast7Days: number;
  totalEvents: number;
};

export type FunnelStage = { key: string; label: string; count: number };
export type FunnelSegment = { key: Segment; label: string; count: number };
export type FunnelStats = {
  stages: FunnelStage[];
  segments: FunnelSegment[];
  knownLeads: number; // distinct emails seen in events
};

// ---- CRM view types --------------------------------------------------------
export type Contact = Lead & {
  stage: Stage; // resolved (explicit or derived)
  segment: Segment; // behavioral
  lastActivityAt: string;
  eventCount: number;
  watchPct: number;
  booked: boolean;
  noteCount: number;
  openTaskCount: number;
  daysSinceActivity: number;
  stageAgeDays: number; // days in the current stage
  hasOverdueTask: boolean;
  nextTask?: { title: string; dueDate?: string; overdue: boolean };
};

export type ContactDetail = {
  contact: Contact;
  events: BehaviourEvent[];
  notes: Note[];
  tasks: Task[];
  sequences: string[]; // enrolled email sequences (from email_queued props)
};

export type ContactSort = "recent" | "created" | "name" | "stage" | "watch";
export type ContactView = "hot" | "nofollow" | "booked" | "clients" | "week";
export type ContactFilter = {
  search?: string;
  stage?: string;
  segment?: string;
  source?: string;
  owner?: string;
  tag?: string;
  view?: string;
  sort?: ContactSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};
export type ContactPage = {
  rows: Contact[];
  total: number;
  page: number;
  pageSize: number;
};
export type ContactsSummary = {
  total: number;
  booked: number;
  avgWatchPct: number;
  byStage: Array<{ stage: Stage; count: number }>;
};

export type ActivityItem = BehaviourEvent & { contactName?: string; contactId?: string };
export type ActivityFilter = { search?: string; category?: string; important?: boolean; owner?: string; from?: string; to?: string; limit?: number; offset?: number };
export type ActivityPage = { items: ActivityItem[]; total: number };
export type ActivitySummary = { today: number; thisWeek: number; byCategory: Array<{ category: EventCategory; label: string; count: number }> };

export type CrmStats = {
  totalContacts: number;
  newLast7Days: number;
  booked: number;
  regToBookedPct: number;
  openTasks: number;
};
export type SourceStat = { source: string; contacts: number; booked: number; convPct: number };
export type TimePoint = { date: string; label: string; count: number };
export type TaskWithContact = Task & { contactName: string; contactId: string };
export type ContactOption = { id: string; name: string; email: string };
export type TaskStats = {
  open: number;
  overdue: number;
  dueToday: number;
  thisWeek: number;
  completedThisWeek: number;
  completionRatePct: number;
};

// ---- Overview (home dashboard) view types ----
export type OverviewKpi = { key: string; label: string; value: string | number; delta?: number; deltaGood?: boolean; href: string };
export type ActionItem = { id: string; kind: "overdue" | "hot" | "nofollow"; title: string; subtitle: string; href: string; tone: Tone };
export type OverviewFunnelStage = { key: string; label: string; count: number; convPct: number | null };
export type TrendPoint = { label: string; registered: number; booked: number };
export type OverviewData = {
  kpis: OverviewKpi[];
  actions: ActionItem[];
  pipeline: { active: number; won: number; lost: number; winRatePct: number; expectedClients: number; stalest: Array<{ id: string; name: string; stage: Stage; stageAgeDays: number }> };
  funnel: OverviewFunnelStage[];
  segments: FunnelSegment[];
  sources: SourceStat[];
  bestSource: string | null;
  trend: TrendPoint[];
  engagement: { showUpPct: number; watchToBookPct: number; avgWatchPct: number };
  thisWeek: { booked: number; tasksCompleted: number; newClients: number };
  speed: { avgRegToBookedDays: number | null };
  owners: string[];
  generatedAt: string;
};

export type PipelineStageStat = { stage: Stage; count: number; avgAgeDays: number };
export type PipelineStats = {
  active: number;
  won: number;
  lost: number;
  winRatePct: number;
  bookedThisWeek: number;
  expectedClients: number;
  byStage: PipelineStageStat[];
};

// --------------------------------------------------------------------------
// In-memory stub (replace with Supabase). Seeded so the CRM isn't empty.
// --------------------------------------------------------------------------
export type CrmProfile = {
  brandName: string;
  bookingUrl: string;
  trainingUrl: string;
  fromName: string;
  replyTo: string;
  timezone: string;
};
export type NotifyPrefs = { overdueTasks: boolean; coolingLeads: boolean; noFollowUp: boolean; newBookings: boolean };
export type CrmPrefs = {
  defaultContactsPageSize: number;
  defaultContactsView: string;
  theme: "light" | "dark" | "system";
  notify: NotifyPrefs;
};
export type CrmSettings = {
  owners: string[];
  tags: string[]; // registry, merged with tags actually seen on contacts
  defaultOwner?: string;
  profile: CrmProfile;
  prefs: CrmPrefs;
};

type StoreState = {
  version: number;
  leads: Lead[];
  events: BehaviourEvent[];
  notes: Note[];
  tasks: Task[];
  settings: CrmSettings;
  counter: number;
};

// Bump when the seed shape changes so a long-running dev server (which pins state
// to globalThis across hot-reloads) reseeds instead of serving a stale shape.
const SEED_VERSION = 5;

function defaultProfile(): CrmProfile {
  return {
    brandName: "Vance Dotson",
    bookingUrl: "https://vancedotson.com/book-a-call",
    trainingUrl: "https://vancedotson.com/webinar/room",
    fromName: "Vance Dotson",
    replyTo: "vance@vancedotson.com",
    timezone: "America/Chicago",
  };
}
function defaultNotify(): NotifyPrefs {
  return { overdueTasks: true, coolingLeads: true, noFollowUp: true, newBookings: true };
}
function defaultPrefs(): CrmPrefs {
  return { defaultContactsPageSize: 25, defaultContactsView: "all", theme: "system", notify: defaultNotify() };
}
function defaultSettings(): CrmSettings {
  return { owners: ["Vance", "Team"], tags: ["priority"], defaultOwner: "Vance", profile: defaultProfile(), prefs: defaultPrefs() };
}

const DAY = 24 * 60 * 60 * 1000;

// Which funnel events a contact has fired, by "level" reached.
type Level = "new" | "registered" | "low" | "mid" | "high" | "offer" | "abandon" | "booked" | "client";

function journeyFor(level: Level): Array<{ ev: string; min: number; props?: Record<string, unknown> }> {
  if (level === "new") return [];
  const s: Array<{ ev: string; min: number; props?: Record<string, unknown> }> = [
    { ev: EVENTS.registered, min: 0, props: { source: "vance-webinar" } },
    { ev: EVENTS.emailQueued, min: 0, props: { sequence: "pre_webinar" } },
    { ev: EVENTS.confirmedView, min: 2 },
  ];
  const engaged = ["low", "mid", "high", "offer", "abandon", "booked", "client"].includes(level);
  if (engaged) {
    s.push({ ev: EVENTS.quizStarted, min: 3 });
    s.push({ ev: EVENTS.quizCompleted, min: 4, props: { concern: "The collector calls won't stop", tried: "I disputed it myself", urgency: "As soon as possible, it's urgent" } });
    s.push({ ev: EVENTS.goalReplied, min: 5, props: { goal: "Stop the calls and clean up my report" } });
    s.push({ ev: EVENTS.roomOpened, min: 30 });
    s.push({ ev: EVENTS.watch25, min: 33 });
  }
  if (["mid", "high", "offer", "abandon", "booked", "client"].includes(level)) s.push({ ev: EVENTS.watch50, min: 38 });
  if (["high", "offer", "abandon", "booked", "client"].includes(level)) {
    s.push({ ev: EVENTS.watch75, min: 43 });
    s.push({ ev: EVENTS.watch90, min: 47 });
    s.push({ ev: EVENTS.completed, min: 50 });
  }
  if (["offer", "abandon", "booked", "client"].includes(level)) {
    s.push({ ev: EVENTS.offerCtaClicked, min: 51 });
    s.push({ ev: EVENTS.callPageView, min: 52 });
  }
  if (level === "abandon") s.push({ ev: EVENTS.bookingStarted, min: 53 });
  if (["booked", "client"].includes(level)) {
    s.push({ ev: EVENTS.bookingStarted, min: 53 });
    s.push({ ev: EVENTS.booked, min: 55, props: { preferredTime: "Weekday mornings" } });
    s.push({ ev: EVENTS.emailQueued, min: 55, props: { sequence: "onboarding" } });
  }
  return s;
}

function seedState(): StoreState {
  const now = Date.now();
  const profiles: Array<{
    name: string; email: string; src: string; d: number; level: Level;
    phone?: string; owner?: string; tags?: string[]; stage?: Stage;
  }> = [
    { name: "Ana Martins", email: "ana@example.com", src: "facebook", d: 12, level: "client", phone: "+1 405 555 0110", owner: "Vance", tags: ["priority"], stage: "won" },
    { name: "James Carter", email: "james@example.com", src: "youtube", d: 11, level: "booked" },
    { name: "Sofia Rossi", email: "sofia@example.com", src: "email", d: 10, level: "abandon", phone: "+1 405 555 0112" },
    { name: "Marcus Bell", email: "marcus@example.com", src: "google", d: 9, level: "offer" },
    { name: "Nia Thompson", email: "nia@example.com", src: "facebook", d: 9, level: "high" },
    { name: "Diego Alvarez", email: "diego@example.com", src: "instagram", d: 8, level: "high", phone: "+1 405 555 0115" },
    { name: "Priya Nair", email: "priya@example.com", src: "google", d: 7, level: "mid" },
    { name: "Tyler Brooks", email: "tyler@example.com", src: "tiktok", d: 6, level: "low" },
    { name: "Grace Okafor", email: "grace@example.com", src: "email", d: 6, level: "booked", phone: "+1 405 555 0118", owner: "Vance" },
    { name: "Liam Walsh", email: "liam@example.com", src: "facebook", d: 5, level: "registered" },
    { name: "Hannah Kim", email: "hannah@example.com", src: "partner", d: 4, level: "offer" },
    { name: "Omar Haddad", email: "omar@example.com", src: "youtube", d: 3, level: "mid" },
    { name: "Bella Nguyen", email: "bella@example.com", src: "direct", d: 2, level: "registered" },
    { name: "Chris Dawson", email: "chris@example.com", src: "google", d: 2, level: "low" },
    { name: "Rosa Jimenez", email: "rosa@example.com", src: "facebook", d: 1, level: "high", phone: "+1 405 555 0123" },
    { name: "Evan Wright", email: "evan@example.com", src: "tiktok", d: 0, level: "registered" },
    { name: "Walk-in Referral", email: "referral@example.com", src: "partner", d: 3, level: "new", phone: "+1 405 555 0125", stage: "new" },
  ];

  const leads: Lead[] = [];
  const events: BehaviourEvent[] = [];
  let ln = 1000;
  let en = 20000;

  for (const p of profiles) {
    const reg = now - p.d * DAY + 10 * 60 * 60 * 1000; // ~10:00 that day
    const journey = journeyFor(p.level);
    const last = journey.length ? reg + journey[journey.length - 1].min * 60 * 1000 : reg;
    leads.push({
      id: `lead_${++ln}`,
      name: p.name,
      email: p.email,
      phone: p.phone,
      source: "vance-webinar",
      utm: { utm_source: p.src },
      createdAt: new Date(reg).toISOString(),
      stage: p.stage,
      owner: p.owner,
      tags: p.tags,
      updatedAt: new Date(last).toISOString(),
    });
    for (const step of journey) {
      events.push({
        id: `evt_${++en}`,
        event: step.ev,
        email: p.email,
        props: step.props,
        createdAt: new Date(reg + step.min * 60 * 1000).toISOString(),
      });
    }
  }

  const notes: Note[] = [
    { id: "note_1", email: "ana@example.com", body: "Great first call. Pulling her 3 bureau reports, two medical collections look inaccurate. Sending the intake packet.", author: "Vance", createdAt: new Date(now - 11 * DAY).toISOString() },
    { id: "note_2", email: "ana@example.com", body: "Signed the engagement. Opening the case.", author: "Vance", createdAt: new Date(now - 10 * DAY).toISOString() },
    { id: "note_3", email: "grace@example.com", body: "Booked for a weekday morning. She has collector voicemails saved, big FDCPA angle.", author: "Vance", createdAt: new Date(now - 5 * DAY).toISOString() },
    { id: "note_4", email: "sofia@example.com", body: "Started booking but dropped off. Follow up, she seemed unsure about cost.", author: "Vance", createdAt: new Date(now - 9 * DAY).toISOString() },
  ];

  const tasks: Task[] = [
    { id: "task_1", email: "sofia@example.com", title: "Call back about the strategy call", type: "call", priority: "high", owner: "Vance", dueDate: new Date(now - 1 * DAY).toISOString(), done: false, createdAt: new Date(now - 9 * DAY).toISOString() },
    { id: "task_2", email: "grace@example.com", title: "Send prep checklist before the call", type: "email", priority: "high", owner: "Vance", dueDate: new Date(now).toISOString(), done: false, createdAt: new Date(now - 5 * DAY).toISOString() },
    { id: "task_3", email: "ana@example.com", title: "Draft dispute letters for 2 medical collections", type: "document", priority: "high", owner: "Vance", dueDate: new Date(now + 2 * DAY).toISOString(), done: false, createdAt: new Date(now - 9 * DAY).toISOString() },
    { id: "task_4", email: "marcus@example.com", title: "Nudge: clicked book but didn't finish", type: "follow_up", priority: "normal", owner: "Team", dueDate: new Date(now + 1 * DAY).toISOString(), done: false, createdAt: new Date(now - 8 * DAY).toISOString() },
    { id: "task_5", email: "hannah@example.com", title: "Re-send the booking link", type: "email", priority: "normal", dueDate: new Date(now - 2 * DAY).toISOString(), done: false, createdAt: new Date(now - 4 * DAY).toISOString() },
    { id: "task_6", email: "nia@example.com", title: "Weekly value email", type: "email", priority: "low", recurrence: "weekly", owner: "Team", dueDate: new Date(now + 4 * DAY).toISOString(), done: false, createdAt: new Date(now - 6 * DAY).toISOString() },
    { id: "task_7", email: "ana@example.com", title: "Confirm intake packet received", type: "follow_up", priority: "normal", owner: "Vance", done: true, completedAt: new Date(now - 8 * DAY).toISOString(), createdAt: new Date(now - 10 * DAY).toISOString() },
    { id: "task_8", email: "grace@example.com", title: "Log the discovery call notes", type: "document", priority: "normal", owner: "Vance", done: true, completedAt: new Date(now - 2 * DAY).toISOString(), createdAt: new Date(now - 5 * DAY).toISOString() },
  ];

  return { version: SEED_VERSION, leads, events, notes, tasks, settings: defaultSettings(), counter: 30000 };
}

const globalForStore = globalThis as unknown as { __vanceStore?: StoreState };
if (!globalForStore.__vanceStore || globalForStore.__vanceStore.version !== SEED_VERSION) {
  globalForStore.__vanceStore = seedState();
}
const state: StoreState = globalForStore.__vanceStore;
// Defensive migration: fill any missing settings sub-shape so a stale globalThis
// state (HMR that didn't reseed) can't 500 the CRM.
if (!state.settings) state.settings = defaultSettings();
const _s = state.settings;
_s.owners ??= ["Vance", "Team"];
_s.tags ??= [];
_s.profile ??= defaultProfile();
_s.prefs ??= defaultPrefs();
_s.prefs.notify ??= defaultNotify();
const { leads, events, notes, tasks } = state;

function nextId(prefix: string): string {
  state.counter += 1;
  return `${prefix}_${state.counter}`;
}

// --------------------------------------------------------------------------
// Repository API — funnel (unchanged signatures).
// --------------------------------------------------------------------------

export async function createLead(input: Omit<Lead, "id" | "createdAt">): Promise<Lead> {
  const lead: Lead = { id: nextId("lead"), createdAt: new Date().toISOString(), ...input };
  leads.unshift(lead);
  // --- Supabase: await supabase.from("leads").insert(input).select().single() ---
  return lead;
}

export async function recordEvent(input: Omit<BehaviourEvent, "id" | "createdAt">): Promise<BehaviourEvent> {
  const event: BehaviourEvent = { id: nextId("evt"), createdAt: new Date().toISOString(), ...input };
  events.unshift(event);
  // --- Supabase: await supabase.from("events").insert(input) ---
  return event;
}

export async function listLeads(): Promise<Lead[]> {
  return [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listEvents(limit = 20): Promise<BehaviourEvent[]> {
  return [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

/** Every event fired by one lead (by email) — feeds segment derivation + timeline. */
export async function listEventsForEmail(email: string): Promise<BehaviourEvent[]> {
  return events.filter((e) => e.email === email).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const FUNNEL_STAGES: Array<{ key: string; label: string; event: string }> = [
  { key: "registered", label: "Registered", event: EVENTS.registered },
  { key: "confirmed", label: "Confirmation seen", event: EVENTS.confirmedView },
  { key: "room", label: "Opened the room", event: EVENTS.roomOpened },
  { key: "watch25", label: "Watched 25%", event: EVENTS.watch25 },
  { key: "watch50", label: "Watched 50%", event: EVENTS.watch50 },
  { key: "watch75", label: "Watched 75%", event: EVENTS.watch75 },
  { key: "watch90", label: "Watched 90%", event: EVENTS.watch90 },
  { key: "completed", label: "Finished", event: EVENTS.completed },
  { key: "booked", label: "Booked the call", event: EVENTS.booked },
];

export async function getFunnelStats(): Promise<FunnelStats> {
  const byEmail = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.email) continue;
    const set = byEmail.get(e.email) ?? new Set<string>();
    set.add(e.event);
    byEmail.set(e.email, set);
  }
  const stages: FunnelStage[] = FUNNEL_STAGES.map((s) => ({
    key: s.key,
    label: s.label,
    count: [...byEmail.values()].filter((set) => set.has(s.event)).length,
  }));
  const tally = new Map<Segment, number>();
  for (const set of byEmail.values()) {
    const seg = deriveSegment([...set].map((event) => ({ event })));
    tally.set(seg, (tally.get(seg) ?? 0) + 1);
  }
  const segments: FunnelSegment[] = SEGMENTS_IN_ORDER.map((key) => ({
    key,
    label: SEGMENT_LABELS[key],
    count: tally.get(key) ?? 0,
  }));
  return { stages, segments, knownLeads: byEmail.size };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = now.getTime() - 7 * DAY;
  const leadsToday = leads.filter((l) => new Date(l.createdAt).getTime() >= startOfToday).length;
  const leadsLast7Days = leads.filter((l) => new Date(l.createdAt).getTime() >= sevenDaysAgo).length;
  return { totalLeads: leads.length, leadsToday, leadsLast7Days, totalEvents: events.length };
}

// --------------------------------------------------------------------------
// Repository API — CRM.
// --------------------------------------------------------------------------

function watchPctFor(names: string[]): number {
  if (names.includes(EVENTS.completed)) return 100;
  if (names.includes(EVENTS.watch90)) return 90;
  if (names.includes(EVENTS.watch75)) return 75;
  if (names.includes(EVENTS.watch50)) return 50;
  if (names.includes(EVENTS.watch25)) return 25;
  if (names.includes(EVENTS.roomOpened)) return 5;
  return 0;
}

/** Ensure every email seen in events has a Lead row (backfills bookers/anonymous). */
function ensureLeadForEmail(email: string): Lead {
  let lead = leads.find((l) => l.email === email);
  if (lead) return lead;
  const evs = events.filter((e) => e.email === email);
  const earliest = evs.length ? evs.reduce((m, e) => (e.createdAt < m ? e.createdAt : m), evs[0].createdAt) : new Date().toISOString();
  const nameProp = evs.map((e) => e.props?.name).find((n) => typeof n === "string") as string | undefined;
  const src = evs.map((e) => e.props?.source).find((s) => typeof s === "string") as string | undefined;
  lead = {
    id: nextId("lead"),
    name: nameProp ?? email.split("@")[0],
    email,
    source: src ?? "vance-webinar",
    createdAt: earliest,
  };
  leads.push(lead);
  return lead;
}

function backfillContacts(): void {
  const emails = new Set(events.map((e) => e.email).filter((e): e is string => !!e));
  emails.forEach(ensureLeadForEmail);
}

function contactSource(lead: Lead): string {
  return lead.utm?.utm_source ?? lead.source ?? "direct";
}

function enrichContact(lead: Lead, evs: BehaviourEvent[]): Contact {
  const names = evs.map((e) => e.event);
  const segment = deriveSegment(names.map((event) => ({ event })));
  const now = Date.now();
  const openTaskList = tasks
    .filter((t) => t.email === lead.email && !t.done)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const next = openTaskList[0];
  const isOver = (iso?: string) => !!iso && new Date(iso).getTime() < now;
  const lastActivityAt = evs.length ? evs[0].createdAt : lead.updatedAt ?? lead.createdAt;
  const stageSince = lead.stageChangedAt ?? lead.createdAt;
  return {
    ...lead,
    stage: lead.stage ?? stageFromEvents(names),
    segment,
    lastActivityAt,
    eventCount: evs.length,
    watchPct: watchPctFor(names),
    booked: names.includes(EVENTS.booked),
    noteCount: notes.filter((n) => n.email === lead.email).length,
    openTaskCount: openTaskList.length,
    daysSinceActivity: Math.max(0, Math.floor((now - new Date(lastActivityAt).getTime()) / DAY)),
    stageAgeDays: Math.max(0, Math.floor((now - new Date(stageSince).getTime()) / DAY)),
    hasOverdueTask: openTaskList.some((t) => isOver(t.dueDate)),
    nextTask: next ? { title: next.title, dueDate: next.dueDate, overdue: isOver(next.dueDate) } : undefined,
  };
}

// All contacts, enriched — the base set every contacts query filters from.
function allEnrichedContacts(): Contact[] {
  backfillContacts();
  const byEmail = new Map<string, BehaviourEvent[]>();
  for (const e of events) {
    if (!e.email) continue;
    (byEmail.get(e.email) ?? byEmail.set(e.email, []).get(e.email)!).push(e);
  }
  for (const list of byEmail.values()) list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return leads.map((l) => enrichContact(l, byEmail.get(l.email) ?? []));
}

function matchView(c: Contact, view: string): boolean {
  switch (view) {
    case "hot":
      return !c.booked && ["high_watch", "offer_click_no_book", "booking_abandon"].includes(c.segment);
    case "nofollow":
      return !c.booked && c.openTaskCount === 0 && ["registered_no_show", "low_watch", "mid_watch", "high_watch"].includes(c.segment);
    case "booked":
      return c.booked;
    case "clients":
      return c.stage === "won";
    case "week":
      return Date.now() - new Date(c.createdAt).getTime() < 7 * DAY;
    default:
      return true;
  }
}

function filterAndSortContacts(filter: ContactFilter): Contact[] {
  let rows = allEnrichedContacts();
  const q = filter.search?.trim().toLowerCase();
  if (q) rows = rows.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  if (filter.stage) rows = rows.filter((c) => c.stage === filter.stage);
  if (filter.segment) rows = rows.filter((c) => c.segment === filter.segment);
  if (filter.source) rows = rows.filter((c) => contactSource(c) === filter.source);
  if (filter.owner) rows = rows.filter((c) => (filter.owner === "__none__" ? !c.owner : c.owner === filter.owner));
  if (filter.tag) rows = rows.filter((c) => (c.tags ?? []).includes(filter.tag!));
  if (filter.view) rows = rows.filter((c) => matchView(c, filter.view!));

  const sort: ContactSort = filter.sort ?? "recent";
  const asc = filter.dir === "asc";
  const cmp = (a: Contact, b: Contact) => {
    switch (sort) {
      case "name": return a.name.localeCompare(b.name);
      case "created": return a.createdAt.localeCompare(b.createdAt);
      case "stage": return STAGES_IN_ORDER.indexOf(a.stage) - STAGES_IN_ORDER.indexOf(b.stage);
      case "watch": return a.watchPct - b.watchPct;
      default: return a.lastActivityAt.localeCompare(b.lastActivityAt); // recent
    }
  };
  rows.sort((a, b) => (asc ? cmp(a, b) : -cmp(a, b)));
  return rows;
}

export async function listContacts(filter: ContactFilter = {}): Promise<ContactPage> {
  const rows = filterAndSortContacts(filter);
  const total = rows.length;
  const pageSize = filter.pageSize ?? 25;
  const page = Math.max(1, filter.page ?? 1);
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total, page, pageSize };
}

/** All contact ids matching a filter (for "select all N" bulk actions across pages). */
export async function listContactIds(filter: ContactFilter = {}): Promise<string[]> {
  return filterAndSortContacts(filter).map((c) => c.id);
}

/** Aggregate stats over the current filter (the mini-stat strip). */
export async function getContactsSummary(filter: ContactFilter = {}): Promise<ContactsSummary> {
  const rows = filterAndSortContacts(filter);
  const watched = rows.filter((c) => c.watchPct > 0);
  const byStageMap = new Map<Stage, number>();
  for (const s of STAGES_IN_ORDER) byStageMap.set(s, 0);
  for (const c of rows) byStageMap.set(c.stage, (byStageMap.get(c.stage) ?? 0) + 1);
  return {
    total: rows.length,
    booked: rows.filter((c) => c.booked).length,
    avgWatchPct: watched.length ? Math.round(watched.reduce((n, c) => n + c.watchPct, 0) / watched.length) : 0,
    byStage: STAGES_IN_ORDER.map((stage) => ({ stage, count: byStageMap.get(stage) ?? 0 })),
  };
}

/** Distinct tags across all contacts (for the tag filter). */
export async function listTags(): Promise<string[]> {
  const set = new Set<string>();
  for (const l of leads) for (const t of l.tags ?? []) set.add(t);
  return [...set].sort();
}

export async function addTagToContact(id: string, tag: string): Promise<Lead | null> {
  const l = leads.find((x) => x.id === id);
  if (!l) return null;
  l.tags = [...new Set([...(l.tags ?? []), tag])];
  l.updatedAt = new Date().toISOString();
  return l;
}

/** Delete a contact and its notes/tasks/events (so backfill won't resurrect it). */
export async function deleteContact(id: string): Promise<boolean> {
  const i = leads.findIndex((l) => l.id === id);
  if (i === -1) return false;
  const email = leads[i].email;
  leads.splice(i, 1);
  for (let j = notes.length - 1; j >= 0; j--) if (notes[j].email === email) notes.splice(j, 1);
  for (let j = tasks.length - 1; j >= 0; j--) if (tasks[j].email === email) tasks.splice(j, 1);
  for (let j = events.length - 1; j >= 0; j--) if (events[j].email === email) events.splice(j, 1);
  return true;
}

export async function getContact(idOrEmail: string): Promise<ContactDetail | null> {
  backfillContacts();
  const lead = leads.find((l) => l.id === idOrEmail || l.email === idOrEmail);
  if (!lead) return null;
  const evs = await listEventsForEmail(lead.email);
  const contact = enrichContact(lead, evs);
  const contactNotes = notes.filter((n) => n.email === lead.email).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const contactTasks = tasks
    .filter((t) => t.email === lead.email)
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const sequences = [...new Set(evs.filter((e) => e.event === EVENTS.emailQueued).map((e) => e.props?.sequence).filter((s): s is string => typeof s === "string"))];
  return { contact, events: evs, notes: contactNotes, tasks: contactTasks, sequences };
}

export async function getLeadById(id: string): Promise<Lead | null> {
  return leads.find((l) => l.id === id) ?? null;
}

export async function updateLead(
  id: string,
  patch: Partial<Pick<Lead, "stage" | "owner" | "tags" | "name" | "phone" | "lostReason">>,
): Promise<Lead | null> {
  const lead = leads.find((l) => l.id === id);
  if (!lead) return null;
  const now = new Date().toISOString();
  if (patch.stage && patch.stage !== lead.stage) lead.stageChangedAt = now;
  Object.assign(lead, patch, { updatedAt: now });
  // --- Supabase: await supabase.from("leads").update(patch).eq("id", id) ---
  return lead;
}

export async function upsertLeadByEmail(email: string, partial: Partial<Lead> = {}): Promise<Lead> {
  const existing = leads.find((l) => l.email === email);
  if (existing) {
    Object.assign(existing, { ...partial, email }, { updatedAt: new Date().toISOString() });
    return existing;
  }
  const lead: Lead = {
    id: nextId("lead"),
    name: partial.name ?? email.split("@")[0],
    email,
    source: partial.source ?? "vance-webinar",
    createdAt: new Date().toISOString(),
    ...partial,
  };
  leads.unshift(lead);
  return lead;
}

export async function addNote(email: string, body: string, author?: string): Promise<Note> {
  const note: Note = { id: nextId("note"), email, body, author, createdAt: new Date().toISOString() };
  notes.unshift(note);
  return note;
}

export async function listNotes(email: string): Promise<Note[]> {
  return notes.filter((n) => n.email === email).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addTask(email: string, input: TaskInput): Promise<Task> {
  const task: Task = {
    id: nextId("task"),
    email,
    title: input.title,
    dueDate: input.dueDate,
    done: false,
    createdAt: new Date().toISOString(),
    priority: input.priority ?? "normal",
    type: input.type ?? "follow_up",
    owner: input.owner,
    notes: input.notes,
    recurrence: input.recurrence ?? "none",
  };
  tasks.unshift(task);
  return task;
}

export async function listTasks(email: string): Promise<Task[]> {
  return tasks.filter((t) => t.email === email);
}

// When a recurring task is completed, spawn its next occurrence.
function spawnRecurrence(task: Task): void {
  if (!task.recurrence || task.recurrence === "none" || !task.dueDate) return;
  const next = new Date(task.dueDate);
  if (task.recurrence === "weekly") next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  tasks.unshift({
    id: nextId("task"),
    email: task.email,
    title: task.title,
    dueDate: next.toISOString(),
    done: false,
    createdAt: new Date().toISOString(),
    priority: task.priority,
    type: task.type,
    owner: task.owner,
    notes: task.notes,
    recurrence: task.recurrence,
  });
}

export async function toggleTask(id: string): Promise<Task | null> {
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;
  task.done = !task.done;
  task.completedAt = task.done ? new Date().toISOString() : undefined;
  if (task.done) spawnRecurrence(task);
  return task;
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, "title" | "dueDate" | "priority" | "type" | "owner" | "notes" | "recurrence" | "done">>,
): Promise<Task | null> {
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;
  const { done, ...rest } = patch;
  Object.assign(task, rest);
  if (done !== undefined && done !== task.done) {
    task.done = done;
    task.completedAt = done ? new Date().toISOString() : undefined;
    if (done) spawnRecurrence(task);
  }
  return task;
}

export async function deleteTask(id: string): Promise<boolean> {
  const i = tasks.findIndex((t) => t.id === id);
  if (i === -1) return false;
  tasks.splice(i, 1);
  return true;
}

/** Lightweight contact list for task pickers. */
export async function listContactOptions(): Promise<ContactOption[]> {
  backfillContacts();
  return leads
    .map((l) => ({ id: l.id, name: l.name, email: l.email }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTaskStats(): Promise<TaskStats> {
  const now = Date.now();
  const startOfToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
  const tomorrow = startOfToday + DAY;
  const weekEnd = startOfToday + 7 * DAY;
  const weekAgo = now - 7 * DAY;
  const open = tasks.filter((t) => !t.done);
  const due = (t: Task) => (t.dueDate ? new Date(t.dueDate).getTime() : null);
  const overdue = open.filter((t) => { const d = due(t); return d !== null && d < startOfToday; }).length;
  const dueToday = open.filter((t) => { const d = due(t); return d !== null && d >= startOfToday && d < tomorrow; }).length;
  const thisWeek = open.filter((t) => { const d = due(t); return d !== null && d >= startOfToday && d < weekEnd; }).length;
  const completedThisWeek = tasks.filter((t) => t.done && t.completedAt && new Date(t.completedAt).getTime() >= weekAgo).length;
  const doneCount = tasks.filter((t) => t.done).length;
  const completionRatePct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  return { open: open.length, overdue, dueToday, thisWeek, completedThisWeek, completionRatePct };
}

export async function listAllTasks(): Promise<TaskWithContact[]> {
  return tasks
    .map((t) => {
      const lead = leads.find((l) => l.email === t.email);
      return { ...t, contactName: lead?.name ?? t.email, contactId: lead?.id ?? t.email };
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
}

// ---- CRM analytics ---------------------------------------------------------

export async function getCrmStats(): Promise<CrmStats> {
  backfillContacts();
  const sevenDaysAgo = Date.now() - 7 * DAY;
  const bookedEmails = new Set(events.filter((e) => e.event === EVENTS.booked && e.email).map((e) => e.email));
  const registeredEmails = new Set(events.filter((e) => e.event === EVENTS.registered && e.email).map((e) => e.email));
  const reg = registeredEmails.size || 1;
  return {
    totalContacts: leads.length,
    newLast7Days: leads.filter((l) => new Date(l.createdAt).getTime() >= sevenDaysAgo).length,
    booked: bookedEmails.size,
    regToBookedPct: Math.round((bookedEmails.size / reg) * 100),
    openTasks: tasks.filter((t) => !t.done).length,
  };
}

export async function getSourceStats(): Promise<SourceStat[]> {
  backfillContacts();
  const bookedEmails = new Set(events.filter((e) => e.event === EVENTS.booked && e.email).map((e) => e.email));
  const map = new Map<string, { contacts: number; booked: number }>();
  for (const l of leads) {
    const src = contactSource(l);
    const row = map.get(src) ?? { contacts: 0, booked: 0 };
    row.contacts += 1;
    if (bookedEmails.has(l.email)) row.booked += 1;
    map.set(src, row);
  }
  return [...map.entries()]
    .map(([source, r]) => ({ source, contacts: r.contacts, booked: r.booked, convPct: r.contacts ? Math.round((r.booked / r.contacts) * 100) : 0 }))
    .sort((a, b) => b.contacts - a.contacts);
}

/** Distinct owners (configured + seen in data) for the assign dropdowns. */
export async function listOwners(): Promise<string[]> {
  const set = new Set<string>(state.settings.owners);
  for (const l of leads) if (l.owner) set.add(l.owner);
  return [...set].sort();
}

export async function addOwner(name: string): Promise<string[]> {
  const n = name.trim();
  if (n && !state.settings.owners.includes(n)) state.settings.owners.push(n);
  return listOwners();
}

/** Rename an owner everywhere it's referenced (config + contacts + tasks). */
export async function renameOwner(from: string, to: string): Promise<string[]> {
  const t = to.trim();
  if (!t || t === from) return listOwners();
  state.settings.owners = uniq(state.settings.owners.map((o) => (o === from ? t : o)));
  for (const l of leads) if (l.owner === from) l.owner = t;
  for (const tk of tasks) if (tk.owner === from) tk.owner = t;
  if (state.settings.defaultOwner === from) state.settings.defaultOwner = t;
  return listOwners();
}

/**
 * Remove an owner. Their contacts/tasks are reassigned to `reassignTo` (or left
 * unassigned) so nothing is orphaned pointing at a deleted owner.
 */
export async function removeOwner(name: string, reassignTo?: string): Promise<string[]> {
  const to = reassignTo?.trim() || undefined;
  for (const l of leads) if (l.owner === name) l.owner = to;
  for (const tk of tasks) if (tk.owner === name) tk.owner = to;
  state.settings.owners = state.settings.owners.filter((o) => o !== name);
  if (state.settings.defaultOwner === name) state.settings.defaultOwner = to;
  return listOwners();
}

export async function setDefaultOwner(name: string): Promise<void> {
  state.settings.defaultOwner = name.trim() || undefined;
}

/** Per-owner workload for the settings owner manager. */
export async function getOwnerWorkloads(): Promise<Array<{ owner: string; contacts: number; openTasks: number }>> {
  const names = await listOwners();
  return names.map((o) => ({
    owner: o,
    contacts: leads.filter((l) => l.owner === o).length,
    openTasks: tasks.filter((t) => t.owner === o && !t.done).length,
  }));
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, "");
}
function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/** Tags with how many contacts carry them (merges the registry so 0-count tags show). */
export async function listTagsWithCounts(): Promise<Array<{ tag: string; count: number }>> {
  const m = new Map<string, number>();
  for (const t of state.settings.tags) m.set(t, 0);
  for (const l of leads) for (const t of l.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
}

/** Register a new tag so it's available before any contact carries it. */
export async function createTag(tag: string): Promise<void> {
  const t = normalizeTag(tag);
  if (t && !state.settings.tags.includes(t)) state.settings.tags.push(t);
}

/** Rename a tag everywhere (registry + contacts). */
export async function renameTag(from: string, to: string): Promise<void> {
  const t = normalizeTag(to);
  if (!t || t === from) return;
  state.settings.tags = uniq(state.settings.tags.map((x) => (x === from ? t : x)));
  for (const l of leads) if (l.tags) l.tags = uniq(l.tags.map((x) => (x === from ? t : x)));
}

/** Merge a tag into another (moves every contact, drops the source from the registry). */
export async function mergeTag(from: string, into: string): Promise<void> {
  const t = normalizeTag(into);
  if (!t || t === from) return;
  for (const l of leads) if (l.tags?.includes(from)) l.tags = uniq(l.tags.map((x) => (x === from ? t : x)));
  state.settings.tags = uniq(state.settings.tags.map((x) => (x === from ? t : x)));
}

/** Remove a tag from the registry and every contact. */
export async function deleteTag(tag: string): Promise<void> {
  state.settings.tags = state.settings.tags.filter((t) => t !== tag);
  for (const l of leads) if (l.tags?.includes(tag)) l.tags = l.tags.filter((t) => t !== tag);
}

// -------------------------------------------------------------------------
// Business profile, preferences, and data management
// -------------------------------------------------------------------------

export async function getSettings(): Promise<CrmSettings> {
  return state.settings;
}

export async function updateProfile(patch: Partial<CrmProfile>): Promise<CrmProfile> {
  const p = state.settings.profile;
  for (const k of ["brandName", "bookingUrl", "trainingUrl", "fromName", "replyTo", "timezone"] as const) {
    if (typeof patch[k] === "string") p[k] = (patch[k] as string).trim();
  }
  return p;
}

export async function updatePrefs(patch: Partial<CrmPrefs>): Promise<CrmPrefs> {
  const p = state.settings.prefs;
  if (patch.notify) Object.assign(p.notify, patch.notify);
  if (typeof patch.theme === "string") p.theme = patch.theme;
  if (typeof patch.defaultContactsView === "string") p.defaultContactsView = patch.defaultContactsView;
  if (typeof patch.defaultContactsPageSize === "number" && patch.defaultContactsPageSize > 0) {
    p.defaultContactsPageSize = Math.min(200, Math.floor(patch.defaultContactsPageSize));
  }
  return p;
}

export type StoreStatus = {
  backend: string;
  seedVersion: number;
  counts: { contacts: number; events: number; notes: number; tasks: number; tags: number; owners: number };
};

export async function getStoreStatus(): Promise<StoreStatus> {
  const tags = await listTagsWithCounts();
  const owners = await listOwners();
  return {
    backend: "In-memory (Supabase-ready seam)",
    seedVersion: state.version,
    counts: { contacts: leads.length, events: events.length, notes: notes.length, tasks: tasks.length, tags: tags.length, owners: owners.length },
  };
}

/** Wipe the store and re-seed the demo data in place (keeps captured array refs). */
export async function resetStore(): Promise<void> {
  const fresh = seedState();
  leads.length = 0; leads.push(...fresh.leads);
  events.length = 0; events.push(...fresh.events);
  notes.length = 0; notes.push(...fresh.notes);
  tasks.length = 0; tasks.push(...fresh.tasks);
  state.settings = fresh.settings;
  state.counter = fresh.counter;
  state.version = fresh.version;
}

/** Everything in the store, for a full JSON export/backup. */
export async function exportAllData(): Promise<{ leads: Lead[]; events: BehaviourEvent[]; notes: Note[]; tasks: Task[]; settings: CrmSettings }> {
  return { leads, events, notes, tasks, settings: state.settings };
}

export type SettingsInsights = {
  stages: Array<{ stage: Stage; count: number; probability: number }>;
  lostReasons: Array<{ reason: string; count: number }>;
  segments: Array<{ segment: Segment; count: number }>;
};

/** Live counts to make the read-only config cards on Settings informative. */
export async function getSettingsInsights(): Promise<SettingsInsights> {
  backfillContacts();
  const evByEmail = new Map<string, string[]>();
  for (const e of events) if (e.email) { const a = evByEmail.get(e.email) ?? []; a.push(e.event); evByEmail.set(e.email, a); }
  const stageCount = new Map<Stage, number>();
  const lostCount = new Map<string, number>();
  const segCount = new Map<Segment, number>();
  for (const l of leads) {
    const names = evByEmail.get(l.email) ?? [];
    const stage = l.stage ?? stageFromEvents(names);
    stageCount.set(stage, (stageCount.get(stage) ?? 0) + 1);
    if (l.lostReason) lostCount.set(l.lostReason, (lostCount.get(l.lostReason) ?? 0) + 1);
    const seg = deriveSegment(names.map((event) => ({ event })));
    segCount.set(seg, (segCount.get(seg) ?? 0) + 1);
  }
  return {
    stages: STAGES_IN_ORDER.map((s) => ({ stage: s, count: stageCount.get(s) ?? 0, probability: STAGE_PROBABILITY[s] })),
    lostReasons: LOST_REASONS.map((r) => ({ reason: r, count: lostCount.get(r) ?? 0 })),
    segments: SEGMENTS_IN_ORDER.map((s) => ({ segment: s, count: segCount.get(s) ?? 0 })),
  };
}

/** The activity feed: filterable, paginated, contact-resolved event log. */
export async function listActivity(f: ActivityFilter = {}): Promise<ActivityPage> {
  backfillContacts();
  const byEmail = new Map(leads.map((l) => [l.email, l]));
  let items: ActivityItem[] = events.map((e) => {
    const l = e.email ? byEmail.get(e.email) : undefined;
    return { ...e, contactName: l?.name, contactId: l?.id };
  });
  const s = f.search?.trim().toLowerCase();
  if (s) items = items.filter((i) => i.contactName?.toLowerCase().includes(s) || i.email?.toLowerCase().includes(s) || displayEvent(i.event).label.toLowerCase().includes(s));
  if (f.category) items = items.filter((i) => displayEvent(i.event).category === f.category);
  if (f.important) items = items.filter((i) => displayEvent(i.event).important);
  if (f.owner) items = items.filter((i) => { const l = i.email ? byEmail.get(i.email) : undefined; return f.owner === "__none__" ? !l?.owner : l?.owner === f.owner; });
  if (f.from) items = items.filter((i) => i.createdAt.slice(0, 10) >= f.from!);
  if (f.to) items = items.filter((i) => i.createdAt.slice(0, 10) <= f.to!);
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = items.length;
  const offset = Math.max(0, f.offset ?? 0);
  const limit = f.limit ?? 40;
  return { items: items.slice(offset, offset + limit), total };
}

export async function getActivitySummary(): Promise<ActivitySummary> {
  const now = Date.now();
  const t0 = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();
  const weekAgo = now - 7 * DAY;
  const today = events.filter((e) => new Date(e.createdAt).getTime() >= t0).length;
  const thisWeek = events.filter((e) => new Date(e.createdAt).getTime() >= weekAgo).length;
  const cats = new Map<EventCategory, number>();
  for (const c of EVENT_CATEGORIES) cats.set(c, 0);
  for (const e of events) { const c = displayEvent(e.event).category; cats.set(c, (cats.get(c) ?? 0) + 1); }
  return { today, thisWeek, byCategory: EVENT_CATEGORIES.map((category) => ({ category, label: CATEGORY_LABELS[category], count: cats.get(category) ?? 0 })) };
}

export type Booking = { id: string; contactId?: string; contactName?: string; email?: string; createdAt: string; preferredTime?: string };

/** Booked calls, resolved to contacts (for the calendar + upcoming panel). */
export async function listBookings(): Promise<Booking[]> {
  backfillContacts();
  const byEmail = new Map(leads.map((l) => [l.email, l]));
  return events
    .filter((e) => e.event === EVENTS.booked)
    .map((e) => {
      const l = e.email ? byEmail.get(e.email) : undefined;
      return { id: e.id, contactId: l?.id, contactName: l?.name, email: e.email, createdAt: e.createdAt, preferredTime: typeof e.props?.preferredTime === "string" ? e.props.preferredTime : undefined };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type NavData = {
  counts: { overdueTasks: number; needsAttention: number; openTasks: number };
  notifications: ActionItem[];
  contacts: ContactOption[];
  owners: string[];
  tags: string[];
};

/** Everything the global nav chrome needs: counts, notifications, search index. */
export async function getNavData(): Promise<NavData> {
  const ov = await getOverview(30);
  const now = Date.now();
  const t0 = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();
  const overdueTasks = tasks.filter((t) => !t.done && t.dueDate && new Date(t.dueDate).getTime() < t0).length;
  const openTasks = tasks.filter((t) => !t.done).length;
  return {
    counts: { overdueTasks, needsAttention: ov.actions.length, openTasks },
    notifications: ov.actions,
    contacts: await listContactOptions(),
    owners: ov.owners,
    tags: await listTags(),
  };
}

/** Pipeline health: active count, win rate, booked-this-week, forecast, per-stage aging. */
export async function getPipelineStats(): Promise<PipelineStats> {
  backfillContacts();
  const now = Date.now();
  const byEmail = new Map<string, string[]>();
  for (const e of events) {
    if (!e.email) continue;
    (byEmail.get(e.email) ?? byEmail.set(e.email, []).get(e.email)!).push(e.event);
  }

  const agg = new Map<Stage, { count: number; ageSum: number }>();
  for (const s of STAGES_IN_ORDER) agg.set(s, { count: 0, ageSum: 0 });
  let expected = 0;
  for (const l of leads) {
    const stage = l.stage ?? stageFromEvents(byEmail.get(l.email) ?? []);
    const a = agg.get(stage)!;
    a.count += 1;
    const since = l.stageChangedAt ?? l.createdAt;
    a.ageSum += Math.floor((now - new Date(since).getTime()) / DAY);
    expected += STAGE_PROBABILITY[stage];
  }

  const byStage: PipelineStageStat[] = STAGES_IN_ORDER.map((stage) => {
    const a = agg.get(stage)!;
    return { stage, count: a.count, avgAgeDays: a.count ? Math.round(a.ageSum / a.count) : 0 };
  });

  const count = (s: Stage) => agg.get(s)!.count;
  const active = ACTIVE_STAGES.reduce((n, s) => n + count(s), 0);
  const won = count("won");
  const lost = count("lost");
  const sevenDaysAgo = now - 7 * DAY;
  const bookedThisWeek = new Set(
    events
      .filter((e) => e.event === EVENTS.booked && e.email && new Date(e.createdAt).getTime() >= sevenDaysAgo)
      .map((e) => e.email),
  ).size;

  return {
    active,
    won,
    lost,
    winRatePct: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0,
    bookedThisWeek,
    expectedClients: Math.round(expected),
    byStage,
  };
}

/**
 * The whole Overview home dashboard in one aggregate: KPIs (with week-over-week
 * deltas), an action queue (overdue tasks + cooling hot leads + no-follow-up),
 * a pipeline snapshot, funnel step conversions, a two-series trend, engagement,
 * a this-week digest, source performance, and reg→booked speed. Respects an
 * optional owner filter and a range in days.
 */
export async function getOverview(rangeDays = 30, owner?: string): Promise<OverviewData> {
  backfillContacts();
  const now = Date.now();
  const range = rangeDays * DAY;
  const t0 = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();

  const { rows: allContacts } = await listContacts({ pageSize: 100000 });
  const contacts = owner ? allContacts.filter((c) => (owner === "__none__" ? !c.owner : c.owner === owner)) : allContacts;
  const emailSet = new Set(contacts.map((c) => c.email));
  const evs = owner ? events.filter((e) => e.email && emailSet.has(e.email)) : events;
  const tks = owner ? tasks.filter((t) => emailSet.has(t.email)) : tasks;
  const ms = (iso: string) => new Date(iso).getTime();
  const inWin = (iso: string, from: number, to: number) => { const t = ms(iso); return t >= from && t < to; };

  // KPIs + deltas
  const newCur = contacts.filter((c) => inWin(c.createdAt, now - range, now)).length;
  const newPrev = contacts.filter((c) => inWin(c.createdAt, now - 2 * range, now - range)).length;
  const bookedEvents = evs.filter((e) => e.event === EVENTS.booked && e.email);
  const bookedSetIn = (from: number, to: number) => new Set(bookedEvents.filter((e) => inWin(e.createdAt, from, to)).map((e) => e.email)).size;
  const bookedCur = bookedSetIn(now - range, now);
  const bookedPrev = bookedSetIn(now - 2 * range, now - range);
  const regEmails = new Set(evs.filter((e) => e.event === EVENTS.registered && e.email).map((e) => e.email));
  const allBooked = new Set(bookedEvents.map((e) => e.email));
  const openTasksN = tks.filter((t) => !t.done).length;
  const delta = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100));
  const kpis: OverviewKpi[] = [
    { key: "total", label: "Total contacts", value: contacts.length, href: "/crm/contacts" },
    { key: "new", label: `New (${rangeDays}d)`, value: newCur, delta: delta(newCur, newPrev), deltaGood: true, href: "/crm/contacts?sort=created" },
    { key: "booked", label: `Booked (${rangeDays}d)`, value: bookedCur, delta: delta(bookedCur, bookedPrev), deltaGood: true, href: "/crm/contacts?segment=booked" },
    { key: "conv", label: "Reg → booked", value: `${regEmails.size ? Math.round((allBooked.size / regEmails.size) * 100) : 0}%`, href: "/crm/pipeline" },
    { key: "tasks", label: "Open tasks", value: openTasksN, href: "/crm/tasks" },
  ];

  // Action queue (priority: overdue → cooling hot → no follow-up)
  const actions: ActionItem[] = [];
  const overdueTasks = tks.filter((t) => !t.done && t.dueDate && ms(t.dueDate) < t0).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  for (const t of overdueTasks.slice(0, 5)) {
    const c = contacts.find((x) => x.email === t.email);
    actions.push({ id: `t_${t.id}`, kind: "overdue", title: t.title, subtitle: `${c?.name ?? t.email} · overdue`, href: `/crm/contacts/${c?.id ?? ""}`, tone: "danger" });
  }
  const hot = contacts.filter((c) => !c.booked && ["high_watch", "offer_click_no_book", "booking_abandon"].includes(c.segment) && c.daysSinceActivity >= 2).sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
  for (const c of hot.slice(0, 5)) actions.push({ id: `h_${c.id}`, kind: "hot", title: `${c.name} is cooling off`, subtitle: `${SEGMENT_LABELS[c.segment]} · ${c.daysSinceActivity}d quiet`, href: `/crm/contacts/${c.id}`, tone: "warn" });
  const noFollow = contacts.filter((c) => !c.booked && !c.nextTask && c.openTaskCount === 0 && ["registered_no_show", "low_watch", "mid_watch"].includes(c.segment) && c.daysSinceActivity >= 3).sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
  for (const c of noFollow.slice(0, 4)) actions.push({ id: `n_${c.id}`, kind: "nofollow", title: `No follow-up set for ${c.name}`, subtitle: `${SEGMENT_LABELS[c.segment]} · ${c.daysSinceActivity}d quiet`, href: `/crm/contacts/${c.id}`, tone: "neutral" });

  // Pipeline snapshot (owner-filtered)
  const stageCount = (s: Stage) => contacts.filter((c) => c.stage === s).length;
  const won = stageCount("won"), lost = stageCount("lost");
  const stalest = contacts.filter((c) => ACTIVE_STAGES.includes(c.stage)).sort((a, b) => b.stageAgeDays - a.stageAgeDays).slice(0, 3).map((c) => ({ id: c.id, name: c.name, stage: c.stage, stageAgeDays: c.stageAgeDays }));
  const pipeline = { active: ACTIVE_STAGES.reduce((n, s) => n + stageCount(s), 0), won, lost, winRatePct: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0, expectedClients: Math.round(contacts.reduce((n, c) => n + STAGE_PROBABILITY[c.stage], 0)), stalest };

  // Funnel + step conversions
  const byEmail = new Map<string, Set<string>>();
  for (const e of evs) { if (!e.email) continue; (byEmail.get(e.email) ?? byEmail.set(e.email, new Set()).get(e.email)!).add(e.event); }
  const counts = FUNNEL_STAGES.map((s) => [...byEmail.values()].filter((set) => set.has(s.event)).length);
  const funnel: OverviewFunnelStage[] = FUNNEL_STAGES.map((s, i) => ({ key: s.key, label: s.label, count: counts[i], convPct: i === 0 ? null : counts[i - 1] ? Math.round((counts[i] / counts[i - 1]) * 100) : 0 }));

  // Segments
  const segTally = new Map<Segment, number>();
  for (const c of contacts) segTally.set(c.segment, (segTally.get(c.segment) ?? 0) + 1);
  const segments: FunnelSegment[] = SEGMENTS_IN_ORDER.map((k) => ({ key: k, label: SEGMENT_LABELS[k], count: segTally.get(k) ?? 0 }));

  // Sources + best
  const srcMap = new Map<string, { contacts: number; booked: number }>();
  for (const c of contacts) { const s = c.utm?.utm_source ?? c.source ?? "direct"; const r = srcMap.get(s) ?? { contacts: 0, booked: 0 }; r.contacts++; if (c.booked) r.booked++; srcMap.set(s, r); }
  const sources: SourceStat[] = [...srcMap.entries()].map(([source, r]) => ({ source, contacts: r.contacts, booked: r.booked, convPct: r.contacts ? Math.round((r.booked / r.contacts) * 100) : 0 })).sort((a, b) => b.contacts - a.contacts);
  const bestSource = [...sources].filter((s) => s.contacts >= 2).sort((a, b) => b.convPct - a.convPct)[0]?.source ?? null;

  // Two-series trend
  const trend: TrendPoint[] = [];
  const days = Math.min(rangeDays, 30);
  for (let i = days - 1; i >= 0; i--) {
    const from = t0 - i * DAY, to = from + DAY;
    trend.push({
      label: new Date(from).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      registered: contacts.filter((c) => ms(c.createdAt) >= from && ms(c.createdAt) < to).length,
      booked: bookedEvents.filter((e) => ms(e.createdAt) >= from && ms(e.createdAt) < to).length,
    });
  }

  // Engagement
  const roomEmails = new Set(evs.filter((e) => e.event === EVENTS.roomOpened && e.email).map((e) => e.email));
  const watched = contacts.filter((c) => c.watchPct > 0);
  const engagement = {
    showUpPct: regEmails.size ? Math.round((roomEmails.size / regEmails.size) * 100) : 0,
    watchToBookPct: roomEmails.size ? Math.round((allBooked.size / roomEmails.size) * 100) : 0,
    avgWatchPct: watched.length ? Math.round(watched.reduce((n, c) => n + c.watchPct, 0) / watched.length) : 0,
  };

  // This week (7d)
  const weekAgo = now - 7 * DAY;
  const thisWeek = {
    booked: new Set(bookedEvents.filter((e) => ms(e.createdAt) >= weekAgo).map((e) => e.email)).size,
    tasksCompleted: tks.filter((t) => t.done && t.completedAt && ms(t.completedAt) >= weekAgo).length,
    newClients: contacts.filter((c) => c.stage === "won" && c.stageChangedAt && ms(c.stageChangedAt) >= weekAgo).length,
  };

  // Speed: reg → booked
  const regTimes = new Map<string, number>();
  for (const e of evs) if (e.event === EVENTS.registered && e.email) { const t = ms(e.createdAt); const p = regTimes.get(e.email); if (p === undefined || t < p) regTimes.set(e.email, t); }
  const diffs: number[] = [];
  for (const e of bookedEvents) { const r = e.email ? regTimes.get(e.email) : undefined; if (r !== undefined) { const d = ms(e.createdAt) - r; if (d >= 0) diffs.push(d); } }
  const speed = { avgRegToBookedDays: diffs.length ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length / DAY) * 10) / 10 : null };

  const owners = await listOwners();
  return { kpis, actions: actions.slice(0, 10), pipeline, funnel, segments, sources, bestSource, trend, engagement, thisWeek, speed, owners, generatedAt: new Date().toISOString() };
}

export async function getLeadsTimeSeries(days = 14): Promise<TimePoint[]> {
  const out: TimePoint[] = [];
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(startOfDay(today) - i * DAY);
    const from = day.getTime();
    const to = from + DAY;
    const count = leads.filter((l) => {
      const t = new Date(l.createdAt).getTime();
      return t >= from && t < to;
    }).length;
    out.push({
      date: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
    });
  }
  return out;
}
