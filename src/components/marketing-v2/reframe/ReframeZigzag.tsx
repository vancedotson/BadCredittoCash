import { site } from "@/config/site-v2";
import { ImageIcon } from "../Icons";

/**
 * Reframe — zig-zag education rows. Alternating image / text that teach the
 * reader their rights (FCRA / FDCPA) in plain, relatable, convincing language
 * (brand voice: name the enemy, first-person, dignity-first, no hype).
 * ⚠️ Images are placeholders — swap the dashed boxes for real assets.
 */
export function ReframeZigzag() {
  const { zigzagHeading, zigzag } = site.reframe;
  return (
    <section className="bg-card">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <h2 className="mx-auto max-w-2xl text-center text-3xl sm:text-4xl">
          {zigzagHeading}
        </h2>

        <div className="mt-16 space-y-16 sm:space-y-20">
          {zigzag.map((row, i) => {
            const flip = i % 2 === 1;
            return (
              <div
                key={row.title}
                className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-14"
              >
                {/* Image placeholder */}
                <div className={flip ? "lg:order-2" : ""}>
                  <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-mist bg-cloud px-6 text-slate">
                    <ImageIcon className="h-10 w-10 text-slate/50" />
                    <p className="max-w-xs text-center text-xs text-slate/70">
                      {row.imageHint}
                    </p>
                  </div>
                </div>

                {/* Text */}
                <div className={flip ? "lg:order-1" : ""}>
                  <span className="font-display text-2xl text-gold">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-2xl sm:text-3xl">{row.title}</h3>
                  <p className="mt-4 text-lg leading-relaxed text-slate">
                    {row.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
