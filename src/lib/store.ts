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
  type Stage,
} from "./stages";
import { type TaskPriority, type TaskType, type Recurrence } from "./tasks";

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

export type ContactFilter = {
  search?: string;
  stage?: string;
  segment?: string;
  source?: string;
  sort?: "recent" | "created" | "name";
  page?: number;
  pageSize?: number;
};
export type ContactPage = {
  rows: Contact[];
  total: number;
  page: number;
  pageSize: number;
};

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
type StoreState = {
  version: number;
  leads: Lead[];
  events: BehaviourEvent[];
  notes: Note[];
  tasks: Task[];
  counter: number;
};

// Bump when the seed shape changes so a long-running dev server (which pins state
// to globalThis across hot-reloads) reseeds instead of serving a stale shape.
const SEED_VERSION = 3;

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

  return { version: SEED_VERSION, leads, events, notes, tasks, counter: 30000 };
}

const globalForStore = globalThis as unknown as { __vanceStore?: StoreState };
if (!globalForStore.__vanceStore || globalForStore.__vanceStore.version !== SEED_VERSION) {
  globalForStore.__vanceStore = seedState();
}
const state: StoreState = globalForStore.__vanceStore;
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

export async function listContacts(filter: ContactFilter = {}): Promise<ContactPage> {
  backfillContacts();
  const byEmail = new Map<string, BehaviourEvent[]>();
  for (const e of events) {
    if (!e.email) continue;
    (byEmail.get(e.email) ?? byEmail.set(e.email, []).get(e.email)!).push(e);
  }
  for (const list of byEmail.values()) list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  let rows: Contact[] = leads.map((l) => enrichContact(l, byEmail.get(l.email) ?? []));

  const q = filter.search?.trim().toLowerCase();
  if (q) rows = rows.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  if (filter.stage) rows = rows.filter((c) => c.stage === filter.stage);
  if (filter.segment) rows = rows.filter((c) => c.segment === filter.segment);
  if (filter.source) rows = rows.filter((c) => contactSource(c) === filter.source);

  const sort = filter.sort ?? "recent";
  rows.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
    return b.lastActivityAt.localeCompare(a.lastActivityAt);
  });

  const total = rows.length;
  const pageSize = filter.pageSize ?? 25;
  const page = Math.max(1, filter.page ?? 1);
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total, page, pageSize };
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

const DEFAULT_OWNERS = ["Vance", "Team"];

/** Distinct owners (data + defaults) for the assign dropdowns. */
export async function listOwners(): Promise<string[]> {
  const set = new Set<string>(DEFAULT_OWNERS);
  for (const l of leads) if (l.owner) set.add(l.owner);
  return [...set].sort();
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
