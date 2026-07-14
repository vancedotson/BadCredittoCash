"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { track, getRememberedLead, getUtmParams } from "@/lib/tracking";
import { EVENTS } from "@/lib/events";
import { Kicker, Reveal, SectionScan } from "../../marketing-v3/shared/primitives";
import { useReveal } from "../../marketing-v3/shared/hooks";
import { CheckIcon, ArrowRightIcon } from "@/components/marketing-v2/Icons";

/**
 * /book — a standalone "pick a time" scheduler for the free strategy call,
 * reached from NON-webinar sequences (nurture / direct outreach), not the
 * webinar funnel. Same case-file shell as /webinar/* (so the V1/V2/V3 toggle
 * reskins it), but self-contained copy that doesn't assume they watched the
 * training. Slots are generated (no live calendar yet); a booking POSTs to
 * /api/book, so it lands in the CRM exactly like a webinar booking. Fires
 * call_page_view on load, call_booking_started on first engagement, and
 * call_booked on success before routing to the booked/onboarding page.
 */

const KICKER = "SCHEDULE // STRATEGY CALL";
const HEADING = "Book your free strategy call.";
const BODY =
  "Pick a time that works for you. We'll look at what's happening with your credit and the calls you're getting, and I'll tell you the honest next step. No cost, no obligation.";
const COVERS = [
  "We review the calls you're getting and the items on your report.",
  "We find out whether there's a violation to hold them to.",
  "You leave knowing exactly where you stand, either way.",
];
const FACTS = ["By phone", "Directly with Vance", "Free, no obligation"];
const TIMES = ["9:00 AM", "11:00 AM", "1:00 PM", "3:00 PM"];

type Day = { key: string; weekday: string; dayNum: string; month: string; full: string };

/** Next 10 weekdays starting tomorrow. Built client-side (uses the current date),
 *  so it runs in an effect, not in render (avoids the purity lint + hydration). */
function buildDays(): Day[] {
  const out: Day[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (out.length < 10) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      out.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: String(d.getDate()),
        month: d.toLocaleDateString("en-US", { month: "short" }),
        full: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

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

export function BookSchedulerV4() {
  const ref = useReveal<HTMLDivElement>();
  const router = useRouter();

  const [days, setDays] = useState<Day[]>([]);
  const [dayKey, setDayKey] = useState("");
  const [time, setTime] = useState("");
  const [values, setValues] = useState({ name: "", email: "", phone: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    track(EVENTS.callPageView, {}, getRememberedLead()?.email);
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

  const selectedDay = days.find((d) => d.key === dayKey);
  const slotLabel = selectedDay && time ? `${selectedDay.full} at ${time}` : "";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = values.name.trim();
    const email = values.email.trim();
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      setError("Please enter your name and a valid email.");
      return;
    }
    if (!slotLabel) {
      setStatus("error");
      setError("Please pick a day and time for your call.");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, name, email, preferredTime: slotLabel, utm: getUtmParams() }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Booking failed.");
      }
      track(EVENTS.booked, { preferredTime: slotLabel }, email);
      router.push("/webinar/booked");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <section className="v3-section" style={{ paddingTop: "clamp(40px,6vw,84px)" }}>
      <SectionScan />
      <div className="v3-wrap grid items-start gap-x-12 gap-y-8 lg:grid-cols-[1fr_1fr]" ref={ref}>
        {/* Heading */}
        <div className="order-1 min-w-0 lg:col-start-1 lg:row-start-1">
          <Kicker>{KICKER}</Kicker>
          <h1 className="v3-display mt-5" style={{ fontSize: "clamp(34px,5vw,64px)", lineHeight: 1.03 }}>
            {HEADING}
          </h1>
          <p className="mt-6" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 560 }}>
            {BODY}
          </p>
        </div>

        {/* Details — under the heading on desktop, below the scheduler on mobile */}
        <div className="order-3 min-w-0 lg:col-start-1 lg:row-start-2">
          <span className="v3-mono" style={labelStyle}>On the call</span>
          <ul className="mt-3 flex flex-col gap-2.5">
            {COVERS.map((c) => (
              <li key={c} className="flex items-start gap-3" style={{ color: "var(--v3-mut)", fontSize: 15.5 }}>
                <span style={{ color: "var(--v3-accent)", marginTop: 2 }}>
                  <CheckIcon className="h-4 w-4" />
                </span>
                {c}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {FACTS.map((f) => (
              <span key={f} className="v3-mono" style={{ fontSize: 12, color: "var(--v3-faint)", letterSpacing: "0.03em" }}>
                <span style={{ color: "var(--v3-accent)" }}>·</span> {f}
              </span>
            ))}
          </div>
        </div>

        {/* Scheduler */}
        <Reveal delay={1} className="order-2 min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="v3-panel v3-corner p-7 sm:p-9" style={{ borderRadius: 4 }}>
            <span className="v3-display" style={{ fontSize: 24 }}>Pick a time</span>
            <p className="v3-mono mt-2" style={{ fontSize: 12, color: "var(--v3-faint)" }}>
              It&apos;s just me, so I open a limited number of call slots each week.
            </p>

            <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-5" onFocus={markStarted}>
              {/* Day picker */}
              <div>
                <span className="v3-mono mb-2 block" style={labelStyle}>Choose a day</span>
                {days.length === 0 ? (
                  <p className="v3-mono" style={{ fontSize: 13, color: "var(--v3-faint)" }}>Loading available days…</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {days.map((d) => {
                      const sel = d.key === dayKey;
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => { markStarted(); setDayKey(d.key); }}
                          className="shrink-0 rounded-sm px-3 py-2 text-center transition-colors"
                          style={{
                            minWidth: 62,
                            border: `1px solid ${sel ? "var(--v3-accent)" : "var(--v3-line)"}`,
                            background: sel ? "color-mix(in srgb, var(--v3-accent) 14%, transparent)" : "transparent",
                          }}
                        >
                          <span className="v3-mono block" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--v3-faint)" }}>{d.weekday.toUpperCase()}</span>
                          <span className="v3-display block" style={{ fontSize: 20, lineHeight: 1.1, color: "var(--v3-ink)" }}>{d.dayNum}</span>
                          <span className="v3-mono block" style={{ fontSize: 9, color: "var(--v3-faint)" }}>{d.month.toUpperCase()}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Time picker */}
              <div>
                <span className="v3-mono mb-2 block" style={labelStyle}>Available times</span>
                <div className="grid grid-cols-2 gap-2">
                  {TIMES.map((t) => {
                    const sel = t === time;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { markStarted(); setTime(t); }}
                        className="v3-mono rounded-sm px-3 py-2.5 transition-colors"
                        style={{
                          fontSize: 14,
                          border: `1px solid ${sel ? "var(--v3-accent)" : "var(--v3-line)"}`,
                          background: sel ? "color-mix(in srgb, var(--v3-accent) 14%, transparent)" : "rgba(0,0,0,0.25)",
                          color: sel ? "var(--v3-ink)" : "var(--v3-mut)",
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                <p className="v3-mono mt-3" style={{ fontSize: 12.5, color: slotLabel ? "var(--v3-accent)" : "var(--v3-faint)" }}>
                  {slotLabel ? `Selected: ${slotLabel}` : "Pick a day and a time above."}
                </p>
              </div>

              <div className="border-t pt-5" style={{ borderColor: "var(--v3-line)" }}>
                {[
                  { key: "email" as const, label: "Email", type: "email", placeholder: "you@example.com" },
                  { key: "name" as const, label: "Name", type: "text", placeholder: "Your name" },
                  { key: "phone" as const, label: "Phone (optional)", type: "tel", placeholder: "(405) 000-0000" },
                ].map((f) => (
                  <div key={f.key} className="mb-3.5">
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

                {error ? (
                  <p role="alert" style={{ fontSize: 13, color: "var(--v3-danger)" }}>{error}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="v3-btn v3-btn-primary v3-clip mt-1 w-full disabled:opacity-60"
                  style={{ paddingLeft: 12 }}
                >
                  <span className="v3-btn-badge">
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                  {status === "loading" ? "Booking your call…" : "Confirm my call"}
                </button>
                <p className="text-center" style={{ fontSize: 12.5, color: "var(--v3-faint)" }}>
                  Free. No obligation. I&apos;ll confirm by email.
                </p>
              </div>
            </form>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
