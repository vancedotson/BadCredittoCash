"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { site } from "@/config/site-v3";
import { track, getRememberedLead } from "@/lib/tracking";
import { EVENTS } from "@/lib/events";
import { Kicker, Reveal, SectionScan } from "../../marketing-v3/shared/primitives";
import { useReveal } from "../../marketing-v3/shared/hooks";
import { CheckIcon, ArrowRightIcon } from "@/components/marketing-v2/Icons";
import { FunnelProgress } from "./FunnelProgress";

/**
 * /webinar/confirmed — the confirmation step. The ebook calls this the single
 * biggest lever on show-up, so it does real work: it fires `confirmed_view`,
 * restates event importance + what they'll learn, then gates the training behind
 * a short 3-step concern quiz. The quiz state lives here so the progress header
 * (top of the section) and the quiz card share it. Submitting routes to the room.
 */
const wb = site.webinar;
const quiz = wb.confirm.quiz;
const STEPS = quiz.steps;

const labelStyle = {
  fontSize: 10,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  color: "var(--v3-faint)",
};

export function ConfirmedSectionV4() {
  const ref = useReveal<HTMLDivElement>();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    track(EVENTS.confirmedView, {}, getRememberedLead()?.email);
  }, []);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const selected = answers[current.id];

  function choose(option: string) {
    if (!startedRef.current) {
      startedRef.current = true;
      track(EVENTS.quizStarted, {}, getRememberedLead()?.email);
    }
    setAnswers((a) => ({ ...a, [current.id]: option }));
    if (!isLast) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function submit() {
    setSubmitting(true);
    track(EVENTS.quizCompleted, { ...answers }, getRememberedLead()?.email);
    router.push("/webinar/room");
  }

  return (
    <section className="v3-section" style={{ paddingTop: "clamp(40px,6vw,88px)" }}>
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        {/* TOP CONTAINER — where they are in the webinar journey (this = step 2) */}
        <FunnelProgress current={2} note="Almost there. Your training is next." />

        <div className="mt-10 grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left — importance + what you'll learn (two bullets) */}
          <div>
            <Kicker>{wb.confirm.kicker}</Kicker>
            <h1 className="v3-display mt-5" style={{ fontSize: "clamp(34px,5.2vw,66px)", lineHeight: 1.02 }}>
              You&apos;re in.{" "}
              <span style={{ color: "var(--v3-accent)" }}>Your training is ready.</span>
            </h1>
            <p className="mt-6" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 560 }}>
              {wb.confirm.body}
            </p>

            <div className="mt-8">
              <span className="v3-mono" style={labelStyle}>
                What you&apos;ll learn
              </span>
              <ul className="mt-3 flex flex-col gap-3">
                {wb.learn.slice(0, 2).map((l) => (
                  <li key={l} className="flex items-start gap-3" style={{ color: "var(--v3-mut)", fontSize: 15.5, lineHeight: 1.5 }}>
                    <span style={{ color: "var(--v3-accent)", marginTop: 3 }}>
                      <CheckIcon className="h-4 w-4" />
                    </span>
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right — the quiz card (question + options, no progress bar now) */}
          <Reveal delay={1}>
            <div className="v3-panel v3-corner p-7 sm:p-9" style={{ borderRadius: 4 }}>
              <p style={{ fontSize: 15.5, color: "var(--v3-ink)", lineHeight: 1.5 }}>
                {quiz.intro}
              </p>

              <div className="mt-6 flex flex-wrap items-baseline gap-x-2.5">
                <span className="v3-mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", color: "var(--v3-faint)" }}>
                  QUESTION {step + 1} OF {STEPS.length}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--v3-accent)" }}>
                  {quiz.progress[step]}
                </span>
              </div>
              <h3 className="v3-display mt-2.5" style={{ fontSize: 20, lineHeight: 1.15 }}>
                {current.question}
              </h3>
              <div className="mt-4 flex flex-col gap-2.5">
                {current.options.map((opt, oi) => {
                  const isSel = selected === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => choose(opt)}
                      aria-pressed={isSel}
                      className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors"
                      style={{
                        border: `1px solid ${isSel ? "var(--v3-accent)" : "var(--v3-line)"}`,
                        background: isSel ? "color-mix(in srgb, var(--v3-accent) 12%, transparent)" : "rgba(0,0,0,0.28)",
                        color: "var(--v3-ink)",
                        fontSize: 15,
                      }}
                    >
                      {/* numbered badge — signals these are the choices to click */}
                      <span
                        className="v3-mono grid place-items-center"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          flexShrink: 0,
                          background: "var(--v3-accent)",
                          color: "var(--v3-bg)",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {oi + 1}
                      </span>
                      <span style={{ flex: 1 }}>{opt}</span>
                      {isSel ? (
                        <span style={{ color: "var(--v3-accent)", flexShrink: 0 }}>
                          <CheckIcon className="h-4 w-4" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    className="v3-mono"
                    style={{ fontSize: 12, letterSpacing: "0.1em", color: "var(--v3-mut)" }}
                  >
                    &larr; Back
                  </button>
                ) : (
                  <span />
                )}

                {isLast ? (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!selected || submitting}
                    className="v3-btn v3-btn-primary v3-clip disabled:opacity-50"
                    style={{ paddingLeft: 12 }}
                  >
                    <span className="v3-btn-badge">
                      <ArrowRightIcon className="h-4 w-4" />
                    </span>
                    {submitting ? "Opening the training…" : quiz.submitLabel}
                  </button>
                ) : (
                  <span className="v3-mono" style={{ fontSize: 11.5, color: "var(--v3-faint)" }}>
                    Tap an answer to continue
                  </span>
                )}
              </div>

              <div className="mt-5 text-center" style={{ borderTop: "1px solid var(--v3-line)", paddingTop: 16 }}>
                <Link
                  href="/webinar/room"
                  className="v3-mono"
                  style={{ fontSize: 12, color: "var(--v3-faint)", letterSpacing: "0.04em" }}
                >
                  Prefer to skip? {wb.confirm.watchCta}
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
