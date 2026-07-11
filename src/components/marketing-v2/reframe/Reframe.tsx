import { site } from "@/config/site-v2";
import { ScaleIcon, CheckIcon } from "../Icons";

const before = ["I owe them.", "I must have messed up.", "Nothing I do works."];
const after = [
  "They reported it wrong — that's on them.",
  "They harassed you — that crossed a legal line.",
  "The law already backs you.",
];

/**
 * The Reframe (chosen) — a "Big Spotlight" header (oversized headline, scales
 * watermark, FCRA/FDCPA tags) over the Before -> After columns that flip her
 * self-blame into the truth: the law is on her side.
 */
export function Reframe() {
  const { kicker, headline, note, laws } = site.reframe;
  return (
    <section className="relative overflow-hidden bg-sky">
      <ScaleIcon
        aria-hidden
        className="pointer-events-none absolute -right-10 top-20 h-72 w-72 text-trust/5"
      />
      <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-24">
        {/* Spotlight header */}
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-trust">
            {kicker}
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-4xl leading-[1.05] sm:text-6xl">
            {headline}
          </h2>
          <div className="mt-7 flex items-center justify-center gap-3">
            {laws.map((law) => (
              <span
                key={law.abbr}
                className="rounded-full border border-trust/30 bg-card px-4 py-1.5 font-heading text-sm font-semibold text-trust"
              >
                {law.abbr}
              </span>
            ))}
          </div>
        </div>

        {/* Before -> After columns */}
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-mist bg-card p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">
              What you tell yourself
            </p>
            <ul className="mt-6 space-y-4">
              {before.map((t) => (
                <li
                  key={t}
                  className="text-xl text-slate line-through decoration-slate/40"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-navy p-8 text-white shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">
              The truth
            </p>
            <ul className="mt-6 space-y-4">
              {after.map((t) => (
                <li key={t} className="flex items-start gap-3 text-xl">
                  <CheckIcon className="mt-1.5 h-5 w-5 shrink-0 text-gold" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-10 text-center text-lg text-body">{note}</p>
      </div>
    </section>
  );
}
