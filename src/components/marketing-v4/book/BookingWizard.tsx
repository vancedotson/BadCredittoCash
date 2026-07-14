"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { track, getRememberedLead, getUtmParams } from "@/lib/tracking";
import { EVENTS } from "@/lib/events";
import { ArrowRightIcon } from "@/components/marketing-v2/Icons";
import { buildDays, slotLabelOf, type Day } from "./slots";
import { SlotPicker } from "./SlotPicker";

/**
 * Two-step strategy-call booking card, shared by /webinar/call and /book so both
 * use the same booking experience. Step 1 = your details ("Book my free call"
 * advances). Step 2 = pick a time from the week-grid calendar + a short intake,
 * then finalize. Fires call_booking_started on first engagement and call_booked
 * on success; the intake answers ride along to the CRM. Routes to the booked
 * page. (The page fires call_page_view on load.)
 */

const SLOTS_NOTE = "It's just me, so I open a limited number of call slots each week.";
const STEP1_CTA = "Book my free call";

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
  { id: "situation", label: "What's driving this?", type: "radio", options: ["Collector calls that won't stop", "Errors on my report", "Both"] },
  { id: "tried", label: "Have you tried disputing it yourself?", type: "radio", options: ["Yes, and it came back", "Yes, still waiting", "Not yet"] },
  { id: "urgency", label: "How soon do you want it handled?", type: "select", options: ["As soon as possible", "Within a few weeks", "Just exploring for now"] },
];
const DEFAULT_ANSWERS: Record<string, string> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.options[0]]));

export function BookingWizard() {
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
        <span className="v3-display" style={{ fontSize: 28 }}>{step === 1 ? "Book your call" : "Pick a time"}</span>
        <span className="v3-mono" style={{ fontSize: 12, color: "var(--v3-faint)", letterSpacing: "0.1em" }}>STEP {step} / 2</span>
      </div>
      <p className="v3-mono mt-2" style={{ fontSize: 13.5, color: "var(--v3-faint)" }}>{SLOTS_NOTE}</p>
      <div className="mt-5 border-t" style={{ borderColor: "var(--v3-line)" }} />

      {step === 1 ? (
        <form onSubmit={toStep2} noValidate className="mt-5 flex flex-col gap-4" onFocus={markStarted}>
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
                className="w-full rounded-sm px-4 py-3.5 outline-none transition-colors"
                style={inputStyle}
              />
            </div>
          ))}
          {error ? <p role="alert" style={{ fontSize: 14, color: "var(--v3-danger)" }}>{error}</p> : null}
          <button type="submit" className="v3-btn v3-btn-primary v3-clip mt-1 w-full" style={{ paddingLeft: 12, fontSize: 16 }}>
            <span className="v3-btn-badge"><ArrowRightIcon className="h-4 w-4" /></span>
            {STEP1_CTA}
          </button>
          <p className="text-center" style={{ fontSize: 13.5, color: "var(--v3-faint)" }}>Free. No obligation. I&apos;ll confirm by email.</p>
        </form>
      ) : (
        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-5">
          <SlotPicker
            days={days}
            dayKey={dayKey}
            onDay={(k) => { markStarted(); setDayKey(k); }}
            time={time}
            onTime={(t) => { markStarted(); setTime(t); }}
            dayLayout="calendar"
            labelSize={11.5}
          />

          {/* Short intake */}
          <div className="flex flex-col gap-4 border-t pt-5" style={{ borderColor: "var(--v3-line)" }}>
            {QUESTIONS.map((q) => (
              <div key={q.id}>
                <span className="v3-mono mb-2 block" style={labelStyle}>{q.label}</span>
                {q.type === "radio" ? (
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt) => (
                      <label key={opt} className="flex cursor-pointer items-center gap-2.5" style={{ fontSize: 15.5, color: "var(--v3-mut)" }}>
                        <input
                          type="radio"
                          name={q.id}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() => setAnswer(q.id, opt)}
                          style={{ accentColor: "var(--v3-accent)", width: 16, height: 16 }}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : (
                  <select
                    value={answers[q.id]}
                    onChange={(e) => setAnswer(q.id, e.currentTarget.value)}
                    className="w-full rounded-sm px-4 py-3.5 outline-none"
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

          {error ? <p role="alert" style={{ fontSize: 14, color: "var(--v3-danger)" }}>{error}</p> : null}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setError(null); setStatus("idle"); setStep(1); }}
              className="v3-mono shrink-0"
              style={{ fontSize: 13.5, color: "var(--v3-faint)" }}
            >
              ← Back
            </button>
            <button type="submit" disabled={status === "loading"} className="v3-btn v3-btn-primary v3-clip w-full disabled:opacity-60" style={{ paddingLeft: 12, fontSize: 16 }}>
              <span className="v3-btn-badge"><ArrowRightIcon className="h-4 w-4" /></span>
              {status === "loading" ? "Booking your call…" : "Confirm my call"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
