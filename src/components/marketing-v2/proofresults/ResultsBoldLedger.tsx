"use client";

import { useEffect, useRef, useState } from "react";
import { site } from "@/config/site-v2";
import { isRemoval } from "./outcome";

/**
 * Results — "Bold Ledger".
 * Full-bleed dark section, oversized display rows: each challenged item struck
 * through in big Staatliches caps, with a solid outcome pill.
 *
 * On scroll-in the rows cascade up, the gold strike-line draws across each
 * item, then the outcome pill pops — item appears → gets struck → stamped.
 * Respects prefers-reduced-motion (jumps straight to the final state).
 */
export function ResultsBoldLedger() {
  const { heading, results, disclaimer } = site.proofResults;
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <section className="bg-darkblue">
      <div
        ref={ref}
        className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28"
      >
        <div
          className={`mb-12 text-center transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:opacity-100 ${
            revealed ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <h2 className="text-4xl text-white sm:text-5xl lg:text-6xl">
            {heading}
          </h2>
        </div>

        <ul className="border-t border-white/10">
          {results.map((r, i) => {
            const base = 150 + i * 140;
            return (
              <li
                key={r.item}
                style={{ transitionDelay: `${base}ms` }}
                className={`flex items-center justify-between gap-6 border-b border-white/10 py-6 transition-all duration-500 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none sm:py-7 ${
                  revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
              >
                <div className="flex min-w-0 items-baseline gap-4 sm:gap-6">
                  <span className="hidden shrink-0 font-display text-2xl tabular-nums text-white/25 sm:block">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="relative inline-block font-display text-2xl leading-none text-white sm:text-3xl lg:text-4xl">
                    {r.item}
                    {/* strike-line draws left → right */}
                    <span
                      aria-hidden
                      style={{ transitionDelay: `${base + 280}ms` }}
                      className={`absolute left-0 top-1/2 h-[3px] w-full origin-left -translate-y-1/2 rounded-full bg-gold/70 transition-transform duration-700 ease-out motion-reduce:scale-x-100 motion-reduce:transition-none ${
                        revealed ? "scale-x-100" : "scale-x-0"
                      }`}
                    />
                  </span>
                </div>
                <span
                  style={{ transitionDelay: `${base + 560}ms` }}
                  className={`shrink-0 rounded-full px-4 py-2 font-heading text-xs font-bold uppercase tracking-wide transition-all duration-500 ease-out motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none sm:text-sm ${
                    isRemoval(r.outcome) ? "bg-green text-white" : "bg-gold text-ink"
                  } ${revealed ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
                >
                  {r.outcome}
                </span>
              </li>
            );
          })}
        </ul>

        <p
          className={`mt-8 text-center text-sm text-white/40 transition-opacity duration-700 ease-out motion-reduce:opacity-100 motion-reduce:transition-none ${
            revealed ? "opacity-100" : "opacity-0"
          }`}
          style={{ transitionDelay: `${150 + results.length * 140 + 300}ms` }}
        >
          {disclaimer}
        </p>
      </div>
    </section>
  );
}
