import { site } from "@/config/site";
import { CtaButtons } from "./CtaButtons";

/**
 * SECTION 9 — How It Works. Remove friction; make the path feel simple and
 * safe. Emphasize step 1 is free and low-commitment. Repeat dual CTA.
 * Sky Tint background. (structure §9)
 */
export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 bg-sky">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="text-center text-3xl sm:text-4xl">
          {site.howItWorks.heading}
        </h2>

        <ol className="mt-12 space-y-6">
          {site.howItWorks.steps.map((step, i) => (
            <li key={step.title} className="flex items-start gap-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy font-heading text-xl font-bold text-white">
                {i + 1}
              </span>
              <div className="pt-1">
                <h3 className="text-xl">{step.title}</h3>
                <p className="mt-1 text-slate">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex justify-center">
          <CtaButtons tone="light" />
        </div>
      </div>
    </section>
  );
}
