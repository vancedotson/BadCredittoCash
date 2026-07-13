"use client";

import { site } from "@/config/site-v3";
import { Kicker, SectionScan } from "../../marketing-v3/shared/primitives";
import { useReveal } from "../../marketing-v3/shared/hooks";
import { RegistrationFormV3 } from "../../marketing-v3/shared/RegistrationFormV3";

/**
 * v4 "Submit // Open your case" (final CTA + registration). Same shell/form as
 * the shared RegisterSection, but the headline accents "carrying this alone"
 * in gold. Keeps id="register" so the sticky-reveal stack + anchors still work.
 */
const HEADING = site.finalCta.heading; // "You've been carrying this alone. You don't have to anymore."
const PHRASE = "carrying this alone";
const idx = HEADING.indexOf(PHRASE);

export function RegisterSectionV4() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="v3-section" id="register" style={{ scrollMarginTop: 80 }}>
      <SectionScan />
      <div className="v3-wrap grid items-center gap-12 lg:grid-cols-2" ref={ref}>
        <div>
          <Kicker>{site.ev.kickers.register}</Kicker>
          <h2 className="v3-display mt-5" style={{ fontSize: "clamp(36px,5.4vw,72px)" }}>
            {idx >= 0 ? (
              <>
                {HEADING.slice(0, idx)}
                <span style={{ color: "var(--v3-accent)" }}>{PHRASE}</span>
                {HEADING.slice(idx + PHRASE.length)}
              </>
            ) : (
              HEADING
            )}
          </h2>
          <p className="mt-6" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 520 }}>
            {site.register.body}
          </p>
          <div
            className="v3-mono mt-8 flex flex-col gap-2"
            style={{ fontSize: 12.5, color: "var(--v3-faint)", letterSpacing: "0.06em" }}
          >
            {site.ev.terminal.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
        <div className="v3-panel v3-corner p-7 sm:p-9" style={{ borderRadius: 4 }}>
          <div className="mb-6 flex items-center justify-between">
            <span className="v3-display" style={{ fontSize: 24 }}>
              {site.register.heading}
            </span>
          </div>
          <RegistrationFormV3 redirectTo="/webinar/confirmed" />
        </div>
      </div>
    </section>
  );
}
