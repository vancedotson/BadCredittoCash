"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { site } from "@/config/site-v3";
import { track, getRememberedLead, getUtmParams } from "@/lib/tracking";
import { EVENTS } from "@/lib/events";
import { Kicker, Reveal, SectionScan } from "../../marketing-v3/shared/primitives";
import { useReveal } from "../../marketing-v3/shared/hooks";
import { CheckIcon, ArrowRightIcon } from "@/components/marketing-v2/Icons";
import { buildDays, slotLabelOf, type Day } from "../book/slots";
import { SlotPicker } from "../book/SlotPicker";

/**
 * /webinar/call — the "offer" page. Left: heading + what the call covers. Right:
 * a two-step booking card (step 1 = your details, step 2 = pick a time from the
 * availability calendar + a short intake, then finalize). Fires call_page_view on
 * load, call_booking_started the moment they engage, and call_booked on success
 * (the conversion) before routing to the booked/onboarding page.
 */
const wb = site.webinar;

const labelStyle = {
  fontSize: 10,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  color: "var(--v3-faint)",
};
const inputStyle = {
  background: "rgba(0,0,0,0.35)",
  border: "1px solid var(--v3-line)",
  color: "var(--v3-ink)",
  fontFamily: "var(--v3-mono)",
  fontSize: 15,
} as const;

const CALL_FACTS = ["By phone", "Directly with Vance", "Free, no obligation"];

// Short pre-call intake — a few quick questions so the call starts warm. Easy to
// edit here; answers ride along to the CRM on the booking.
const QUESTIONS: Array<{ id: string; label: string; type: "radio" | "select"; options: string[] }> = [
  { id: "situation", label: "What's driving this?", type: "radio", options: ["Collector calls that won't stop", "Errors on my report", "Both"] },
  { id: "tried", label: "Have you tried disputing it yourself?", type: "radio", options: ["Yes, and it came back", "Yes, still waiting", "Not yet"] },
  { id: "urgency", label: "How soon do you want it handled?", type: "select", options: ["As soon as possible", "Within a few weeks", "Just exploring for now"] },
];
const DEFAULT_ANSWERS: Record<string, string> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.options[0]]));

export function BookCallV4() {
  const ref = useReveal<HTMLDivElement>();

  useEffect(() => {
    track(EVENTS.callPageView, {}, getRememberedLead()?.email);
  }, []);

  return (
    <section className="v3-section" style={{ paddingTop: "clamp(40px,6vw,84px)" }}>
      <SectionScan />
      <div className="v3-wrap grid items-start gap-x-12 gap-y-8 lg:grid-cols-[1.05fr_0.95fr]" ref={ref}>
        {/* Heading */}
        <div className="order-1 min-w-0 lg:col-start-1 lg:row-start-1">
          <Kicker>{wb.call.kicker}</Kicker>
          <h1 className="v3-display mt-5" style={{ fontSize: "clamp(34px,5vw,64px)", lineHeight: 1.03 }}>
            {wb.call.heading}
          </h1>
          <p className="mt-6" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 560 }}>
            {wb.call.body}
          </p>
        </div>

        {/* What the call covers — below the card on mobile, under the heading on desktop */}
        <div className="order-3 min-w-0 lg:col-start-1 lg:row-start-2">
          <span className="v3-mono" style={labelStyle}>On the call</span>
          <ul className="mt-3 flex flex-col gap-2.5">
            {wb.call.covers.map((c) => (
              <li key={c} className="flex items-start gap-3" style={{ color: "var(--v3-mut)", fontSize: 15.5 }}>
                <span style={{ color: "var(--v3-accent)", marginTop: 2 }}>
                  <CheckIcon className="h-4 w-4" />
                </span>
                {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Booking card — two-step wizard */}
        <Reveal delay={1} className="order-2 min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="v3-panel v3-corner p-7 sm:p-9" style={{ borderRadius: 4 }}>
            <BookingWizard />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function BookingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState({ name: "", email: "", phone: "" });
  const [days, setDays] = useState<Day[]>([]);
  const [dayKey, setDayKey] = useState("");
  const [time, setTime] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>(DEFAULT_ANSWERS);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const d = buildDays();
      setDays(d);
      setDayKey(d[0]?.key ?? "");
      const lead = getRememberedLead();
      if (lead) setValues((v) => ({ ...v, email: lead.email, name: lead.name ?? "" }));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function markStarted() {
    if (startedRef.current) return;
    startedRef.current = true;
    track(EVENTS.bookingStarted, {}, getRememberedLead()?.email || values.email || undefined);
  }
  function set(key: keyof typeof values, val: string) {
    markStarted();
    setValues((v) => ({ ...v, [key]: val }));
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
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      setError("Please enter your name and a valid email.");
      return;
    }
    setStatus("idle");
    setError(null);
    setStep(2);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slotLabel) {
      setStatus("error");
      setError("Please pick a day and time for your call.");
      return;
    }
    setStatus("loading");
    setError(null);
    const name = values.name.trim();
    const email = values.email.trim();
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, name, email, preferredTime: slotLabel, answers, utm: getUtmParams() }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Booking failed.");
      }
      track(EVENTS.booked, { preferredTime: slotLabel, ...answers }, email);
      router.push("/webinar/booked");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div>
      {/* Card header (constant across steps) */}
      <div className="flex items-center justify-between gap-2">
        <span className="v3-display" style={{ fontSize: 24 }}>{step === 1 ? "Book your call" : "Pick a time"}</span>
        <span className="v3-mono" style={{ fontSize: 11, color: "var(--v3-faint)", letterSpacing: "0.1em" }}>STEP {step} / 2</span>
      </div>
      <p className="v3-mono mt-2" style={{ fontSize: 12, color: "var(--v3-faint)" }}>{wb.call.slotsNote}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-4" style={{ borderColor: "var(--v3-line)" }}>
        {CALL_FACTS.map((f) => (
          <span key={f} className="v3-mono" style={{ fontSize: 11.5, color: "var(--v3-faint)", letterSpacing: "0.03em" }}>
            <span style={{ color: "var(--v3-accent)" }}>·</span> {f}
          </span>
        ))}
      </div>

      {step === 1 ? (
        <form onSubmit={toStep2} noValidate className="mt-6 flex flex-col gap-3.5" onFocus={markStarted}>
          {[
            { key: "email" as const, label: "Email", type: "email", placeholder: "you@example.com" },
            { key: "name" as const, label: "Name", type: "text", placeholder: "Your name" },
            { key: "phone" as const, label: "Phone (optional)", type: "tel", placeholder: "(405) 000-0000" },
          ].map((f) => (
            <div key={f.key}>
              <label htmlFor={`bk-${f.key}`} className="v3-mono mb-1.5 block" style={labelStyle}>{f.label}</label>
              <input
                id={`bk-${f.key}`}
                name={f.key}
                type={f.type}
                required={f.key !== "phone"}
                value={values[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.currentTarget.value)}
                className="w-full rounded-sm px-4 py-3 outline-none transition-colors"
                style={inputStyle}
              />
            </div>
          ))}
          {error ? <p role="alert" style={{ fontSize: 13, color: "var(--v3-danger)" }}>{error}</p> : null}
          <button type="submit" className="v3-btn v3-btn-primary v3-clip mt-1 w-full" style={{ paddingLeft: 12 }}>
            <span className="v3-btn-badge"><ArrowRightIcon className="h-4 w-4" /></span>
            {wb.call.cta}
          </button>
          <p className="text-center" style={{ fontSize: 12.5, color: "var(--v3-faint)" }}>Free. No obligation. I&apos;ll confirm by email.</p>
        </form>
      ) : (
        <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-5">
          <SlotPicker
            days={days}
            dayKey={dayKey}
            onDay={(k) => { markStarted(); setDayKey(k); }}
            time={time}
            onTime={(t) => { markStarted(); setTime(t); }}
          />

          {/* Short intake */}
          <div className="flex flex-col gap-4 border-t pt-5" style={{ borderColor: "var(--v3-line)" }}>
            {QUESTIONS.map((q) => (
              <div key={q.id}>
                <span className="v3-mono mb-2 block" style={labelStyle}>{q.label}</span>
                {q.type === "radio" ? (
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt) => (
                      <label key={opt} className="flex cursor-pointer items-center gap-2.5" style={{ fontSize: 14, color: "var(--v3-mut)" }}>
                        <input
                          type="radio"
                          name={q.id}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() => setAnswer(q.id, opt)}
                          style={{ accentColor: "var(--v3-accent)" }}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : (
                  <select
                    value={answers[q.id]}
                    onChange={(e) => setAnswer(q.id, e.currentTarget.value)}
                    className="w-full rounded-sm px-4 py-3 outline-none"
                    style={inputStyle}
                  >
                    {q.options.map((opt) => (
                      <option key={opt} value={opt} style={{ background: "#0b0d12" }}>{opt}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>

          {error ? <p role="alert" style={{ fontSize: 13, color: "var(--v3-danger)" }}>{error}</p> : null}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setError(null); setStatus("idle"); setStep(1); }}
              className="v3-mono shrink-0"
              style={{ fontSize: 12.5, color: "var(--v3-faint)" }}
            >
              ← Back
            </button>
            <button type="submit" disabled={status === "loading"} className="v3-btn v3-btn-primary v3-clip w-full disabled:opacity-60" style={{ paddingLeft: 12 }}>
              <span className="v3-btn-badge"><ArrowRightIcon className="h-4 w-4" /></span>
              {status === "loading" ? "Booking your call…" : "Confirm my call"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
