"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { track, getRememberedLead, getUtmParams, getVisitorId } from "@/lib/tracking";
import { EVENTS } from "@/lib/events";
import { ArrowRightIcon } from "@/components/marketing-v2/Icons";
import { buildDays, slotLabelOf, slotStart, type Day } from "./slots";
import { SlotPicker } from "./SlotPicker";
import { TurnstileWidget } from "@/components/TurnstileWidget";

/**
 * Two-step strategy-call booking card, shared by /webinar/call and /book so both
 * use the same booking experience. Step 1 = your details ("Book my free call"
 * advances). Step 2 = pick a time from the week-grid calendar + a short intake,
 * then finalize. Fires call_booking_started on first engagement and call_booked
 * on success; the intake answers ride along to the CRM. Routes to the booked
 * page. (The page fires call_page_view on load.)
 */

const SLOTS_NOTE = "It's just me, so I open a limited number of call slots each week.";
const STEP1_CTA = "Continue to choose a time";

const labelStyle = {
  fontSize: 11.5,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  color: "var(--v3-faint)",
};
const inputStyle = {
  background: "rgba(0,0,0,0.35)",
  border: "1px solid var(--v3-line)",
  color: "var(--v3-ink)",
  fontFamily: "var(--v3-mono)",
  fontSize: 16.5,
} as const;

// Short pre-call intake — a few quick questions so the call starts warm. Easy to
// edit here; answers ride along to the CRM on the booking.
const QUESTIONS: Array<{ id: string; label: string; type: "radio" | "select"; options: string[] }> = [
  { id: "situation", label: "What do you need help with?", type: "radio", options: ["Collector calls that won't stop", "Errors on my report", "Both"] },
  { id: "tried", label: "Have you tried disputing it yourself?", type: "radio", options: ["Yes, and it came back", "Yes, still waiting", "Not yet"] },
  { id: "urgency", label: "How soon do you want it handled?", type: "select", options: ["As soon as possible", "Within a few weeks", "Just exploring for now"] },
];
const EMPTY_ANSWERS: Record<string, string> = Object.fromEntries(QUESTIONS.map((q) => [q.id, ""]));

export function BookingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState({ name: "", email: "", phone: "" });
  const [days, setDays] = useState<Day[]>([]);
  const [dayKey, setDayKey] = useState("");
  const [time, setTime] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>(EMPTY_ANSWERS);
  const [timezoneLabel, setTimezoneLabel] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [contactErrors, setContactErrors] = useState<{ email?: string; name?: string }>({});
  const [unavailableStarts, setUnavailableStarts] = useState<Set<string>>(new Set());
  const [busyIntervals, setBusyIntervals] = useState<Array<{ start: string; end: string }>>([]);
  const [availability, setAvailability] = useState<"loading" | "ready" | "error">("loading");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const startedRef = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const d = buildDays();
      setDays(d);
      setDayKey(d[0]?.key ?? "");
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const friendlyZone = new Intl.DateTimeFormat(undefined, {
        timeZone: timezone,
        timeZoneName: "long",
      }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value;
      setTimezoneLabel(friendlyZone ? `${friendlyZone} (${timezone})` : timezone);
      const reviewState = new URLSearchParams(window.location.search).get("state");
      if (reviewState === "booking-contact-error") {
        setPreviewMode(true);
        setValues({ name: "Alex Morgan", email: "alex@", phone: "(405) 555-0147" });
        setContactErrors({ email: "Enter a valid email address." });
        setStatus("error");
        setAvailability("ready");
        requestAnimationFrame(() => emailRef.current?.focus());
        return;
      }
      if (reviewState === "booking-calendar") {
        setPreviewMode(true);
        setStep(2);
        setAvailability("ready");
        return;
      }
      if (reviewState === "booking-loading") {
        setPreviewMode(true);
        setStep(2);
        setTime("9:00 AM");
        setAnswers({
          situation: "Collector calls that won't stop",
          tried: "Yes, and it came back",
          urgency: "As soon as possible",
        });
        setAvailability("ready");
        setStatus("loading");
        return;
      }
      if (reviewState === "booking-availability-error") {
        setPreviewMode(true);
        setStep(2);
        setAvailability("error");
        return;
      }
      if (reviewState === "booking-error") {
        setPreviewMode(true);
        setStep(2);
        setAnswers({
          situation: "Collector calls that won't stop",
          tried: "Yes, and it came back",
          urgency: "As soon as possible",
        });
        const taken = slotStart(d[0]?.key ?? "", "9:00 AM");
        if (taken) setUnavailableStarts(new Set([taken.toISOString()]));
        setAvailability("ready");
        setStatus("error");
        setSlotError("That time was just booked by someone else. Choose another available time.");
        requestAnimationFrame(() =>
          document.querySelector<HTMLButtonElement>('[data-booking-time]:not(:disabled)')?.focus(),
        );
        return;
      }
      fetch("/api/book")
        .then((response) => response.ok ? response.json() : Promise.reject())
        .then((payload: { startsAt?: string[]; busy?: Array<{ start: string; end: string }> }) => {
          setUnavailableStarts(new Set((payload.startsAt ?? []).map((value) => new Date(value).toISOString())));
          setBusyIntervals(payload.busy ?? []);
          setAvailability("ready");
        })
        .catch(() => {
          setAvailability("error");
        });
      const lead = getRememberedLead();
      if (lead) setValues((v) => ({ ...v, email: lead.email, name: lead.name ?? "" }));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function markStarted() {
    if (startedRef.current) return;
    startedRef.current = true;
    if (previewMode) return;
    track(EVENTS.bookingStarted, {}, getRememberedLead()?.email || values.email || undefined);
  }
  function set(key: keyof typeof values, val: string) {
    markStarted();
    setValues((v) => ({ ...v, [key]: val }));
    if (key === "email" || key === "name") {
      setContactErrors((errors) => ({ ...errors, [key]: undefined }));
    }
  }
  function setAnswer(id: string, val: string) {
    markStarted();
    setAnswers((a) => ({ ...a, [id]: val }));
  }

  const slotLabel = slotLabelOf(days, dayKey, time);

  function toStep2(e: React.FormEvent) {
    e.preventDefault();
    const name = values.name.trim();
    const email = values.email.trim();
    const nextErrors = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? undefined : "Enter a valid email address.",
      name: name.length >= 2 ? undefined : "Enter your name.",
    };
    setContactErrors(nextErrors);
    if (nextErrors.email || nextErrors.name) {
      if (!previewMode) {
        track(EVENTS.funnelError, { action: "booking", reason: "invalid_contact_details" }, email || undefined);
      }
      setStatus("error");
      setError(null);
      requestAnimationFrame(() => (nextErrors.email ? emailRef.current : nameRef.current)?.focus());
      return;
    }
    setStatus("idle");
    setError(null);
    setStep(2);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (availability !== "ready") {
      track(EVENTS.funnelError, { action: "booking", reason: `availability_${availability}` }, values.email || undefined);
      setStatus("error");
      setError(availability === "loading"
        ? "Please wait while live availability loads."
        : "Live availability could not be loaded. Please refresh and try again.");
      return;
    }
    if (!slotLabel) {
      track(EVENTS.funnelError, { action: "booking", reason: "slot_missing" }, values.email || undefined);
      setStatus("error");
      setError("Please pick a day and time for your call.");
      return;
    }
    const missingAnswer = QUESTIONS.find((question) => !answers[question.id]);
    if (missingAnswer) {
      track(EVENTS.funnelError, { action: "booking", reason: "intake_missing" }, values.email || undefined);
      setStatus("error");
      setError("Please answer all three quick questions.");
      document.getElementById(`intake-${missingAnswer.id}`)?.focus();
      return;
    }
    if (!turnstileToken) {
      track(EVENTS.funnelError, { action: "booking", reason: "turnstile_missing" }, values.email || undefined);
      setStatus("error");
      setError("Please complete the security check.");
      return;
    }
    if (previewMode) {
      setStatus("error");
      setError("This preview cannot create a booking. Use Back to enter your details.");
      return;
    }
    setStatus("loading");
    setError(null);
    const name = values.name.trim();
    const email = values.email.trim();
    const starts = slotStart(dayKey, time);
    if (!starts) {
      track(EVENTS.funnelError, { action: "booking", reason: "slot_invalid" }, email);
      setStatus("error");
      setError("Please choose a valid appointment time.");
      return;
    }
    const ends = new Date(starts.getTime() + 30 * 60 * 1000);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          name,
          email,
          preferredTime: slotLabel,
          startsAt: starts.toISOString(),
          endsAt: ends.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          visitorId: getVisitorId(),
          answers,
          utm: getUtmParams(),
          turnstileToken,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Booking failed.");
      }
      const result = await res.json() as {
        booking?: { id: string; startsAt: string; endsAt: string; timezone: string };
      };
      if (result.booking) {
        sessionStorage.setItem("vance:last-booking", JSON.stringify({
          ...result.booking,
          name,
        }));
      }
      router.push("/webinar/booked");
    } catch (err) {
      track(EVENTS.funnelError, { action: "booking", reason: "request_failed" }, email);
      setStatus("error");
      const message = err instanceof Error ? err.message : "Something went wrong.";
      if (/just booked|choose another slot/i.test(message)) {
        setError(null);
        setSlotError("That time was just booked by someone else. Choose another available time.");
        setUnavailableStarts((current) => new Set(current).add(starts.toISOString()));
        setTime("");
        requestAnimationFrame(() =>
          document.querySelector<HTMLButtonElement>('[data-booking-time]:not(:disabled)')?.focus(),
        );
      } else {
        setError(message);
      }
      setTurnstileToken(null);
      setTurnstileReset((value) => value + 1);
    }
  }

  return (
    <div>
      {/* Card header (constant across steps) */}
      <div className="flex items-center justify-between gap-2">
        <span className="v3-display" style={{ fontSize: 28 }}>{step === 1 ? "Your details" : "Pick a time"}</span>
        <span className="v3-mono" style={{ fontSize: 12, color: "var(--v3-faint)", letterSpacing: "0.1em" }}>STEP {step} / 2</span>
      </div>
      <p className="v3-mono mt-2" style={{ fontSize: 13.5, color: "var(--v3-faint)" }}>{SLOTS_NOTE}</p>
      {step === 1 ? (
        <p className="mt-3" style={{ fontSize: 14.5, color: "var(--v3-mut)", lineHeight: 1.5 }}>
          Next: choose a 30-minute time, then answer 3 quick questions.
        </p>
      ) : null}
      <div className="mt-5 border-t" style={{ borderColor: "var(--v3-line)" }} />

      {step === 1 ? (
        <form onSubmit={toStep2} noValidate className="mt-5 flex flex-col gap-4" onFocus={markStarted}>
          {[
            { key: "email" as const, label: "Email", type: "email", placeholder: "you@example.com", autoComplete: "email" },
            { key: "name" as const, label: "Name", type: "text", placeholder: "Your name", autoComplete: "name" },
            { key: "phone" as const, label: "Phone (optional)", type: "tel", placeholder: "(405) 000-0000", autoComplete: "tel" },
          ].map((f) => (
            <div key={f.key}>
              <label htmlFor={`bk-${f.key}`} className="v3-mono mb-1.5 block" style={labelStyle}>{f.label}</label>
              <input
                ref={f.key === "email" ? emailRef : f.key === "name" ? nameRef : undefined}
                id={`bk-${f.key}`}
                name={f.key}
                type={f.type}
                autoComplete={f.autoComplete}
                required={f.key !== "phone"}
                aria-invalid={f.key === "email" || f.key === "name" ? Boolean(contactErrors[f.key]) : undefined}
                aria-describedby={f.key === "email" || f.key === "name" ? `bk-${f.key}-error` : undefined}
                value={values[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.currentTarget.value)}
                className="v4-booking-input w-full rounded-sm px-4 py-3.5 outline-none transition-colors"
                style={inputStyle}
              />
              {(f.key === "email" || f.key === "name") && contactErrors[f.key] ? (
                <p id={`bk-${f.key}-error`} className="mt-1.5" style={{ fontSize: 13.5, color: "var(--v3-danger)" }}>
                  {contactErrors[f.key]}
                </p>
              ) : null}
            </div>
          ))}
          <button type="submit" className="v3-btn v3-btn-primary v3-clip mt-1 w-full" style={{ paddingLeft: 12, fontSize: 16 }}>
            <span className="v3-btn-badge"><ArrowRightIcon className="h-4 w-4" /></span>
            {STEP1_CTA}
          </button>
          <p className="text-center" style={{ fontSize: 13.5, color: "var(--v3-mut)" }}>
            Private. No spam. No obligation. I&apos;ll confirm by email.
          </p>
        </form>
      ) : (
        <form
          onSubmit={submit}
          noValidate
          className="mt-5 flex flex-col gap-5"
          aria-busy={status === "loading"}
        >
          <SlotPicker
            days={days}
            dayKey={dayKey}
            onDay={(k) => { markStarted(); setDayKey(k); setTime(""); }}
            time={time}
            onTime={(t) => { markStarted(); setTime(t); setSlotError(null); }}
            dayLayout="calendar"
            labelSize={11.5}
            unavailableStarts={unavailableStarts}
            busyIntervals={busyIntervals}
            timezoneLabel={timezoneLabel}
            disabled={status === "loading" || availability !== "ready"}
          />
          {availability === "loading" ? (
            <p role="status" style={{ fontSize: 14, color: "var(--v3-faint)" }}>Checking live availability…</p>
          ) : null}

          {slotError ? (
            <div
              id="booking-slot-error"
              role="alert"
              className="rounded-sm p-4"
              style={{
                border: "1px solid color-mix(in srgb, var(--v3-danger) 65%, var(--v3-line))",
                background: "color-mix(in srgb, var(--v3-danger) 9%, transparent)",
              }}
            >
              <p style={{ fontSize: 14.5, color: "var(--v3-ink)", lineHeight: 1.5 }}>{slotError}</p>
            </div>
          ) : null}

          {availability === "error" ? (
            <div
              id="booking-availability-error"
              role="alert"
              className="rounded-sm p-4"
              style={{
                border: "1px solid color-mix(in srgb, var(--v3-danger) 65%, var(--v3-line))",
                background: "color-mix(in srgb, var(--v3-danger) 9%, transparent)",
              }}
            >
              <p style={{ fontSize: 14.5, color: "var(--v3-ink)", lineHeight: 1.5 }}>
                We couldn&apos;t load live appointment times. Your details are safe.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="v3-mono mt-3 underline underline-offset-4"
                style={{ fontSize: 13.5, color: "var(--v3-danger)" }}
              >
                Retry availability
              </button>
            </div>
          ) : null}

          {/* Short intake */}
          <div className="flex flex-col gap-4 border-t pt-5" style={{ borderColor: "var(--v3-line)" }}>
            <span className="v3-mono" style={labelStyle}>About your situation // 3 quick questions</span>
            {QUESTIONS.map((q) => q.type === "radio" ? (
              <fieldset key={q.id}>
                <legend className="v3-mono mb-2 block" style={labelStyle}>{q.label}</legend>
                <div className="flex flex-col gap-2">
                  {q.options.map((opt, index) => (
                    <label key={opt} className="flex cursor-pointer items-center gap-2.5" style={{ fontSize: 15.5, color: "var(--v3-mut)" }}>
                      <input
                        id={index === 0 ? `intake-${q.id}` : undefined}
                        type="radio"
                        name={q.id}
                        value={opt}
                        required
                        disabled={status === "loading"}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswer(q.id, opt)}
                        style={{ accentColor: "var(--v3-accent)", width: 16, height: 16 }}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <div key={q.id}>
                <label htmlFor={`intake-${q.id}`} className="v3-mono mb-2 block" style={labelStyle}>{q.label}</label>
                <select
                  id={`intake-${q.id}`}
                  name={q.id}
                  required
                  disabled={status === "loading"}
                  value={answers[q.id]}
                  onChange={(e) => setAnswer(q.id, e.currentTarget.value)}
                  className="v4-booking-input w-full rounded-sm px-4 py-3.5 outline-none"
                  style={inputStyle}
                >
                  <option value="" disabled style={{ background: "#0b0d12" }}>Choose one</option>
                  {q.options.map((opt) => (
                    <option key={opt} value={opt} style={{ background: "#0b0d12" }}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {error ? <p role="alert" style={{ fontSize: 14, color: "var(--v3-danger)" }}>{error}</p> : null}
          {status === "loading" ? (
            <p
              id="booking-loading-status"
              role="status"
              aria-live="polite"
              style={{ fontSize: 14, color: "var(--v3-accent)", lineHeight: 1.5 }}
            >
              Booking your call. Please wait and keep this page open.
            </p>
          ) : previewMode ? (
            <p id="booking-preview-note" role="status" style={{ fontSize: 13.5, color: "var(--v3-mut)", lineHeight: 1.5 }}>
              Preview only. Use Back to enter your details and make a real booking.
            </p>
          ) : (
            <div>
              <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileReset} />
              <p className="mt-2" style={{ fontSize: 13, color: "var(--v3-faint)" }}>
                This security check stops spam. Your details stay private.
              </p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={status === "loading"}
              onClick={() => { setError(null); setSlotError(null); setStatus("idle"); setStep(1); }}
              className="v3-mono shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ fontSize: 13.5, color: "var(--v3-faint)" }}
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={status === "loading" || availability !== "ready" || previewMode}
              aria-describedby={status === "loading" ? "booking-loading-status" : availability === "error" ? "booking-availability-error" : slotError ? "booking-slot-error" : previewMode ? "booking-preview-note" : undefined}
              className="v3-btn v3-btn-primary v3-clip w-full disabled:cursor-not-allowed disabled:opacity-60"
              style={{ paddingLeft: 12, fontSize: 16 }}
            >
              <span className="v3-btn-badge">
                {status === "loading" ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
                ) : (
                  <ArrowRightIcon className="h-4 w-4" />
                )}
              </span>
              {status === "loading" ? "Booking your call…" : "Confirm my call"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
