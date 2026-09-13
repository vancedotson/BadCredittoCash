"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { liveWebinar } from "@/config/live-webinar";
import { useLiveSession } from "./LiveSessionProvider";

/**
 * Time-zone handling for the live event (CRO map §06: "remove avoidable
 * time-zone ambiguity"). The stored session start is the source of truth;
 * the source zone stays visible at all times while
 * the selector re-renders the SAME moment in a zone the visitor picks.
 *
 * Rendering starts on the source zone and only switches to the visitor's
 * detected zone after mount, so the server and first client paint agree.
 */

const COMMON_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Africa/Lagos",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function detectZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone || null;
  } catch {
    return null;
  }
}

export function formatInZone(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    // An unknown zone must never blank the time out — state UTC explicitly.
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  }
}

/**
 * The source time, stated plainly. Never changes with the selector.
 *
 * `showDuration` defaults to true so the registration and confirmation pages are
 * unchanged. The room passes false — once you're in the room, how long the
 * session runs is noise.
 */
export function SourceTime({ showDuration = true }: { showDuration?: boolean } = {}) {
  const { session } = useLiveSession();
  if (!session) return null;
  const { startsAt, timezone: sourceTimeZone } = session;
  const durationMinutes = Math.round((new Date(session.endsAt).getTime() - new Date(startsAt).getTime()) / 60_000);
  return (
    <>
      {formatInZone(startsAt, sourceTimeZone)}
      {showDuration ? ` · ${durationMinutes} minutes` : null}
    </>
  );
}

/* ---------------------------------------------------------------- countdown */

/**
 * A single shared 1s ticker. `now` is cached between ticks so getSnapshot
 * returns a stable value within a render — returning Date.now() directly would
 * hand React a new value every call and loop forever.
 */
let sharedNow = 0;
const tickListeners = new Set<() => void>();
let tickTimer: ReturnType<typeof setInterval> | null = null;

function subscribeToTick(onChange: () => void) {
  if (sharedNow === 0) sharedNow = Date.now();
  tickListeners.add(onChange);
  if (!tickTimer) {
    tickTimer = setInterval(() => {
      sharedNow = Date.now();
      for (const listener of tickListeners) listener();
    }, 1000);
  }
  return () => {
    tickListeners.delete(onChange);
    if (tickListeners.size === 0 && tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };
}

/** 0 on the server and until the first subscription — meaning "not ticking yet". */
const getNow = () => sharedNow;
const getServerNow = () => 0;

export function useLiveClock() {
  return useSyncExternalStore(subscribeToTick, getNow, getServerNow);
}

export type EventPhase = "before" | "live" | "ended" | "pending";

export function useEventPhase(): { phase: EventPhase; msUntilStart: number } {
  const now = useLiveClock();
  const { session } = useLiveSession();
  if (!session) return { phase: "pending", msUntilStart: 0 };
  const start = new Date(session.startsAt).getTime();
  const end = new Date(session.endsAt).getTime();

  if (now === 0) return { phase: "pending", msUntilStart: 0 };
  if (now >= end) return { phase: "ended", msUntilStart: 0 };
  if (now >= start) return { phase: "live", msUntilStart: 0 };
  return { phase: "before", msUntilStart: start - now };
}

function splitDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/**
 * Live countdown to the session. Renders a neutral placeholder on the server and
 * for the first paint, then ticks. Handles the event being in progress or over
 * rather than counting into negative numbers.
 */
export function Countdown() {
  const { phase, msUntilStart } = useEventPhase();

  if (phase === "live" || phase === "ended") {
    return (
      <p style={{ fontSize: 16, color: "var(--v3-accent)", fontWeight: 600 }}>
        {phase === "live"
          ? liveWebinar.confirmed.countdown.live
          : liveWebinar.confirmed.countdown.ended}
      </p>
    );
  }

  const { days, hours, minutes, seconds } = splitDuration(msUntilStart);
  const units: Array<[number, string]> = [
    [days, "days"],
    [hours, "hrs"],
    [minutes, "min"],
    [seconds, "sec"],
  ];

  return (
    <div>
      <span
        className="v3-mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--v3-faint)",
        }}
      >
        {liveWebinar.confirmed.countdown.label}
      </span>
      <div
        className="mt-3 flex gap-6"
        role="timer"
        aria-live="off"
        aria-label={
          phase === "pending"
            ? "Time until the session starts"
            : `${days} days, ${hours} hours, ${minutes} minutes until the session starts`
        }
      >
        {units.map(([value, unit]) => (
          <div key={unit}>
            <div className="v3-display" style={{ fontSize: 34, lineHeight: 1, color: "var(--v3-ink)" }}>
              {phase === "pending" ? "--" : String(value).padStart(2, "0")}
            </div>
            <div
              className="v3-mono mt-1.5"
              style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--v3-faint)" }}
            >
              {unit.toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- zone handling */

/**
 * The visitor's own zone, read hydration-safely: the server (and the first
 * client paint) see the source zone, and the detected zone takes over on
 * hydration. The value never changes afterwards, so there is nothing to
 * subscribe to.
 */
const NO_SUBSCRIBE = () => () => {};

function useDetectedZone(sourceTimeZone: string): string {
  return useSyncExternalStore(
    NO_SUBSCRIBE,
    () => detectZone() ?? sourceTimeZone,
    () => sourceTimeZone,
  );
}

/**
 * Zone selector + the same moment re-stated. Shown next to, never instead of,
 * the source time.
 */
export function TimeZonePicker() {
  const { session, timezone, setTimezone } = useLiveSession();
  const sourceTimeZone = session?.timezone ?? "UTC";
  const detectedZone = useDetectedZone(sourceTimeZone);
  // null until the visitor picks one themselves; their choice always wins.
  const [chosenZone, setChosenZone] = useState<string | null>(null);
  const zone = chosenZone ?? (timezone || detectedZone);
  const setZone = (value: string) => { setChosenZone(value); setTimezone(value); };

  const zones = useMemo(() => {
    const detected = detectZone();
    const all = new Set([sourceTimeZone, ...COMMON_ZONES]);
    if (detected) all.add(detected);
    return [...all].sort();
  }, [sourceTimeZone]);

  const label = "live-event-timezone";
  if (!session) return null;

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={label}
        className="v3-mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--v3-faint)",
        }}
      >
        Show this in a time zone
      </label>
      <select
        id={label}
        value={zone}
        onChange={(e) => setZone(e.target.value)}
        className="v4-booking-input"
        style={{ width: "100%", maxWidth: 340, minHeight: 44 }}
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <p style={{ fontSize: 14, color: "var(--v3-mut)" }}>
        That&rsquo;s{" "}
        <strong style={{ color: "var(--v3-ink)", fontWeight: 600 }}>
          {formatInZone(session.startsAt, zone)}
        </strong>{" "}
        where you are. Same moment — only the clock changes.
      </p>
    </div>
  );
}
