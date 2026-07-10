import { site } from "@/config/site";
import { CheckIcon } from "./Icons";

/**
 * SECTION 7 — Proof II: Results. Concrete, specific documented outcomes as
 * plain text (skimmable + indexable). Disclaimer visible in the same viewport.
 * White background. (structure §7)
 *
 * ⚠️ Results re-captioned from the prior site — confirm each with Vance.
 */
export function ProofResults() {
  return (
    <section className="bg-card">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="text-center text-3xl sm:text-4xl">
          {site.proofResults.heading}
        </h2>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {site.proofResults.results.map((result) => (
            <li
              key={result}
              className="flex items-start gap-3 rounded-xl border border-mist bg-cloud p-5 shadow-card"
            >
              <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-green" />
              <span className="text-body">{result}</span>
            </li>
          ))}
        </ul>

        {/* Required results disclaimer — legible (14px min), same viewport. */}
        <p className="mt-6 text-center text-sm text-slate">
          {site.proofResults.disclaimer}
        </p>
      </div>
    </section>
  );
}
