import Link from "next/link";
import { site } from "@/config/site-v2";
import { PhoneIcon } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Header — "Credential Bar" (chosen design). Trust-forward authority:
 * wordmark stacked over a "Since 2004" credential line, a prominent
 * "Prefer to talk?" click-to-call, and the gold primary CTA.
 * Dark-blue bar (clearly blue, distinct from the near-black navy).
 */
export function Header() {
  return (
    <header className="sticky top-0 z-50 overflow-hidden bg-darkblue shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-lg backdrop-saturate-150 supports-[backdrop-filter]:bg-darkblue/95">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="leading-tight">
          <span className="block font-heading text-lg font-bold tracking-tight text-white">
            VANCE DOTSON
          </span>
          <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-gold/90">
            Consumer Advocate · Since 2004
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {site.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-white/75 transition-colors hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4 sm:gap-6">
          <a href={site.contact.phoneHref} className="hidden text-right sm:block">
            <span className="block text-[11px] font-medium text-white/55">
              Prefer to talk?
            </span>
            <span className="flex items-center gap-1.5 font-heading text-base font-semibold text-white transition-colors hover:text-gold">
              <PhoneIcon className="h-4 w-4 text-gold" />
              {site.contact.phoneDisplay}
            </span>
          </a>
          <ThemeToggle />
        </div>
      </div>

      {/* Bottom-border beam: a static gold accent line + a highlight that
          sweeps left -> right, tapering thin at both ends. The glow is a
          blurred copy of the gradient (so it fades at the ends like the beam,
          not a rectangular box-shadow halo). Respects prefers-reduced-motion. */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-px w-1/4 animate-[beam_5s_linear_infinite] motion-reduce:hidden">
        <span className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-r from-transparent via-gold/70 to-transparent blur-[4px]" />
        <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
      </span>
    </header>
  );
}
