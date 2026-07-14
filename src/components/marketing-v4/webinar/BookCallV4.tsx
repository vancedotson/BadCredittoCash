"use client";

import { useEffect } from "react";
import { site } from "@/config/site-v3";
import { track, getRememberedLead } from "@/lib/tracking";
import { EVENTS } from "@/lib/events";
import { Kicker, Reveal, SectionScan } from "../../marketing-v3/shared/primitives";
import { useReveal } from "../../marketing-v3/shared/hooks";
import { CheckIcon } from "@/components/marketing-v2/Icons";
import { BookingWizard } from "../book/BookingWizard";

/**
 * /webinar/call — the "offer" page. Left (40%): heading + what the call covers,
 * top-aligned. Right (60%): the shared two-step BookingWizard. Fires
 * call_page_view on load; the wizard handles the rest.
 */
const wb = site.webinar;

const labelStyle = {
  fontSize: 11.5,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  color: "var(--v3-faint)",
};

export function BookCallV4() {
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
          <Kicker>{wb.call.kicker}</Kicker>
          <h1 className="v3-display mt-5" style={{ fontSize: "clamp(34px,5vw,64px)", lineHeight: 1.03 }}>
            {wb.call.heading}
          </h1>
          <p className="mt-6" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 560 }}>
            {wb.call.body}
          </p>

          <div className="mt-8">
            <span className="v3-mono" style={labelStyle}>On the call</span>
            <ul className="mt-3 flex flex-col gap-2.5">
              {wb.call.covers.map((c) => (
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
