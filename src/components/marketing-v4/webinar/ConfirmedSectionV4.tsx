"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

export function ReviewableConfirmedSectionV4() {
  const reviewState = useSearchParams().get("state");
  const isQuestionTwo = reviewState === "quiz-2";
  const isQuestionThree = reviewState === "quiz-3";
  const isQuizReady = reviewState === "quiz-ready";
  const isQuizLoading = reviewState === "quiz-loading";
  const isReviewMode = reviewState?.startsWith("quiz-") ?? false;
  let initialAnswers: Record<string, string> | undefined;
  if (isQuizReady || isQuizLoading) {
    initialAnswers = {
      concern: STEPS[0].options[0],
      tried: STEPS[1].options[0],
      urgency: STEPS[2].options[0],
    };
  } else if (isQuestionThree) {
    initialAnswers = { concern: STEPS[0].options[0], tried: STEPS[1].options[0] };
  } else if (isQuestionTwo) {
    initialAnswers = { concern: STEPS[0].options[0] };
  }

  return (
    <ConfirmedSectionV4
      key={reviewState ?? "quiz-default"}
      initialStep={isQuizReady || isQuizLoading || isQuestionThree ? 2 : isQuestionTwo ? 1 : 0}
      initialAnswers={initialAnswers}
      focusActionOnLoad={isQuizReady || isQuizLoading}
      initialSubmitting={isQuizLoading}
      reviewMode={isReviewMode}
      trackView={!isReviewMode}
    />
  );
}

export function ConfirmedSectionV4({
  initialStep = 0,
  initialAnswers = {},
  focusActionOnLoad = false,
  initialSubmitting = false,
  reviewMode = false,
  trackView = true,
}: {
  initialStep?: number;
  initialAnswers?: Record<string, string>;
  focusActionOnLoad?: boolean;
  initialSubmitting?: boolean;
  reviewMode?: boolean;
  trackView?: boolean;
} = {}) {
  const ref = useReveal<HTMLDivElement>();
  const router = useRouter();
  const actionRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(() => Math.min(Math.max(initialStep, 0), STEPS.length - 1));
  const [answers, setAnswers] = useState<Record<string, string>>(() => initialAnswers);
  const [submitting, setSubmitting] = useState(initialSubmitting);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!trackView) return;
    track(EVENTS.confirmedView, {}, getRememberedLead()?.email);
  }, [trackView]);

  useEffect(() => {
    if (!focusActionOnLoad) return;
    const timer = setTimeout(() => actionRef.current?.scrollIntoView({ block: "center" }), 350);
    return () => clearTimeout(timer);
  }, [focusActionOnLoad]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const selected = answers[current.id];

  function choose(option: string) {
    if (submitting) return;
    if (!startedRef.current) {
      startedRef.current = true;
      if (!reviewMode) track(EVENTS.quizStarted, {}, getRememberedLead()?.email);
    }
    setAnswers((a) => ({ ...a, [current.id]: option }));
  }

  function continueQuiz() {
    if (!selected || isLast) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function submit() {
    if (submitting) return;
    setSubmitting(true);
    const email = getRememberedLead()?.email;
    if (!reviewMode) {
      track(EVENTS.quizCompleted, { ...answers }, email);
      if (answers.concern) track(EVENTS.goalReplied, { goal: answers.concern }, email);
    }
    router.push("/webinar/room");
  }

  return (
    <section className="v3-section" style={{ paddingTop: "clamp(40px,6vw,88px)" }}>
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        {/* TOP CONTAINER — where they are in the webinar journey (this = step 2) */}
        <FunnelProgress current={2} note="You're registered. Choose what matters most." />

        {/* On mobile the action must not be buried: order heading -> quiz -> learn.
            On lg the grid places heading (col1/row1) + learn (col1/row2) beside the
            quiz (col2, spanning both rows) — the original desktop layout. */}
        <div className="mt-10 grid items-start gap-x-12 gap-y-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Heading block */}
          <div className="order-1 lg:col-start-1 lg:row-start-1">
            <Kicker>{wb.confirm.kicker}</Kicker>
            <h1 className="v3-display mt-5" style={{ fontSize: "clamp(34px,5.2vw,66px)", lineHeight: 1.02 }}>
              You&apos;re in.{" "}
              <span style={{ color: "var(--v3-accent)" }}>Your training is ready.</span>
            </h1>
            <p className="mt-6" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 560 }}>
              Your place is saved. The training is ready whenever you are. Answer three quick questions so I can point you to the most useful part.
            </p>
          </div>

          {/* What you'll learn — below the quiz on mobile, under the heading on desktop */}
          <div className="order-3 lg:col-start-1 lg:row-start-2">
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

          {/* Quiz card — right after the heading on mobile */}
          <Reveal delay={1} className="order-2 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <div
              className="v3-panel v3-corner p-7 sm:p-9"
              aria-busy={submitting}
              style={{ borderRadius: 4 }}
            >
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
              <fieldset className="mt-2.5">
              <legend className="v3-display" style={{ fontSize: 20, lineHeight: 1.15 }}>
                {current.question}
              </legend>
              <p
                id={`quiz-${current.id}-guidance`}
                className="mt-2"
                aria-live="polite"
                style={{ fontSize: 13, color: selected ? "var(--v3-accent)" : "var(--v3-mut)" }}
              >
                {isLast
                  ? selected
                    ? "Answer selected. Open the training when ready."
                    : "Choose one answer to open the training."
                  : selected
                    ? "Answer selected. Continue when ready."
                    : "Choose one answer to continue."}
              </p>
              <div className="mt-4 flex flex-col gap-2.5">
                {current.options.map((opt, oi) => {
                  const isSel = selected === opt;
                  return (
                    <label
                      key={opt}
                      className="v4-quiz-option flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors"
                      style={{
                        border: `1px solid ${isSel ? "var(--v3-accent)" : "var(--v3-line)"}`,
                        background: isSel ? "color-mix(in srgb, var(--v3-accent) 12%, transparent)" : "rgba(0,0,0,0.28)",
                        color: "var(--v3-ink)",
                        fontSize: 15,
                      }}
                    >
                      <input
                        type="radio"
                        name={`quiz-${current.id}`}
                        value={opt}
                          checked={isSel}
                          disabled={submitting}
                          onChange={() => choose(opt)}
                        aria-describedby={`quiz-${current.id}-guidance`}
                        className="sr-only"
                      />
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
                    </label>
                  );
                })}
              </div>
              </fieldset>

              <div ref={actionRef} className="mt-6 flex items-center justify-between gap-3">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    disabled={submitting}
                    className="v4-quiz-back v3-mono whitespace-nowrap rounded-sm px-1 py-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
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
                      {submitting ? (
                        <span
                          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                          aria-hidden="true"
                        />
                      ) : (
                        <ArrowRightIcon className="h-4 w-4" />
                      )}
                    </span>
                    {submitting ? "Opening the training..." : quiz.submitLabel}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={continueQuiz}
                    disabled={!selected}
                    className="v3-btn v3-btn-primary v3-clip disabled:opacity-50"
                  >
                    Continue
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              {submitting ? (
                <p
                  role="status"
                  className="mt-3 text-right"
                  style={{ fontSize: 13, color: "var(--v3-accent)" }}
                >
                  Opening your training. Please wait.
                </p>
              ) : null}

              <div className="mt-5 text-center" style={{ borderTop: "1px solid var(--v3-line)", paddingTop: 16 }}>
                <Link
                  href="/webinar/room"
                  aria-disabled={submitting}
                  tabIndex={submitting ? -1 : undefined}
                  onClick={submitting ? (event) => event.preventDefault() : undefined}
                  className="v3-mono inline-block py-1.5"
                  style={{
                    fontSize: 13,
                    color: "var(--v3-mut)",
                    letterSpacing: "0.02em",
                    textDecoration: "underline",
                    opacity: submitting ? 0.5 : 1,
                    pointerEvents: submitting ? "none" : "auto",
                  }}
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
