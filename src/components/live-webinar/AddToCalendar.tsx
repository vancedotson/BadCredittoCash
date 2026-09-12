"use client";

import { liveWebinar } from "@/config/live-webinar";
import { useLiveSession } from "./LiveSessionProvider";

/**
 * Add-to-calendar for the live session — the single biggest show-up lever on
 * /live/confirmed. Follows the same ICS shape already used by
 * marketing-v4/webinar/BookedSectionV4 so both calendar entries behave alike.
 *
 * Event details and stable calendar identity come from the stored session.
 * Preview calendars are disabled so placeholder logistics cannot be exported.
 */

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

export function AddToCalendar() {
  const { session, preview, href } = useLiveSession();
  if (!session) return null;
  const cal = liveWebinar.confirmed.calendar;
  const { startsAt, endsAt } = session;
  const roomPath = href("/live/room");
  const roomUrl = typeof window === "undefined" ? roomPath : new URL(roomPath, window.location.origin).toString();
  const description = `${cal.eventDescription}\nSession: ${roomUrl}\nOn another device, use your personal joining link from the confirmation email.`;
  const query = new URLSearchParams({
      action: "TEMPLATE",
      text: session.title,
      dates: `${calendarStamp(startsAt)}/${calendarStamp(endsAt)}`,
      details: description,
      location: roomUrl,
    });
  const googleUrl = `https://calendar.google.com/calendar/render?${query.toString()}`;

  function downloadIcs() {
    if (preview || !session) return;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Vance Dotson//Live Session//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:live-${session.id}@vancedotson.com`,
      `SEQUENCE:${session.scheduleVersion}`,
      `DTSTAMP:${calendarStamp(new Date().toISOString())}`,
      `DTSTART:${calendarStamp(startsAt)}`,
      `DTEND:${calendarStamp(endsAt)}`,
      `SUMMARY:${escapeIcs(session.title)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `URL:${escapeIcs(roomUrl)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "vance-dotson-live-session.ics";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <a
        href={preview ? undefined : googleUrl}
        aria-disabled={preview}
        target="_blank"
        rel="noreferrer"
        className="v3-btn v3-btn-primary"
        style={{ minHeight: 44 }}
      >
        {cal.googleLabel}
      </a>
      <button
        type="button"
        disabled={preview}
        onClick={downloadIcs}
        className="v3-btn v3-btn-ghost"
        style={{ minHeight: 44 }}
      >
        {cal.icsLabel}
      </button>
    </div>
  );
}
