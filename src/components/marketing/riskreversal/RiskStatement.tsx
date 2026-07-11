import Image from "next/image";
import { site } from "@/config/site";
import { CheckIcon } from "../Icons";

/** Layered portrait: Vance (transparent cutout) over the OKC night skyline,
 *  with gradients and a name caption. Fills whatever relative parent holds it. */
function PortraitLayers() {
  return (
    <>
      <Image
        src="/oklahoma-night.png"
        alt=""
        aria-hidden
        fill
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-cover object-center"
      />
      {/* fade the left edge into the section + ground the bottom */}
      <div className="absolute inset-0 bg-gradient-to-r from-darkblue via-darkblue/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-darkblue/70 to-transparent" />
      <Image
        src="/vance2.png"
        alt="Vance Dotson, consumer credit advocate"
        fill
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-contain object-bottom drop-shadow-2xl"
      />
      <div className="absolute bottom-8 left-8 z-10 sm:left-10">
        <p className="font-display text-2xl leading-none text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.6)]">
          Vance Dotson
        </p>
        <p className="mt-1 text-sm font-medium text-gold [text-shadow:0_2px_8px_rgba(0,0,0,0.6)]">
          Consumer Advocate · since 2004
        </p>
      </div>
    </>
  );
}

/**
 * Risk Reversal — "Giant Statement".
 * A huge reassurance headline (left) beside a full-height portrait of Vance in
 * front of the Oklahoma City night skyline that bleeds to the right edge.
 */
export function RiskStatement() {
  const { heading, points, guaranteeNote } = site.riskReversal;
  return (
    <section className="relative overflow-hidden bg-darkblue">
      {/* full-height portrait, flush to the right edge (desktop) */}
      <div className="absolute inset-y-0 right-0 hidden w-[56%] lg:block">
        <PortraitLayers />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-28 sm:px-6 sm:py-40 lg:min-h-[46rem]">
        <div className="lg:flex lg:min-h-[34rem] lg:w-[46%] lg:flex-col lg:justify-center lg:pr-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
            No risk
          </p>
          <h2 className="mt-4 text-5xl leading-[1.03] text-white sm:text-6xl lg:text-7xl">
            {heading}
          </h2>

          <div className="mt-8 flex flex-wrap gap-3">
            {points.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-white/85"
              >
                <CheckIcon className="h-4 w-4 shrink-0 text-gold" />
                {p}
              </span>
            ))}
          </div>

          {guaranteeNote ? (
            <p className="mt-8 font-heading font-semibold text-white">
              {guaranteeNote}
            </p>
          ) : null}
        </div>

        {/* stacked portrait (mobile) */}
        <div className="relative mx-auto mt-12 aspect-[4/5] w-full max-w-sm overflow-hidden rounded-3xl ring-1 ring-white/10 lg:hidden">
          <PortraitLayers />
        </div>
      </div>
    </section>
  );
}
