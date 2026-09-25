"use client";

import Link from "next/link";
import { Kicker } from "@/components/marketing-v3/shared/primitives";
import { UnscheduledNotice, PreviewBanner } from "./UnscheduledNotice";
import { useLiveSession } from "./LiveSessionProvider";
import { useEventPhase } from "./EventTime";
import { LiveRegisterV1 } from "./registration/LiveRegisterV1";

/**
 * /live — step 1 of the live webinar funnel: the registration page.
 *
 * The session's subject is collector conduct under the FDCPA — what a collector
 * is not allowed to do and how to respond — NOT reading a credit report.
 *
 * Layout is the "Value + Form" recipe from the funnel wireframe encyclopedia
 * (v4) entry "Webinar / Masterclass Registration Page" — see
 * ./registration/LiveRegisterV1.tsx and `registrationPage` in
 * src/config/live-webinar.ts.
 */

function RegistrationPage({ preview }: { preview: boolean }) {
  return (
    <main>
      {preview ? <PreviewBanner /> : null}
      <LiveRegisterV1 />
    </main>
  );
}

/**
 * Gate: the real page only renders once a session is scheduled in the CRM.
 * `?preview=1` lets the team review the finished page before that, behind an
 * explicit banner so a placeholder date is never mistaken for a real one.
 */
function GatedRegistrationPage() {
  const { session, preview, loading, error, href } = useLiveSession();
  const { phase } = useEventPhase();
  if (loading || !session || (!preview && (error || session.status !== "scheduled"))) return <UnscheduledNotice />;
  if (!preview && phase === "ended") {
    return <main className="v3-wrap" style={{ paddingTop: 72, paddingBottom: 120, maxWidth: 720 }}>
      <Kicker>SESSION ENDED</Kicker>
      <h1 className="v3-display mt-5" style={{ fontSize: 40 }}>This session has ended.</h1>
      <p className="mt-6" style={{ color: "var(--v3-mut)" }}>Registration for {session.title} is closed.</p>
      <div className="mt-8 flex flex-wrap gap-4">
        <Link className="v3-btn v3-btn-ghost" href={href("/live/call")}>Book a free call</Link>
      </div>
    </main>;
  }
  return <RegistrationPage preview={preview} />;
}

export function LiveRegisterSection() {
  return <GatedRegistrationPage />;
}
