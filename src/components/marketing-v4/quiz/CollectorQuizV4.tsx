"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, ArrowRightIcon } from "@/components/marketing-v2/Icons";
import { SectionScan } from "../../marketing-v3/shared/primitives";
import { QUIZ_QUESTIONS as QUESTIONS, QUIZ_TOTAL as TOTAL, quizReflections, type QuizAnswers } from "@/config/collector-quiz";

/**
 * "The 60-second collector check" — dark case-file skin of the lead-magnet quiz
 * (content + logic in src/config/collector-quiz). Same behavior as the light
 * home skin; styled with the v3 tokens so the accent tracks the V1/V2/V3 toggle.
 * Routes to /book. Compliance-safe.
 */

function optionStyle(sel: boolean) {
  return {
    fontSize: 17,
    border: `1px solid ${sel ? "var(--v3-accent)" : "var(--v3-line)"}`,
    background: sel ? "color-mix(in srgb, var(--v3-accent) 12%, transparent)" : "rgba(0,0,0,0.25)",
    color: sel ? "var(--v3-ink)" : "var(--v3-mut)",
  };
}

export function CollectorQuizV4() {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswers>({});

  const q = QUESTIONS[step - 1];
  const answer = answers[q.id];
  const answered = q.type === "single" ? Boolean(answer) : Array.isArray(answer) && answer.length > 0;
  const pct = Math.round((step / TOTAL) * 100);

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
    <section className="v3-section" id="check">
      <SectionScan />
      <div className="v3-wrap">
        <div style={{ maxWidth: 940, margin: "0 auto" }}>
          <div className="text-center">
            <span className="v3-mono" style={{ fontSize: 12.5, letterSpacing: "0.22em", color: "var(--v3-accent)" }}>THE 60-SECOND CHECK</span>
            <h2 className="v3-display mt-4" style={{ fontSize: "clamp(38px,5vw,64px)", lineHeight: 1.03 }}>Does any of this sound familiar?</h2>
            <p className="mx-auto mt-5" style={{ maxWidth: 620, fontSize: 19, lineHeight: 1.6, color: "var(--v3-mut)" }}>
              If one of these names has been calling, writing, or showing up on your credit report, you are not powerless. Answer a few quick questions and I&apos;ll point you to your next step.
            </p>
          </div>

          <div className="v3-panel v3-corner mt-10 p-7 sm:p-11" style={{ borderRadius: 4 }}>
            {done ? (
              <ResultsV4 answers={answers} onRestart={restart} onBack={back} />
            ) : (
              <>
                <div className="mb-7">
                  <div className="v3-mono mb-2.5 flex items-center justify-between" style={{ fontSize: 12.5, letterSpacing: "0.08em", color: "var(--v3-faint)" }}>
                    <span>QUESTION {step} OF {TOTAL}</span>
                    <span>{pct}%</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 9999, background: "var(--v3-line)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "var(--v3-accent)", transition: "width .3s" }} />
                  </div>
                </div>

                <h3 className="v3-display" style={{ fontSize: "clamp(24px,2.6vw,30px)", lineHeight: 1.2 }}>{q.title}</h3>
                {q.type === "multi" ? <p className="v3-mono mt-2" style={{ fontSize: 13.5, color: "var(--v3-faint)" }}>Select all that apply.</p> : null}

                <div className={`mt-6 grid gap-3 ${q.id === "who" ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                  {q.options.map((opt) => {
                    const sel = isSelected(opt);
                    return (
                      <button key={opt} type="button" onClick={() => pick(opt)} className="flex items-center gap-3 rounded-sm px-4 py-4 text-left transition-colors" style={optionStyle(sel)}>
                        <span className="grid h-6 w-6 shrink-0 place-items-center" style={{ borderRadius: q.type === "single" ? 9999 : 4, border: `1px solid ${sel ? "var(--v3-accent)" : "var(--v3-line)"}`, background: sel ? "var(--v3-accent)" : "transparent", color: "var(--v3-ink)" }}>
                          {sel ? <CheckIcon className="h-4 w-4" /> : null}
                        </span>
                        <span className="min-w-0">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 flex items-center justify-between gap-3">
                  <button type="button" onClick={back} disabled={step === 1} className="v3-mono" style={{ fontSize: 14, color: "var(--v3-faint)", opacity: step === 1 ? 0 : 1 }}>← Back</button>
                  <button type="button" onClick={next} disabled={!answered} className="v3-btn v3-btn-primary v3-clip disabled:opacity-50" style={{ paddingLeft: 12, fontSize: 16 }}>
                    <span className="v3-btn-badge"><ArrowRightIcon className="h-4 w-4" /></span>
                    {step < TOTAL ? "Continue" : "See my results"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ResultsV4({ answers, onRestart, onBack }: { answers: QuizAnswers; onRestart: () => void; onBack: () => void }) {
  const reflections = quizReflections(answers);
  return (
    <div className="text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full" style={{ background: "var(--v3-accent)", color: "var(--v3-ink)" }}>
        <CheckIcon className="h-8 w-8" />
      </div>
      <h3 className="v3-display mt-6" style={{ fontSize: "clamp(30px,3.8vw,46px)", lineHeight: 1.08 }}>You don&apos;t have to deal with this alone.</h3>

      {reflections.length ? (
        <ul className="mx-auto mt-7 max-w-lg space-y-2.5 text-left">
          {reflections.map((r) => (
            <li key={r} className="flex items-start gap-3" style={{ fontSize: 17, lineHeight: 1.6, color: "var(--v3-mut)" }}>
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--v3-accent)" }} />
              {r}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mx-auto mt-7" style={{ maxWidth: 600, fontSize: 19, lineHeight: 1.6, color: "var(--v3-mut)" }}>
        From what you shared, you may have protections under the FCRA and FDCPA. The only way to know for sure is to look at your specific situation. Book a free, no-pressure call and I&apos;ll tell you the honest next step.
      </p>

      <div className="mt-9 flex flex-col items-center gap-3">
        <Link href="/book" className="v3-btn v3-btn-primary v3-clip" style={{ paddingLeft: 12, fontSize: 16 }}>
          <span className="v3-btn-badge"><ArrowRightIcon className="h-4 w-4" /></span>
          Book my free call
        </Link>
        <p className="v3-mono" style={{ fontSize: 13.5, color: "var(--v3-faint)" }}>Free. No obligation.</p>
      </div>

      <div className="mt-9 flex items-center justify-center gap-6">
        <button type="button" onClick={onBack} className="v3-mono" style={{ fontSize: 14, color: "var(--v3-faint)" }}>← Back</button>
        <button type="button" onClick={onRestart} className="v3-mono" style={{ fontSize: 14, color: "var(--v3-faint)" }}>Start over</button>
      </div>
    </div>
  );
}
