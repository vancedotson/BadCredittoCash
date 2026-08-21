import "server-only";

import { createAdminClient } from "./supabase/admin";
import { decryptSecret, encryptSecret } from "./secret-crypto";
import { isCrmDemoMode } from "./demo";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

const appBaseUrl = (process.env.APP_BASE_URL ?? "https://vance-dotson.vancedotson.workers.dev").replace(/\/$/, "");

export const GOOGLE_CALENDAR_REDIRECT_URI =
  `${appBaseUrl}/api/integrations/google-calendar/callback`;

type GoogleConnectionRow = {
  refresh_token_ciphertext: string;
  calendar_id: string;
  account_email: string | null;
  timezone: string;
  connected_at: string;
};

function oauthCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured.");
  return { clientId, clientSecret };
}

export async function exchangeGoogleAuthorizationCode(code: string): Promise<string> {
  const { clientId, clientSecret } = oauthCredentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: GOOGLE_CALENDAR_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const result = await response.json() as { refresh_token?: string; error_description?: string };
  if (!response.ok || !result.refresh_token) {
    throw new Error(result.error_description ?? "Google did not return an offline refresh token.");
  }
  return result.refresh_token;
}

export async function saveGoogleCalendarConnection(refreshToken: string): Promise<void> {
  const ciphertext = await encryptSecret(refreshToken);
  const { error } = await createAdminClient().rpc("save_google_calendar_connection", {
    p_refresh_token_ciphertext: ciphertext,
    p_calendar_id: "primary",
    p_account_email: process.env.GOOGLE_CALENDAR_ACCOUNT_EMAIL ?? null,
    p_timezone: process.env.GOOGLE_CALENDAR_TIMEZONE ?? "America/Chicago",
  });
  if (error) throw new Error(error.message);
}

export async function getGoogleCalendarStatus(): Promise<{
  connected: boolean;
  accountEmail?: string;
  timezone?: string;
  connectedAt?: string;
}> {
  if (isCrmDemoMode()) return { connected: false };
  const { data, error } = await createAdminClient().rpc("get_google_calendar_connection");
  if (error) throw new Error(error.message);
  const connection = (data as GoogleConnectionRow[] | null)?.[0];
  return connection ? {
    connected: true,
    accountEmail: connection.account_email ?? undefined,
    timezone: connection.timezone,
    connectedAt: connection.connected_at,
  } : { connected: false };
}

export async function getGoogleAccessToken(): Promise<{
  accessToken: string;
  calendarId: string;
  timezone: string;
}> {
  const { data, error } = await createAdminClient().rpc("get_google_calendar_connection");
  if (error) throw new Error(error.message);
  const connection = (data as GoogleConnectionRow[] | null)?.[0];
  if (!connection) throw new Error("Google Calendar is not connected.");
  const { clientId, clientSecret } = oauthCredentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: await decryptSecret(connection.refresh_token_ciphertext),
      grant_type: "refresh_token",
    }),
  });
  const result = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description ?? "Google Calendar authorization expired.");
  }
  return {
    accessToken: result.access_token,
    calendarId: connection.calendar_id,
    timezone: connection.timezone,
  };
}

export type GoogleBusyInterval = { start: string; end: string };

type GoogleAccess = Awaited<ReturnType<typeof getGoogleAccessToken>>;

class GoogleCalendarRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GoogleCalendarRequestError";
  }
}

type GoogleEventInput = {
  name: string;
  email: string;
  phone?: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
};

async function googleCalendarFetch<T>(path: string, init?: RequestInit, access?: GoogleAccess): Promise<T> {
  const connection = access ?? await getGoogleAccessToken();
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const result = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new GoogleCalendarRequestError(
    result.error?.message ?? "Google Calendar request failed.",
    response.status,
  );
  return result;
}

export async function listGoogleBusyIntervals(from: Date, to: Date): Promise<GoogleBusyInterval[]> {
  const connection = await getGoogleAccessToken();
  const result = await googleCalendarFetch<{
    calendars?: Record<string, { busy?: GoogleBusyInterval[]; errors?: unknown[] }>;
  }>("/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      timeZone: connection.timezone,
      items: [{ id: connection.calendarId }],
    }),
  }, connection);
  const calendar = result.calendars?.[connection.calendarId];
  if (calendar?.errors?.length) throw new Error("Google Calendar availability could not be read.");
  return calendar?.busy ?? [];
}

export async function assertGoogleCalendarAvailable(startsAt: Date, endsAt: Date): Promise<void> {
  const busy = await listGoogleBusyIntervals(startsAt, endsAt);
  if (busy.some((interval) =>
    new Date(interval.start).getTime() < endsAt.getTime()
      && new Date(interval.end).getTime() > startsAt.getTime()
  )) throw new Error("That time is busy on the connected calendar.");
}

function eventBody(input: GoogleEventInput) {
  return {
    summary: `Strategy call — ${input.name}`,
    description: [
      `Contact: ${input.name}`,
      `Email: ${input.email}`,
      input.phone ? `Phone: ${input.phone}` : null,
      "Booked through the Vance Dotson website.",
    ].filter(Boolean).join("\n"),
    start: { dateTime: input.startsAt, timeZone: input.timezone },
    end: { dateTime: input.endsAt, timeZone: input.timezone },
  };
}

export async function createGoogleCalendarEvent(input: GoogleEventInput): Promise<string> {
  const connection = await getGoogleAccessToken();
  const result = await googleCalendarFetch<{ id?: string }>(
    `/calendars/${encodeURIComponent(connection.calendarId)}/events?sendUpdates=none`,
    { method: "POST", body: JSON.stringify(eventBody(input)) },
    connection,
  );
  if (!result.id) throw new Error("Google Calendar did not return an event ID.");
  return result.id;
}

export async function updateGoogleCalendarEvent(eventId: string, input: GoogleEventInput): Promise<void> {
  const connection = await getGoogleAccessToken();
  await googleCalendarFetch(
    `/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    { method: "PATCH", body: JSON.stringify(eventBody(input)) },
    connection,
  );
}

export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  const connection = await getGoogleAccessToken();
  try {
    await googleCalendarFetch(
      `/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
      { method: "DELETE" },
      connection,
    );
  } catch (error) {
    if (error instanceof GoogleCalendarRequestError && [404, 410].includes(error.status)) return;
    throw error;
  }
}

type GoogleCalendarEvent = {
  status?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
};

async function getGoogleCalendarEvent(
  eventId: string,
  access: GoogleAccess,
): Promise<GoogleCalendarEvent | null> {
  try {
    const event = await googleCalendarFetch<GoogleCalendarEvent>(
      `/calendars/${encodeURIComponent(access.calendarId)}/events/${encodeURIComponent(eventId)}`,
      undefined,
      access,
    );
    return event.status === "cancelled" ? null : event;
  } catch (error) {
    if (error instanceof GoogleCalendarRequestError && [404, 410].includes(error.status)) return null;
    throw error;
  }
}

export async function reconcileGoogleCalendarBookings(limit = 25): Promise<{
  checked: number;
  rescheduled: number;
  cancelled: number;
  failed: number;
}> {
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_google_bookings_for_reconciliation", {
    p_limit: safeLimit,
  });
  if (error) throw new Error(error.message);
  if (!data?.length) return { checked: 0, rescheduled: 0, cancelled: 0, failed: 0 };

  const access = await getGoogleAccessToken();
  let checked = 0;
  let rescheduled = 0;
  let cancelled = 0;
  let failed = 0;
  for (const booking of data) {
    try {
      const event = await getGoogleCalendarEvent(booking.provider_event_id as string, access);
      checked += 1;
      if (!event) {
        const { error: cancelError } = await admin.rpc("cancel_booking_and_notify", {
          p_booking_id: booking.booking_id,
        });
        if (cancelError) throw new Error(cancelError.message);
        cancelled += 1;
        continue;
      }

      const startsAt = event.start?.dateTime;
      const endsAt = event.end?.dateTime;
      if (!startsAt || !endsAt) throw new Error("Google event has no timed start or end.");
      const moved = Math.abs(new Date(startsAt).getTime() - new Date(booking.starts_at).getTime()) > 1000
        || Math.abs(new Date(endsAt).getTime() - new Date(booking.ends_at).getTime()) > 1000;
      if (!moved) continue;

      const starts = new Date(startsAt);
      const testMode = (process.env.EMAIL_MODE ?? "test") !== "production";
      const reminderAt = testMode
        ? new Date(Date.now() + 5 * 60 * 1000)
        : new Date(Math.max(Date.now(), starts.getTime() - 24 * 60 * 60 * 1000));
      const { error: moveError } = await admin.rpc("reconcile_google_booking", {
        p_booking_id: booking.booking_id,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
        p_reminder_at: reminderAt.toISOString(),
      });
      if (moveError) throw new Error(moveError.message);
      rescheduled += 1;
    } catch (bookingError) {
      failed += 1;
      console.error("[google-calendar] booking reconciliation failed", {
        bookingId: booking.booking_id,
        error: bookingError instanceof Error ? bookingError.message : "unknown_error",
      });
    }
  }
  return { checked, rescheduled, cancelled, failed };
}

export async function attachGoogleEventToBooking(bookingId: string, eventId: string): Promise<void> {
  const { error } = await createAdminClient().rpc("set_booking_google_event", {
    p_booking_id: bookingId,
    p_provider_event_id: eventId,
  });
  if (error) throw new Error(error.message);
}
