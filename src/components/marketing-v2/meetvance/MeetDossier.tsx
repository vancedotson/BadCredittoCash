import Image from "next/image";
import { site } from "@/config/site-v2";
import { CheckIcon } from "../Icons";

const MARQUEE = Array.from({ length: 12 });

/**
 * Meet Vance (chosen) — "The Dossier" on a dark-blue (almost-black) stage.
 * A continuous "VANCE DOTSON" marquee scrolls across the back; Vance is
 * oversized and bleeds off the bottom (like he's walking off the page); the
 * case-file panel sits on the right.
 */
export function MeetDossier() {
  const { heading, body, signoff, credentials } = site.meetVance;
  return (
    <section className="relative overflow-hidden bg-darkblue text-white">
      {/* Continuous name marquee (backdrop) */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-0 flex -translate-y-1/2 overflow-hidden">
        <div className="flex w-max shrink-0 items-center whitespace-nowrap will-change-transform [animation:marquee_34s_linear_infinite] motion-reduce:[animation:none]">
          {MARQUEE.map((_, i) => (
            <span
              key={i}
              className="flex items-center font-display text-[clamp(3rem,9vw,6rem)] font-bold uppercase leading-none text-white/[0.16]"
            >
              Vance Dotson
              <span className="mx-8 text-gold/40">•</span>
            </span>
          ))}
        </div>
      </div>

      {/* Oversized Vance — aligned to the content container, bleeding off the
          bottom, with a black -> transparent gradient over his lower half. */}
      <div className="pointer-events-none absolute inset-0 z-10 mx-auto hidden max-w-6xl px-4 sm:px-6 lg:block">
        <Image
          src="/vance2.png"
          alt="Vance Dotson, consumer advocate, holding client case files"
          width={620}
          height={930}
          priority
          sizes="460px"
          className="absolute -bottom-[12%] left-0 h-[110%] w-auto object-contain object-top drop-shadow-2xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-[12%] left-0 h-[110%] aspect-[62/93] bg-gradient-to-t from-black to-transparent"
        />
      </div>

      <div className="relative z-20 mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-2 lg:gap-12">
        {/* Vance in flow on mobile */}
        <div className="flex justify-center lg:hidden">
          <Image
            src="/vance2.png"
            alt=""
            aria-hidden
            width={520}
            height={780}
            className="h-auto w-full max-w-xs object-contain drop-shadow-2xl"
          />
        </div>
        <div className="hidden lg:block" aria-hidden />

        {/* Case-file panel */}
        <div className="relative">
          <span className="absolute -top-4 left-8 rounded-t-lg bg-gold px-5 py-1.5 font-heading text-xs font-semibold uppercase tracking-wider text-ink">
            Case: Vance Dotson
          </span>
          <span className="absolute -right-3 -top-3 z-10 flex h-20 w-20 rotate-12 items-center justify-center rounded-full border-2 border-gold text-center font-heading text-[11px] font-bold uppercase leading-tight text-gold">
            Since
            <br />
            2004
          </span>

          <div className="rounded-2xl bg-card p-8 text-body shadow-2xl">
            <h2 className="text-3xl sm:text-4xl">{heading}</h2>
            {body.map((para) => (
              <p key={para} className="mt-4 leading-relaxed text-slate">
                {para}
              </p>
            ))}

            <ul className="mt-6 space-y-2 border-t border-mist pt-6">
              {credentials.map((c) => (
                <li key={c} className="flex items-start gap-2 text-sm text-body">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-green" />
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-6 font-display text-xl tracking-wide text-heading">
              {signoff}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
