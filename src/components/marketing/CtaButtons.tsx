import Link from "next/link";
import { site } from "@/config/site";
import { PlayIcon } from "./Icons";
import { ButtonShine } from "./ButtonShine";

/**
 * The dual CTA in the chosen "Pill" style:
 *   Primary   = gold pill with the play icon in an ink badge
 *   Secondary = outlined pill (tone-aware for light/dark backgrounds)
 */
const primaryClass =
  "relative inline-flex min-h-[54px] items-center justify-center gap-2.5 overflow-hidden rounded-full bg-gold py-3 pl-3 pr-7 font-heading text-[17px] font-semibold text-ink shadow-card transition-all duration-200 hover:scale-[1.02] hover:bg-gold-deep";

export function CtaButtons({
  className = "",
  fullWidth = false,
  tone = "dark",
}: {
  className?: string;
  fullWidth?: boolean;
  tone?: "dark" | "light";
}) {
  const secondaryClass = `group inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full border px-7 py-3.5 font-heading text-[15px] font-semibold transition-colors ${
    tone === "light"
      ? "border-navy/25 text-heading hover:border-navy hover:bg-navy/5"
      : "border-white/30 text-white hover:border-gold hover:text-gold"
  }`;

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row ${fullWidth ? "" : "sm:w-auto"} ${className}`}
    >
      <Link href={site.cta.primary.href} className={primaryClass}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-gold">
          <PlayIcon className="h-4 w-4" />
        </span>
        {site.cta.primary.label}
        <ButtonShine />
      </Link>
      <Link href={site.cta.secondary.href} className={secondaryClass}>
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
