"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { site } from "@/config/site-v3";
import { track, getRememberedLead } from "@/lib/tracking";
import { EVENTS, WATCH_MILESTONES } from "@/lib/events";
import { Kicker } from "../../marketing-v3/shared/primitives";
import { ArrowRightIcon } from "@/components/marketing-v2/Icons";
import { WebinarPlayer } from "./WebinarPlayer";

/**
 * /webinar/room — the training itself. Minimal chrome, one job: hold attention
 * and shift belief. The player fires watch-progress events (25/50/75/90 +
 * completed) attributed to the remembered lead. The booking CTA lives in a
 * sticky bottom bar that slides up at the pitch mark (ebook §3.4, "now you know
 * the system, here's the shortcut") and then stays put so it's always one tap
 * away for the rest of the session.
 */
const wb = site.webinar;

export function ReviewableWebinarRoomV4() {
  const reviewState = useSearchParams().get("state");
  const isPlaying = reviewState === "player-playing";
  const isComplete = reviewState === "player-complete";
  const isOfferVisible = reviewState === "offer-visible";
  const reviewProgress =
    reviewState === "player-25"
      ? 0.25
      : reviewState === "player-50"
        ? 0.5
        : reviewState === "player-75"
          ? 0.75
          : reviewState === "player-90"
            ? 0.9
            : null;
  const isReviewMode = reviewState?.startsWith("player-") || reviewState === "offer-visible";

  return (
    <WebinarRoomV4
      key={reviewState ?? "player-default"}
      initialPlaying={isPlaying || reviewProgress !== null}
      initialTimeSec={isComplete ? 35 * 60 : isOfferVisible ? 35 * 60 * 0.7 : reviewProgress !== null ? 35 * 60 * reviewProgress : isPlaying ? 12 : 0}
      initialPitched={isComplete || isOfferVisible}
      reviewMode={Boolean(isReviewMode)}
    />
  );
}

export function WebinarRoomV4({
  initialPlaying = false,
  initialTimeSec = 0,
  initialPitched = false,
  reviewMode = false,
}: {
  initialPlaying?: boolean;
  initialTimeSec?: number;
  initialPitched?: boolean;
  reviewMode?: boolean;
} = {}) {
  const [pitched, setPitched] = useState(initialPitched);

  useEffect(() => {
    if (reviewMode) return;
    track(EVENTS.roomOpened, {}, getRememberedLead()?.email);
  }, [reviewMode]);

  function handleMilestone(pct: number) {
    if (reviewMode) return;
    const m = WATCH_MILESTONES.find((x) => x.pct === pct);
    if (!m) return;
    track(m.event, { pct }, getRememberedLead()?.email);
  }

  function handleComplete() {
    if (reviewMode) return;
    track(EVENTS.completed, {}, getRememberedLead()?.email);
  }

  function handleOfferClick() {
    if (reviewMode) return;
    track(EVENTS.offerCtaClicked, {}, getRememberedLead()?.email);
  }

  return (
    <>
      <section className="v3-section" style={{ paddingTop: "clamp(40px,6vw,80px)", paddingBottom: 120 }}>
        <div className="v3-wrap" style={{ maxWidth: 940 }}>
          <div className="text-center">
            <Kicker>{wb.room.kicker}</Kicker>
            <h1 className="v3-display mt-4" style={{ fontSize: "clamp(28px,4.4vw,52px)", lineHeight: 1.05 }}>
              {wb.room.heading}
            </h1>
            <p className="mt-3" style={{ fontSize: 16, color: "var(--v3-mut)" }}>
              {wb.room.subhead}
            </p>
          </div>

          <div className="mt-8">
            <WebinarPlayer
              title={wb.room.heading}
              chapters={wb.room.chapters}
              initialPlaying={initialPlaying}
              initialTimeSec={initialTimeSec}
              onMilestone={handleMilestone}
              onPitch={() => setPitched(true)}
              onComplete={handleComplete}
            />
          </div>

          {pitched && (
            <aside
              className="v3-corner mt-6"
              role="status"
              style={{
                border: "1px solid color-mix(in srgb, var(--v3-accent) 55%, var(--v3-line))",
                background: "color-mix(in srgb, var(--v3-accent) 8%, var(--v3-panel))",
                padding: "clamp(18px, 3vw, 28px)",
              }}
            >
              <span
                className="v3-mono"
                style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-accent)" }}
              >
                YOUR NEXT STEP
              </span>
              <p className="mt-2" style={{ color: "var(--v3-ink)", fontSize: 17, lineHeight: 1.55 }}>
                {wb.room.pitchCue}
              </p>
            </aside>
          )}

          {/* Optimized bottom: what's inside + the stay-to-the-end hook */}
          <div
            className="mt-8 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center"
            style={{ borderTop: "1px solid var(--v3-line)", paddingTop: 24 }}
          >
            <div>
              <span
                className="v3-mono"
                style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--v3-faint)" }}
              >
                In this training
              </span>
              <div className="mt-3 flex flex-col gap-2">
                {wb.room.chapters.map((c, i) => (
                  <span key={c} style={{ fontSize: 14.5, color: "var(--v3-mut)" }}>
                    <span className="v3-mono" style={{ color: "var(--v3-accent)", marginRight: 8 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <p className="v3-serif-em" style={{ fontSize: 15.5, color: "var(--v3-mut)", maxWidth: 300, lineHeight: 1.5 }}>
              {wb.room.stayHook}
            </p>
          </div>
        </div>
      </section>

      {/* Do not render an invisible link before the offer appears. */}
      {pitched && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
            background: "color-mix(in srgb, var(--v3-bg) 90%, transparent)",
            backdropFilter: "blur(10px)",
            borderTop: "1px solid var(--v3-accent)",
          }}
        >
          <div className="v3-wrap flex items-center justify-between gap-4" style={{ paddingTop: 13, paddingBottom: 13 }}>
            <div className="hidden min-w-0 sm:block">
              <span className="v3-mono" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-accent)" }}>
                THE SHORTCUT
              </span>
              <p style={{ fontSize: 15.5, color: "var(--v3-ink)", lineHeight: 1.3 }}>
                {wb.room.bookBarNote}
              </p>
            </div>
            <Link
              href="/webinar/call"
              onClick={handleOfferClick}
              className="v3-btn v3-btn-primary v3-clip w-full sm:w-auto"
              style={{ paddingLeft: 12, whiteSpace: "nowrap" }}
            >
              <span className="v3-btn-badge">
                <ArrowRightIcon className="h-4 w-4" />
              </span>
              {wb.room.offerCta}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
