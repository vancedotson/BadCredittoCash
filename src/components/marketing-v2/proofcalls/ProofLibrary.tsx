"use client";

import { useEffect, useState } from "react";
import { site } from "@/config/site-v2";
import { PlayIcon, CloseIcon } from "../Icons";
import { Waveform } from "./Waveform";
import { Equalizer } from "./Equalizer";
import { TranscriptPreview } from "./TranscriptPreview";
import { code, statute } from "./violations";

type Mode = "idle" | "confirm" | "playing";

/** Simulated playback length (no real audio yet). */
const DURATION_MS = 8000;

/**
 * Proof I — "Evidence Library".
 * Pick a recording → a compact navy popover flies out to the right of the
 * clicked row (name + Play). Hit play → playback runs: the waveform fills, the
 * transcript reveals turn-by-turn, and the violation flag lights up when the
 * playhead reaches it.
 */
export function ProofLibrary() {
  const { heading, subhead, clips } = site.proofCalls;
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>("idle");
  const [progress, setProgress] = useState(1);
  const current = clips[selected];
  const openUp = selected >= clips.length - 2;

  useEffect(() => {
    if (mode !== "playing") return;
    let raf = 0;
    let startT: number | undefined;
    const tick = (t: number) => {
      if (startT === undefined) startT = t;
      const p = Math.min(1, (t - startT) / DURATION_MS);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setMode("idle");
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, selected]);

  function selectRecording(i: number) {
    setSelected(i);
    setProgress(1);
    setMode("confirm");
  }
  function startPlay() {
    setProgress(0);
    setMode("playing");
  }

  const waveProgress = mode === "playing" ? progress : 0.4;

  return (
    <section id="proof" className="scroll-mt-24 bg-cloud">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">
            The evidence library
          </p>
          <h2 className="mt-3 text-4xl sm:text-5xl lg:text-6xl">{heading}</h2>
          <p className="mt-3 font-heading text-lg font-semibold text-trust">
            {subhead}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-mist bg-card shadow-card lg:grid lg:grid-cols-[260px_1fr]">
          {/* sidebar */}
          <aside className="border-b border-mist bg-cloud p-3 lg:border-b-0 lg:border-r">
            <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate">
              Recordings · {clips.length}
            </p>
            <ul className="space-y-1">
              {clips.map((clip, i) => {
                const on = i === selected;
                const showPopover = on && mode === "confirm";
                return (
                  <li key={clip.title} className="relative">
                    <button
                      type="button"
                      onClick={() => selectRecording(i)}
                      aria-pressed={on}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        on ? "bg-navy shadow-sm" : "hover:bg-card"
                      }`}
                    >
                      <span
                        className={`flex h-6 shrink-0 items-center rounded px-1.5 text-[10px] font-bold ${
                          on ? "bg-gold text-ink" : "bg-mist text-slate"
                        }`}
                      >
                        {code(clip.title)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm font-medium ${
                            on ? "text-white" : "text-heading"
                          }`}
                        >
                          {clip.title}
                        </span>
                        <span
                          className={`text-xs ${on ? "text-white/60" : "text-slate"}`}
                        >
                          {clip.duration}
                        </span>
                      </span>
                      {on && mode === "playing" && (
                        <Equalizer className="h-3.5 w-4 shrink-0 text-gold" />
                      )}
                    </button>

                    {/* Navy popover flies out to the right of the clicked row */}
                    {showPopover && (
                      <div
                        className={`absolute left-full z-30 ml-3 w-72 rounded-xl bg-navy p-4 text-white shadow-2xl [animation:popIn_.28s_ease-out_both] ${
                          openUp ? "bottom-0" : "top-0"
                        }`}
                      >
                        <span
                          className={`absolute -left-1.5 h-3 w-3 rotate-45 border-b border-l border-white/10 bg-navy ${
                            openUp ? "bottom-5" : "top-5"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setMode("idle")}
                          aria-label="Close"
                          className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                        <div className="flex items-center gap-2 pr-6">
                          <span className="rounded border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                            {statute(clip.title)}
                          </span>
                          <span className="font-heading text-xs tabular-nums text-white/50">
                            {clip.duration}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold leading-snug text-white">
                          {clip.title}
                        </p>
                        <button
                          type="button"
                          onClick={startPlay}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-gold py-1.5 pl-2 pr-4 font-heading text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/10">
                            <PlayIcon className="h-3.5 w-3.5" />
                          </span>
                          Play recording
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* reading view */}
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4 border-b border-mist pb-5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-deep">
                  Transcript · {selected + 1} of {clips.length}
                  {mode === "playing" && " · Playing"}
                </p>
                <h3 className="mt-1 truncate text-xl text-heading">
                  {current.title}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden sm:block">
                  <Waveform
                    playedClass="bg-gold"
                    baseClass="bg-trust/25"
                    className="h-8 w-40"
                    progress={waveProgress}
                  />
                </span>
                <button
                  type="button"
                  onClick={() =>
                    mode === "playing" ? setMode("idle") : selectRecording(selected)
                  }
                  aria-label={mode === "playing" ? "Pause" : `Play: ${current.title}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-ink shadow-sm transition-transform hover:scale-105"
                >
                  {mode === "playing" ? (
                    <span aria-hidden className="flex gap-[3px]">
                      <span className="h-4 w-1 rounded-sm bg-ink" />
                      <span className="h-4 w-1 rounded-sm bg-ink" />
                    </span>
                  ) : (
                    <PlayIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            <div className="mt-6">
              <TranscriptPreview
                statuteLabel={statute(current.title)}
                progress={mode === "playing" ? progress : 1}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
