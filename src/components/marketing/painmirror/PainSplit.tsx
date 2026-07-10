import { site } from "@/config/site";

/**
 * Pain Mirror (new) 1 — "Sticky Split".
 * Asymmetric editorial: the heading + pivot stay pinned on the left while a
 * big numbered rundown of the pain points reads down the right.
 */
export function PainSplit() {
  const { heading, points, pivot } = site.painMirror;
  return (
    <section className="bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="text-4xl leading-tight sm:text-5xl">{heading}</h2>
          <p className="mt-8 max-w-xs font-heading text-xl font-semibold leading-snug text-heading">
            {pivot}
          </p>
        </div>

        <ol className="divide-y divide-mist border-t border-mist">
          {points.map((point, i) => (
            <li key={point} className="flex gap-5 py-6">
              <span className="font-display text-2xl leading-none text-gold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-lg leading-relaxed text-body">{point}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
