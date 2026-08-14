"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { site } from "@/config/site-v3";
import { Kicker, SectionScan } from "../../marketing-v3/shared/primitives";
import { useReveal } from "../../marketing-v3/shared/hooks";
import { CheckIcon, PhoneIcon } from "@/components/marketing-v2/Icons";

/**
 * /webinar/booked — the onboarding step after the call is booked. Captures
 * decision momentum with a "start here" checklist so the call is productive
 * (ebook §2.2, the thank-you page). Also the honest in-crisis path.
 */
const wb = site.webinar;

type BookingConfirmation = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
};

function calendarStamp(value: string): string {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function BookedSectionV4() {
  const ref = useReveal<HTMLDivElement>();
  const [booking, setBooking] = useState<BookingConfirmation | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const stored = sessionStorage.getItem("vance:last-booking");
        if (!stored) return;
        const parsed = JSON.parse(stored) as BookingConfirmation;
        if (parsed.id && parsed.startsAt && parsed.endsAt && parsed.timezone) setBooking(parsed);
      } catch {
        // The generic confirmation remains useful if browser storage is unavailable.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const formattedTime = useMemo(() => {
    if (!booking) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: booking.timezone,
      }).format(new Date(booking.startsAt));
    } catch {
      return new Date(booking.startsAt).toLocaleString();
    }
  }, [booking]);

  const googleCalendarUrl = useMemo(() => {
    if (!booking) return null;
    const query = new URLSearchParams({
      action: "TEMPLATE",
      text: "Strategy call with Vance Dotson",
      dates: `${calendarStamp(booking.startsAt)}/${calendarStamp(booking.endsAt)}`,
      details: "Strategy call booked through the Vance Dotson website.",
    });
    return `https://calendar.google.com/calendar/render?${query.toString()}`;
  }, [booking]);

  function downloadCalendarFile() {
    if (!booking) return;
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
      "SUMMARY:Strategy call with Vance Dotson",
      "DESCRIPTION:Strategy call booked through the Vance Dotson website.",
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
    <section className="v3-section" style={{ paddingTop: "clamp(56px,8vw,120px)" }}>
      <SectionScan />
      <div className="v3-wrap" style={{ maxWidth: 720 }} ref={ref}>
        <div className="mx-auto grid place-items-center" style={{ width: 56, height: 56, borderRadius: "50%", background: "color-mix(in srgb, var(--v3-accent) 20%, transparent)", border: "1px solid var(--v3-accent)", color: "var(--v3-accent)" }}>
          <CheckIcon className="h-7 w-7" />
        </div>
        <div className="mt-6 text-center">
          <Kicker>{wb.booked.kicker}</Kicker>
          <h1 className="v3-display mt-4" style={{ fontSize: "clamp(32px,4.6vw,56px)" }}>
            {wb.booked.heading}
          </h1>
          <p className="mx-auto mt-5" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 560 }}>
            {wb.booked.body}
          </p>
          {booking && formattedTime ? (
            <div className="v3-panel mx-auto mt-6 p-5" style={{ maxWidth: 560, borderRadius: 4 }}>
              <span className="v3-mono block" style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--v3-accent)" }}>
                Your appointment
              </span>
              <strong className="mt-2 block" style={{ fontSize: 18, color: "var(--v3-ink)" }}>{formattedTime}</strong>
              <span className="v3-mono mt-1 block" style={{ fontSize: 12, color: "var(--v3-faint)" }}>{booking.timezone}</span>
              <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
                <a
                  href={googleCalendarUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="v3-btn v3-btn-primary"
                  style={{ minHeight: 44 }}
                >
                  Add to Google Calendar
                </a>
                <button type="button" onClick={downloadCalendarFile} className="v3-btn v3-btn-ghost" style={{ minHeight: 44 }}>
                  Download calendar file
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="v3-panel v3-corner mt-9 p-7 sm:p-9" style={{ borderRadius: 4 }}>
          <span className="v3-mono" style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--v3-accent)" }}>
            Start here // before we talk
          </span>
          <ol className="mt-4 flex flex-col gap-4">
            {wb.booked.checklist.map((step, i) => (
              <li key={step} className="flex items-start gap-4">
                <span className="v3-display" style={{ fontSize: 22, color: "var(--v3-accent)", lineHeight: 1, minWidth: 28 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ color: "var(--v3-mut)", fontSize: 15.5, lineHeight: 1.5 }}>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* In-crisis path — don't make someone being harassed wait */}
        <p className="mt-7 text-center" style={{ fontSize: 14, color: "var(--v3-mut)" }}>
          Being harassed right now and can&apos;t wait?{" "}
          <a
            href={site.contact.phoneHref}
            className="inline-flex items-center gap-1.5"
            style={{ color: "var(--v3-accent)", fontWeight: 600 }}
          >
            <PhoneIcon className="h-4 w-4" />
            Call {site.contact.phoneDisplay}
          </a>
        </p>

        <div className="mt-8 text-center">
          <Link href="/v4" className="v3-btn v3-btn-ghost" style={{ minHeight: 46 }}>
            Back to the case file
          </Link>
        </div>
      </div>
    </section>
  );
}
