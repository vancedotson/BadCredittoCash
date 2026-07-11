import { site } from "@/config/site-v2";

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
          <h2 className="text-4xl sm:text-5xl lg:text-6xl">
            The questions everyone asks
          </h2>
        </div>

        <div className="mt-12 divide-y divide-mist border-y border-mist">
          {site.faq.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg py-6 outline-none focus-visible:ring-2 focus-visible:ring-gold/50">
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

        {/* Blueprint: FAQ links back to the primary CTA. */}
        <div className="mt-10 text-center">
          <a
            href="#register"
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-gold px-7 py-3.5 font-heading text-base font-semibold text-ink outline-none transition-colors hover:bg-gold-deep focus-visible:ring-2 focus-visible:ring-ink/30"
          >
            Get my questions answered — free
          </a>
          <p className="mt-3 text-sm text-slate">
            Still unsure? The free call&apos;s whole job is to tell you if you
            even have a case.
          </p>
        </div>
      </div>
    </section>
  );
}
