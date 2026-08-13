"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { EVENTS } from "@/lib/events";
import { getRememberedLead, syncInternalTrafficPreference, track } from "@/lib/tracking";

const EXCLUDED_PREFIXES = ["/crm", "/login", "/auth", "/forgot-password", "/unsubscribe"];

export function PublicPageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (syncInternalTrafficPreference()) return;
    if (EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;
    track(EVENTS.pageViewed, {}, getRememberedLead()?.email);
  }, [pathname]);

  return null;
}
