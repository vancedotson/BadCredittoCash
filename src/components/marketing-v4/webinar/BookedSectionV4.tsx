"use client";

import Link from "next/link";
import { site } from "@/config/site-v3";
import { Kicker, SectionScan } from "../../marketing-v3/shared/primitives";
import { useReveal } from "../../marketing-v3/shared/hooks";
import { CheckIcon, PhoneIcon } from "@/components/marketing-v2/Icons";

/**
 * /webinar/booked — the onboarding step after the call is booked. Captures
 * decision momentum with a "start here" checklist so the call is productive
 * (ebook §2.2, the thank-you page). Also the honest in-crisis path.
 */
const wb = site.webinar;

export function BookedSectionV4() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="v3-section" style={{ paddingTop: "clamp(56px,8vw,120px)" }}>
      <SectionScan />
      <div className="v3-wrap" style={{ maxWidth: 720 }} ref={ref}>
        <div className="mx-auto grid place-items-center" style={{ width: 56, height: 56, borderRadius: "50%", background: "color-mix(in srgb, var(--v3-accent) 20%, transparent)", border: "1px solid var(--v3-accent)", color: "var(--v3-accent)" }}>
          <CheckIcon className="h-7 w-7" />
        </div>
        <div className="mt-6 text-center">
          <Kicker>{wb.booked.kicker}</Kicker>
          <h1 className="v3-display mt-4" style={{ fontSize: "clamp(32px,4.6vw,56px)" }}>
            {wb.booked.heading}
          </h1>
          <p className="mx-auto mt-5" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 560 }}>
            {wb.booked.body}
          </p>
        </div>

        <div className="v3-panel v3-corner mt-9 p-7 sm:p-9" style={{ borderRadius: 4 }}>
          <span className="v3-mono" style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--v3-accent)" }}>
            Start here // before we talk
          </span>
          <ol className="mt-4 flex flex-col gap-4">
            {wb.booked.checklist.map((step, i) => (
              <li key={step} className="flex items-start gap-4">
                <span className="v3-display" style={{ fontSize: 22, color: "var(--v3-accent)", lineHeight: 1, minWidth: 28 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ color: "var(--v3-mut)", fontSize: 15.5, lineHeight: 1.5 }}>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* In-crisis path — don't make someone being harassed wait */}
        <p className="mt-7 text-center" style={{ fontSize: 14, color: "var(--v3-mut)" }}>
          Being harassed right now and can&apos;t wait?{" "}
          <a
            href={site.contact.phoneHref}
            className="inline-flex items-center gap-1.5"
            style={{ color: "var(--v3-accent)", fontWeight: 600 }}
          >
            <PhoneIcon className="h-4 w-4" />
            Call {site.contact.phoneDisplay}
          </a>
        </p>

        <div className="mt-8 text-center">
          <Link href="/v4" className="v3-btn v3-btn-ghost" style={{ minHeight: 46 }}>
            Back to the case file
          </Link>
        </div>
      </div>
    </section>
  );
}
