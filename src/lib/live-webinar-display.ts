import type { LiveWebinarRegistration } from "./live-webinar-types";

export function formatLiveDate(iso: string | null, timezone = "UTC"): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso));
}

export function liveParticipationLabel(registration: LiveWebinarRegistration): string {
  if (registration.cancelledAt) return "Registration cancelled";
  if (registration.attendedAt || registration.postSessionOutcome === "attended") return "Present during session";
  if (registration.postSessionOutcome === "no_show") return "No attendance recorded";
  if (registration.firstRoomOpenedAt) return "Entered room";
  return "Registered";
}

/** A delayed incomplete attempt is an observation, not a browser-unload event. */
export function liveBookingLabel(registration: LiveWebinarRegistration, now: number): string | null {
  if (registration.bookedAt) return "Call booked";
  if (!registration.bookingStartedAt) return null;
  return now - Date.parse(registration.bookingStartedAt) >= 30 * 60_000
    ? "Booking incomplete (30m+)" : "Booking started";
}

export function liveDateInput(iso: string | null, timezone: string): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

/** Resolve a wall-clock input in its authored timezone, without using browser time. */
export function liveDateToIso(input: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) throw new Error("Enter a valid date and time.");
  const utc = Date.parse(`${input}:00Z`);
  if (!Number.isFinite(utc)) throw new Error("Enter a valid date and time.");
  const candidates = new Set<string>();
  // Offsets on both sides of the date cover daylight-saving changes.
  for (const delta of [-36, -12, 0, 12, 36]) {
    const probe = utc + delta * 3600000;
    const local = Date.parse(`${liveDateInput(new Date(probe).toISOString(), timezone)}:00Z`);
    const candidate = new Date(utc - (local - probe)).toISOString();
    if (liveDateInput(candidate, timezone) === input) candidates.add(candidate);
  }
  if (!candidates.size) throw new Error("This time does not exist in the selected timezone. Choose a time outside the daylight-saving clock change.");
  if (candidates.size > 1) throw new Error("This time occurs twice during the daylight-saving clock change. Choose a time outside the repeated hour.");
  return [...candidates][0];
}
