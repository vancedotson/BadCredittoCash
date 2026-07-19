import { SectionScan } from "../../marketing-v3/shared/primitives";
import { CheckIcon } from "@/components/marketing-v2/Icons";
import { COLLECTORS } from "@/config/collector-quiz";

/**
 * "Know the playbook" — a two-column education section between the testimonials
 * ("on the record") and the getting-started/intake section. Left: how these
 * debt buyers operate and what to watch for (honest, no fake scarcity; framed
 * around the consumer's FDCPA/FCRA rights, general to the category — never a
 * claim about a specific company). Right: a grid of collector name-tiles that
 * wobble on hover. (Swap the tiles for real logo images later if licensed.)
 */

const INTRO =
  "Most of the names on this list are debt buyers. They purchase old, charged-off accounts in bulk for pennies on the dollar, then work to collect the full balance. Here is how it usually plays out, and what is worth watching for.";

const HOW = [
  "They buy debt in bulk, sometimes without the paperwork to prove the balance is yours.",
  "They count on you not knowing your rights, or being too worn down to push back.",
  "Repeated calls, letters, and credit-report entries are built to pressure a fast payment.",
  "Old or disputed debt can be re-sold and reappear under a different name.",
];

const WATCH = [
  "Can they validate the debt in writing when you ask?",
  "Is it past your state's statute of limitations?",
  "Is it accurate, and listed only once, on your credit report?",
  "Are the calls following the rules on timing and frequency?",
];

const labelStyle = { fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "var(--v3-faint)" };

export function CollectorTacticsV4() {
  return (
    <section className="v3-section" id="playbook">
      <SectionScan />
      <div className="v3-wrap grid items-start gap-x-14 gap-y-12 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left — education */}
        <div className="min-w-0">
          <span className="v3-mono" style={{ fontSize: 12, letterSpacing: "0.22em", color: "var(--v3-accent)" }}>KNOW THE PLAYBOOK</span>
          <h2 className="v3-display mt-4" style={{ fontSize: "clamp(32px,4.4vw,54px)", lineHeight: 1.04 }}>How these collectors operate.</h2>
          <p className="mt-5" style={{ maxWidth: 560, fontSize: 18, lineHeight: 1.65, color: "var(--v3-mut)" }}>{INTRO}</p>

          <div className="mt-9">
            <span className="v3-mono" style={labelStyle}>How they get people</span>
            <ul className="mt-3.5 flex flex-col gap-3">
              {HOW.map((t) => (
                <li key={t} className="flex items-start gap-3" style={{ fontSize: 16, lineHeight: 1.55, color: "var(--v3-mut)" }}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--v3-accent)" }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8">
            <span className="v3-mono" style={labelStyle}>What to pay attention to</span>
            <ul className="mt-3.5 flex flex-col gap-3">
              {WATCH.map((t) => (
                <li key={t} className="flex items-start gap-3" style={{ fontSize: 16, lineHeight: 1.55, color: "var(--v3-ink)" }}>
                  <span style={{ color: "var(--v3-accent)", marginTop: 2 }}><CheckIcon className="h-4 w-4" /></span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right — collector name tiles that wobble on hover */}
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COLLECTORS.map((name) => (
              <div key={name} className="v4-logo-tile grid min-h-[86px] place-items-center rounded-md px-3 py-4 text-center">
                <span className="v3-mono" style={{ fontSize: 12.5, lineHeight: 1.35 }}>{name}</span>
              </div>
            ))}
          </div>
          <p className="v3-mono mt-4 text-center" style={{ fontSize: 11.5, color: "var(--v3-faint)", letterSpacing: "0.04em" }}>
            Recognize one? That is the whole point. Book a call and let us look at it.
          </p>
        </div>
      </div>
    </section>
  );
}
