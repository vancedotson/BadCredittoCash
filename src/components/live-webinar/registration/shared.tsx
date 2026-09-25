"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { liveWebinar } from "@/config/live-webinar";
import { RegistrationFormV3 } from "@/components/marketing-v3/shared/RegistrationFormV3";
import { ArrowRightIcon } from "@/components/marketing-v2/Icons";
import { useEventPhase } from "../EventTime";
import { useLiveSession } from "../LiveSessionProvider";
import "./live-register.css";

/**
 * Building blocks for the /live registration page. Anything that touches the
 * CRM session — the form's session ID, timezone, and preview-disabled state —
 * lives here once, kept apart from the page layout.
 */

const registrationFormProps = {
  redirectTo: "/live/confirmed",
  source: "vance-live-webinar",
  showPhone: false,
  submitLabel: liveWebinar.registration.submitLabel,
  loadingLabel: liveWebinar.registration.loadingLabel,
  reassurance: liveWebinar.registration.reassurance,
} as const;

function ReviewableRegistrationForm({ idPrefix }: { idPrefix: string }) {
  const { session, timezone, preview, href } = useLiveSession();
  const reviewState = useSearchParams().get("state");
  const previewState =
    reviewState === "registration-invalid"
      ? "invalid"
      : reviewState === "registration-error"
        ? "server-error"
        : reviewState === "registration-loading"
          ? "submitting"
          : undefined;

  return (
    <RegistrationFormV3
      key={`${preview ? "preview" : session?.id}:${previewState ?? "normal"}`}
      {...registrationFormProps}
      redirectTo={href("/live/confirmed")}
      sessionId={preview ? undefined : session?.id}
      timezone={timezone || undefined}
      disabledPreview={preview || !session || session.status !== "scheduled"}
      idPrefix={idPrefix}
      previewState={previewState}
    />
  );
}

/** The session-wired form. `idPrefix` must be unique per form on the page. */
export function LiveRegistrationForm({ idPrefix }: { idPrefix: string }) {
  return (
    <Suspense fallback={<RegistrationFormV3 {...registrationFormProps} idPrefix={idPrefix} disabledPreview />}>
      <ReviewableRegistrationForm idPrefix={idPrefix} />
    </Suspense>
  );
}

export function useSessionDurationMinutes(): number {
  const { session } = useLiveSession();
  if (!session) return liveWebinar.event.durationMinutes;
  return Math.round((Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 60_000);
}

/** Session FAQ; live sessions are never recorded. */
export function useFaqItems() {
  return liveWebinar.faq;
}

/** Button that scrolls to a form anchor on the same page. */
export function RegisterAnchor({ target, label = liveWebinar.ctaLabel, className = "v3-btn v3-btn-primary" }: {
  target: string;
  label?: string;
  className?: string;
}) {
  return (
    <a className={className} href={`#${target}`}>
      {label} <ArrowRightIcon className="h-4 w-4" />
    </a>
  );
}

/** Large, honest countdown to the real session start. Nothing when live/over. */
export function BigCountdown({ compact = false }: { compact?: boolean }) {
  const { phase, msUntilStart } = useEventPhase();
  if (phase === "live") return <p className="lr-countdown-live">Happening now</p>;
  if (phase === "ended") return null;

  const total = Math.max(0, Math.floor(msUntilStart / 1000));
  const units: Array<[number, string]> = [
    [Math.floor(total / 86400), "Days"],
    [Math.floor((total % 86400) / 3600), "Hours"],
    [Math.floor((total % 3600) / 60), "Min"],
    [total % 60, "Sec"],
  ];
  const pending = phase === "pending";

  return (
    <div
      className={`lr-countdown${compact ? " is-compact" : ""}`}
      role="timer"
      aria-live="off"
      aria-label={pending ? "Time until the session starts" : `${units[0][0]} days, ${units[1][0]} hours, ${units[2][0]} minutes until the session starts`}
    >
      {units.map(([value, unit]) => (
        <div key={unit} className="lr-countdown-unit">
          <span className="v3-display">{pending ? "--" : String(value).padStart(2, "0")}</span>
          <small className="v3-mono">{unit}</small>
        </div>
      ))}
    </div>
  );
}

/**
 * Mobile-only bar that appears once the given form has scrolled out of view,
 * so the ask is one tap away on a long page. Hidden again when the form (or a
 * second form) is back on screen.
 */
export function StickyRegisterBar({ watchIds, target }: { watchIds: string; target: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // `watchIds` is a space-separated string so the effect doesn't re-run on
    // every render the way a fresh array literal would.
    const ids = watchIds.split(" ").filter(Boolean);
    let frame = 0;
    const update = () => {
      frame = 0;
      const forms = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
      if (forms.length === 0) return;
      const viewport = window.innerHeight;
      const anyOnScreen = forms.some((el) => {
        const rect = el.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < viewport;
      });
      // Only after scrolling PAST the first form — not before reaching it.
      const pastFirst = forms[0].getBoundingClientRect().bottom < 0;
      setVisible(pastFirst && !anyOnScreen);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    onScroll(); // first measure on the next frame, not synchronously in the effect
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [watchIds]);

  return (
    <div className={`lr-sticky${visible ? " is-visible" : ""}`} aria-hidden={!visible}>
      <span className="lr-sticky-copy">
        <strong>Free live session</strong>
        <small>Joining link by email</small>
      </span>
      <a className="v3-btn v3-btn-primary" href={`#${target}`} tabIndex={visible ? 0 : -1}>
        {liveWebinar.ctaLabel}
      </a>
    </div>
  );
}

