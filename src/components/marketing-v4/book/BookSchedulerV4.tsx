"use client";

import { useEffect } from "react";
import { track, getRememberedLead } from "@/lib/tracking";
import { EVENTS } from "@/lib/events";
import { Kicker, SectionScan } from "../../marketing-v3/shared/primitives";
import { useReveal } from "../../marketing-v3/shared/hooks";
import { CheckIcon } from "@/components/marketing-v2/Icons";
import { BookingWizard } from "./BookingWizard";

/**
 * /book — standalone strategy-call scheduler for NON-webinar sequences (nurture /
 * direct outreach). Keeps its own left column (heading + what the call covers +
 * quick facts) and 50/50 layout; the right container uses the shared two-step
 * BookingWizard so the booking experience matches /webinar/call. Fires
 * call_page_view on load; the wizard books through /api/book into the CRM.
 */

const KICKER = "SCHEDULE // STRATEGY CALL";
const HEADING = "Book your free strategy call.";
const BODY =
  "Start with your details, then choose a free 30-minute phone call. Vance will review what’s happening, explain whether there may be a violation, and give you the honest next step. No cost. No obligation.";
const COVERS = [
  "We review the calls you're getting and the items on your report.",
  "We find out whether there's a violation to hold them to.",
  "You leave knowing exactly where you stand, either way.",
];
const FACTS = ["30 minutes", "By phone", "Directly with Vance", "Free, no obligation"];

const labelStyle = {
  fontSize: 10,
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
      <div className="v3-wrap grid items-start gap-x-12 gap-y-8 lg:grid-cols-[1fr_1fr]" ref={ref}>
        {/* Heading */}
        <div className="order-1 min-w-0 lg:col-start-1 lg:row-start-1">
          <Kicker>{KICKER}</Kicker>
          <h1 className="v3-display mt-5" style={{ fontSize: "clamp(34px,5vw,64px)", lineHeight: 1.03 }}>
            {HEADING}
          </h1>
          <p className="mt-6" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 560 }}>
            {BODY}
          </p>
        </div>

        {/* Details — under the heading on desktop, below the card on mobile */}
        <div className="order-3 min-w-0 lg:col-start-1 lg:row-start-2">
          <span className="v3-mono" style={labelStyle}>On the call</span>
          <ul className="mt-3 flex flex-col gap-2.5">
            {COVERS.map((c) => (
              <li key={c} className="flex items-start gap-3" style={{ color: "var(--v3-mut)", fontSize: 15.5 }}>
                <span aria-hidden style={{ color: "var(--v3-accent)", marginTop: 2 }}>
                  <CheckIcon className="h-4 w-4" />
                </span>
                {c}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {FACTS.map((f) => (
              <span key={f} className="v3-mono" style={{ fontSize: 12, color: "var(--v3-faint)", letterSpacing: "0.03em" }}>
                <span style={{ color: "var(--v3-accent)" }}>·</span> {f}
              </span>
            ))}
          </div>
        </div>

        {/* Booking card — shared two-step wizard */}
        <div className="order-2 min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="v3-panel v3-corner p-7 sm:p-9" style={{ borderRadius: 4 }}>
            <BookingWizard />
          </div>
        </div>
      </div>
    </section>
  );
}
