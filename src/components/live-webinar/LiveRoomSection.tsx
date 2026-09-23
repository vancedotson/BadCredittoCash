"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { liveWebinar } from "@/config/live-webinar";
import { trackLiveEvent } from "@/lib/live-tracking";
import { Kicker, SectionScan } from "@/components/marketing-v3/shared/primitives";
import { Countdown, SourceTime, useEventPhase, useLiveClock } from "./EventTime";
import { UnscheduledNotice, PreviewBanner } from "./UnscheduledNotice";
import { sessionReplayAvailable, useLiveSession } from "./LiveSessionProvider";

/**
 * /live/room — step 3. The session itself.
 *
 * Deliberately sparse: a stage and a question box, nothing else competing with
 * the stream. The page has three states, because a live URL gets opened at the
 * wrong time constantly — too early (countdown, auto-opens), live (stage + Q&A),
 * and over (honest wrap, no fake replay).
 *
 * The Q&A is one-way by design. See `room.qa` in the config for why a public
 * chat is the wrong shape for this particular subject.
 */

const R = liveWebinar.room;

/* --------------------------------------------------------------- the stage */

function Stage() {
  const { session } = useLiveSession();
  if (!session?.embedUrl) {
    return (
      <div
        className="grid place-items-center p-8 text-center"
        style={{
          aspectRatio: "16 / 9",
          width: "100%",
          background: "var(--v3-bg2)",
          border: "1px dashed var(--v3-line)",
          borderRadius: 4,
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <span
            className="v3-mono"
            style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-accent)" }}
          >
            {R.stagePlaceholder.label}
          </span>
          <p className="mt-4" style={{ fontSize: 14.5, color: "var(--v3-mut)", lineHeight: 1.6 }}>
            The stream is not connected yet. Please keep this page open and check your email for updates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
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
        src={session.embedUrl}
        title={session.title}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ the Q&A */

type SentQuestion = { id: string; text: string };

function QuestionBox() {
  const { session, participant, preview } = useLiveSession();
  const [text, setText] = useState("");
  const [sent, setSent] = useState<SentQuestion[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<{ id: string; text: string } | null>(null);
  const sending = useRef(false);

  const trimmed = text.trim();
  const canSend = trimmed.length > 1 && status !== "sending" && !preview && Boolean(participant && session);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend || sending.current || !session || !participant) return;
    const question = trimmed.slice(0, R.qa.maxLength);
    if (pending.current?.text !== question) pending.current = { id: crypto.randomUUID(), text: question };
    const submissionId = pending.current.id;
    sending.current = true;
    setStatus("sending");
    try {
      const saved = await trackLiveEvent("live_question_asked", session.id, { question }, submissionId);
      if (!saved) throw new Error("Question could not be saved.");
      setSent((prev) => [...prev, { id: submissionId, text: question }]);
      pending.current = null;
      setText("");
      setStatus("idle");
      inputRef.current?.focus();
    } catch {
      setStatus("error");
    } finally {
      sending.current = false;
    }
  }

  return (
    <div className="v3-panel v3-corner p-6" style={{ borderRadius: 4 }}>
      <span
        className="v3-mono"
        style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-accent)" }}
      >
        {R.qa.label}
      </span>

      <form onSubmit={handleSubmit} className="mt-5">
        <label htmlFor="live-question" className="sr-only">
          {R.qa.label}
        </label>
        <textarea
          id="live-question"
          ref={inputRef}
          value={text}
          disabled={preview || !participant || status === "sending"}
          onChange={(e) => setText(e.target.value)}
          maxLength={R.qa.maxLength}
          rows={4}
          placeholder={R.qa.placeholder}
          className="v4-registration-input w-full rounded-sm px-4 py-3 outline-none"
          style={{
            background: "rgba(0,0,0,0.35)",
            border: "1px solid var(--v3-line)",
            color: "var(--v3-ink)",
            fontFamily: "var(--v3-mono)",
            fontSize: 14.5,
            resize: "vertical",
          }}
        />
        <div className="mt-3 flex items-center justify-between gap-4">
          <span className="v3-mono" style={{ fontSize: 11, color: "var(--v3-faint)" }}>
            {trimmed.length}/{R.qa.maxLength}
          </span>
          <button
            type="submit"
            disabled={!canSend}
            className="v3-btn v3-btn-primary"
            style={{ minHeight: 44, opacity: canSend ? 1 : 0.5 }}
          >
            {status === "sending" ? R.qa.sendingLabel : R.qa.submitLabel}
          </button>
        </div>
        {status === "error" ? (
          <p className="mt-3" role="alert" style={{ fontSize: 13.5, color: "var(--v3-danger)" }}>
            {R.qa.errorText}
          </p>
        ) : null}
      </form>

      {!participant && !preview ? <p className="mt-4" style={{ fontSize: 14, color: "var(--v3-mut)", lineHeight: 1.6 }}>
        To send a question, open your personal joining link from the confirmation email on this device.
      </p> : null}

      <p className="mt-5" style={{ fontSize: 13, color: "var(--v3-faint)", lineHeight: 1.6 }}>
        {R.qa.note}
      </p>

      {sent.length > 0 ? (
        <div className="mt-6" aria-live="polite">
          <span
            className="v3-mono"
            style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-faint)" }}
          >
            {R.qa.sentHeading}
          </span>
          <ul className="mt-3 flex flex-col gap-3">
            {sent.map((q) => (
              <li
                key={q.id}
                className="flex items-start gap-3 py-2"
                style={{ borderTop: "1px solid var(--v3-line-soft)" }}
              >
                <span
                  className="v3-mono"
                  style={{ fontSize: 10, color: "var(--v3-accent)", paddingTop: 4, flexShrink: 0 }}
                >
                  {R.qa.sentLabel.toUpperCase()}
                </span>
                <span style={{ fontSize: 14.5, color: "var(--v3-mut)", lineHeight: 1.55 }}>
                  {q.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------- the three states */

function EarlyState() {
  return (
    <div className="v3-wrap" style={{ maxWidth: 680, paddingTop: 64, paddingBottom: 120 }}>
      <Kicker>{R.early.kicker}</Kicker>
      <h1 className="v3-display mt-5" style={{ fontSize: "clamp(32px,5vw,56px)", lineHeight: 1.05 }}>
        {R.early.heading}
      </h1>
      <p className="mt-5" style={{ fontSize: 17, color: "var(--v3-mut)", lineHeight: 1.6 }}>
        {R.early.sub}
      </p>
      <p className="mt-7" style={{ fontSize: 16, color: "var(--v3-ink)", fontWeight: 600 }}>
        <SourceTime showDuration={false} />
      </p>
      <div className="mt-8">
        <Countdown />
      </div>
    </div>
  );
}

function EndedState() {
  // When a replay actually exists, that's the most useful next step and the
  // "no replay was promised" line would be wrong. Both follow the one flag.
  const { session, href } = useLiveSession();
  const now = useLiveClock();
  const hasReplay = sessionReplayAvailable(session, now);
  return (
    <div className="v3-wrap" style={{ maxWidth: 680, paddingTop: 64, paddingBottom: 120 }}>
      <Kicker>{R.ended.kicker}</Kicker>
      <h1 className="v3-display mt-5" style={{ fontSize: "clamp(32px,5vw,56px)", lineHeight: 1.05 }}>
        {R.ended.heading}
      </h1>
      <p className="mt-5" style={{ fontSize: 17, color: "var(--v3-mut)", lineHeight: 1.6 }}>
        {hasReplay ? R.ended.subWithReplay : R.ended.sub}
      </p>
      <div className="mt-9 flex flex-wrap gap-3">
        {hasReplay ? (
          <Link className="v3-btn v3-btn-primary" href={href("/live/replay")}>
            Watch the replay
          </Link>
        ) : null}
        <Link
          className={hasReplay ? "v3-btn v3-btn-ghost" : "v3-btn v3-btn-primary"}
          href={href(R.cta.href)}
        >
          {R.cta.buttonLabel}
        </Link>
      </div>
    </div>
  );
}

function LiveState() {
  const { session, participant, preview } = useLiveSession();
  const { phase } = useEventPhase();
  const sessionId = session?.id;
  const registrationId = participant?.registrationId;
  const startsAt = session?.startsAt;
  const endsAt = session?.endsAt;
  const embedUrl = session?.embedUrl;

  useEffect(() => {
    if (preview || !sessionId || !registrationId) return;
    void trackLiveEvent("webinar_room_opened", sessionId);
  }, [preview, sessionId, registrationId]);

  useEffect(() => {
    if (preview || !sessionId || !registrationId || !embedUrl || !startsAt || !endsAt || phase !== "live") return;
    const presence = () => {
      const now = Date.now();
      if (document.visibilityState === "visible" && now >= Date.parse(startsAt) && now < Date.parse(endsAt)) {
        void trackLiveEvent("live_presence", sessionId, { evidence: "visible_room" });
      }
    };
    presence();
    const timer = setInterval(presence, 60_000);
    document.addEventListener("visibilitychange", presence);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", presence); };
  }, [preview, sessionId, registrationId, startsAt, endsAt, embedUrl, phase]);

  return (
    <div className="v3-wrap" style={{ paddingTop: 32, paddingBottom: 96 }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "var(--v3-danger)",
              display: "inline-block",
            }}
          />
          <span
            className="v3-mono"
            style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--v3-danger)" }}
          >
            {phase === "live" ? "LIVE NOW" : "DOORS OPEN — STARTING SOON"}
          </span>
        </div>
      </div>

      <h1 className="v3-display mt-5" style={{ fontSize: "clamp(26px,3.4vw,40px)", lineHeight: 1.05 }}>
        {session?.title ?? R.heading}
      </h1>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <Stage />
        <QuestionBox key={`${sessionId}:${registrationId}`} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- gating */

function RoomBody() {
  const { phase, msUntilStart } = useEventPhase();

  // "pending" is the server render and first paint, before the ticker starts.
  // Show the early state rather than guessing — it never claims the session is
  // live when it isn't.
  if (phase === "pending") return <EarlyState />;
  if (phase === "ended") return <EndedState />;
  if (phase === "live") return <LiveState />;

  const doorsOpen = msUntilStart <= R.doorsOpenMinutes * 60_000;
  return doorsOpen ? <LiveState /> : <EarlyState />;
}

function GatedRoom() {
  const { session, preview, loading, error } = useLiveSession();
  if (loading || !session || (!preview && (error || session.status !== "scheduled"))) return <UnscheduledNotice />;
  return (
    <main>
      {preview ? <PreviewBanner /> : null}
      <SectionScan />
      <RoomBody />
    </main>
  );
}

export function LiveRoomSection() {
  return <GatedRoom />;
}
