import { site } from "@/config/site-v2";
import { CheckIcon } from "./Icons";

/** Repeated at hero, mid-page, and close for skimmers (structure: persistent elements). */
export function TrustBar({
  variant = "light",
  className = "",
}: {
  variant?: "light" | "onNavy";
  className?: string;
}) {
  const textClass = variant === "onNavy" ? "text-white/90" : "text-slate";
  const checkClass = variant === "onNavy" ? "text-gold" : "text-green";

  return (
    <ul
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 ${textClass} ${className}`}
    >
      {site.trustBar.map((item) => (
        <li
          key={item}
          className="inline-flex items-center gap-1.5 text-sm font-medium"
        >
          <CheckIcon className={`h-4 w-4 shrink-0 ${checkClass}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}
