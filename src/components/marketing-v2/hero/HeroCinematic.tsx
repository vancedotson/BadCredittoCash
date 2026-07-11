import Image from "next/image";
import Link from "next/link";
import { site } from "@/config/site-v2";
import { HeroCtas } from "./HeroCtas";
import { PlayIcon, CheckIcon } from "../Icons";

/**
 * Hero Option 3 — "Cinematic".
 * Full-bleed, heavily-tinted OKC skyline; Vance stands large on the right; an
 * oversized display headline dominates the left and overlaps him for depth
 * (text in front, Vance behind). Immersive, poster-like. Contained height.
 */
export function HeroCinematic() {
  return (
    <section className="relative min-h-[560px] overflow-hidden text-white sm:min-h-[640px] lg:min-h-[780px]">
      {/* OKC skyline — day (light theme) / night (dark theme) */}
      <Image
        src="/oklahoma.png"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="object-cover object-center dark:hidden"
      />
      <Image
        src="/oklahoma-night.png"
        alt=""
        aria-hidden
        fill
        sizes="100vw"
        className="hidden object-cover object-center dark:block"
      />
      <div aria-hidden className="absolute inset-0 bg-navy/80" />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[#03050b] via-navy/40 to-navy/20"
      />

      {/* Vance — bottom-attached, sized up and nudged left of the right edge */}
      <div className="absolute inset-y-0 right-0 z-10 flex items-end sm:right-[4%] lg:right-[10%]">
        <Image
          src="/vance.png"
          alt="Vance Dotson, consumer advocate"
          width={760}
          height={1140}
          priority
          sizes="(min-width: 1024px) 640px, 85vw"
          className="h-auto max-h-[500px] w-auto -scale-x-100 object-contain object-bottom sm:max-h-[640px] lg:max-h-[780px]"
        />
      </div>
      {/* Blend Vance into the bottom */}
      <div
        aria-hidden
        className="absolute inset-0 z-20 bg-gradient-to-t from-[#03050b] from-0% via-[#03050b]/40 via-15% to-transparent to-44%"
      />

      <div className="relative z-30 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
        <div className="max-w-3xl [text-shadow:0_2px_14px_rgba(3,5,11,0.55)] motion-safe:animate-[fadeup_0.6s_ease-out]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
            Consumer advocate · FCRA &amp; FDCPA
          </span>
          <h1 className="mt-4 text-6xl leading-[0.98] tracking-wide text-white sm:text-8xl">
            {site.hero.headline}
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/85">
            {site.hero.subhead}
          </p>

          <ul className="mt-6 space-y-2">
            {site.hero.bullets.map((b) => (
              <li
                key={b}
                className="flex items-center gap-2.5 text-base font-medium text-white"
              >
                <CheckIcon className="h-5 w-5 shrink-0 text-gold" />
                {b}
              </li>
            ))}
          </ul>

          {/* ⚠️ PLACEHOLDER aggregate proof — swap in Vance's real numbers. */}
          <div className="mt-6 flex items-center gap-2 text-sm font-medium text-white/85">
            <span aria-hidden className="tracking-tight text-gold">
              ★★★★★
            </span>
            <span>
              {site.hero.rating.stars} · {site.hero.rating.count}
            </span>
          </div>

          <HeroCtas className="mt-8" />
        </div>
      </div>

      {/* Vertical "See how it works" tag attached to the right edge */}
      <Link
        href={site.cta.primary.href}
        className="group absolute right-0 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-3 rounded-l-xl border border-r-0 border-white/15 bg-navy/70 px-2.5 py-4 font-heading text-sm font-semibold text-white shadow-lg backdrop-blur transition-colors hover:text-gold sm:flex"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-ink">
          <PlayIcon className="h-3.5 w-3.5" />
        </span>
        <span className="tracking-wide [writing-mode:vertical-rl]">
          See how it works
        </span>
      </Link>
    </section>
  );
}
