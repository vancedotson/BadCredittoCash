import Link from "next/link";
import { site } from "@/config/site";
import { PlayIcon } from "../Icons";
import { ButtonShine } from "../ButtonShine";

/**
 * Hero CTA cluster (chosen "Pill" style). Primary is a gold pill with the play
 * icon in an ink badge; the secondary here is a BORDERLESS ghost text-arrow
 * (per request — hero secondary has no border, unlike elsewhere on the page).
 */
export function HeroCtas({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6 ${className}`}
    >
      <Link
        href={site.cta.primary.href}
        className="relative inline-flex min-h-[54px] items-center justify-center gap-2.5 overflow-hidden rounded-full bg-gold py-3 pl-3 pr-7 font-heading text-[17px] font-semibold text-ink shadow-card transition-all duration-200 hover:scale-[1.02] hover:bg-gold-deep"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-gold">
          <PlayIcon className="h-4 w-4" />
        </span>
        {site.cta.primary.label}
        <ButtonShine />
      </Link>
      <Link
        href={site.cta.secondary.href}
        className="group inline-flex items-center gap-2 font-heading text-[15px] font-semibold text-white/85 transition-colors hover:text-gold"
      >
        {site.cta.secondary.label}
        <span
          aria-hidden
          className="transition-transform duration-200 group-hover:translate-x-1"
        >
          →
        </span>
      </Link>
    </div>
  );
}
