"use client";

import { useEffect } from "react";
import { track, getRememberedLead } from "@/lib/tracking";
import { EVENTS } from "@/lib/events";
import { Kicker, Reveal, SectionScan } from "../../marketing-v3/shared/primitives";
import { useReveal } from "../../marketing-v3/shared/hooks";
import { CheckIcon } from "@/components/marketing-v2/Icons";
import { BookingWizard } from "./BookingWizard";

/**
 * /book — standalone strategy-call scheduler for NON-webinar sequences (nurture /
 * direct outreach). Same case-file shell + shared two-step BookingWizard as
 * /webinar/call (so the booking experience is identical), with self-contained
 * copy that doesn't assume they watched the training. Fires call_page_view on
 * load; the wizard books through /api/book so it lands in the CRM.
 */

const KICKER = "SCHEDULE // STRATEGY CALL";
const HEADING = "Book your free strategy call.";
const BODY =
  "Pick a time that works for you. We'll look at what's happening with your credit and the calls you're getting, and I'll tell you the honest next step. No cost, no obligation.";
const COVERS = [
  "We review the calls you're getting and the items on your report.",
  "We find out whether there's a violation to hold them to.",
  "You leave knowing exactly where you stand, either way.",
];

const labelStyle = {
  fontSize: 11.5,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  color: "var(--v3-faint)",
};

export function BookSchedulerV4() {
  const ref = useReveal<HTMLDivElement>();

  useEffect(() => {
    track(EVENTS.callPageView, {}, getRememberedLead()?.email);
  }, []);

  return (
    <section className="v3-section" style={{ paddingTop: "clamp(40px,6vw,84px)" }}>
      <SectionScan />
      <div className="v3-wrap grid items-start gap-x-12 gap-y-8 lg:grid-cols-[2fr_3fr]" ref={ref}>
        {/* Left column — heading + what the call covers, grouped at the top */}
        <div className="min-w-0">
          <Kicker>{KICKER}</Kicker>
          <h1 className="v3-display mt-5" style={{ fontSize: "clamp(34px,5vw,64px)", lineHeight: 1.03 }}>
            {HEADING}
          </h1>
          <p className="mt-6" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 560 }}>
            {BODY}
          </p>

          <div className="mt-8">
            <span className="v3-mono" style={labelStyle}>On the call</span>
            <ul className="mt-3 flex flex-col gap-2.5">
              {COVERS.map((c) => (
                <li key={c} className="flex items-start gap-3" style={{ color: "var(--v3-mut)", fontSize: 16 }}>
                  <span style={{ color: "var(--v3-accent)", marginTop: 2 }}>
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Booking card — shared two-step wizard (60%) */}
        <Reveal delay={1} className="min-w-0">
          <div className="v3-panel v3-corner p-7 sm:p-9" style={{ borderRadius: 4 }}>
            <BookingWizard />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
