"use client";

import { useState } from "react";
import { site } from "@/config/site";
import { Waveform } from "./Waveform";

/**
 * Proof I — "Evidence Library".
 * The recorded calls are a rack of vinyl-style discs you flip through. Pick a
 * disc and it becomes the spinning "now playing" record, with the two-tone
 * player (waveform on navy) + transcript exhibit below. Interactive selection;
 * the two-tone card aesthetic the user picked, reframed as a collection.
 */
function code(title: string) {
  if (title.includes("FDCPA")) return "FDCPA";
  if (title.includes("FCRA")) return "FCRA";
  return "REC";
}
function statute(title: string) {
  if (title.includes("FDCPA")) return "FDCPA §807";
  if (title.includes("FCRA")) return "FCRA §1681";
  return "Admission";
}

/** A vinyl-record disc. `centerText` labels a static disc; a bare disc (no
 *  text) shows a spindle hole and can spin as the active record. */
function Disc({
  centerText,
  spinning = false,
  active = false,
  className,
}: {
  centerText?: string;
  spinning?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-square rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.45)] ${
        spinning ? "motion-safe:animate-[spin_9s_linear_infinite]" : ""
      } ${active ? "ring-4 ring-gold ring-offset-2 ring-offset-darkblue" : ""} ${
        className ?? ""
      }`}
      style={{
        background:
          "radial-gradient(circle at 50% 42%, #2a3a54 0%, #0d1626 46%, #05080f 100%)",
      }}
    >
      {/* grooves */}
      <span className="absolute inset-[7%] rounded-full border border-white/[0.06]" />
      <span className="absolute inset-[15%] rounded-full border border-white/[0.05]" />
      <span className="absolute inset-[23%] rounded-full border border-white/[0.04]" />
      {/* gloss sweep */}
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(125deg,rgba(255,255,255,0.14),transparent_38%)]" />
      {/* center label */}
      <span className="absolute inset-[34%] flex items-center justify-center rounded-full bg-gold text-ink">
        {centerText ? (
          <span className="text-[9px] font-bold uppercase tracking-tight">
            {centerText}
          </span>
        ) : (
          <span className="h-[18%] w-[18%] rounded-full bg-darkblue ring-1 ring-black/50" />
        )}
      </span>
    </div>
  );
}

export function ProofDiscLibrary() {
  const { heading, subhead, clips } = site.proofCalls;
  const [active, setActive] = useState(0);
  const current = clips[active];

  return (
    <section id="proof" className="scroll-mt-24 bg-darkblue">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
            The evidence library
          </p>
          <h2 className="mt-3 text-3xl text-white sm:text-4xl">{heading}</h2>
          <p className="mt-3 font-heading text-lg font-semibold text-white/70">
            {subhead}
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-start">
          {/* THE LIBRARY — pick a disc */}
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
              Choose a recording
            </p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-7">
              {clips.map((clip, i) => (
                <button
                  key={clip.title}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-pressed={i === active}
                  aria-label={`Play recording: ${clip.title}`}
                  className="group flex flex-col items-center gap-2 text-center"
                >
                  <Disc
                    centerText={code(clip.title)}
                    active={i === active}
                    className={`w-full transition-transform duration-300 ${
                      i === active
                        ? "scale-105"
                        : "group-hover:-translate-y-1 group-hover:rotate-3"
                    }`}
                  />
                  <span
                    className={`font-heading text-[11px] tabular-nums ${
                      i === active ? "text-gold" : "text-white/55"
                    }`}
                  >
                    {clip.duration}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* NOW PLAYING — two-tone player + transcript */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-card shadow-card">
            {/* navy header: spinning record + waveform */}
            <div className="bg-navy p-6">
              <div className="flex items-center gap-5">
                <Disc
                  spinning
                  className="h-24 w-24 shrink-0 sm:h-28 sm:w-28"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
                    Now playing · {active + 1} of {clips.length}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                      {statute(current.title)}
                    </span>
                    <span className="font-heading text-xs tabular-nums text-white/50">
                      {current.duration}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-snug text-white">
                    {current.title}
                  </p>
                  <Waveform
                    playedClass="bg-gold"
                    baseClass="bg-white/20"
                    className="mt-3 h-8"
                  />
                </div>
              </div>
            </div>

            {/* light transcript body */}
            <div aria-hidden className="space-y-4 p-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate">
                  Collector
                </p>
                <div className="mt-2 space-y-1.5">
                  <span className="block h-2.5 w-full rounded-full bg-mist" />
                  <span className="block h-2.5 w-4/5 rounded-full bg-mist" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
                  ⚑ Violation flagged
                </p>
                <div className="mt-2 space-y-1.5">
                  <span className="block h-2.5 w-11/12 rounded-full bg-gold/50" />
                  <span className="block h-2.5 w-2/3 rounded-full bg-gold/30" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
