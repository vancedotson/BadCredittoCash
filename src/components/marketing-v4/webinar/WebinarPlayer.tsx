"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlayIcon } from "@/components/marketing-v2/Icons";
import { WATCH_MILESTONES } from "@/lib/events";

/**
 * Placeholder webinar player. There's no real recording yet (that's Vance's to
 * produce), so this simulates playback on a short demo timeline while firing the
 * SAME watch-progress signals a real <video> would: it calls `onMilestone` as
 * playback crosses 25/50/75/90 percent, `onPitch` at the transition mark (so the
 * room can reveal its CTA exactly where the script pitches), and `onComplete` at
 * the end. The progress bar is seekable so the funnel can be walked quickly;
 * seeking forward fires any milestones it passes, just like scrubbing a video.
 *
 * Swap the body for a real player later (fire the same callbacks from the
 * <video> `timeupdate`/`ended` events) and nothing downstream changes.
 */
type WebinarPlayerProps = {
  title: string;
  durationSec?: number;
  pitchAt?: number; // fraction 0..1
  chapters?: readonly string[];
  onMilestone?: (pct: number) => void;
  onPitch?: () => void;
  onComplete?: () => void;
};

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function WebinarPlayer({
  title,
  durationSec = 45,
  pitchAt = 0.7,
  chapters = [],
  onMilestone,
  onPitch,
  onComplete,
}: WebinarPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const tRef = useRef(0);
  const firedRef = useRef<Set<number>>(new Set());
  const pitchedRef = useRef(false);
  const completedRef = useRef(false);

  const emit = useCallback(
    (time: number) => {
      const pct = (time / durationSec) * 100;
      WATCH_MILESTONES.forEach((m) => {
        if (pct >= m.pct && !firedRef.current.has(m.pct)) {
          firedRef.current.add(m.pct);
          onMilestone?.(m.pct);
        }
      });
      if (!pitchedRef.current && time >= durationSec * pitchAt) {
        pitchedRef.current = true;
        onPitch?.();
      }
      if (!completedRef.current && time >= durationSec) {
        completedRef.current = true;
        onComplete?.();
      }
    },
    [durationSec, pitchAt, onMilestone, onPitch, onComplete],
  );

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const next = Math.min(durationSec, tRef.current + dt);
      tRef.current = next;
      setT(next);
      emit(next);
      if (next >= durationSec) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, durationSec, emit]);

  function toggle() {
    if (tRef.current >= durationSec) {
      // replay from the top; keep fired milestones so events don't duplicate
      tRef.current = 0;
      setT(0);
    }
    setPlaying((p) => !p);
  }

  function seek(clientFraction: number) {
    const time = Math.max(0, Math.min(1, clientFraction)) * durationSec;
    tRef.current = time;
    setT(time);
    emit(time);
  }

  const progress = durationSec ? (t / durationSec) * 100 : 0;

  return (
    <div
      className="v3-corner relative overflow-hidden"
      style={{
        border: "1px solid var(--v3-line)",
        borderRadius: 4,
        background: "linear-gradient(160deg, #0b0d12, #05060a)",
        aspectRatio: "16 / 9",
      }}
    >
      {/* demo marker — honest about the placeholder */}
      <span
        className="v3-mono absolute left-4 top-4 z-10"
        style={{ fontSize: 9.5, letterSpacing: "0.24em", color: "var(--v3-faint)" }}
      >
        DEMO PLAYER // PLACEHOLDER
      </span>

      {/* stage: title + audio-wave while playing, big play glyph when idle */}
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="absolute inset-0 grid place-items-center outline-none"
        style={{ cursor: "pointer" }}
      >
        {playing ? (
          <div className="v3-wave playing" style={{ width: "min(60%, 320px)", height: 60 }}>
            {Array.from({ length: 30 }).map((_, k) => (
              <i key={k} style={{ height: `${20 + ((k * 7) % 80)}%`, animationDelay: `${(k % 8) * 0.06}s` }} />
            ))}
          </div>
        ) : (
          <span
            className="grid place-items-center"
            style={{
              width: 76,
              height: 76,
              borderRadius: "50%",
              background: "color-mix(in srgb, var(--v3-accent) 22%, transparent)",
              border: "1px solid var(--v3-accent)",
              color: "var(--v3-accent)",
            }}
          >
            <PlayIcon className="h-8 w-8" />
          </span>
        )}
        {/* Title overlay is redundant with the page <h1>; hide on phones where the
            short 16:9 frame makes it collide with the play button. */}
        <span
          className="v3-display absolute hidden px-6 text-center sm:block"
          style={{ bottom: 64, fontSize: "clamp(16px,2.4vw,26px)", color: "var(--v3-ink)", maxWidth: "80%" }}
        >
          {title}
        </span>
      </button>

      {/* controls */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-3.5 pt-8" style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.75), transparent)" }}>
        <div
          role="slider"
          aria-label="Seek"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seek((e.clientX - r.left) / r.width);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") seek((t + durationSec * 0.1) / durationSec);
            if (e.key === "ArrowLeft") seek((t - durationSec * 0.1) / durationSec);
          }}
          className="relative"
          style={{ height: 14, cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <div style={{ position: "absolute", inset: "0 0", top: "50%", height: 4, transform: "translateY(-50%)", background: "var(--v3-line)", borderRadius: 2 }} />
          <div style={{ position: "absolute", left: 0, top: "50%", height: 4, transform: "translateY(-50%)", width: `${progress}%`, background: "var(--v3-accent)", borderRadius: 2 }} />
          {/* chapter ticks */}
          {chapters.map((c, i) => (
            <span
              key={c}
              title={c}
              style={{
                position: "absolute",
                left: `${((i + 1) / (chapters.length + 1)) * 100}%`,
                top: "50%",
                width: 2,
                height: 10,
                transform: "translate(-50%,-50%)",
                background: "var(--v3-faint)",
              }}
            />
          ))}
        </div>
        <div className="mt-1 flex items-center justify-between">
          <button type="button" onClick={toggle} className="v3-mono" style={{ fontSize: 11, color: "var(--v3-mut)", letterSpacing: "0.1em" }}>
            {playing ? "❚❚ PAUSE" : "▶ PLAY"}
          </button>
          <span className="v3-mono" style={{ fontSize: 11, color: "var(--v3-faint)" }}>
            {fmt(t)} / {fmt(durationSec)}
          </span>
        </div>
      </div>
    </div>
  );
}
