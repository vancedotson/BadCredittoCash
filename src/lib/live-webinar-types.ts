export type LiveWebinarSession = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: "draft" | "scheduled" | "cancelled";
  embedUrl: string | null;
  replayUrl: string | null;
  replayPublished: boolean;
  replayAvailableUntil: string | null;
  automationEnabled: boolean;
  scheduleVersion: number;
  streamProvider?: "external" | "cloudflare";
  cloudflareLiveInputId?: string | null;
};

export type PublicLiveWebinarSession = LiveWebinarSession;

export type LiveWebinarMessage = {
  id: string;
  templateKey: string;
  status: string;
  scheduledFor: string;
  sentAt: string | null;
  lastError: string | null;
};

export type LiveWebinarRegistration = {
  id: string;
  contactId: string;
  sessionId: string;
  registeredAt: string;
  cancelledAt: string | null;
  firstRoomOpenedAt: string | null;
  attendedAt: string | null;
  lastPresenceAt: string | null;
  replayOpenedAt: string | null;
  bookingStartedAt: string | null;
  bookedAt?: string | null;
  postSessionOutcome: "attended" | "no_show" | null;
  timezone: string | null;
};

export type LiveWebinarContactRegistration = LiveWebinarRegistration & {
  bookingStatus?: string | null;
  session: LiveWebinarSession;
  messages: LiveWebinarMessage[];
};

export type LiveWebinarSessionReport = {
  session: LiveWebinarSession;
  registrations: Array<LiveWebinarRegistration & {
    contactName: string;
    email: string;
    messages: LiveWebinarMessage[];
  }>;
  stats: { registrations: number; attended: number; noAttendance: number; replayOpened: number; booked: number };
};

export const LIVE_ACTIVITY_EVENTS = [
  "webinar_confirmed_view", "webinar_room_opened", "live_presence",
  "live_question_asked", "call_page_view", "call_booking_started",
] as const;
export type LiveActivityEvent = (typeof LIVE_ACTIVITY_EVENTS)[number];

export function isLiveActivityEvent(value: unknown): value is LiveActivityEvent {
  return typeof value === "string" && (LIVE_ACTIVITY_EVENTS as readonly string[]).includes(value);
}

export const LIVE_PLAYER_ORIGINS = [
  "https://www.youtube.com", "https://www.youtube-nocookie.com", "https://player.vimeo.com",
] as const;

export function isLivePlayerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const cloudflarePlayer = /^customer-[a-z0-9]+\.cloudflarestream\.com$/i.test(url.hostname);
    return url.protocol === "https:" && !url.username && !url.password
      && ((LIVE_PLAYER_ORIGINS as readonly string[]).includes(url.origin) || cloudflarePlayer);
  } catch { return false; }
}

export function isCloudflareWhepUrl(value: string, liveInputId?: string | null): boolean {
  try {
    const url = new URL(value);
    const inputId = liveInputId ?? url.pathname.split("/")[1];
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash
      && /^customer-[a-z0-9]+\.cloudflarestream\.com$/i.test(url.hostname)
      && /^[a-f\d]{32}$/i.test(inputId)
      && url.pathname === `/${inputId}/webRTC/play`;
  } catch { return false; }
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 100) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; }
}

export function hasLiveContext(props: Record<string, unknown> = {}): boolean {
  return props.funnel === "live" || typeof props.sessionId === "string" || typeof props.webinarSessionId === "string"
    || (typeof props.pagePath === "string" && /^\/live(?:\/|\?|$)/.test(props.pagePath));
}
