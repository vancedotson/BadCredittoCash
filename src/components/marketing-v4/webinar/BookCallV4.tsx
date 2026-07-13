"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { site } from "@/config/site-v3";
import { track, getRememberedLead, getUtmParams } from "@/lib/tracking";
import { EVENTS } from "@/lib/events";
import { Kicker, Reveal, SectionScan } from "../../marketing-v3/shared/primitives";
import { useReveal } from "../../marketing-v3/shared/hooks";
import { CheckIcon, CloseIcon, ArrowRightIcon } from "@/components/marketing-v2/Icons";

/**
 * /webinar/call — the "offer" page, application-style. It qualifies (who it's
 * for / who it's not for), reverses risk, and books the free call. Fires
 * `call_page_view` on load, `call_booking_started` the moment they engage the
 * form, and `call_booked` on success (the conversion) before routing to booked.
 * The "started but not booked" gap is what the segmentation reads as an abandon.
 */
const wb = site.webinar;

export function BookCallV4() {
  const ref = useReveal<HTMLDivElement>();

  useEffect(() => {
    track(EVENTS.callPageView, {}, getRememberedLead()?.email);
  }, []);

  return (
    <section className="v3-section" style={{ paddingTop: "clamp(40px,6vw,84px)" }}>
      <SectionScan />
      {/* On mobile the booking form must not be buried: order heading -> form ->
          details. On lg the grid keeps heading (col1/row1) + details (col1/row2)
          beside the form (col2, spanning both rows) — the original desktop layout. */}
      <div className="v3-wrap grid items-start gap-x-12 gap-y-8 lg:grid-cols-[1.05fr_0.95fr]" ref={ref}>
        {/* Heading block */}
        <div className="order-1 lg:col-start-1 lg:row-start-1">
          <Kicker>{wb.call.kicker}</Kicker>
          <h1 className="v3-display mt-5" style={{ fontSize: "clamp(34px,5vw,64px)", lineHeight: 1.03 }}>
            {wb.call.heading}
          </h1>
          <p className="mt-6" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 560 }}>
            {wb.call.body}
          </p>
        </div>

        {/* Details — below the form on mobile, under the heading on desktop */}
        <div className="order-3 lg:col-start-1 lg:row-start-2">
          {/* What the call covers */}
          <div>
            <span className="v3-mono" style={labelStyle}>
              On the call
            </span>
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

          {/* Who it's for / not for — qualification */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <span className="v3-mono" style={labelStyle}>
                This is for you if
              </span>
              <ul className="mt-3 flex flex-col gap-2">
                {wb.call.whoFor.map((w) => (
                  <li key={w} className="flex items-start gap-2.5" style={{ color: "var(--v3-mut)", fontSize: 14.5, lineHeight: 1.5 }}>
                    <span style={{ color: "var(--v3-accent)", marginTop: 3 }}>
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="v3-mono" style={labelStyle}>
                Probably not if
              </span>
              <ul className="mt-3 flex flex-col gap-2">
                {wb.call.whoNotFor.map((w) => (
                  <li key={w} className="flex items-start gap-2.5" style={{ color: "var(--v3-faint)", fontSize: 14.5, lineHeight: 1.5 }}>
                    <span style={{ color: "var(--v3-faint)", marginTop: 3 }}>
                      <CloseIcon className="h-3.5 w-3.5" />
                    </span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Risk reversal */}
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {site.riskReversal.points.map((p) => (
              <span key={p} className="v3-mono" style={{ fontSize: 12.5, color: "var(--v3-faint)", letterSpacing: "0.04em" }}>
                <span style={{ color: "var(--v3-accent)" }}>·</span> {p}
              </span>
            ))}
          </div>
        </div>

        {/* Booking card — right after the heading on mobile */}
        <Reveal delay={1} className="order-2 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="v3-panel v3-corner p-7 sm:p-9" style={{ borderRadius: 4 }}>
            <span className="v3-display" style={{ fontSize: 24 }}>
              Book your call
            </span>
            <p className="v3-mono mt-2" style={{ fontSize: 12, color: "var(--v3-faint)" }}>
              {wb.call.slotsNote}
            </p>
            <div className="mt-6">
              <BookingForm />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const labelStyle = {
  fontSize: 10,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  color: "var(--v3-faint)",
};

const TIME_WINDOWS = [
  "Weekday mornings",
  "Weekday afternoons",
  "Weekday evenings",
  "Weekends",
];

function BookingForm() {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", email: "", phone: "", preferredTime: TIME_WINDOWS[0] });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Prefill from the remembered lead so a warm registrant doesn't retype.
  // Deferred via rAF (matches the /v4 page's localStorage read) so we don't
  // setState synchronously in the effect body, and avoid a hydration mismatch.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
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

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = values.name.trim();
    const email = values.email.trim();
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      setError("Please enter your name and a valid email.");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, name, email, utm: getUtmParams() }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Booking failed.");
      }
      track(EVENTS.booked, { preferredTime: values.preferredTime }, email);
      router.push("/webinar/booked");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const inputStyle = {
    background: "rgba(0,0,0,0.35)",
    border: "1px solid var(--v3-line)",
    color: "var(--v3-ink)",
    fontFamily: "var(--v3-mono)",
    fontSize: 15,
  } as const;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3.5" onFocus={markStarted}>
      {[
        { key: "email" as const, label: "Email", type: "email", placeholder: "you@example.com" },
        { key: "name" as const, label: "Name", type: "text", placeholder: "Your name" },
        { key: "phone" as const, label: "Phone (optional)", type: "tel", placeholder: "(405) 000-0000" },
      ].map((f) => (
        <div key={f.key}>
          <label htmlFor={`bk-${f.key}`} className="v3-mono mb-1.5 block" style={labelStyle}>
            {f.label}
          </label>
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

      <div>
        <label htmlFor="bk-time" className="v3-mono mb-1.5 block" style={labelStyle}>
          Best time for a call
        </label>
        <select
          id="bk-time"
          value={values.preferredTime}
          onChange={(e) => set("preferredTime", e.currentTarget.value)}
          className="w-full rounded-sm px-4 py-3 outline-none transition-colors"
          style={inputStyle}
        >
          {TIME_WINDOWS.map((w) => (
            <option key={w} value={w} style={{ background: "#0b0d12" }}>
              {w}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p role="alert" style={{ fontSize: 13, color: "var(--v3-danger)" }}>
          {error}
        </p>
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
        {status === "loading" ? "Booking your call…" : wb.call.cta}
      </button>
      <p className="text-center" style={{ fontSize: 12.5, color: "var(--v3-faint)" }}>
        Free. No obligation. I&apos;ll confirm by email.
      </p>
    </form>
  );
}
