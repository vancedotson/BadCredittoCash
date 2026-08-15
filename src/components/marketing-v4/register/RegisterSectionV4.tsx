"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
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

const registrationFormProps = {
  redirectTo: "/webinar/confirmed",
  showPhone: false,
  submitLabel: "Send me the free training",
  loadingLabel: "Sending your link...",
  reassurance: "Free training. No payment. No obligation. Your link arrives by email.",
} as const;

function ReviewableRegistrationForm() {
  const reviewState = useSearchParams().get("state");
  const previewState =
    reviewState === "registration-invalid"
      ? "invalid"
      : reviewState === "registration-error"
        ? "server-error"
        : reviewState === "registration-loading"
          ? "submitting"
        : undefined;

  return (
    <RegistrationFormV3
      key={previewState ?? "normal"}
      {...registrationFormProps}
      previewState={previewState}
    />
  );
}

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
            Watch the free training to understand what may be wrong, what the law says, and what you can do next. No payment. No obligation.
          </p>
          <div
            className="v3-mono mt-8 hidden flex-col gap-2 sm:flex"
            style={{ fontSize: 12.5, color: "var(--v3-faint)", letterSpacing: "0.06em" }}
          >
            {site.ev.terminal.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
        <div className="v3-panel v3-corner p-7 sm:p-9" style={{ borderRadius: 4 }}>
          <div className="mb-6">
            <h3 className="v3-display" style={{ fontSize: 28 }}>
              Get the free training.
            </h3>
            <p className="mt-3" style={{ color: "var(--v3-mut)", fontSize: 14.5, lineHeight: 1.5 }}>
              Tell me where to send your private watch link.
            </p>
          </div>
          <Suspense fallback={<RegistrationFormV3 {...registrationFormProps} />}>
            <ReviewableRegistrationForm />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
