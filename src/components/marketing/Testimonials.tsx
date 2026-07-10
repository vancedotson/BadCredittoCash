import { site } from "@/config/site";
import { PlayIcon } from "./Icons";

/**
 * SECTION 8 — Proof III: Testimonials. Peer proof (not authority) that lowers
 * her guard. Lead each with the one-line result; quote pull-outs captioned.
 * Cloud background. (structure §8)
 *
 * ⚠️ PLACEHOLDER — swap in real video testimonials + names/permission.
 */
export function Testimonials() {
  return (
    <section className="bg-cloud">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="text-center text-3xl sm:text-4xl">
          {site.testimonials.heading}
        </h2>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {site.testimonials.items.map((item) => (
            <figure
              key={item.quote}
              className="overflow-hidden rounded-xl border border-mist bg-card shadow-card"
            >
              <div className="flex aspect-video items-center justify-center bg-gradient-to-b from-sky to-mist">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold text-ink">
                  <PlayIcon className="h-6 w-6" />
                </span>
              </div>
              <blockquote className="px-6 py-5">
                <p className="font-serif text-xl leading-snug text-heading">
                  “{item.quote}”
                </p>
                <figcaption className="mt-3 text-sm font-medium text-slate">
                  {item.name}
                </figcaption>
              </blockquote>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
