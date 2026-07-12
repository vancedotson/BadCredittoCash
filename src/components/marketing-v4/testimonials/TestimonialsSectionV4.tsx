"use client";

import { site } from "@/config/site-v3";
import { Kicker, Reveal, SectionScan } from "../../marketing-v3/shared/primitives";
import { TestiSpotlight } from "./variants";

/**
 * v4 "In their own words" (Testimonials) — the chosen "Spotlight Wall": eight
 * quote cards where hovering one dims the others and pops the focused card.
 * Compliance-safe: neutral avatars (no fabricated faces) + the ⚠️ placeholder
 * note until real names/photos/permissions land.
 */
export function TestimonialsSectionV4() {
  return (
    <section className="v3-section relative" id="statements">
      <SectionScan />
      <div className="v3-wrap">
        <Reveal>
          <Kicker>{site.ev.kickers.testimonials}</Kicker>
        </Reveal>
        <Reveal as="h2" className="v3-display mt-5">
          <span style={{ fontSize: "clamp(34px,5vw,64px)" }}>
            {site.testimonials.heading}
          </span>
        </Reveal>
      </div>

      <div className="mt-10">
        <TestiSpotlight />
      </div>

      <div className="v3-wrap">
        <p
          className="v3-mono mt-8"
          style={{ fontSize: 11, color: "var(--v3-faint)", letterSpacing: "0.08em" }}
        >
          ⚠️ Placeholder statements: real names, photos &amp; permissions pending.
        </p>
      </div>
    </section>
  );
}
