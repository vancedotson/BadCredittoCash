"use client";

import Link from "next/link";
import { site } from "@/config/site-v3";
import { ArrowRightIcon } from "@/components/marketing-v2/Icons";
import { Kicker, SectionScan } from "../marketing-v3/shared/primitives";
import { useReveal } from "../marketing-v3/shared/hooks";

export function LaunchChoicesSectionV4() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="v3-section" id="register" aria-labelledby="launch-choices-heading" style={{ scrollMarginTop: 80 }}>
      <SectionScan />
      <div className="v3-wrap grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]" ref={ref}>
        <div>
          <Kicker>{site.ev.kickers.register}</Kicker>
          <h2 id="launch-choices-heading" className="v3-display mt-5" style={{ fontSize: "clamp(36px,5.4vw,72px)" }}>
            {site.register.heading}
          </h2>
          <p className="mt-6" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 520 }}>
            {site.register.body}
          </p>
        </div>

        <nav aria-label="Choose how to get started" className="grid gap-4 sm:grid-cols-2">
          <Link
            href={site.cta.primary.href}
            className="v3-panel v3-corner group flex min-h-52 flex-col justify-between p-6 transition-colors hover:border-[var(--v3-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--v3-accent)] sm:p-7"
          >
            <span>
              <span className="v3-mono block" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--v3-accent)" }}>OPTION 01 // GET THE GUIDE</span>
              <span className="v3-display mt-4 block" style={{ fontSize: 25, color: "var(--v3-ink)" }}>{site.cta.primary.label}</span>
              <span className="mt-3 block" style={{ fontSize: 14.5, color: "var(--v3-mut)", lineHeight: 1.55 }}>{site.register.primaryDescription}</span>
            </span>
            <span className="v3-mono mt-6 inline-flex items-center gap-2" style={{ fontSize: 12, color: "var(--v3-accent)" }}>
              GET STARTED <ArrowRightIcon className="h-4 w-4" />
            </span>
          </Link>

          <Link
            href={site.cta.secondary.href}
            className="v3-panel v3-corner group flex min-h-52 flex-col justify-between p-6 transition-colors hover:border-[var(--v3-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--v3-accent)] sm:p-7"
          >
            <span>
              <span className="v3-mono block" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--v3-accent)" }}>OPTION 02 // TALK IT THROUGH</span>
              <span className="v3-display mt-4 block" style={{ fontSize: 25, color: "var(--v3-ink)" }}>{site.cta.secondary.label}</span>
              <span className="mt-3 block" style={{ fontSize: 14.5, color: "var(--v3-mut)", lineHeight: 1.55 }}>{site.register.secondaryDescription}</span>
            </span>
            <span className="v3-mono mt-6 inline-flex items-center gap-2" style={{ fontSize: 12, color: "var(--v3-accent)" }}>
              VIEW TIMES <ArrowRightIcon className="h-4 w-4" />
            </span>
          </Link>
        </nav>
      </div>
    </section>
  );
}
