"use client";

import { useEffect } from "react";
import { liveWebinar } from "@/config/live-webinar";
import { trackLiveEvent } from "@/lib/live-tracking";
import { Kicker, SectionScan } from "@/components/marketing-v3/shared/primitives";
import { useReveal } from "@/components/marketing-v3/shared/hooks";
import { CheckIcon } from "@/components/marketing-v2/Icons";
import { BookingWizard } from "@/components/marketing-v4/book/BookingWizard";
import { LiveSessionLoading, useLiveSession } from "./LiveSessionProvider";
import { PreviewBanner, UnscheduledNotice } from "./UnscheduledNotice";

/**
 * /live/call — step 4 of the live funnel. The offer, taken off the live session.
 *
 * Reuses the shared two-step BookingWizard so the booking experience is
 * identical to /webinar/call and /book — same slot availability, same intake
 * questions, same /api/book write into the CRM. Only the surrounding copy is
 * different, and it lives in `liveWebinar.call`.
 *
 * This page is NOT gated on `isScheduled`. A booking is a real thing that works
 * whether or not a live session is on the calendar, so gating it would refuse
 * genuine leads for no reason. Nothing here references the event's date.
 */

const C = liveWebinar.call;

const labelStyle = {
  fontSize: 10,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  color: "var(--v3-faint)",
};

export function LiveBookCallSection() {
  const ref = useReveal<HTMLDivElement>();
  const { session, participant, preview, loading, error, href } = useLiveSession();
  const sessionId = session?.id;
  const registrationId = participant?.registrationId;

  useEffect(() => {
    if (preview || !sessionId || !registrationId) return;
    void trackLiveEvent("call_page_view", sessionId);
  }, [preview, sessionId, registrationId]);

  if (loading) return <LiveSessionLoading />;
  if (error && !preview) return <UnscheduledNotice />;

  return (
    <section className="v3-section" style={{ paddingTop: "clamp(40px,6vw,84px)" }}>
      {preview ? <PreviewBanner /> : null}
      <SectionScan />
      {/* Three blocks, same pattern as /live: on mobile the booking card sits
          directly under the heading, and from lg up the supporting detail moves
          back beneath the heading in the left column. */}
      <div className="v3-wrap grid items-start gap-x-12 gap-y-8 lg:grid-cols-2" ref={ref}>
        <div className="lg:col-start-1 lg:row-start-1">
          <Kicker>{C.kicker}</Kicker>
          <h1 className="v3-display mt-5" style={{ fontSize: "clamp(34px,5vw,64px)", lineHeight: 1.03 }}>
            {C.heading}
          </h1>
          <p className="mt-6" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 560 }}>
            {C.body}
          </p>
        </div>

        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <BookingWizard key={preview ? "preview" : sessionId ?? "direct"} redirectTo={href("/live/booked")} funnel="live" sessionId={preview ? undefined : sessionId} disabledPreview={preview} />
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <span className="v3-mono" style={labelStyle}>
            What the call covers
          </span>
          <ul className="mt-5 flex flex-col gap-4">
            {C.covers.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3"
                style={{ fontSize: 16, color: "var(--v3-mut)", lineHeight: 1.6 }}
              >
                <span style={{ color: "var(--v3-accent)", flexShrink: 0, marginTop: 3 }} aria-hidden>
                  <CheckIcon className="h-5 w-5" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-2.5">
            {C.facts.map((fact) => (
              <span
                key={fact}
                className="v3-mono"
                style={{
                  border: "1px solid var(--v3-line)",
                  borderRadius: 999,
                  padding: "6px 14px",
                  fontSize: 12.5,
                  letterSpacing: "0.06em",
                  color: "var(--v3-mut)",
                }}
              >
                {fact}
              </span>
            ))}
          </div>

          <div
            className="mt-8 p-6"
            style={{ border: "1px solid var(--v3-line-soft)", borderRadius: 4 }}
          >
            <span className="v3-mono" style={{ ...labelStyle, color: "var(--v3-accent)" }}>
              Nothing to lose by looking
            </span>
            <ul className="mt-4 flex flex-col gap-2.5">
              {C.reassurance.map((line) => (
                <li key={line} style={{ fontSize: 14.5, color: "var(--v3-mut)", lineHeight: 1.55 }}>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-6" style={{ fontSize: 13.5, color: "var(--v3-faint)" }}>
            {C.note}
          </p>
        </div>
      </div>
    </section>
  );
}
