"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { site } from "@/config/site-v2";
import { PlayIcon, PhoneIcon } from "./Icons";
import { track } from "@/lib/tracking";

/**
 * Sticky CTA bar (structure: persistent elements). Appears once the visitor
 * scrolls past the hero so the conversion action is always one tap away.
 * Navy background, gold primary + blue secondary (brand-guideline §6).
 */
export function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 640);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-navy transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        {/* ⚠️ PLACEHOLDER rating — real numbers before launch. */}
        <span className="mr-auto hidden items-center gap-1.5 text-sm font-medium text-white/85 lg:flex">
          <span aria-hidden className="tracking-tight text-gold">
            ★★★★★
          </span>
          {site.hero.rating.stars}
        </span>
        <Link
          href={site.cta.primary.href}
          onClick={() => track("cta_clicked", { location: "sticky", type: "webinar" })}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-gold px-4 py-2.5 font-heading text-[15px] font-semibold text-ink outline-none transition-colors hover:bg-gold-deep focus-visible:ring-2 focus-visible:ring-white/70 sm:flex-none sm:px-6"
        >
          <PlayIcon className="h-4 w-4" />
          Watch — Free
        </Link>
        <a
          href={site.contact.phoneHref}
          onClick={() => track("cta_clicked", { location: "sticky", type: "call" })}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-trust px-4 py-2.5 font-heading text-[15px] font-semibold text-white outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 sm:flex-none sm:px-6"
        >
          <PhoneIcon className="h-4 w-4" />
          <span className="sm:hidden">Call now</span>
          <span className="hidden sm:inline">{site.contact.phoneDisplay}</span>
        </a>
      </div>
    </div>
  );
}
