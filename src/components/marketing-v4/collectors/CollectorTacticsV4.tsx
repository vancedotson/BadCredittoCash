import Link from "next/link";
import { SectionScan } from "../../marketing-v3/shared/primitives";
import { ArrowRightIcon } from "@/components/marketing-v2/Icons";
import { COLLECTORS } from "@/config/collector-quiz";

/**
 * "Know the playbook" — a two-column education section between the testimonials
 * ("on the record") and the getting-started/intake section. Left: how these
 * debt buyers operate (honest, no fake scarcity; general to the category, never
 * a claim about a specific company). Right: a bento of collector name-tiles that
 * wobble on hover, anchored by a feature CTA cell. (Swap tiles for real logo
 * images later if licensed.)
 */

const INTRO =
  "Most of the names on this list are debt buyers. They purchase old, charged-off accounts in bulk for pennies on the dollar, then work to collect the full balance. Here is how it usually plays out.";

const HOW = [
  "They buy debt in bulk, sometimes without the paperwork to prove the balance is yours.",
  "They count on you not knowing your rights, or being too worn down to push back.",
  "Repeated calls, letters, and credit-report entries are built to pressure a fast payment.",
  "Old or disputed debt can be re-sold and reappear under a different name.",
];

const labelStyle = { fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "var(--v3-faint)" };

export function CollectorTacticsV4() {
  return (
    <section className="v3-section" id="playbook">
      <SectionScan />
      <div className="v3-wrap grid items-start gap-x-14 gap-y-12 lg:grid-cols-[1.02fr_0.98fr]">
        {/* Left — education */}
        <div className="min-w-0">
          <span className="v3-mono" style={{ fontSize: 12, letterSpacing: "0.22em", color: "var(--v3-accent)" }}>KNOW THE PLAYBOOK</span>
          <h2 className="v3-display mt-4" style={{ fontSize: "clamp(32px,4.4vw,54px)", lineHeight: 1.04 }}>How these collectors operate.</h2>
          <p className="mt-5" style={{ maxWidth: 560, fontSize: 18, lineHeight: 1.65, color: "var(--v3-mut)" }}>{INTRO}</p>

          <div className="mt-9">
            <span className="v3-mono" style={labelStyle}>How they get people</span>
            <ul className="mt-3.5 flex flex-col gap-3.5">
              {HOW.map((t) => (
                <li key={t} className="flex items-start gap-3" style={{ fontSize: 16.5, lineHeight: 1.55, color: "var(--v3-mut)" }}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--v3-accent)" }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right — bento of collector tiles + a feature CTA cell */}
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ gridAutoRows: "84px", gridAutoFlow: "dense" }}>
            {/* Feature CTA — spans 2x2 */}
            <Link href="/book" className="v4-bento-cta col-span-2 row-span-2 flex flex-col justify-between rounded-md p-5 no-underline">
              <span className="v3-mono" style={{ fontSize: 10.5, letterSpacing: "0.18em", color: "var(--v3-accent)" }}>THE USUAL SUSPECTS</span>
              <div>
                <p className="v3-display" style={{ fontSize: "clamp(20px,2.2vw,26px)", lineHeight: 1.1, color: "var(--v3-ink)" }}>Recognize a name?</p>
                <p className="mt-1.5" style={{ fontSize: 13.5, lineHeight: 1.45, color: "var(--v3-mut)" }}>You are not the first they have called. Let us look at yours.</p>
              </div>
              <span className="v3-mono inline-flex items-center gap-1.5" style={{ fontSize: 12.5, color: "var(--v3-accent)" }}>
                Book my free call <ArrowRightIcon className="h-3.5 w-3.5" />
              </span>
            </Link>

            {/* Collector tiles — wobble on hover */}
            {COLLECTORS.map((name) => (
              <div key={name} className="v4-logo-tile grid place-items-center rounded-md px-2 text-center">
                <span className="v3-mono" style={{ fontSize: 12, lineHeight: 1.3 }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
