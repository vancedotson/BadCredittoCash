import "server-only";

import { cookies } from "next/headers";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { isCrmDemoMode } from "./demo";
import { isUuid, type LiveWebinarSession, type LiveWebinarRegistration, type LiveWebinarMessage, type LiveWebinarSessionReport, type LiveWebinarContactRegistration } from "./live-webinar-types";
import { liveParticipantCookie, verifyLiveParticipantToken, type LiveParticipantClaims } from "./live-webinar-token";
import { liveBookingLabel } from "./live-webinar-display";

type Row = Record<string, unknown>;
const str = (value: unknown) => typeof value === "string" ? value : "";
const nullable = (value: unknown) => typeof value === "string" ? value : null;

export function liveWebinarsEnabled(): boolean { return process.env.LIVE_WEBINAR_ENABLED === "true"; }

export function mapLiveSession(row: Row): LiveWebinarSession {
  return {
    id: str(row.id), slug: str(row.slug), title: str(row.title),
    startsAt: str(row.starts_at), endsAt: str(row.ends_at), timezone: str(row.timezone),
    status: row.status as LiveWebinarSession["status"], embedUrl: nullable(row.embed_url), replayUrl: nullable(row.replay_url),
    replayPublished: row.replay_published === true, replayAvailableUntil: nullable(row.replay_available_until),
    automationEnabled: row.automation_enabled === true, scheduleVersion: Number(row.schedule_version ?? 1),
    streamProvider: row.stream_provider === "cloudflare" ? "cloudflare" : "external",
    cloudflareLiveInputId: nullable(row.cloudflare_live_input_id),
  };
}

function mapRegistration(row: Row): LiveWebinarRegistration {
  return {
    id: str(row.id), contactId: str(row.contact_id), sessionId: str(row.session_id), registeredAt: str(row.registered_at),
    cancelledAt: nullable(row.cancelled_at), firstRoomOpenedAt: nullable(row.first_room_opened_at),
    attendedAt: nullable(row.attended_at), lastPresenceAt: nullable(row.last_presence_at), replayOpenedAt: nullable(row.replay_opened_at),
    bookingStartedAt: nullable(row.booking_started_at), postSessionOutcome: row.post_session_outcome === "no_attendance" ? "no_show" : row.post_session_outcome === "attended" ? "attended" : null,
    timezone: nullable(row.timezone),
  };
}

export async function getPublicLiveWebinarSession(identity?: string | null): Promise<LiveWebinarSession | null> {
  if (!liveWebinarsEnabled()) return null;
  const admin = createAdminClient();
  let query = admin.from("live_webinar_sessions").select("*").neq("status", "draft");
  if (identity) {
    if (identity.length > 100 || !/^[a-zA-Z0-9-]+$/.test(identity)) return null;
    query = query.eq(isUuid(identity) ? "id" : "slug", identity);
  } else {
    query = query.eq("status", "scheduled").gt("ends_at", new Date().toISOString()).order("starts_at").limit(1);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("Could not load the live session.");
  return data ? mapLiveSession(data) : null;
}

export async function resolveLiveParticipant(sessionId: string, token?: string): Promise<(LiveParticipantClaims & { email: string }) | null> {
  const raw = token ?? (await cookies()).get(liveParticipantCookie(sessionId))?.value;
  if (!raw) return null;
  const claims = verifyLiveParticipantToken(raw);
  if (!claims || claims.sessionId !== sessionId) return null;
  const { data, error } = await createAdminClient().from("live_webinar_registrations")
    .select("id, access_version, cancelled_at,contact:contacts!inner(email)").eq("id", claims.registrationId).eq("session_id", sessionId).maybeSingle();
  if (error) throw new Error("Could not verify session registration.");
  if (!data || data.cancelled_at || data.access_version !== claims.accessVersion) return null;
  const contact = (Array.isArray(data.contact) ? data.contact[0] : data.contact) as unknown as { email: string };
  return { ...claims, email: contact.email };
}

export async function getLiveWebinarSessions(): Promise<LiveWebinarSession[]> {
  if (isCrmDemoMode()) return [];
  const db = await createClient();
  const rows: LiveWebinarSession[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("live_webinar_sessions").select("*").order("starts_at", { ascending: false }).order("id").range(offset, offset + 999);
    if (error && (error.code === "42P01" || error.code === "PGRST205")) return [];
    if (error) throw new Error("Could not load webinar sessions. Check that the live webinar migration has been applied.");
    rows.push(...(data ?? []).map(mapLiveSession));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/** Pass one request timestamp to the calendar so server and client agree on today. */
export async function getLiveWebinarWorkspace() {
  const sessions = await getLiveWebinarSessions();
  return { sessions, now: new Date().toISOString() };
}

async function getRegistrationMessages(registrationIds: string[]): Promise<Map<string, LiveWebinarMessage[]>> {
  const result = new Map<string, LiveWebinarMessage[]>();
  const db = await createClient();
  for (let chunk = 0; chunk < registrationIds.length; chunk += 100) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("scheduled_messages")
        .select("id,template_key,status,scheduled_for,sent_at,last_error,enrollment:sequence_enrollments!inner(live_registration_id)")
        .in("enrollment.live_registration_id", registrationIds.slice(chunk, chunk + 100)).order("scheduled_for").order("id").range(offset, offset + 999);
      if (error) throw new Error("Could not load webinar messages.");
      for (const item of data ?? []) {
        const row = item as unknown as Row;
        const enrollment = (Array.isArray(row.enrollment) ? row.enrollment[0] : row.enrollment) as Row;
        const id = str(enrollment.live_registration_id);
        const list = result.get(id) ?? [];
        list.push({ id: str(row.id), templateKey: str(row.template_key), status: str(row.status), scheduledFor: str(row.scheduled_for), sentAt: nullable(row.sent_at), lastError: nullable(row.last_error) });
        result.set(id, list);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return result;
}

export async function getContactLiveWebinars(contactId: string): Promise<LiveWebinarContactRegistration[]> {
  if (isCrmDemoMode()) return [];
  const db = await createClient();
  const { data, error } = await db.from("live_webinar_registrations").select("*,session:live_webinar_sessions!inner(*)")
    .eq("contact_id", contactId).order("registered_at", { ascending: false });
  if (error && (error.code === "42P01" || error.code === "PGRST205")) return [];
  if (error) throw new Error("Could not load this contact's webinar history.");
  const messages = await getRegistrationMessages((data ?? []).map((row) => row.id));
  const bookings = await getRegistrationBookingTimes((data ?? []).map((row) => row.id));
  const observedAt = Date.now();
  return (data ?? []).map((row) => {
    const registration = { ...mapRegistration(row), bookedAt: bookings.get(row.id) ?? null };
    return { ...registration, bookingStatus: liveBookingLabel(registration, observedAt), session: mapLiveSession(row.session as unknown as Row), messages: messages.get(row.id) ?? [] };
  });
}

async function getRegistrationBookingTimes(registrationIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const db = await createClient();
  for (let chunk = 0; chunk < registrationIds.length; chunk += 100) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("bookings").select("live_registration_id,created_at")
        .in("live_registration_id", registrationIds.slice(chunk, chunk + 100)).neq("status", "cancelled")
        .order("created_at", { ascending: false }).order("id").range(offset, offset + 999);
      if (error) throw new Error("Could not load participant bookings.");
      for (const row of data ?? []) if (!result.has(row.live_registration_id)) result.set(row.live_registration_id, row.created_at);
      if (!data || data.length < 1000) break;
    }
  }
  return result;
}

export async function getLiveWebinarSessionReport(sessionId: string): Promise<LiveWebinarSessionReport | null> {
  if (isCrmDemoMode()) return null;
  const db = await createClient();
  const { data: session, error: sessionError } = await db.from("live_webinar_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (sessionError) throw new Error("Could not load session.");
  if (!session) return null;
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("live_webinar_registrations").select("*,contact:contacts!inner(name,email)")
      .eq("session_id", sessionId).order("registered_at", { ascending: false }).order("id").range(offset, offset + 999);
    if (error) throw new Error("Could not load session registrations.");
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const messages = await getRegistrationMessages(rows.map((row) => str(row.id)));
  const bookings = await getRegistrationBookingTimes(rows.map((row) => str(row.id)));
  const registrations = rows.map((row) => {
    const contact = (Array.isArray(row.contact) ? row.contact[0] : row.contact) as Row;
    return { ...mapRegistration(row), bookedAt: bookings.get(str(row.id)) ?? null, contactName: str(contact.name), email: str(contact.email), messages: messages.get(str(row.id)) ?? [] };
  });
  const { count, error: bookingError } = await db.from("bookings").select("id", { count: "exact", head: true }).eq("live_session_id", sessionId).neq("status", "cancelled");
  if (bookingError) throw new Error("Could not load session bookings.");
  return {
    session: mapLiveSession(session), registrations,
    stats: { registrations: registrations.length, attended: registrations.filter((row) => row.attendedAt).length,
      noAttendance: registrations.filter((row) => row.postSessionOutcome === "no_show").length,
      replayOpened: registrations.filter((row) => row.replayOpenedAt).length, booked: count ?? 0 },
  };
}
