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
  isStage,
  LOST_REASONS,
  type Stage,
  type Tone,
} from "./stages";
import { type TaskPriority, type TaskType, type Recurrence } from "./tasks";
import { displayEvent, CATEGORY_LABELS, EVENT_CATEGORIES, type EventCategory } from "./event-display";
import { createClient as createServerSupabaseClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { isCrmDemoMode } from "./demo";

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
  clientEventId?: string;
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

export type SequenceQueueStats = {
  activeEnrollments: number;
  scheduledMessages: number;
  retryingMessages: number;
  sentMessages: number;
  failedMessages: number;
};

export type SequenceFailure = {
  id: string;
  contactName: string;
  email: string;
  templateKey: string;
  attempts: number;
  error: string;
  failedAt: string;
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
export type ContactsPageData = ContactPage & {
  summary: ContactsSummary;
  matchingIds: string[];
  sources: string[];
};
export type TrashedContact = {
  id: string;
  name: string;
  email: string;
  deletedAt: string;
  deletedBy?: string;
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
export type NotificationItem = {
  id: string;
  kind: "overdue" | "cooling" | "nofollow" | "booking" | "high_intent" | "failed_email" | "failed_booking" | "new_lead";
  title: string;
  subtitle: string;
  href: string;
  tone: Tone;
  readAt?: string;
  createdAt: string;
};
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
export type NotifyPrefs = {
  overdueTasks: boolean;
  coolingLeads: boolean;
  noFollowUp: boolean;
  newBookings: boolean;
  highIntentRegistrations: boolean;
};
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
const SEED_VERSION = 7;

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
  return {
    overdueTasks: true,
    coolingLeads: true,
    noFollowUp: true,
    newBookings: true,
    highIntentRegistrations: true,
  };
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
  const startOfToday = new Date().setHours(0, 0, 0, 0);
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
    const reg = startOfToday - p.d * DAY + 10 * 60 * 60 * 1000; // 10:00 that day
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

  // Demo records must never be an implicit production fallback. Next.js can
  // evaluate this module in more than one server bundle, and a bundle that has
  // not yet hydrated from Supabase would otherwise expose the fake contacts.
  // They are available only for an explicitly opted-in local demo environment.
  if (isCrmDemoMode()) {
    return { version: SEED_VERSION, leads, events, notes, tasks, settings: defaultSettings(), counter: 30000 };
  }
  return { version: SEED_VERSION, leads: [], events: [], notes: [], tasks: [], settings: defaultSettings(), counter: 30000 };
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

type RelationName = { display_name?: string | null } | Array<{ display_name?: string | null }> | null;
type RelationEmail = { email?: string | null } | Array<{ email?: string | null }> | null;
type PublicContactRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  source: string;
  utm: Record<string, string> | null;
  stage: string;
  lost_reason: string | null;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
  stage_changed_at: string;
};

function relationDisplayName(value: RelationName): string | undefined {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.display_name ?? undefined;
}

function relationEmail(value: RelationEmail): string | undefined {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.email ?? undefined;
}

function leadFromContactRow(row: PublicContactRow, owner?: string, tags?: string[]): Lead {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    source: row.source,
    utm: row.utm ?? {},
    stage: row.stage as Stage,
    owner,
    tags,
    lostReason: row.lost_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stageChangedAt: row.stage_changed_at,
  };
}

async function contactIdForEmail(email: string): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("contacts").select("id").eq("email", email).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Contact not found.");
  return data.id;
}

export async function listExistingContactEmails(emails: string[]): Promise<Set<string>> {
  const normalized = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (!normalized.length) return new Set();
  const supabase = await createServerSupabaseClient();
  const found = new Set<string>();
  for (let index = 0; index < normalized.length; index += 100) {
    const { data, error } = await supabase
      .from("contacts")
      .select("email")
      .in("email", normalized.slice(index, index + 100));
    if (error) throw new Error(error.message);
    for (const row of data ?? []) found.add(row.email.toLowerCase());
  }
  return found;
}

async function ownerIdForName(name?: string): Promise<string | null> {
  if (!name) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("crm_users").select("user_id").eq("display_name", name).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.user_id ?? null;
}

/**
 * Load the durable CRM state for the current authenticated request. Existing
 * view/analytics helpers continue to operate on these request-fresh arrays
 * while the repository migration proceeds in functional slices.
 */
export async function hydrateStore(): Promise<void> {
  if (isCrmDemoMode()) return;
  const supabase = await createServerSupabaseClient();
  const [contactsResult, eventsResult, notesResult, tasksResult] = await Promise.all([
    supabase.from("contacts").select("*, owner:crm_users!contacts_owner_id_fkey(display_name), contact_tags(tags(name))"),
    supabase.from("events").select("*").order("occurred_at", { ascending: false }),
    supabase.from("notes").select("*, contact:contacts!notes_contact_id_fkey(email), author:crm_users!notes_author_id_fkey(display_name)").order("created_at", { ascending: false }),
    supabase.from("tasks").select("*, contact:contacts!tasks_contact_id_fkey(email), owner:crm_users!tasks_owner_id_fkey(display_name)").order("created_at", { ascending: false }),
  ]);

  const firstError = contactsResult.error ?? eventsResult.error ?? notesResult.error ?? tasksResult.error;
  if (firstError) throw new Error(`Could not load CRM data: ${firstError.message}`);

  const durableLeads: Lead[] = (contactsResult.data ?? []).map((row) => {
    const contactTags = (row.contact_tags ?? []) as Array<{ tags?: { name?: string } | Array<{ name?: string }> | null }>;
    const tagNames = contactTags
      .map((entry) => Array.isArray(entry.tags) ? entry.tags[0]?.name : entry.tags?.name)
      .filter((name): name is string => Boolean(name));
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone ?? undefined,
      source: row.source ?? undefined,
      utm: (row.utm ?? {}) as Record<string, string>,
      stage: row.stage as Stage,
      owner: row.owner_name ?? relationDisplayName(row.owner as RelationName),
      tags: tagNames,
      lostReason: row.lost_reason ?? undefined,
      stageChangedAt: row.stage_changed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  const durableEvents: BehaviourEvent[] = (eventsResult.data ?? []).map((row) => ({
    id: row.id,
    event: row.event_key,
    email: row.email ?? undefined,
    props: (row.properties ?? {}) as Record<string, unknown>,
    createdAt: row.occurred_at,
  }));

  const durableNotes: Note[] = (notesResult.data ?? []).map((row) => ({
    id: row.id,
    email: relationEmail(row.contact as RelationEmail) ?? "",
    body: row.body,
    author: relationDisplayName(row.author as RelationName),
    createdAt: row.created_at,
  }));

  const durableTasks: Task[] = (tasksResult.data ?? []).map((row) => {
    const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact;
    return {
      id: row.id,
      email: contact?.email ?? "",
      title: row.title,
      dueDate: row.due_at ?? undefined,
      done: row.done,
      createdAt: row.created_at,
      priority: row.priority as TaskPriority,
      type: row.task_type as TaskType,
      owner: row.owner_name ?? relationDisplayName(row.owner as RelationName),
      notes: row.notes ?? undefined,
      recurrence: row.recurrence as Recurrence,
      completedAt: row.completed_at ?? undefined,
    };
  });

  leads.splice(0, leads.length, ...durableLeads);
  events.splice(0, events.length, ...durableEvents);
  notes.splice(0, notes.length, ...durableNotes);
  tasks.splice(0, tasks.length, ...durableTasks);
}

function nextId(prefix: string): string {
  state.counter += 1;
  return `${prefix}_${state.counter}`;
}

// --------------------------------------------------------------------------
// Repository API — funnel (unchanged signatures).
// --------------------------------------------------------------------------

export async function createLead(input: Omit<Lead, "id" | "createdAt">): Promise<Lead> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("register_funnel_lead", {
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone ?? null,
    p_source: input.source ?? "vance-webinar",
    p_utm: input.utm ?? {},
  }).single();
  if (error || !data) throw new Error(error?.message ?? "Could not save contact.");
  return leadFromContactRow(data as PublicContactRow);
}

export async function createCrmContact(input: Omit<Lead, "id" | "createdAt">): Promise<Lead> {
  const supabase = await createServerSupabaseClient();
  const ownerId = await ownerIdForName(input.owner);
  const { data, error } = await supabase.from("contacts").insert({
    name: input.name,
    email: input.email.trim().toLowerCase(),
    phone: input.phone ?? null,
    source: input.source ?? "manual",
    utm: input.utm ?? {},
    first_touch: input.utm ?? {},
    last_touch: input.utm ?? {},
    stage: input.stage ?? "new",
    owner_id: ownerId,
    owner_name: input.owner ?? null,
    stage_changed_at: input.stageChangedAt ?? new Date().toISOString(),
    lost_reason: input.lostReason ?? null,
  }).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Could not create contact.");
  const lead = leadFromContactRow(data as PublicContactRow, input.owner, input.tags);
  for (const tag of input.tags ?? []) await addTagToContact(lead.id, tag);
  return lead;
}

export async function recordEvent(input: Omit<BehaviourEvent, "id" | "createdAt">): Promise<BehaviourEvent> {
  const supabase = createAdminClient();
  const createdAt = new Date().toISOString();
  const { data, error } = await supabase.rpc("record_funnel_event", {
    p_event_key: input.event,
    p_email: input.email ?? null,
    p_properties: input.props ?? {},
    p_client_event_id: input.clientEventId ?? null,
  });
  if (error || !data) throw new Error(error?.message ?? "Could not save event.");
  return { id: data, createdAt, ...input };
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

async function getDurableFunnelStages(owner?: string): Promise<FunnelStage[]> {
  if (isCrmDemoMode()) {
    const stages = (await getFunnelStats()).stages;
    if (!owner) return stages;
    const emails = new Set(leads.filter((lead) => lead.owner === owner).map((lead) => lead.email));
    return FUNNEL_STAGES.map((stage) => ({
      key: stage.key,
      label: stage.label,
      count: new Set(events.filter((event) => event.event === stage.event && event.email && emails.has(event.email)).map((event) => event.email)).size,
    }));
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_crm_funnel_metrics_v1", {
    p_owner: owner ?? "",
  });
  if (error) throw new Error(`Could not query funnel metrics: ${error.message}`);
  const counts = (data ?? {}) as Record<string, number>;
  return FUNNEL_STAGES.map((stage) => ({
    key: stage.key,
    label: stage.label,
    count: Number(counts[stage.event] ?? 0),
  }));
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
    stage: isStage(lead.stage) ? lead.stage : stageFromEvents(names),
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
  const data = await getContactsPageData(filter);
  return { rows: data.rows, total: data.total, page: data.page, pageSize: data.pageSize };
}

/** All contact ids matching a filter (for "select all N" bulk actions across pages). */
export async function listContactIds(filter: ContactFilter = {}): Promise<string[]> {
  return (await getContactsPageData({ ...filter, page: 1, pageSize: 1 })).matchingIds;
}

/** Aggregate stats over the current filter (the mini-stat strip). */
export async function getContactsSummary(filter: ContactFilter = {}): Promise<ContactsSummary> {
  return (await getContactsPageData({ ...filter, page: 1, pageSize: 1 })).summary;
}

type DatabaseContactSearchRow = {
  id: string; name: string; email: string; phone: string | null; source: string;
  utm: Record<string, string> | null; stage: string; lost_reason: string | null;
  owner: string | null; created_at: string; updated_at: string; stage_changed_at: string;
  tags: string[] | null; event_count: number; last_activity_at: string; watch_pct: number;
  booked: boolean; note_count: number; open_task_count: number; has_overdue_task: boolean;
  next_task: { title: string; dueDate?: string | null; overdue: boolean } | null; segment: string;
};

type DatabaseContactSearchResult = {
  rows?: DatabaseContactSearchRow[]; matchingIds?: string[]; total?: number; booked?: number;
  avgWatchPct?: number; byStage?: Record<string, number>; sources?: string[];
};

/** One database query supplies the page, aggregate strip, and bulk-selection IDs. */
export async function getContactsPageData(filter: ContactFilter = {}): Promise<ContactsPageData> {
  const page = Math.max(1, Math.trunc(filter.page ?? 1));
  const pageSize = Math.max(1, Math.min(100000, Math.trunc(filter.pageSize ?? 25)));
  if (isCrmDemoMode()) {
    const matching = filterAndSortContacts(filter);
    const rows = matching.slice((page - 1) * pageSize, page * pageSize);
    const booked = matching.filter((contact) => contact.booked).length;
    const avgWatchPct = matching.length
      ? Math.round(matching.reduce((total, contact) => total + contact.watchPct, 0) / matching.length)
      : 0;
    return {
      rows,
      total: matching.length,
      page,
      pageSize,
      matchingIds: matching.map((contact) => contact.id),
      sources: [...new Set(allEnrichedContacts().map(contactSource))].sort(),
      summary: {
        total: matching.length,
        booked,
        avgWatchPct,
        byStage: STAGES_IN_ORDER.map((stage) => ({ stage, count: matching.filter((contact) => contact.stage === stage).length })),
      },
    };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("search_crm_contacts", {
    p_search: filter.search ?? "", p_stage: filter.stage ?? "", p_segment: filter.segment ?? "",
    p_source: filter.source ?? "", p_owner: filter.owner ?? "", p_tag: filter.tag ?? "",
    p_view: filter.view ?? "", p_sort: filter.sort ?? "recent", p_dir: filter.dir ?? "desc",
    p_page: page, p_page_size: pageSize,
  });
  if (error) throw new Error(`Could not query contacts: ${error.message}`);
  const result = (data ?? {}) as DatabaseContactSearchResult;
  const now = Date.now();
  const rows: Contact[] = (result.rows ?? []).map((row) => ({
    id: row.id, name: row.name, email: row.email, phone: row.phone ?? undefined,
    source: row.source, utm: row.utm ?? {}, stage: isStage(row.stage) ? row.stage : "new",
    lostReason: row.lost_reason ?? undefined, owner: row.owner ?? undefined, tags: row.tags ?? [],
    createdAt: row.created_at, updatedAt: row.updated_at, stageChangedAt: row.stage_changed_at,
    segment: row.segment as Segment, lastActivityAt: row.last_activity_at,
    eventCount: Number(row.event_count), watchPct: Number(row.watch_pct), booked: row.booked,
    noteCount: Number(row.note_count), openTaskCount: Number(row.open_task_count),
    daysSinceActivity: Math.max(0, Math.floor((now - new Date(row.last_activity_at).getTime()) / DAY)),
    stageAgeDays: Math.max(0, Math.floor((now - new Date(row.stage_changed_at).getTime()) / DAY)),
    hasOverdueTask: row.has_overdue_task,
    nextTask: row.next_task ? {
      title: row.next_task.title,
      dueDate: row.next_task.dueDate ?? undefined,
      overdue: row.next_task.overdue,
    } : undefined,
  }));
  const stageCounts = result.byStage ?? {};
  const total = Number(result.total ?? 0);
  return {
    rows, total, page, pageSize,
    matchingIds: result.matchingIds ?? [],
    sources: result.sources ?? [],
    summary: {
      total,
      booked: Number(result.booked ?? 0),
      avgWatchPct: Number(result.avgWatchPct ?? 0),
      byStage: STAGES_IN_ORDER.map((stage) => ({ stage, count: Number(stageCounts[stage] ?? 0) })),
    },
  };
}

/** Distinct tags across all contacts (for the tag filter). */
export async function listTags(): Promise<string[]> {
  if (isCrmDemoMode()) {
    return [...new Set([...state.settings.tags, ...leads.flatMap((lead) => lead.tags ?? [])])].sort();
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("tags").select("name").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.name);
}

export async function addTagToContact(id: string, tag: string): Promise<Lead | null> {
  const name = tag.trim();
  if (!name) return getLeadById(id);
  const supabase = await createServerSupabaseClient();
  const { data: tagRow, error: tagError } = await supabase.from("tags").upsert({ name }, { onConflict: "name" }).select("id").single();
  if (tagError || !tagRow) throw new Error(tagError?.message ?? "Could not save tag.");
  const { error } = await supabase.from("contact_tags").upsert({ contact_id: id, tag_id: tagRow.id }, { onConflict: "contact_id,tag_id" });
  if (error) throw new Error(error.message);
  await hydrateStore();
  return leads.find((lead) => lead.id === id) ?? null;
}

/** Delete a contact and its notes/tasks/events (so backfill won't resurrect it). */
export async function deleteContact(id: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("trash_contact", { p_contact_id: id });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function listTrashedContacts(): Promise<TrashedContact[]> {
  if (isCrmDemoMode()) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("contact_trash")
    .select("contact_id, name, email, deleted_at, deleted_by, actor:crm_users!contact_trash_deleted_by_fkey(display_name)")
    .order("deleted_at", { ascending: false });
  if (error) throw new Error(`Could not load contact trash: ${error.message}`);
  return (data ?? []).map((row) => {
    const actor = row.actor as unknown as { display_name?: string | null } | Array<{ display_name?: string | null }> | null;
    return {
      id: row.contact_id,
      name: row.name,
      email: String(row.email),
      deletedAt: row.deleted_at,
      deletedBy: (Array.isArray(actor) ? actor[0]?.display_name : actor?.display_name) ?? undefined,
    };
  });
}

export async function restoreContact(id: string): Promise<Lead> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("restore_contact_from_trash", { p_contact_id: id });
  if (error) {
    if (error.message.includes("contact_email_already_exists")) {
      throw new Error("A current contact already uses this email address. Resolve that contact before restoring this copy.");
    }
    throw new Error(error.message);
  }
  const restored = await getLeadById(String(data ?? id));
  if (!restored) throw new Error("The contact could not be restored.");
  return restored;
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
  const supabase = await createServerSupabaseClient();
  const { data: enrollmentRows, error: enrollmentError } = await supabase
    .from("sequence_enrollments")
    .select("sequence_key")
    .eq("contact_id", lead.id);
  if (enrollmentError) throw new Error(enrollmentError.message);
  const sequences = [...new Set((enrollmentRows ?? []).map((row) => row.sequence_key))];
  return { contact, events: evs, notes: contactNotes, tasks: contactTasks, sequences };
}

export async function getSequenceQueueStats(): Promise<SequenceQueueStats> {
  if (isCrmDemoMode()) {
    const queued = events.filter((event) => event.event === EVENTS.emailQueued).length;
    return { activeEnrollments: queued, scheduledMessages: 6, retryingMessages: 1, sentMessages: 24, failedMessages: 0 };
  }
  const supabase = await createServerSupabaseClient();
  const [active, scheduled, retrying, sent, failed] = await Promise.all([
    supabase.from("sequence_enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("scheduled_messages").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
    supabase.from("scheduled_messages").select("id", { count: "exact", head: true }).eq("status", "scheduled").gt("attempts", 0),
    supabase.from("scheduled_messages").select("id", { count: "exact", head: true }).eq("status", "sent"),
    supabase.from("scheduled_messages").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  const error = active.error ?? scheduled.error ?? retrying.error ?? sent.error ?? failed.error;
  if (error) throw new Error(error.message);
  return {
    activeEnrollments: active.count ?? 0,
    scheduledMessages: scheduled.count ?? 0,
    retryingMessages: retrying.count ?? 0,
    sentMessages: sent.count ?? 0,
    failedMessages: failed.count ?? 0,
  };
}

export async function getRecentSequenceFailures(limit = 10): Promise<SequenceFailure[]> {
  if (isCrmDemoMode()) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("scheduled_messages")
    .select("id, template_key, attempts, last_error, updated_at, contact:contacts!scheduled_messages_contact_id_fkey(name, email)")
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(25, Math.trunc(limit))));
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const relation = Array.isArray(row.contact) ? row.contact[0] : row.contact;
    return {
      id: row.id,
      contactName: relation?.name ?? "Unknown contact",
      email: relation?.email ?? "",
      templateKey: row.template_key,
      attempts: row.attempts,
      error: row.last_error ?? "Unknown delivery error",
      failedAt: row.updated_at,
    };
  });
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("contacts").select("*, owner:crm_users!contacts_owner_id_fkey(display_name), contact_tags(tags(name))").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const nestedTags = (data.contact_tags ?? []) as Array<{ tags?: { name?: string } | Array<{ name?: string }> | null }>;
  const tagNames = nestedTags.map((entry) => Array.isArray(entry.tags) ? entry.tags[0]?.name : entry.tags?.name).filter((name): name is string => Boolean(name));
  return leadFromContactRow(data as PublicContactRow, data.owner_name ?? relationDisplayName(data.owner as RelationName), tagNames);
}

export class ContactConflictError extends Error {
  constructor() {
    super("This contact was changed by someone else. Refresh the page and try again.");
    this.name = "ContactConflictError";
  }
}

export async function updateLead(
  id: string,
  patch: Partial<Pick<Lead, "stage" | "owner" | "tags" | "name" | "phone" | "lostReason">>,
  expectedUpdatedAt?: string,
): Promise<Lead | null> {
  const supabase = await createServerSupabaseClient();
  const existing = await getLeadById(id);
  if (!existing) return null;
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.phone !== undefined) update.phone = patch.phone ?? null;
  if (patch.stage !== undefined) {
    update.stage = patch.stage;
    if (patch.stage !== existing.stage) update.stage_changed_at = new Date().toISOString();
  }
  if (patch.lostReason !== undefined) update.lost_reason = patch.lostReason ?? null;
  if (patch.owner !== undefined) {
    update.owner_id = await ownerIdForName(patch.owner);
    update.owner_name = patch.owner || null;
  }
  // Tag-only edits must also touch the contact row. The timestamp match makes
  // every write conditional so a stale tab cannot overwrite a newer edit.
  if (expectedUpdatedAt) update.updated_at = new Date().toISOString();
  if (Object.keys(update).length > 0) {
    let query = supabase.from("contacts").update(update).eq("id", id);
    if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
    const { data, error } = await query.select("id");
    if (error) throw new Error(error.message);
    if (expectedUpdatedAt && (!data || data.length === 0)) throw new ContactConflictError();
  }

  if (patch.tags !== undefined) {
    const { error: clearError } = await supabase.from("contact_tags").delete().eq("contact_id", id);
    if (clearError) throw new Error(clearError.message);
    for (const tag of patch.tags) await addTagToContact(id, tag);
  }
  return getLeadById(id);
}

export async function upsertLeadByEmail(email: string, partial: Partial<Lead> = {}): Promise<Lead> {
  return createLead({
    name: partial.name ?? email.split("@")[0],
    email,
    phone: partial.phone,
    source: partial.source ?? "vance-webinar",
    utm: partial.utm,
  });
}

export async function addNote(email: string, body: string, author?: string): Promise<Note> {
  const supabase = await createServerSupabaseClient();
  const contactId = await contactIdForEmail(email);
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data, error } = await supabase.from("notes").insert({ contact_id: contactId, body, author_id: claimsData?.claims?.sub ?? null }).select("id, body, created_at").single();
  if (error || !data) throw new Error(error?.message ?? "Could not save note.");
  return { id: data.id, email, body: data.body, author, createdAt: data.created_at };
}

export async function listNotes(email: string): Promise<Note[]> {
  return notes.filter((n) => n.email === email).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addTask(email: string, input: TaskInput): Promise<Task> {
  const supabase = await createServerSupabaseClient();
  const contactId = await contactIdForEmail(email);
  const ownerId = await ownerIdForName(input.owner);
  const { data, error } = await supabase.from("tasks").insert({
    contact_id: contactId,
    title: input.title,
    due_at: input.dueDate ?? null,
    priority: input.priority ?? "normal",
    task_type: input.type ?? "follow_up",
    owner_id: ownerId,
    owner_name: input.owner ?? null,
    notes: input.notes ?? null,
    recurrence: input.recurrence ?? "none",
  }).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Could not save task.");
  return {
    id: data.id, email, title: data.title, dueDate: data.due_at ?? undefined,
    done: data.done, createdAt: data.created_at, priority: data.priority as TaskPriority,
    type: data.task_type as TaskType, owner: input.owner, notes: data.notes ?? undefined,
    recurrence: data.recurrence as Recurrence, completedAt: data.completed_at ?? undefined,
  };
}

export async function listTasks(email: string): Promise<Task[]> {
  return tasks.filter((t) => t.email === email);
}

export async function toggleTask(id: string): Promise<Task | null> {
  await hydrateStore();
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;
  return updateTask(id, { done: !task.done });
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, "title" | "dueDate" | "priority" | "type" | "owner" | "notes" | "recurrence" | "done">>,
): Promise<Task | null> {
  await hydrateStore();
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;
  const supabase = await createServerSupabaseClient();
  if (patch.done === true) {
    const { error } = await supabase.rpc("complete_task_and_schedule_next", { p_task_id: id });
    if (error) throw new Error(error.message);
    await hydrateStore();
    return tasks.find((candidate) => candidate.id === id) ?? null;
  }
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.dueDate !== undefined) update.due_at = patch.dueDate ?? null;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.type !== undefined) update.task_type = patch.type;
  if (patch.owner !== undefined) {
    update.owner_id = await ownerIdForName(patch.owner);
    update.owner_name = patch.owner || null;
  }
  if (patch.notes !== undefined) update.notes = patch.notes ?? null;
  if (patch.recurrence !== undefined) update.recurrence = patch.recurrence;
  if (patch.done === false) {
    update.done = false;
    update.completed_at = null;
  }
  const { error } = await supabase.from("tasks").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  await hydrateStore();
  return tasks.find((candidate) => candidate.id === id) ?? null;
}

export async function deleteTask(id: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("tasks").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
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
  await getSettings();
  const set = new Set<string>(state.settings.owners);
  for (const l of leads) if (l.owner) set.add(l.owner);
  return [...set].sort();
}

export async function addOwner(name: string): Promise<string[]> {
  await getSettings();
  const n = name.trim();
  if (n && !state.settings.owners.includes(n)) state.settings.owners.push(n);
  await persistSettings();
  return listOwners();
}

/** Rename an owner everywhere it's referenced (config + contacts + tasks). */
export async function renameOwner(from: string, to: string): Promise<string[]> {
  await getSettings();
  const t = to.trim();
  if (!t || t === from) return listOwners();
  state.settings.owners = uniq(state.settings.owners.map((o) => (o === from ? t : o)));
  const supabase = await createServerSupabaseClient();
  const [{ error: contactsError }, { error: tasksError }] = await Promise.all([
    supabase.from("contacts").update({ owner_name: t }).eq("owner_name", from),
    supabase.from("tasks").update({ owner_name: t }).eq("owner_name", from),
  ]);
  if (contactsError || tasksError) throw new Error(contactsError?.message ?? tasksError?.message);
  if (state.settings.defaultOwner === from) state.settings.defaultOwner = t;
  await persistSettings();
  await hydrateStore();
  return listOwners();
}

/**
 * Remove an owner. Their contacts/tasks are reassigned to `reassignTo` (or left
 * unassigned) so nothing is orphaned pointing at a deleted owner.
 */
export async function removeOwner(name: string, reassignTo?: string): Promise<string[]> {
  await getSettings();
  const to = reassignTo?.trim() || undefined;
  const supabase = await createServerSupabaseClient();
  const [{ error: contactsError }, { error: tasksError }] = await Promise.all([
    supabase.from("contacts").update({ owner_name: to ?? null, owner_id: null }).eq("owner_name", name),
    supabase.from("tasks").update({ owner_name: to ?? null, owner_id: null }).eq("owner_name", name),
  ]);
  if (contactsError || tasksError) throw new Error(contactsError?.message ?? tasksError?.message);
  state.settings.owners = state.settings.owners.filter((o) => o !== name);
  if (state.settings.defaultOwner === name) state.settings.defaultOwner = to;
  await persistSettings();
  await hydrateStore();
  return listOwners();
}

export async function setDefaultOwner(name: string): Promise<void> {
  await getSettings();
  state.settings.defaultOwner = name.trim() || undefined;
  await persistSettings();
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
  if (isCrmDemoMode()) {
    return (await listTags()).map((tag) => ({ tag, count: leads.filter((lead) => lead.tags?.includes(tag)).length }));
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("tags").select("name, contact_tags(count)").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ tag: row.name, count: row.contact_tags?.[0]?.count ?? 0 }));
}

/** Register a new tag so it's available before any contact carries it. */
export async function createTag(tag: string): Promise<void> {
  const t = normalizeTag(tag);
  if (!t) return;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("tags").upsert({ name: t }, { onConflict: "name" });
  if (error) throw new Error(error.message);
}

/** Rename a tag everywhere (registry + contacts). */
export async function renameTag(from: string, to: string): Promise<void> {
  const t = normalizeTag(to);
  if (!t || t === from) return;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("tags").update({ name: t }).eq("name", from);
  if (error) throw new Error(error.message);
}

/** Merge a tag into another (moves every contact, drops the source from the registry). */
export async function mergeTag(from: string, into: string): Promise<void> {
  const t = normalizeTag(into);
  if (!t || t === from) return;
  const supabase = await createServerSupabaseClient();
  const [{ data: source }, { data: target }] = await Promise.all([
    supabase.from("tags").select("id").eq("name", from).maybeSingle(),
    supabase.from("tags").upsert({ name: t }, { onConflict: "name" }).select("id").single(),
  ]);
  if (!source || !target) return;
  const { data: links, error: linksError } = await supabase.from("contact_tags").select("contact_id").eq("tag_id", source.id);
  if (linksError) throw new Error(linksError.message);
  if (links?.length) {
    const { error } = await supabase.from("contact_tags").upsert(links.map((link) => ({ contact_id: link.contact_id, tag_id: target.id })), { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  const { error } = await supabase.from("tags").delete().eq("id", source.id);
  if (error) throw new Error(error.message);
}

/** Remove a tag from the registry and every contact. */
export async function deleteTag(tag: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("tags").delete().eq("name", tag);
  if (error) throw new Error(error.message);
}

// -------------------------------------------------------------------------
// Business profile, preferences, and data management
// -------------------------------------------------------------------------

export async function getSettings(): Promise<CrmSettings> {
  if (isCrmDemoMode()) return state.settings;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("settings").select("value").eq("key", "crm").maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.value && typeof data.value === "object") {
    state.settings = { ...defaultSettings(), ...(data.value as Partial<CrmSettings>) } as CrmSettings;
    state.settings.profile = { ...defaultProfile(), ...(state.settings.profile ?? {}) };
    state.settings.prefs = { ...defaultPrefs(), ...(state.settings.prefs ?? {}) };
    state.settings.prefs.notify = { ...defaultNotify(), ...(state.settings.prefs.notify ?? {}) };
  }
  return state.settings;
}

async function persistSettings(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("settings").upsert({ key: "crm", value: state.settings }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export async function updateProfile(patch: Partial<CrmProfile>): Promise<CrmProfile> {
  await getSettings();
  const p = state.settings.profile;
  for (const k of ["brandName", "bookingUrl", "trainingUrl", "fromName", "replyTo", "timezone"] as const) {
    if (typeof patch[k] === "string") p[k] = (patch[k] as string).trim();
  }
  await persistSettings();
  return p;
}

export async function updatePrefs(patch: Partial<CrmPrefs>): Promise<CrmPrefs> {
  await getSettings();
  const p = state.settings.prefs;
  if (patch.notify) Object.assign(p.notify, patch.notify);
  if (typeof patch.theme === "string") p.theme = patch.theme;
  if (typeof patch.defaultContactsView === "string") p.defaultContactsView = patch.defaultContactsView;
  if (typeof patch.defaultContactsPageSize === "number" && patch.defaultContactsPageSize > 0) {
    p.defaultContactsPageSize = Math.min(200, Math.floor(patch.defaultContactsPageSize));
  }
  await persistSettings();
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
    backend: isCrmDemoMode() ? "Local design-review data" : "Supabase Postgres",
    seedVersion: state.version,
    counts: { contacts: leads.length, events: events.length, notes: notes.length, tasks: tasks.length, tags: tags.length, owners: owners.length },
  };
}

/** Everything in the store, for a full JSON export/backup. */
export async function exportAllData(): Promise<{ leads: Lead[]; events: BehaviourEvent[]; notes: Note[]; tasks: Task[]; settings: CrmSettings }> {
  await hydrateStore();
  await getSettings();
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

export type Booking = { id: string; contactId?: string; contactName?: string; email?: string; createdAt: string; preferredTime?: string; endsAt?: string; timezone?: string; status?: string };

/** Booked calls, resolved to contacts (for the calendar + upcoming panel). */
export async function listBookings(): Promise<Booking[]> {
  if (isCrmDemoMode()) {
    return events
      .filter((event) => event.event === EVENTS.booked && event.email)
      .map((event) => {
        const contact = leads.find((lead) => lead.email === event.email);
        const start = new Date(event.createdAt);
        return {
          id: event.id,
          contactId: contact?.id,
          contactName: contact?.name,
          email: event.email,
          createdAt: start.toISOString(),
          endsAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
          timezone: state.settings.profile.timezone,
          status: "confirmed",
        };
      });
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, contact_id, starts_at, ends_at, timezone, status")
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const contact = leads.find((lead) => lead.id === row.contact_id);
    return {
      id: row.id,
      contactId: row.contact_id,
      contactName: contact?.name,
      email: contact?.email,
      createdAt: row.starts_at,
      endsAt: row.ends_at,
      timezone: row.timezone,
      status: row.status,
      preferredTime: undefined,
    };
  });
}

export async function rescheduleBooking(id: string, startsAt: string): Promise<void> {
  const starts = new Date(startsAt);
  if (Number.isNaN(starts.getTime()) || starts.getTime() <= Date.now()) throw new Error("Invalid appointment time.");
  const ends = new Date(starts.getTime() + 30 * 60 * 1000);
  const testMode = (process.env.EMAIL_MODE ?? "test") !== "production";
  const reminderAt = testMode
    ? new Date(Date.now() + 5 * 60 * 1000)
    : new Date(Math.max(Date.now(), starts.getTime() - 24 * 60 * 60 * 1000));
  const { data: detailsData, error: detailsError } = await createAdminClient().rpc("get_booking_calendar_details", {
    p_booking_id: id,
  });
  if (detailsError) throw detailsError;
  const details = (detailsData as Array<{
    starts_at: string; ends_at: string; timezone: string; provider_event_id: string | null;
    contact_name: string; contact_email: string; contact_phone: string | null;
  }> | null)?.[0];
  if (!details) throw new Error("Booking not found.");
  const {
    assertGoogleCalendarAvailable, attachGoogleEventToBooking,
    createGoogleCalendarEvent, updateGoogleCalendarEvent,
  } = await import("./google-calendar");
  await assertGoogleCalendarAvailable(starts, ends);
  let eventId = details.provider_event_id;
  if (eventId) {
    await updateGoogleCalendarEvent(eventId, {
      name: details.contact_name, email: details.contact_email, phone: details.contact_phone,
      startsAt: starts.toISOString(), endsAt: ends.toISOString(), timezone: details.timezone,
    });
  } else {
    eventId = await createGoogleCalendarEvent({
      name: details.contact_name, email: details.contact_email, phone: details.contact_phone,
      startsAt: starts.toISOString(), endsAt: ends.toISOString(), timezone: details.timezone,
    });
  }
  const { error } = await createAdminClient().rpc("reschedule_booking_and_notify", {
    p_booking_id: id,
    p_starts_at: starts.toISOString(),
    p_ends_at: ends.toISOString(),
    p_reminder_at: reminderAt.toISOString(),
  });
  if (error) throw error;
  if (!details.provider_event_id && eventId) await attachGoogleEventToBooking(id, eventId);
}

export async function cancelBooking(id: string): Promise<void> {
  const { data: detailsData, error: detailsError } = await createAdminClient().rpc("get_booking_calendar_details", {
    p_booking_id: id,
  });
  if (detailsError) throw detailsError;
  const details = (detailsData as Array<{ provider_event_id: string | null }> | null)?.[0];
  if (!details) throw new Error("Booking not found.");
  if (details.provider_event_id) {
    const { deleteGoogleCalendarEvent } = await import("./google-calendar");
    await deleteGoogleCalendarEvent(details.provider_event_id);
  }
  const { error } = await createAdminClient().rpc("cancel_booking_and_notify", {
    p_booking_id: id,
  });
  if (error) throw error;
}

export type NavData = {
  counts: { overdueTasks: number; needsAttention: number; openTasks: number };
  notifications: NotificationItem[];
  contacts: ContactOption[];
  owners: string[];
  tags: string[];
};

/** Everything the global nav chrome needs: counts, notifications, search index. */
export async function getNavData(): Promise<NavData> {
  // The maintenance cron refreshes notifications every five minutes. Page
  // requests only read the durable result so the shared CRM layout stays fast.
  const [settings, owners, tags, contacts] = await Promise.all([
    getSettings(),
    listOwners(),
    listTags(),
    listContactOptions(),
  ]);
  const enabledKinds = [
    settings.prefs.notify.overdueTasks ? "overdue" : null,
    settings.prefs.notify.coolingLeads ? "cooling" : null,
    settings.prefs.notify.noFollowUp ? "nofollow" : null,
    settings.prefs.notify.newBookings ? "booking" : null,
    "new_lead",
    settings.prefs.notify.highIntentRegistrations ? "high_intent" : null,
    "failed_email",
    "failed_booking",
  ].filter((kind): kind is string => Boolean(kind));
  let notificationRows: Array<Record<string, unknown>> = [];
  if (isCrmDemoMode()) {
    const preview = (await getOverview()).actions.slice(0, 5);
    notificationRows = preview.map((item, index) => ({
      id: `demo-${item.id}`,
      kind: item.kind === "hot" ? "high_intent" : item.kind,
      title: item.title,
      subtitle: item.subtitle,
      href: item.href,
      tone: item.tone,
      read_at: null,
      created_at: new Date(Date.now() - index * 60_000).toISOString(),
    }));
  } else if (enabledKinds.length) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("crm_notifications")
      .select("id, kind, title, subtitle, href, tone, read_at, created_at")
      .in("kind", enabledKinds)
      .is("dismissed_at", null)
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    notificationRows = (data ?? []) as Array<Record<string, unknown>>;
  }
  const notifications: NotificationItem[] = notificationRows.map((row) => ({
    id: String(row.id),
    kind: row.kind as NotificationItem["kind"],
    title: String(row.title),
    subtitle: String(row.subtitle),
    href: String(row.href),
    tone: row.tone as Tone,
    readAt: row.read_at ? String(row.read_at) : undefined,
    createdAt: String(row.created_at),
  }));
  const now = Date.now();
  const t0 = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();
  const overdueTasks = tasks.filter((t) => !t.done && t.dueDate && new Date(t.dueDate).getTime() < t0).length;
  const openTasks = tasks.filter((t) => !t.done).length;
  return {
    counts: { overdueTasks, needsAttention: notifications.filter((item) => !item.readAt).length, openTasks },
    notifications,
    contacts,
    owners,
    tags,
  };
}

export async function syncCrmNotifications(): Promise<void> {
  const { error } = await createAdminClient().rpc("sync_crm_notifications");
  if (error) throw new Error(`Could not refresh CRM notifications: ${error.message}`);
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
    const stage = isStage(l.stage) ? l.stage : stageFromEvents(byEmail.get(l.email) ?? []);
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
  const expectedClients = Math.round(contacts.reduce((total, contact) => {
    const explicitProbability = STAGE_PROBABILITY[contact.stage];
    const fallbackProbability = contact.booked
      ? STAGE_PROBABILITY.booked
      : STAGE_PROBABILITY.new;
    return total + (Number.isFinite(explicitProbability) ? explicitProbability : fallbackProbability);
  }, 0));
  const pipeline = { active: ACTIVE_STAGES.reduce((n, s) => n + stageCount(s), 0), won, lost, winRatePct: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0, expectedClients, stalest };

  // Funnel + step conversions are aggregated in Postgres from durable events.
  const durableFunnel = await getDurableFunnelStages(owner);
  const funnel: OverviewFunnelStage[] = durableFunnel.map((stage, index) => ({
    ...stage,
    convPct: index === 0
      ? null
      : durableFunnel[index - 1].count
        ? Math.round((stage.count / durableFunnel[index - 1].count) * 100)
        : 0,
  }));

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
