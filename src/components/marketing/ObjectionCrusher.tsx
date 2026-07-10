import { site } from "@/config/site";

/**
 * SECTION 10 — Objection Crusher (FAQ). Dissolve the specific fears that stop
 * the booking, in her order of priority: scam → legal → different → cost →
 * judgment. Accordion, plain confident answers. White background. (structure §10)
 */
export function ObjectionCrusher() {
  return (
    <section id="faq" className="scroll-mt-20 bg-card">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="text-center text-3xl sm:text-4xl">
          The questions everyone asks
        </h2>

        <div className="mt-10 divide-y divide-mist overflow-hidden rounded-xl border border-mist">
          {site.faq.map((item) => (
            <details key={item.q} className="group px-5 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-heading text-lg font-semibold text-heading">
                {item.q}
                <span className="shrink-0 text-2xl leading-none text-trust transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-5 leading-relaxed text-slate">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
