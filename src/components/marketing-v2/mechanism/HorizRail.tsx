"use client";

import { useEffect, useRef, useState } from "react";
import { site } from "@/config/site-v2";

/**
 * Mechanism — horizontal gradient rail. When the section scrolls into view the
 * gold rail draws left-to-right, connecting the three step dots in sequence;
 * each dot lights up as the line reaches it, then a pulse travels the rail.
 */
export function HorizRail() {
  const { eyebrow, subhead, heading, steps, kicker } = site.mechanism;
  const ref = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <section className="bg-cloud">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-gold">
          {eyebrow}
        </p>
        <h2 className="mt-4 max-w-3xl text-3xl leading-tight sm:text-4xl">
          {heading}
        </h2>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate">
          {subhead}
        </p>

        <div ref={ref} className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          {/* rail track (faint) + animated fill that draws on scroll-in.
             Dots are left-aligned in each column, so their centers sit at
             10px (½ dot) from the column's left edge — NOT at the column
             center. Anchor the rail from dot-01's center (10px) to dot-03's
             center (66.667% + 31.333px, i.e. right = 33.333% − 31.333px),
             where 31.333px = ⅓ of the 64px total gap + ½ dot width. */}
          <div
            aria-hidden
            className="absolute top-[9px] hidden h-[3px] md:block"
            style={{ left: "10px", right: "calc(33.333% - 31.333px)" }}
          >
            <span className="absolute inset-0 rounded-full bg-gold/20" />
            <span
              className={`absolute inset-0 origin-left rounded-full bg-gradient-to-r from-gold via-gold to-gold/40 transition-transform duration-[1600ms] ease-out motion-reduce:scale-x-100 motion-reduce:transition-none ${
                drawn ? "scale-x-100" : "scale-x-0"
              }`}
            />
            {/* traveling pulse, only after the rail has drawn */}
            {drawn && (
              <span
                className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold shadow-[0_0_10px_2px_var(--color-gold)] [animation:railPulse_2.8s_ease-in-out_1.6s_infinite] motion-reduce:hidden"
              />
            )}
          </div>

          {steps.map((s, i) => (
            <div key={s.title} className="relative">
              <span
                aria-hidden
                className={`flex h-5 w-5 items-center justify-center rounded-full shadow-[0_0_0_5px_var(--color-cloud)] transition-all duration-500 ease-out motion-reduce:scale-100 motion-reduce:bg-gold motion-reduce:transition-none ${
                  drawn ? "scale-100 bg-gold" : "scale-90 bg-gold/30"
                }`}
                style={{ transitionDelay: `${i * 700}ms` }}
              >
                <span className="h-2 w-2 rounded-full bg-ink/70" />
              </span>
              <span className="mt-6 block font-display text-4xl leading-none text-gold sm:text-5xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 text-2xl">{s.title}</h3>
              <p className="mt-3 leading-relaxed text-slate">{s.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-14 font-heading text-xl font-semibold text-heading">
          {kicker}
        </p>
      </div>
    </section>
  );
}
