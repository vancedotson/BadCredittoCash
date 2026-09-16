"use client";

import { site } from "@/config/site-v3";
import { Kicker } from "@/components/marketing-v3/shared/primitives";
import { LiveSessionLoading, useLiveSession } from "./LiveSessionProvider";

/**
 * Rendered when no published session is available from the server.
 *
 * The wireframe library is explicit that a fictional date must never be shown
 * as a real event, and the page config currently holds placeholder logistics.
 * Rather than publish a plausible-looking registration form for an event that
 * has not been scheduled — which would collect real emails against a promise
 * nobody can keep — the route says so plainly and sends visitors to the
 * evergreen training that does exist.
 *
 * Scheduling and publication are managed through the CRM.
 */
export function UnscheduledNotice() {
  const { loading, error, session } = useLiveSession();
  if (loading) return <LiveSessionLoading />;
  if (error || session?.status === "cancelled") {
    return <main className="v3-wrap" style={{ paddingTop: 72, paddingBottom: 120, maxWidth: 720 }}>
      <Kicker>{error ? "SESSION DETAILS UNAVAILABLE" : "SESSION CANCELLED"}</Kicker>
      <h1 className="v3-display mt-5" style={{ fontSize: 40 }}>
        {error ? "We couldn't load this session." : "This session has been cancelled."}
      </h1>
      <p className="mt-6" role={error ? "alert" : undefined} style={{ color: "var(--v3-mut)", lineHeight: 1.6 }}>
        {error ?? "Check your email for the latest update."}
      </p>
    </main>;
  }
  return (
    <main className="v3-wrap" style={{ paddingTop: 72, paddingBottom: 120, maxWidth: 720 }}>
      <Kicker>NO SESSION SCHEDULED</Kicker>
      <h1 className="v3-display mt-5" style={{ fontSize: "clamp(32px,5vw,56px)", lineHeight: 1.05 }}>
        The next live session
        <br />
        <span style={{ color: "var(--v3-accent)" }}>isn&rsquo;t on the calendar yet.</span>
      </h1>
      <p className="mt-6" style={{ fontSize: 17, color: "var(--v3-mut)", lineHeight: 1.6 }}>
        Rather than take your email for a date that doesn&rsquo;t exist, here&rsquo;s the
        thing that does: the free on-demand training covers the same ground and you
        can watch it right now.
      </p>

      <p className="v3-mono mt-10" style={{ fontSize: 11.5, color: "var(--v3-faint)", lineHeight: 1.8 }}>
        &gt; {site.ev.fileNo}
        <br />
        &gt; status: live session not yet scheduled
      </p>

    </main>
  );
}

/** Banner shown across the top of the page when it is being previewed unscheduled. */
export function PreviewBanner() {
  return (
    <div
      style={{
        background: "var(--v3-accent)",
        color: "#0b0c0e",
        padding: "10px 16px",
        textAlign: "center",
        fontSize: 12.5,
        letterSpacing: "0.06em",
        fontWeight: 600,
      }}
    >
      PREVIEW — for review only. Registration, booking, questions, and tracking are disabled.
    </div>
  );
}
