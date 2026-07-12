"use client";

import Link from "next/link";
import { site } from "@/config/site-v3";
import { useScrolledPast } from "./hooks";
import { PlayIcon } from "@/components/marketing-v2/Icons";

/** Bottom-centered sticky CTA that appears after the hero scrolls away. */
export function StickyCta() {
  const show = useScrolledPast(700);
  return (
    <div className={`v3-stickycta ${show ? "show" : ""}`}>
      <Link
        href={site.cta.primary.href}
        className="v3-btn v3-btn-primary v3-clip"
        style={{ paddingLeft: 12 }}
      >
        <span className="v3-btn-badge">
          <PlayIcon className="h-4 w-4" />
        </span>
        {site.cta.primary.label}
      </Link>
    </div>
  );
}
