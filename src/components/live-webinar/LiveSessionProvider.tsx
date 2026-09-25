"use client";

import { createContext, Suspense, useContext, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { liveWebinar } from "@/config/live-webinar";
import type { PublicLiveWebinarSession } from "@/lib/live-webinar-types";

type SessionContext = {
  session: PublicLiveWebinarSession | null;
  participant: { registrationId: string; sessionId: string } | null;
  loading: boolean;
  error: string | null;
  preview: boolean;
  timezone: string;
  setTimezone: (timezone: string) => void;
  href: (path: string) => string;
};

const Context = createContext<SessionContext | null>(null);

function SessionProvider({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const requestedSession = params.get("session");
  const preview = params.get("preview") === "1" || params.has("state");
  const [result, setResult] = useState<{
    requested: string | null;
    session: PublicLiveWebinarSession | null;
    participant: SessionContext["participant"];
    error: string | null;
  } | null>(null);
  const [timezone, setTimezone] = useState("");
  const selectedSession = useRef<string | null>(requestedSession);

  useEffect(() => {
    const controller = new AbortController();
    let requestVersion = 0;
    selectedSession.current = requestedSession;
    const refresh = async () => {
      const version = ++requestVersion;
      try {
        const query = selectedSession.current
          ? `?${new URLSearchParams({ session: selectedSession.current })}`
          : "";
        const response = await fetch(`/api/live/session${query}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Session details could not be loaded. Please refresh and try again.");
        const payload = await response.json() as Pick<SessionContext, "session" | "participant">;
        if (controller.signal.aborted || version !== requestVersion) return;
        if (payload.session) selectedSession.current = payload.session.id;
        setResult({ requested: requestedSession, session: payload.session, participant: payload.participant, error: null });
      } catch (error) {
        if (controller.signal.aborted || version !== requestVersion) return;
        // Keep drafts mounted through a transient refresh failure. A successful
        // response (including null, cancellation, or revoked participation) still
        // replaces this snapshot, and the server validates every submitted action.
        setResult((previous) => previous?.requested === requestedSession && previous.session
          ? previous
          : { requested: requestedSession, session: null, participant: null,
            error: error instanceof Error ? error.message : "Session details could not be loaded." });
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 60_000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [requestedSession]);

  const current = result?.requested === requestedSession ? result : null;
  const session: PublicLiveWebinarSession | null = current?.session ?? (preview ? {
    id: "preview", slug: "preview", title: liveWebinar.confirmed.calendar.eventTitle,
    startsAt: liveWebinar.event.startsAt,
    endsAt: new Date(new Date(liveWebinar.event.startsAt).getTime() + liveWebinar.event.durationMinutes * 60_000).toISOString(),
    timezone: liveWebinar.event.sourceTimeZone, status: "scheduled", embedUrl: null,
    replayUrl: null, replayPublished: false, replayAvailableUntil: null,
    automationEnabled: false, scheduleVersion: 1,
  } : null);

  function href(path: string) {
    const url = new URL(path, "https://live.local");
    const id = current?.session?.id ?? requestedSession;
    if (id) url.searchParams.set("session", id);
    if (preview) url.searchParams.set("preview", "1");
    return `${url.pathname}${url.search}${url.hash}`;
  }

  return <Context.Provider value={{ session, participant: current?.participant ?? null,
    loading: !current && !preview, error: current?.error ?? null, preview, timezone, setTimezone, href }}>
    {children}
  </Context.Provider>;
}

export function LiveSessionLoading() {
  return <main className="v3-wrap" style={{ paddingTop: 72, paddingBottom: 120 }}>
    <p role="status" style={{ color: "var(--v3-mut)" }}>Loading session details…</p>
  </main>;
}

export function LiveSessionProvider({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LiveSessionLoading />}><SessionProvider>{children}</SessionProvider></Suspense>;
}

export function useLiveSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Live session components require LiveSessionProvider.");
  return value;
}

export function sessionReplayAvailable(session: PublicLiveWebinarSession | null, now: number) {
  void session;
  void now;
  return false;
}
