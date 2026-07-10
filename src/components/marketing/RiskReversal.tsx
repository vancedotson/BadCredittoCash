import { site } from "@/config/site";
import { CheckIcon } from "./Icons";

/**
 * SECTION 11 — Risk Reversal. Shrink the perceived risk of the first step to
 * near-zero. Reassuring, warm. Sky Tint background. (structure §11)
 *
 * ⚠️ The money-back guarantee (50% vs 100% contradiction) is intentionally
 *    NOT published here — it needs reconciliation + CROA legal review. Until
 *    then we use only the naturally-true "free call" framing.
 */
export function RiskReversal() {
  return (
    <section className="bg-sky">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="rounded-2xl border border-mist bg-card p-8 shadow-card sm:p-10">
          <h2 className="text-2xl sm:text-3xl">{site.riskReversal.heading}</h2>

          <ul className="mt-6 space-y-3">
            {site.riskReversal.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-lg text-body">
                <CheckIcon className="mt-1 h-5 w-5 shrink-0 text-green" />
                {point}
              </li>
            ))}
          </ul>

          {site.riskReversal.guaranteeNote ? (
            <p className="mt-6 border-t border-mist pt-6 font-heading font-semibold text-heading">
              {site.riskReversal.guaranteeNote}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
