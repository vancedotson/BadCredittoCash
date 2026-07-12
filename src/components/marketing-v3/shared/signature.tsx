"use client";

import { useState } from "react";
import { site } from "@/config/site-v3";
import { Kicker, Reveal, SectionScan } from "./primitives";
import { useReveal, useRevealChildren, useScrollScene } from "./hooks";
import { PlayIcon } from "@/components/marketing-v2/Icons";
import type { V3Variant } from "./PageSwitcher";

/* ==========================================================================
   REFRAME — "scattered words gather into the sentence" (sticky scrollytelling)
   ========================================================================== */
export function ReframeGather() {
  const { ref } = useScrollScene<HTMLDivElement>();
  const words = site.reframe.gatherWords;
  return (
    <section id="reframe">
      <div ref={ref} className="v3-scene" style={{ minHeight: "300vh" }}>
        <div className="v3-scene-sticky">
          <div aria-hidden className="v3-scan in" style={{ top: "18%" }} />
          <div className="v3-wrap text-center">
            <span
              className="v3-mono"
              style={{
                fontSize: 12,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "var(--v3-accent)",
              }}
            >
              {site.ev.kickers.reframe}
            </span>
            <p
              className="v3-serif-em mx-auto mt-6"
              style={{ fontSize: "clamp(15px,2vw,20px)", color: "var(--v3-mut)", maxWidth: 620 }}
            >
              {site.reframe.kicker}
            </p>
            <div className="v3-gather mt-8">
              {words.map((w, i) => {
                const sx = (i % 2 ? -1 : 1) * (140 + ((i * 37) % 180));
                const sy = ((i * 53) % 3 ? -1 : 1) * (70 + ((i * 29) % 130));
                const sr = (i % 2 ? -1 : 1) * (8 + ((i * 13) % 18));
                const accent = w === "SIDE" || w === "LAW";
                return (
                  <span
                    key={i}
                    style={{
                      color: accent ? "var(--v3-accent)" : "var(--v3-ink)",
                      transform: `translate3d(calc(${sx}px * (1 - var(--p))), calc(${sy}px * (1 - var(--p))), 0) rotate(calc(${sr}deg * (1 - var(--p))))`,
                      opacity: "calc(0.1 + 0.9 * var(--p))" as unknown as number,
                      filter: "blur(calc((1 - var(--p)) * 7px))",
                    }}
                  >
                    {w}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* the two statutes, revealed after the scene */}
      <ReframeLaws />
    </section>
  );
}

function ReframeLaws() {
  const ref = useRevealChildren<HTMLDivElement>();
  return (
    <div className="v3-section" style={{ borderTop: "1px solid var(--v3-line-soft)" }}>
      <div className="v3-wrap" ref={ref}>
        <Reveal>
          <p style={{ fontSize: "clamp(20px,3vw,30px)", color: "var(--v3-mut)", maxWidth: 780, lineHeight: 1.5 }}>
            {site.reframe.body}
          </p>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {site.reframe.laws.map((l, i) => (
            <div
              key={l.abbr}
              className="v3-reveal v3-panel v3-corner relative p-7"
              data-delay={((i % 2) + 1) as 1 | 2}
              style={{ borderRadius: 4 }}
            >
              <div className="flex items-baseline justify-between">
                <span className="v3-display" style={{ fontSize: 40, color: "var(--v3-accent)" }}>
                  {l.abbr}
                </span>
                <span
                  className="v3-mono"
                  style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--v3-faint)", textTransform: "uppercase" }}
                >
                  STATUTE 0{i + 1}
                </span>
              </div>
              <div className="v3-mono mt-1" style={{ fontSize: 12, color: "var(--v3-mut)" }}>
                {l.name}
              </div>
              <p className="mt-4" style={{ fontSize: 16, color: "var(--v3-mut)", lineHeight: 1.55 }}>
                {l.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   MECHANISM — pinned 3-step procedure (sticky, active step tracks scroll)
   ========================================================================== */
export function MechanismPinned() {
  const { ref, progress } = useScrollScene<HTMLDivElement>();
  const steps = site.mechanism.steps;
  const active = Math.min(steps.length - 1, Math.floor(progress * steps.length));
  return (
    <section id="mechanism">
      <div ref={ref} className="v3-scene" style={{ minHeight: "320vh" }}>
        <div className="v3-scene-sticky">
          <div className="v3-wrap grid w-full items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <Kicker>{site.ev.kickers.mechanism}</Kicker>
              <h2 className="v3-display mt-5" style={{ fontSize: "clamp(30px,4vw,52px)", maxWidth: 520 }}>
                {site.mechanism.heading}
              </h2>
              <p className="mt-5" style={{ fontSize: 16, color: "var(--v3-mut)", maxWidth: 460, lineHeight: 1.6 }}>
                {site.mechanism.subhead}
              </p>
              {/* progress bar */}
              <div className="mt-8 h-px w-full" style={{ background: "var(--v3-line)" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round(progress * 100)}%`,
                    background: "linear-gradient(90deg, var(--v3-ink), var(--v3-accent))",
                    transition: "width 0.1s linear",
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4">
              {steps.map((s, i) => {
                const on = i === active;
                const done = i < active;
                return (
                  <div
                    key={i}
                    className="v3-pin-step v3-panel relative flex gap-5 p-6"
                    style={{
                      borderRadius: 4,
                      opacity: on ? 1 : 0.42,
                      transform: on ? "translateX(8px)" : "none",
                      borderColor: on ? "var(--v3-accent)" : "var(--v3-line)",
                    }}
                  >
                    <span
                      className="v3-display shrink-0"
                      style={{
                        fontSize: 40,
                        lineHeight: 1,
                        color: on || done ? "var(--v3-accent)" : "var(--v3-line)",
                        minWidth: 56,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="v3-display" style={{ fontSize: 22, color: "var(--v3-ink)" }}>
                        {s.title}
                      </h3>
                      <p className="mt-2" style={{ fontSize: 15, color: "var(--v3-mut)", lineHeight: 1.5 }}>
                        {s.body}
                      </p>
                    </div>
                  </div>
                );
              })}
              <p className="v3-serif-em mt-3" style={{ fontSize: 18, color: "var(--v3-accent)" }}>
                {site.mechanism.kicker}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   RESULTS — documented-outcomes ledger (strike-draw + stamp on reveal)
   ========================================================================== */
export function ResultsLedger() {
  const ref = useRevealChildren<HTMLDivElement>();
  return (
    <section className="v3-section" id="results">
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        <Reveal>
          <Kicker>{site.ev.kickers.results}</Kicker>
        </Reveal>
        <Reveal as="h2" className="v3-display mt-5">
          <span style={{ fontSize: "clamp(34px,5vw,64px)" }}>{site.proofResults.heading}</span>
        </Reveal>

        <div className="mt-10">
          {site.proofResults.results.map((r, i) => {
            const removed = r.outcome.toLowerCase().includes("removed");
            return (
              <div
                key={i}
                className="v3-reveal grid items-center gap-4 py-5 sm:grid-cols-[1fr_auto]"
                data-delay={((i % 4) + 1) as 1 | 2 | 3 | 4}
                style={{ borderBottom: "1px solid var(--v3-line-soft)" }}
              >
                <div className="flex items-baseline gap-4">
                  <span
                    className="v3-mono"
                    style={{ fontSize: 12, color: "var(--v3-faint)", letterSpacing: "0.1em" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: "clamp(18px,2.6vw,26px)", color: "var(--v3-ink)" }}>
                    {r.item}
                  </span>
                </div>
                <span
                  className="v3-mono justify-self-start sm:justify-self-end"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 14px",
                    fontSize: 12,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: removed ? "var(--v3-accent)" : "var(--v3-ink)",
                    border: `1px solid ${removed ? "var(--v3-accent)" : "var(--v3-line)"}`,
                    borderRadius: 3,
                  }}
                >
                  {r.outcome}
                </span>
              </div>
            );
          })}
        </div>

        <Reveal className="mt-8">
          <p
            style={{
              fontSize: 13,
              color: "var(--v3-faint)",
              lineHeight: 1.6,
              maxWidth: 760,
              borderLeft: "2px solid var(--v3-line)",
              paddingLeft: 14,
            }}
          >
            {site.proofResults.disclaimer}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ==========================================================================
   EVIDENCE LIBRARY — recorded calls. Branches per variant.
   ========================================================================== */
export function EvidenceLibrary({ variant }: { variant: V3Variant }) {
  if (variant === "signalroom") return <EvidencePlayers />;
  if (variant === "ledger") return <EvidenceExpandingGrid />;
  return <EvidenceDossierStrip />;
}

function EvidenceHeader() {
  return (
    <>
      <Reveal>
        <Kicker>{site.ev.kickers.proofCalls}</Kicker>
      </Reveal>
      <Reveal as="h2" className="v3-display mt-5">
        <span style={{ fontSize: "clamp(32px,5vw,62px)", maxWidth: 900, display: "block" }}>
          {site.proofCalls.heading}
        </span>
      </Reveal>
      <Reveal className="mt-4">
        <p className="v3-mono" style={{ fontSize: 13, letterSpacing: "0.12em", color: "var(--v3-mut)" }}>
          {site.proofCalls.subhead} · ⚠️ placeholder media
        </p>
      </Reveal>
    </>
  );
}

/* Case File — horizontal scroll-snap dossier cards ------------------------ */
function EvidenceDossierStrip() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="v3-section" id="proof">
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        <EvidenceHeader />
      </div>
      <div
        className="mt-10 flex gap-4 overflow-x-auto pb-4"
        style={{ scrollSnapType: "x mandatory", paddingInline: "clamp(20px,5vw,48px)" }}
      >
        {site.proofCalls.clips.map((c, i) => (
          <article
            key={i}
            className="v3-panel v3-corner relative shrink-0 p-6"
            style={{ width: 320, scrollSnapAlign: "start", borderRadius: 4 }}
          >
            <div className="flex items-center justify-between">
              <span
                className="v3-mono"
                style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-accent)" }}
              >
                EXHIBIT {String(i + 1).padStart(2, "0")}
              </span>
              <span className="v3-mono" style={{ fontSize: 11, color: "var(--v3-faint)" }}>
                {c.duration}
              </span>
            </div>
            <div className="v3-wave mt-5">
              {Array.from({ length: 34 }).map((_, k) => (
                <i key={k} style={{ height: `${20 + ((k * 7 + i * 11) % 80)}%` }} />
              ))}
            </div>
            <h3 className="v3-display mt-5" style={{ fontSize: 20, color: "var(--v3-ink)", lineHeight: 1.05 }}>
              {c.title}
            </h3>
            <button
              type="button"
              className="v3-btn v3-btn-ghost mt-6 w-full"
              style={{ minHeight: 44, fontSize: 13 }}
            >
              <PlayIcon className="h-4 w-4" /> Play (confirm)
            </button>
          </article>
        ))}
      </div>
      <p
        className="v3-wrap v3-mono"
        style={{ fontSize: 11, color: "var(--v3-faint)", letterSpacing: "0.1em" }}
      >
        ← scroll the locker →
      </p>
    </section>
  );
}

/* Signal Room — vertical stack of waveform players ------------------------ */
function EvidencePlayers() {
  const ref = useRevealChildren<HTMLDivElement>();
  const [playing, setPlaying] = useState<number | null>(null);
  return (
    <section className="v3-section" id="proof">
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        <EvidenceHeader />
        <div className="mt-10 grid gap-3">
          {site.proofCalls.clips.map((c, i) => {
            const on = playing === i;
            return (
              <div
                key={i}
                className="v3-reveal v3-panel flex items-center gap-5 p-5"
                data-delay={((i % 4) + 1) as 1 | 2 | 3 | 4}
                style={{ borderRadius: 4, borderColor: on ? "var(--v3-accent)" : "var(--v3-line)" }}
              >
                <button
                  type="button"
                  onClick={() => setPlaying(on ? null : i)}
                  aria-label={on ? "Pause" : "Play"}
                  className="v3-btn v3-btn-primary shrink-0"
                  style={{ minHeight: 46, width: 46, padding: 0, borderRadius: 999 }}
                >
                  <PlayIcon className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3
                      className="v3-display truncate"
                      style={{ fontSize: 18, color: "var(--v3-ink)" }}
                    >
                      {c.title}
                    </h3>
                    <span className="v3-mono shrink-0" style={{ fontSize: 11, color: "var(--v3-faint)" }}>
                      {c.duration}
                    </span>
                  </div>
                  <div className={`v3-wave mt-3 ${on ? "playing" : ""}`}>
                    {Array.from({ length: 48 }).map((_, k) => (
                      <i key={k} style={{ height: `${18 + ((k * 5 + i * 9) % 82)}%`, animationDelay: `${(k % 8) * 0.06}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* Blacksite Ledger — sticky expanding evidence grid ----------------------- */
function EvidenceExpandingGrid() {
  const { ref, progress } = useScrollScene<HTMLDivElement>();
  const scale = 0.72 + progress * 0.28;
  return (
    <section id="proof">
      <div ref={ref} className="v3-scene" style={{ minHeight: "300vh" }}>
        <div className="v3-scene-sticky">
          <div className="absolute left-0 right-0 top-[10%] text-center">
            <span
              className="v3-mono"
              style={{ fontSize: 12, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--v3-accent)" }}
            >
              {site.ev.kickers.proofCalls}
            </span>
          </div>
          <div
            className="v3-evgrid"
            style={{ ["--gridScale" as string]: scale.toFixed(3) }}
          >
            {site.proofCalls.clips.map((c, i) => (
              <div
                key={i}
                className="v3-panel v3-clip relative flex flex-col justify-between p-4"
                style={{ gridColumn: i === 0 ? "span 2" : "span 2", minHeight: 150, borderRadius: 2 }}
              >
                <div className="flex items-center justify-between">
                  <span className="v3-mono" style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--v3-accent)" }}>
                    EX {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="v3-mono" style={{ fontSize: 10, color: "var(--v3-faint)" }}>
                    {c.duration}
                  </span>
                </div>
                <div className="v3-wave my-2" style={{ height: 26 }}>
                  {Array.from({ length: 22 }).map((_, k) => (
                    <i key={k} style={{ height: `${20 + ((k * 9 + i * 13) % 78)}%` }} />
                  ))}
                </div>
                <h3 className="v3-display" style={{ fontSize: 15, lineHeight: 1.05, color: "var(--v3-ink)" }}>
                  {c.title}
                </h3>
              </div>
            ))}
          </div>
          <p
            className="v3-mono absolute bottom-[8%] left-0 right-0 text-center"
            style={{ fontSize: 11, color: "var(--v3-faint)", letterSpacing: "0.14em" }}
          >
            ⚠️ placeholder media · scroll to open the locker
          </p>
        </div>
      </div>
    </section>
  );
}
