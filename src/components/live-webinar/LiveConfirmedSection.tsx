"use client";

import { useEffect } from "react";
import Link from "next/link";
import { liveWebinar } from "@/config/live-webinar";
import { trackLiveEvent } from "@/lib/live-tracking";
import { Kicker, SectionScan, Reveal } from "@/components/marketing-v3/shared/primitives";
import { useReveal } from "@/components/marketing-v3/shared/hooks";
import { CheckIcon } from "@/components/marketing-v2/Icons";
import { Countdown, SourceTime, useEventPhase } from "./EventTime";
import { AddToCalendar } from "./AddToCalendar";
import { UnscheduledNotice, PreviewBanner } from "./UnscheduledNotice";
import { useLiveSession } from "./LiveSessionProvider";

/**
 * /live/confirmed — step 2 of the live funnel, reached from the registration
 * form on /live (redirectTo="/live/confirmed").
 *
 * This is the show-up page. A live registration is only worth something if the
 * person is in the room at one specific moment, so the order is deliberate:
 * calendar first (the only action that survives closing the tab), then where
 * the link comes from, then the replay/advice boundary. Nothing else — the page
 * is deliberately short so the calendar step isn't competing with anything.
 *
 * Wireframe CRO map §07 — "separate registration from attendance": the page
 * explains link delivery without claiming a seat or an email that doesn't
 * exist. It says what actually happened and nothing more.
 */

const C = liveWebinar.confirmed;

function Panel({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`v3-panel v3-corner p-6 sm:p-8 ${className}`} style={{ borderRadius: 4 }}>
      <span
        className="v3-mono"
        style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-accent)" }}
      >
        {label}
      </span>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function ConfirmedBody() {
  const ref = useReveal<HTMLDivElement>();
  const { session, participant, preview, href } = useLiveSession();
  const { phase } = useEventPhase();
  const sessionId = session?.id;
  const registrationId = participant?.registrationId;

  useEffect(() => {
    if (preview || !sessionId || !registrationId) return;
    void trackLiveEvent("webinar_confirmed_view", sessionId);
  }, [preview, sessionId, registrationId]);

  const isOver = phase === "ended";

  return (
    <main className="v3-section" style={{ paddingTop: "clamp(40px,6vw,72px)" }}>
      <SectionScan />
      <div className="v3-wrap" style={{ maxWidth: 860 }} ref={ref}>
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
            <Kicker>{participant || preview ? C.kicker : "YOUR LIVE SESSION"}</Kicker>
          </div>
          <h1 className="v3-display mt-4" style={{ fontSize: "clamp(32px,4.6vw,56px)", lineHeight: 1.05 }}>
            {participant || preview ? C.heading : "Keep your session details handy."}
          </h1>
          <p className="mt-5" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 600 }}>
            {!participant && !preview ? "Open the personal joining link from your confirmation email to reconnect your registration on this device." : isOver ? C.countdown.endedSub : C.sub}
          </p>
        </div>

        {/* Event + countdown */}
        <Reveal>
          <div
            className="mt-10 flex flex-wrap items-center justify-between gap-8 p-6 sm:p-8"
            style={{
              background: "var(--v3-bg2)",
              border: "1px solid var(--v3-line)",
              borderRadius: 4,
            }}
          >
            <div>
              <span
                className="v3-mono"
                style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-faint)" }}
              >
                THE SESSION
              </span>
              <p className="mt-3" style={{ fontSize: 18, color: "var(--v3-ink)", fontWeight: 600 }}>
                <SourceTime />
              </p>
              <p className="mt-1.5" style={{ fontSize: 14, color: "var(--v3-mut)" }}>
                {session?.title}
              </p>
            </div>
            <Countdown />
          </div>
        </Reveal>

        {!isOver ? (
          <>
            {/* 1 — Calendar. The only action that survives closing this tab. */}
            <Reveal>
              <Panel label={C.calendar.label} className="mt-6">
                <AddToCalendar />
                <p className="mt-5" style={{ fontSize: 14.5, color: "var(--v3-mut)", lineHeight: 1.6 }}>
                  {C.calendar.note}
                </p>
              </Panel>
            </Reveal>

            {/* 2 — Where the link comes from. */}
            <Reveal>
              <Panel label={C.nextUp.label} className="mt-6">
                <ol className="flex flex-col">
                  {(participant || preview ? C.nextUp.steps : [
                    { title: "Already registered?", detail: "Use the personal joining link in your confirmation email. It reconnects your registration on this device." },
                    { title: "Still need a seat?", detail: "Register for this session to receive your personal joining details." },
                  ]).map((step, i) => (
                    <li
                      key={step.title}
                      className="flex gap-5 py-6"
                      style={i > 0 ? { borderTop: "1px solid var(--v3-line-soft)" } : undefined}
                    >
                      <span
                        className="v3-mono"
                        style={{ fontSize: 13, color: "var(--v3-accent)", paddingTop: 5, flexShrink: 0 }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h2 className="v3-display" style={{ fontSize: 24, lineHeight: 1.15 }}>
                          {step.title}
                        </h2>
                        <p className="mt-2.5" style={{ fontSize: 17, color: "var(--v3-mut)", lineHeight: 1.6 }}>
                          {step.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                {!participant && !preview ? <Link className="v3-btn v3-btn-primary" href={href("/live")}>Register for this session</Link> : null}
              </Panel>
            </Reveal>

            {/* 3 — The boundary, restated so nobody plans to catch the replay. */}
            <Reveal>
              <Panel label={C.boundary.label} className="mt-6">
                <ul className="flex flex-col gap-3">
                  {C.boundary.lines.map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-3"
                      style={{ fontSize: 14.5, color: "var(--v3-mut)", lineHeight: 1.6 }}
                    >
                      <span style={{ color: "var(--v3-faint)", flexShrink: 0, marginTop: 2 }} aria-hidden>
                        <CheckIcon className="h-5 w-5" />
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </Reveal>
          </>
        ) : (
          /* The session is over. Everything above is gone, so this is the only
             way off the page — without it an ex-registrant lands on a dead end. */
          <Reveal>
            <div className="mt-10 flex flex-wrap gap-3 py-9" style={{ borderTop: "1px solid var(--v3-line)" }}>
              <Link className="v3-btn v3-btn-ghost" href={href("/live/call")}>
                Book a free call
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </main>
  );
}

/**
 * Same gate as /live: placeholder event details must never reach a real
 * calendar. `?preview=1` shows the page behind an explicit banner.
 */
function GatedConfirmed() {
  const { session, preview, loading, error } = useLiveSession();
  if (loading || !session || (!preview && (error || session.status !== "scheduled"))) return <UnscheduledNotice />;
  return (
    <>
      {preview ? <PreviewBanner /> : null}
      <ConfirmedBody />
    </>
  );
}

export function LiveConfirmedSection() {
  return <GatedConfirmed />;
}
