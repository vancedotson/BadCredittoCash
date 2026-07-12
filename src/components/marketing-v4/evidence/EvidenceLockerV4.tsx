"use client";

import { useEffect, useRef, useState } from "react";
import { site } from "@/config/site-v3";
import { Kicker, Reveal, SectionScan } from "../../marketing-v3/shared/primitives";
import { useReveal, usePrefersReducedMotion } from "../../marketing-v3/shared/hooks";
import { PlayIcon, ChevronRightIcon } from "@/components/marketing-v2/Icons";

/**
 * v4 "Evidence Locker // Recorded Calls". A seamless right→left infinite locker
 * (cards duplicated so it loops with no jump), no scrollbar (‹ › buttons below).
 * Auto-scroll pauses only while the cards are hovered, while a card is playing,
 * or under reduced motion. Clicking Play expands that card to reveal a transcript
 * slot while the others compress. A faint audio-wave animates in the background.
 */
// mechanism step colors (gold → lime → green) for the cursor-reveal wave
const STEP_COLORS = ["#f2a93b", "#c3cf3e", "#33c06a"];
const RGB = STEP_COLORS.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const mechColor = (t: number) => {
  const x = Math.min(0.999, Math.max(0, t)) * 2;
  const [a, b] = x < 1 ? [RGB[0], RGB[1]] : [RGB[1], RGB[2]];
  const f = x < 1 ? x : x - 1;
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};
// deterministic bar set — slower durations than before
const WAVE = Array.from({ length: 96 }).map((_, k) => ({
  h: 16 + ((k * 17 + k * k) % 80),
  delay: (k % 12) * 0.12,
  dur: 2.6 + (k % 5) * 0.35,
  color: mechColor(k / 95),
}));

export function EvidenceLockerV4() {
  const headRef = useReveal<HTMLDivElement>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const reduced = usePrefersReducedMotion();
  const clips = site.proofCalls.clips;
  const loop = [...clips, ...clips]; // duplicated for a seamless loop

  const nudge = (dir: number) =>
    scrollRef.current?.scrollBy({ left: dir * 380, behavior: "smooth" });

  // Seamless infinite scroll right→left. When we pass one full set of cards,
  // subtract that width so it wraps with no visible jump. Pauses when the cards
  // are hovered, a card is playing, or under prefers-reduced-motion.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || reduced || hovered || playing !== null) return;
    let raf = 0;
    const step = () => {
      const first = el.children[0] as HTMLElement | undefined;
      const mid = el.children[clips.length] as HTMLElement | undefined;
      if (first && mid) {
        const loopW = mid.offsetLeft - first.offsetLeft;
        el.scrollLeft += 0.6;
        if (loopW > 0 && el.scrollLeft >= loopW) el.scrollLeft -= loopW;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduced, hovered, playing, clips.length]);

  return (
    <section
      className="v3-section relative"
      id="proof"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      onMouseLeave={(e) => e.currentTarget.style.setProperty("--mx", "-9999px")}
    >
      <SectionScan />

      {/* faint background audio wave (base) */}
      <div className="v4-locker-wave" aria-hidden>
        {WAVE.map((b, k) => (
          <i
            key={k}
            style={{
              height: `${b.h}%`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
            }}
          />
        ))}
      </div>
      {/* cursor-revealed wave in the mechanism colors (gold → green) */}
      <div className="v4-locker-wave-reveal" aria-hidden>
        {WAVE.map((b, k) => (
          <i
            key={k}
            style={{
              height: `${b.h}%`,
              backgroundColor: b.color,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
            }}
          />
        ))}
      </div>

      <div className="v3-wrap relative" style={{ zIndex: 1 }} ref={headRef}>
        <Reveal>
          <Kicker>{site.ev.kickers.proofCalls}</Kicker>
        </Reveal>
        <Reveal as="h2" className="v3-display mt-5">
          <span style={{ fontSize: "clamp(32px,5vw,62px)", maxWidth: 900, display: "block" }}>
            Don&apos;t take my word for it.{" "}
            <span style={{ color: "var(--v3-accent)" }}>Listen to them</span> get
            caught.
          </span>
        </Reveal>
        <Reveal className="mt-4">
          <p
            className="v3-mono"
            style={{ fontSize: 13, letterSpacing: "0.12em", color: "var(--v3-mut)" }}
          >
            {site.proofCalls.subhead}
          </p>
        </Reveal>
      </div>

      {/* locker strip — no scrollbar; hover here (only) pauses the auto-scroll */}
      <div
        ref={scrollRef}
        className="v4-locker-scroll relative mt-10 flex gap-4"
        style={{ overflowX: "auto", paddingInline: "clamp(20px,5vw,48px)", zIndex: 1 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {loop.map((c, idx) => {
          const on = playing === idx;
          const compressed = playing !== null && !on;
          const mainW = compressed ? 268 : 300;
          const transW = on ? 340 : 0;
          return (
            <article
              key={idx}
              className="v3-panel v3-corner relative flex shrink-0 overflow-hidden"
              style={{
                borderColor: on ? "var(--v3-accent)" : "var(--v3-line)",
                borderRadius: 4,
                transition: "border-color 0.4s ease",
              }}
            >
              {/* main */}
              <div
                className="shrink-0 p-6"
                style={{ width: mainW, transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)" }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="v3-mono"
                    style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-accent)" }}
                  >
                    EXHIBIT {String((idx % clips.length) + 1).padStart(2, "0")}
                  </span>
                  <span className="v3-mono" style={{ fontSize: 11, color: "var(--v3-faint)" }}>
                    {c.duration}
                  </span>
                </div>
                <div className={`v3-wave mt-5 ${on ? "playing" : ""}`}>
                  {Array.from({ length: 30 }).map((_, k) => (
                    <i
                      key={k}
                      style={{
                        height: `${20 + ((k * 7 + idx * 11) % 80)}%`,
                        animationDelay: `${(k % 8) * 0.06}s`,
                      }}
                    />
                  ))}
                </div>
                <h3
                  className="v3-display mt-5"
                  style={{ fontSize: 20, color: "var(--v3-ink)", lineHeight: 1.05 }}
                >
                  {c.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setPlaying(on ? null : idx)}
                  className={`v3-btn mt-6 w-full ${on ? "v3-btn-primary" : "v3-btn-ghost"}`}
                  style={{ minHeight: 44, fontSize: 13 }}
                >
                  <PlayIcon className="h-4 w-4" /> {on ? "Playing…" : "Play"}
                </button>
              </div>

              {/* transcript slot — revealed when this card is playing */}
              <div
                className="shrink-0 overflow-hidden"
                style={{
                  width: transW,
                  transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)",
                  borderLeft: "1px solid var(--v3-line)",
                  background: "rgba(0,0,0,0.25)",
                }}
              >
                <div className="p-6" style={{ width: 340 }}>
                  <span
                    className="v3-mono"
                    style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-faint)" }}
                  >
                    TRANSCRIPT
                  </span>
                  <p
                    className="v3-serif-em mt-3"
                    style={{ fontSize: 15, color: "var(--v3-mut)", lineHeight: 1.6 }}
                  >
                    Synced transcript will appear here as the call plays.
                  </p>
                  <div className="mt-5 grid gap-2.5">
                    {[92, 74, 86, 62, 80].map((w, li) => (
                      <div
                        key={li}
                        style={{
                          height: 8,
                          width: `${w}%`,
                          background: "var(--v3-line)",
                          borderRadius: 2,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* nav buttons — below the audios */}
      <div className="v3-wrap relative mt-6 flex items-center gap-3" style={{ zIndex: 1 }}>
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label="Scroll left"
          className="v3-btn v3-btn-ghost"
          style={{ minHeight: 46, width: 52, padding: 0 }}
        >
          <ChevronRightIcon className="h-5 w-5 rotate-180" />
        </button>
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label="Scroll right"
          className="v3-btn v3-btn-ghost"
          style={{ minHeight: 46, width: 52, padding: 0 }}
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}
