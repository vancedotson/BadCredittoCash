import Image from "next/image";
import { site } from "@/config/site-v2";
import { CheckIcon, PersonIcon } from "../Icons";

/**
 * Testimonials — "Marquee".
 * Two rows of quote cards gliding past in opposite directions on a light
 * section, edges faded, pausing on hover. Feels alive and scales to any number
 * of quotes. The scroll pauses for prefers-reduced-motion users.
 *
 * Each card carries a one-line result + a face/name byline (real photo when
 * provided; a neutral avatar placeholder otherwise — never gradient-initials
 * or an AI face).
 */
type Item = {
  quote: string;
  name: string;
  location: string;
  result: string;
  photo: string;
};

function Card({ t }: { t: Item }) {
  return (
    <figure className="w-80 shrink-0 rounded-2xl border border-mist bg-card p-6 shadow-card">
      <span aria-hidden className="font-display text-4xl leading-none text-gold/50">
        &ldquo;
      </span>
      <p className="-mt-3 font-serif text-lg italic leading-snug text-heading">
        {t.quote}
      </p>
      {t.result ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-green">
          <CheckIcon className="h-4 w-4 shrink-0" />
          {t.result}
        </p>
      ) : null}
      <figcaption className="mt-4 flex items-center gap-3 border-t border-mist pt-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-mist text-slate">
          {t.photo ? (
            <Image
              src={t.photo}
              alt={t.name}
              width={36}
              height={36}
              className="h-full w-full object-cover"
            />
          ) : (
            <PersonIcon className="h-5 w-5" />
          )}
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-heading">
            {t.name}
          </span>
          <span className="block text-xs text-slate">{t.location}</span>
        </span>
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
          <h2 className="text-3xl sm:text-4xl">{heading}</h2>
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
