"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon } from "../Icons";
import { QUIZ_QUESTIONS as QUESTIONS, QUIZ_TOTAL as TOTAL, quizReflections, type QuizAnswers } from "@/config/collector-quiz";

/**
 * "The 60-second collector check" — light home-page skin of the lead-magnet quiz
 * (content + logic live in src/config/collector-quiz). It resonates by naming the
 * collectors people actually get contacted by, asks about their situation through
 * an FCRA/FDCPA lens, then routes them to book a free call. Compliance-safe.
 */

const pillBtn =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-gold px-7 font-heading text-base font-semibold text-ink transition-colors hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-50";

export function CollectorQuiz() {
  const [step, setStep] = useState(1); // 1..TOTAL
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const q = QUESTIONS[step - 1];
  const answer = answers[q.id];
  const answered = q.type === "single" ? Boolean(answer) : Array.isArray(answer) && answer.length > 0;

  function pick(opt: string) {
    setAnswers((a) => {
      if (q.type === "single") return { ...a, [q.id]: opt };
      const arr = Array.isArray(a[q.id]) ? (a[q.id] as string[]) : [];
      return { ...a, [q.id]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] };
    });
  }
  function isSelected(opt: string) {
    return q.type === "single" ? answer === opt : Array.isArray(answer) && answer.includes(opt);
  }
  function next() {
    if (step < TOTAL) { setStep(step + 1); return; }
    try { localStorage.setItem("collector-quiz", JSON.stringify(answers)); } catch { /* ignore */ }
    setDone(true);
  }
  function back() {
    if (done) { setDone(false); return; }
    if (step > 1) setStep(step - 1);
  }
  function restart() { setAnswers({}); setStep(1); setDone(false); }

  return (
    <section className="bg-cloud">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="text-center">
          <span className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-gold-deep">The 60-second check</span>
          <h2 className="mt-4 text-4xl leading-tight sm:text-5xl">Does any of this sound familiar?</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-body">
            If one of these names has been calling, writing, or showing up on your credit report, you are not powerless. Answer a few quick questions and I&apos;ll point you to your next step.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-mist bg-card p-6 shadow-card sm:p-9">
          {done ? (
            <Results answers={answers} onRestart={restart} onBack={back} />
          ) : (
            <>
              {/* Progress */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate">
                  <span>Question {step} of {TOTAL}</span>
                  <span>{Math.round((step / TOTAL) * 100)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-mist">
                  <div className="h-full rounded-full bg-gold transition-all duration-300" style={{ width: `${(step / TOTAL) * 100}%` }} />
                </div>
              </div>

              <h3 className="font-heading text-xl font-semibold leading-snug text-heading sm:text-2xl">{q.title}</h3>
              {q.type === "multi" ? <p className="mt-1 text-sm text-slate">Select all that apply.</p> : null}

              <div className={`mt-5 grid gap-2.5 ${q.id === "who" ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                {q.options.map((opt) => {
                  const sel = isSelected(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => pick(opt)}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] transition-colors ${sel ? "border-gold bg-gold/10 text-heading" : "border-mist bg-card text-body hover:border-trust hover:bg-cloud"}`}
                    >
                      <span className={`grid h-5 w-5 shrink-0 place-items-center border ${q.type === "single" ? "rounded-full" : "rounded"} ${sel ? "border-gold bg-gold text-ink" : "border-mist"}`}>
                        {sel ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="min-w-0">{opt}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-7 flex items-center justify-between gap-3">
                <button type="button" onClick={back} disabled={step === 1} className="text-sm font-semibold text-slate transition-colors hover:text-heading disabled:opacity-0">← Back</button>
                <button type="button" onClick={next} disabled={!answered} className={pillBtn}>
                  {step < TOTAL ? "Continue" : "See my results"}
                  <span aria-hidden>→</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Results({ answers, onRestart, onBack }: { answers: QuizAnswers; onRestart: () => void; onBack: () => void }) {
  const reflections = quizReflections(answers);

  return (
    <div className="text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green text-white">
        <CheckIcon className="h-7 w-7" />
      </div>
      <h3 className="mt-6 text-3xl sm:text-4xl">You don&apos;t have to deal with this alone.</h3>

      {reflections.length ? (
        <ul className="mx-auto mt-6 max-w-md space-y-2 text-left">
          {reflections.map((r) => (
            <li key={r} className="flex items-start gap-3 text-[15px] leading-relaxed text-body">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              {r}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-body">
        From what you shared, you may have protections under the FCRA and FDCPA. The only way to know for sure is to look at your specific situation. Book a free, no-pressure call and I&apos;ll tell you the honest next step.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link href="/book" className={pillBtn}>Book my free call<span aria-hidden>→</span></Link>
        <p className="text-sm text-slate">Free. No obligation.</p>
      </div>

      <div className="mt-8 flex items-center justify-center gap-5 text-sm font-semibold text-slate">
        <button type="button" onClick={onBack} className="transition-colors hover:text-heading">← Back</button>
        <button type="button" onClick={onRestart} className="transition-colors hover:text-heading">Start over</button>
      </div>
    </div>
  );
}
