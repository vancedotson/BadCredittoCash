"use client";

import Link from "next/link";
import { site } from "@/config/site-v3";
import { Kicker, Reveal, SectionScan } from "../../marketing-v3/shared/primitives";
import { PlayIcon } from "@/components/marketing-v2/Icons";
import { HiwNumerals } from "./variants";

/**
 * v4 "Intake // Getting started" (How It Works) — the chosen "Big Numerals"
 * treatment, closed with a left-aligned primary CTA + a ghost secondary.
 */
export function HowItWorksSectionV4() {
  return (
    <section className="v3-section" id="how">
      <SectionScan />
      <div className="v3-wrap">
        <Reveal>
          <Kicker>{site.ev.kickers.how}</Kicker>
        </Reveal>
        <Reveal as="h2" className="v3-display mt-5">
          <span style={{ fontSize: "clamp(34px,5vw,64px)" }}>
            {site.howItWorks.heading}
          </span>
        </Reveal>
      </div>

      <div className="mt-12">
        <HiwNumerals />
      </div>

      <div className="v3-wrap mt-12 flex flex-wrap items-center gap-4">
        <Link
          href={site.cta.primary.href}
          className="v3-btn v3-btn-primary v3-clip"
          style={{ paddingLeft: 12 }}
        >
          <span className="v3-btn-badge">
            <PlayIcon className="h-4 w-4" />
          </span>
          {site.cta.primary.label}
        </Link>
        <Link href={site.cta.secondary.href} className="v3-btn v3-btn-ghost">
          {site.cta.secondary.label} →
        </Link>
      </div>
    </section>
  );
}
