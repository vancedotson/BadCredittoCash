import { site } from "@/config/site";

/**
 * Testimonials — "Marquee".
 * Two rows of quote cards gliding past in opposite directions on a light
 * section, edges faded, pausing on hover. Feels alive and scales to any number
 * of quotes. The scroll pauses for prefers-reduced-motion users.
 */
type Item = { quote: string; name: string };

function Card({ t }: { t: Item }) {
  return (
    <figure className="w-80 shrink-0 rounded-2xl border border-mist bg-card p-6 shadow-card">
      <span aria-hidden className="font-display text-4xl leading-none text-gold/50">
        &ldquo;
      </span>
      <p className="-mt-3 font-serif text-lg italic leading-snug text-heading">
        {t.quote}
      </p>
      <figcaption className="mt-3 text-xs font-semibold uppercase tracking-wide text-gold-deep">
        {t.name}
      </figcaption>
    </figure>
  );
}

export function TestiMarquee() {
  const { heading, items } = site.testimonials;
  const track = [...items, ...items];
  const fade =
    "[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]";

  return (
    <section className="overflow-hidden bg-cloud">
      <div className="py-20 sm:py-28">
        <div className="mx-auto mb-12 max-w-6xl px-4 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">
            Real people. Real relief.
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl">{heading}</h2>
        </div>

        <div className={`flex ${fade}`}>
          <div className="flex w-max gap-4 pl-4 [animation:ticker_38s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:[animation:none]">
            {track.map((t, i) => (
              <Card key={i} t={t} />
            ))}
          </div>
        </div>
        <div className={`mt-4 flex ${fade}`}>
          <div className="flex w-max gap-4 pl-4 [animation:ticker_46s_linear_infinite_reverse] hover:[animation-play-state:paused] motion-reduce:[animation:none]">
            {track.map((t, i) => (
              <Card key={i} t={t} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
