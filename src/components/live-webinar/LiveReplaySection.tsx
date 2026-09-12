"use client";

import { useEffect } from "react";
import Link from "next/link";
import { liveWebinar } from "@/config/live-webinar";
import { trackLiveEvent } from "@/lib/live-tracking";
import { Kicker, SectionScan } from "@/components/marketing-v3/shared/primitives";
import { useReveal } from "@/components/marketing-v3/shared/hooks";
import { formatInZone, useLiveClock } from "./EventTime";
import { sessionReplayAvailable, useLiveSession } from "./LiveSessionProvider";
import { PreviewBanner, UnscheduledNotice } from "./UnscheduledNotice";

/**
 * /live/replay — the optional recording, for no-shows and late registrants.
 *
 * Three states, and which one shows is driven entirely by config:
 *   - no recording exists (`replay.isPublished` false) → says so plainly
 *   - published and inside its window → plays
 *   - published but past `availableUntil` → closed
 *
 * The expiry is enforced here, not just asserted in copy: once the deadline
 * passes the player stops rendering. If the page said "48 hours only" and kept
 * playing forever, the claim would be false — and the next scarcity claim
 * wouldn't be believed either.
 *
 * Turning `replay.isPublished` on also strips the "no replay is promised" lines
 * from /live and /live/confirmed automatically — see the replay seam in the
 * config. Nothing needs editing in three places.
 */

const R = liveWebinar.replay;

function Shell({
  kicker,
  heading,
  sub,
  children,
}: {
  kicker: string;
  heading: string;
  sub: string;
  children?: React.ReactNode;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <main className="v3-section" style={{ paddingTop: "clamp(40px,6vw,72px)" }}>
      <SectionScan />
      <div className="v3-wrap" style={{ maxWidth: 900 }} ref={ref}>
        <Kicker>{kicker}</Kicker>
        <h1 className="v3-display mt-5" style={{ fontSize: "clamp(32px,5vw,56px)", lineHeight: 1.05 }}>
          {heading}
        </h1>
        <p className="mt-5" style={{ fontSize: 17, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 620 }}>
          {sub}
        </p>
        {children}
      </div>
    </main>
  );
}

function FallbackLinks() {
  const { href } = useLiveSession();
  return (
    <div className="mt-9 flex flex-wrap gap-3">
      <Link className="v3-btn v3-btn-primary" href="/#register">
        Watch the free training
      </Link>
      <Link className="v3-btn v3-btn-ghost" href={href(R.cta.href)}>
        {R.cta.buttonLabel}
      </Link>
    </div>
  );
}

function Player() {
  const { session } = useLiveSession();
  if (!session?.replayUrl) {
    return (
      <div
        className="mt-8 grid place-items-center p-8 text-center"
        style={{
          aspectRatio: "16 / 9",
          width: "100%",
          background: "var(--v3-bg2)",
          border: "1px dashed var(--v3-line)",
          borderRadius: 4,
        }}
      >
        <div style={{ maxWidth: 440 }}>
          <span
            className="v3-mono"
            style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-accent)" }}
          >
            RECORDING NOT CONNECTED
          </span>
          <p className="mt-4" style={{ fontSize: 14.5, color: "var(--v3-mut)", lineHeight: 1.6 }}>
            The recording is not available yet. Check your email for updates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mt-8"
      style={{
        aspectRatio: "16 / 9",
        width: "100%",
        background: "#000",
        border: "1px solid var(--v3-line)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <iframe
        src={session.replayUrl}
        title={`${session.title} — replay`}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
    </div>
  );
}

function Expiry() {
  const { session } = useLiveSession();
  if (!session?.replayAvailableUntil) return null;
  return (
    <p className="v3-mono mt-5" style={{ fontSize: 12, color: "var(--v3-accent)" }}>
      {R.expiryLabel}: {formatInZone(session.replayAvailableUntil, session.timezone)}
    </p>
  );
}

function CallCta() {
  const { href } = useLiveSession();
  return (
    <div
      className="mt-8 flex flex-wrap items-center justify-between gap-6 p-6 sm:p-8"
      style={{ border: "1px solid var(--v3-line)", borderRadius: 4 }}
    >
      <div>
        <h2 className="v3-display" style={{ fontSize: "clamp(21px,2.4vw,28px)", lineHeight: 1.1 }}>
          {R.cta.heading}
        </h2>
        <p className="mt-2.5" style={{ fontSize: 15, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 520 }}>
          {R.cta.sub}
        </p>
      </div>
      <Link className="v3-btn v3-btn-primary" href={href(R.cta.href)} style={{ minHeight: 44 }}>
        {R.cta.buttonLabel}
      </Link>
    </div>
  );
}

export function LiveReplaySection() {
  const { session, participant, preview, loading, error } = useLiveSession();
  const now = useLiveClock();
  const watchable = now > 0 && sessionReplayAvailable(session, now);
  const sessionId = session?.id;
  const registrationId = participant?.registrationId;
  useEffect(() => {
    if (watchable && !preview && sessionId && registrationId) void trackLiveEvent("live_replay_opened", sessionId);
  }, [watchable, preview, sessionId, registrationId]);

  if (loading || !session || (!preview && (error || session.status !== "scheduled"))) return <UnscheduledNotice />;

  // No recording exists at all — the honest default.
  if (!session.replayPublished || !session.replayUrl || (now > 0 && now < Date.parse(session.endsAt))) {
    return (
      <Shell kicker={R.unavailable.kicker} heading="No recording is posted yet." sub="A replay is not currently available for this session. You can watch the on-demand training or book a free call.">
        {preview ? <PreviewBanner /> : null}
        <FallbackLinks />
      </Shell>
    );
  }

  // Published, but the stated window has passed.
  if (now > 0 && !watchable) {
    return (
      <Shell kicker={R.expiredKicker} heading={R.expiredHeading} sub={R.expiredSub}>
        <FallbackLinks />
      </Shell>
    );
  }

  // Published and inside the window (or still deciding on the first paint —
  // the player is the safe thing to show while `watchable` is null).
  return (
    <Shell kicker={R.kicker} heading={R.heading} sub={R.sub}>
      {preview ? <PreviewBanner /> : null}
      {watchable ? <Player /> : <p className="mt-6" role="status">Checking replay availability…</p>}
      <Expiry />
      <CallCta />
    </Shell>
  );
}
