import { site } from "@/config/site-v2";
import { CtaButtons } from "../CtaButtons";

/**
 * How It Works — "Poster Steps" (sticky stack).
 * Big navy/gold colour-blocked step tiles with huge display numbers. Each tile
 * is tall and `position: sticky`, so as you scroll the next tile rides up and
 * stacks on top of the previous one — a card deck that assembles on scroll.
 * Pure CSS (sticky); no JS, and no motion for reduced-motion users to worry
 * about since it's layout, not animation.
 */
export function StepsPoster() {
  const { heading, steps } = site.howItWorks;
  return (
    <section id="how" className="scroll-mt-24 bg-cloud">
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="text-center">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl">{heading}</h2>
        </div>

        <div className="mt-12">
          {steps.map((s, i) => {
            const gold = i % 2 === 1;
            return (
              <div
                key={s.title}
                className="sticky"
                style={{ top: `calc(6rem + ${i * 1.75}rem)`, zIndex: i + 1 }}
              >
                <div
                  className={`mb-6 flex min-h-[320px] items-center gap-6 rounded-3xl p-8 shadow-[0_20px_50px_rgba(10,26,46,0.25)] sm:min-h-[400px] sm:gap-10 sm:p-12 ${
                    gold ? "bg-gold text-ink" : "bg-navy text-white"
                  }`}
                >
                  <span
                    className={`shrink-0 font-display text-7xl leading-none sm:text-9xl ${
                      gold ? "text-ink/25" : "text-gold"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3
                      className={`font-display text-2xl leading-tight sm:text-4xl ${
                        gold ? "text-ink" : "text-white"
                      }`}
                    >
                      {s.title}
                    </h3>
                    <p
                      className={`mt-3 text-lg ${
                        gold ? "text-ink/70" : "text-white/70"
                      }`}
                    >
                      {s.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex justify-center">
          <CtaButtons tone="light" />
        </div>
      </div>
    </section>
  );
}
