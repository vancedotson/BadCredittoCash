import { site } from "@/config/site";

/**
 * FAQ — Option 1: "Big Accordion".
 * Large display questions with a gold +/× toggle, native <details> so it's
 * accessible and JS-free. Answers fade in on open.
 */
export function FaqAccordion() {
  return (
    <section id="faq" className="scroll-mt-24 bg-cloud">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">
            Honest answers
          </p>
          <h2 className="mt-3 text-4xl sm:text-5xl lg:text-6xl">
            The questions everyone asks
          </h2>
        </div>

        <div className="mt-12 divide-y divide-mist border-y border-mist">
          {site.faq.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6">
                <span className="font-display text-xl leading-tight text-heading sm:text-2xl">
                  {item.q}
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-2xl leading-none text-gold-deep transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="-mt-1 pb-6 leading-relaxed text-slate group-open:animate-[fadeup_0.3s_ease-out]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
