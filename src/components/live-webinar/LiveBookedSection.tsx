"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { site } from "@/config/site-v3";
import { liveWebinar } from "@/config/live-webinar";
import { Kicker, SectionScan, Reveal } from "@/components/marketing-v3/shared/primitives";
import { useReveal } from "@/components/marketing-v3/shared/hooks";
import { CheckIcon } from "@/components/marketing-v2/Icons";
import { useLiveSession } from "./LiveSessionProvider";
import { PreviewBanner } from "./UnscheduledNotice";

/**
 * /live/booked — step 5 of the live funnel. Reached from the BookingWizard on
 * /live/call (redirectTo="/live/booked").
 *
 * Confirms what was actually booked and gets the caller prepared. The booking
 * details are handed over in sessionStorage under "vance:last-booking" by the
 * wizard; when that isn't available the page falls back to a generic
 * confirmation rather than inventing an appointment time.
 *
 * Not gated on `isScheduled` — a booking is real regardless of whether a live
 * session is on the calendar.
 */

const B = liveWebinar.booked;

type BookingConfirmation = {
  id: string;
  name?: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
};

/* ---------------------------------------------------------------- the handoff */

/**
 * The wizard's booking, read from sessionStorage.
 *
 * Read through useSyncExternalStore, not an effect: sessionStorage is an
 * external store the server can't see, and the snapshot must be referentially
 * stable between renders — so the parsed object is memoised against the raw
 * string and only re-parsed when that string changes.
 */
let lastRaw: string | null = null;
let lastParsed: BookingConfirmation | null = null;
let hasRead = false;

function readBooking(key: string): BookingConfirmation | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(key);
  } catch {
    raw = null;
  }
  if (hasRead && raw === lastRaw) return lastParsed;
  hasRead = true;
  lastRaw = raw;
  lastParsed = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as BookingConfirmation;
      if (parsed.id && parsed.startsAt && parsed.endsAt && parsed.timezone) lastParsed = parsed;
    } catch {
      // A generic confirmation is still useful — never throw on the happy path.
    }
  }
  return lastParsed;
}

const NO_SUBSCRIBE = () => () => {};

function useBooking(sessionId?: string): BookingConfirmation | null {
  return useSyncExternalStore(NO_SUBSCRIBE, () => readBooking(`vance:live-booking:${sessionId ?? "direct"}`), () => null);
}

/* --------------------------------------------------------------- the calendar */

function calendarStamp(value: string): string {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

const CALL_TITLE = "Strategy call with Vance Dotson";
const CALL_DETAILS = "Free 30-minute strategy call booked through the Vance Dotson website.";

function AddBookingToCalendar({ booking }: { booking: BookingConfirmation }) {
  const googleUrl = useMemo(() => {
    const query = new URLSearchParams({
      action: "TEMPLATE",
      text: CALL_TITLE,
      dates: `${calendarStamp(booking.startsAt)}/${calendarStamp(booking.endsAt)}`,
      details: CALL_DETAILS,
    });
    return `https://calendar.google.com/calendar/render?${query.toString()}`;
  }, [booking.startsAt, booking.endsAt]);

  function downloadIcs() {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Vance Dotson//Strategy Call//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${escapeIcs(booking.id)}@vancedotson.com`,
      `DTSTAMP:${calendarStamp(new Date().toISOString())}`,
      `DTSTART:${calendarStamp(booking.startsAt)}`,
      `DTEND:${calendarStamp(booking.endsAt)}`,
      `SUMMARY:${escapeIcs(CALL_TITLE)}`,
      `DESCRIPTION:${escapeIcs(CALL_DETAILS)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "vance-dotson-strategy-call.ics";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
      <a
        href={googleUrl}
        target="_blank"
        rel="noreferrer"
        className="v3-btn v3-btn-primary"
        style={{ minHeight: 44 }}
      >
        Add to Google Calendar
      </a>
      <button type="button" onClick={downloadIcs} className="v3-btn v3-btn-ghost" style={{ minHeight: 44 }}>
        Apple / Outlook (.ics)
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ the page */

function useFormattedAppointment(booking: BookingConfirmation | null) {
  return useMemo(() => {
    if (!booking) return null;
    const starts = new Date(booking.startsAt);
    const ends = new Date(booking.endsAt);
    try {
      const time = new Intl.DateTimeFormat(undefined, {
        timeStyle: "short",
        timeZone: booking.timezone,
      });
      const zone =
        new Intl.DateTimeFormat(undefined, { timeZone: booking.timezone, timeZoneName: "long" })
          .formatToParts(starts)
          .find((part) => part.type === "timeZoneName")?.value ?? booking.timezone;
      return {
        date: new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeZone: booking.timezone }).format(starts),
        time: `${time.format(starts)} – ${time.format(ends)}`,
        zone,
      };
    } catch {
      // An unrecognised zone must not blank the confirmation out.
      return {
        date: starts.toLocaleDateString(),
        time: `${starts.toLocaleTimeString()} – ${ends.toLocaleTimeString()}`,
        zone: booking.timezone,
      };
    }
  }, [booking]);
}

export function LiveBookedSection() {
  const ref = useReveal<HTMLDivElement>();
  const { session, preview } = useLiveSession();
  const storedBooking = useBooking(session?.id);
  const booking = preview ? null : storedBooking;
  const appointment = useFormattedAppointment(booking);
  const firstName = booking?.name?.trim().split(/\s+/)[0];

  return (
    <main className="v3-section" style={{ paddingTop: "clamp(40px,6vw,72px)" }}>
      {preview ? <PreviewBanner /> : null}
      <SectionScan />
      <div className="v3-wrap" style={{ maxWidth: 760 }} ref={ref}>
        {/* Confirmation */}
        <div className="flex flex-col items-center text-center">
          <div
            className="grid place-items-center"
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "color-mix(in srgb, var(--v3-accent) 20%, transparent)",
              border: "1px solid var(--v3-accent)",
              color: "var(--v3-accent)",
            }}
          >
            <CheckIcon className="h-7 w-7" />
          </div>
          <div className="mt-6">
            <Kicker>{booking || preview ? B.kicker : "YOUR CALL DETAILS"}</Kicker>
          </div>
          <h1 className="v3-display mt-4" style={{ fontSize: "clamp(32px,4.6vw,56px)", lineHeight: 1.05 }}>
            {firstName ? `${firstName}, your call is booked.` : booking || preview ? B.heading : "Check your booking confirmation."}
          </h1>
          <p className="mt-5" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 580 }}>
            {booking ? B.body : "If you completed a booking, your confirmation email contains the appointment time and call details. Use the checklist below to prepare."}
          </p>
        </div>

        {/* The appointment — only when we actually have one. */}
        {booking && appointment ? (
          <Reveal>
            <div
              className="mt-10 p-6 sm:p-8"
              style={{ background: "var(--v3-bg2)", border: "1px solid var(--v3-line)", borderRadius: 4 }}
            >
              <span
                className="v3-mono"
                style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-accent)" }}
              >
                {B.appointmentLabel}
              </span>
              <p className="v3-display mt-4" style={{ fontSize: 24, lineHeight: 1.15 }}>
                {appointment.date}
              </p>
              <p className="mt-1.5" style={{ fontSize: 20, color: "var(--v3-accent)", fontWeight: 600 }}>
                {appointment.time}
              </p>
              <p className="v3-mono mt-2" style={{ fontSize: 12, color: "var(--v3-faint)" }}>
                {appointment.zone}
              </p>
              <AddBookingToCalendar booking={booking} />
              <p className="mt-5" style={{ fontSize: 13.5, color: "var(--v3-mut)", lineHeight: 1.6 }}>
                {B.calendarNote}
              </p>
            </div>
          </Reveal>
        ) : null}

        {/* Prep */}
        <Reveal>
          <div className="v3-panel v3-corner mt-6 p-6 sm:p-8" style={{ borderRadius: 4 }}>
            <span
              className="v3-mono"
              style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-accent)" }}
            >
              {B.checklist.label}
            </span>
            <ul className="mt-5 flex flex-col gap-4">
              {B.checklist.items.map((item) => (
                <li
                  key={item.text}
                  className="flex items-start gap-3"
                  style={{ fontSize: 16, color: "var(--v3-mut)", lineHeight: 1.6 }}
                >
                  <span style={{ color: "var(--v3-accent)", flexShrink: 0, marginTop: 3 }} aria-hidden>
                    <CheckIcon className="h-5 w-5" />
                  </span>
                  <span>
                    {item.text}
                    {"href" in item && item.href ? (
                      <>
                        {" "}
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--v3-accent)", textDecoration: "underline" }}
                        >
                          {item.linkLabel}
                        </a>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6" style={{ fontSize: 13.5, color: "var(--v3-faint)", lineHeight: 1.6 }}>
              {B.checklist.note}
            </p>
          </div>
        </Reveal>

        {/* The honest in-crisis path. */}
        <Reveal>
          <div
            className="mt-6 flex flex-wrap items-center justify-between gap-5 p-6"
            style={{ border: "1px solid var(--v3-line-soft)", borderRadius: 4 }}
          >
            <div>
              <span
                className="v3-mono"
                style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-faint)" }}
              >
                {B.urgent.label}
              </span>
              <p className="mt-3" style={{ fontSize: 15, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 460 }}>
                {B.urgent.body}
              </p>
            </div>
            <a className="v3-btn v3-btn-ghost" href={site.contact.phoneHref} style={{ minHeight: 44 }}>
              {site.contact.phoneDisplay}
            </a>
          </div>
        </Reveal>

        <p className="mt-10 text-center" style={{ fontSize: 13.5, color: "var(--v3-faint)" }}>
          <Link href="/" style={{ color: "var(--v3-accent)", textDecoration: "underline" }}>
            Back to the main site
          </Link>
        </p>
      </div>
    </main>
  );
}
