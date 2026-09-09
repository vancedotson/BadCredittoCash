"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CREDIT_CHECK_QUESTIONS as questions } from "@/config/credit-check";
import type { QuizAnswers } from "@/config/collector-quiz";
import { ArrowRightIcon, CheckIcon } from "@/components/marketing-v2/Icons";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { getAttribution, getVisitorId } from "@/lib/tracking";
import { normalizeCreditCheckPhone } from "@/lib/credit-check-validation";

type Field = "name" | "email" | "phone";
type Details = Record<Field, string>;
type FieldErrors = Partial<Record<Field, string>>;

function validate(details: Details): FieldErrors {
  const errors: FieldErrors = {};
  if (details.name.trim().length < 2) errors.name = "Please enter your full name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(details.email.trim())) errors.email = "Please enter a valid email address.";
  if (!normalizeCreditCheckPhone(details.phone)) {
    errors.phone = "Enter a phone number with an area or country code.";
  }
  return errors;
}

export function CreditCheckQuiz({ localMode }: { localMode: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [details, setDetails] = useState<Details>({ name: "", email: "", phone: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lastStepRef = useRef(0);
  const submittingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const isDetails = step === questions.length;
  const question = questions[Math.min(step, questions.length - 1)];
  const answer = answers[question.id];
  const answered = question.type === "multi" ? Array.isArray(answer) && answer.length > 0 : typeof answer === "string";

  useEffect(() => {
    if (lastStepRef.current === step) return;
    lastStepRef.current = step;
    headingRef.current?.focus();
  }, [step]);

  function move(next: number) {
    setStep(next);
    setError("");
  }

  function choose(option: string) {
    setAnswers((current) => {
      if (question.type === "single") return { ...current, [question.id]: option };
      const selected = current[question.id];
      const options = Array.isArray(selected) ? selected : [];
      return { ...current, [question.id]: options.includes(option) ? options.filter((item) => item !== option) : [...options, option] };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const errors = validate(details);
    setFieldErrors(errors);
    setError("");
    const firstError = Object.keys(errors)[0] as Field | undefined;
    if (firstError) {
      formRef.current?.querySelector<HTMLInputElement>(`[name="${firstError}"]`)?.focus();
      return;
    }
    if (!localMode && !token) {
      setError("Please complete the security check before continuing.");
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/credit-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...details, answers, turnstileToken: token ?? undefined, attribution: getAttribution(), visitorId: getVisitorId() }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        setFieldErrors(result.fieldErrors ?? {});
        throw new Error(result.fieldErrors?.answers || result.error || "We couldn't save your details. Please try again.");
      }
      router.push("/credit-check/thank-you");
    } catch (problem) {
      setError(problem instanceof Error && problem.name !== "TimeoutError" ? problem.message : "That took longer than expected. Your answers are still here. Please try again.");
      setToken(null);
      setResetKey((key) => key + 1);
      submittingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <main id="credit-check-main" className="cc-container cc-main">
      <ol className="cc-stages" aria-label="Your progress">
        <li className={!isDetails ? "is-current" : "is-complete"} aria-current={!isDetails ? "step" : undefined}><span>{isDetails ? <CheckIcon className="h-3 w-3" /> : "01"}</span> Quick check</li>
        <li className={isDetails ? "is-current" : ""} aria-current={isDetails ? "step" : undefined}><span>02</span> Your details</li>
        <li><span>03</span> Your next step</li>
      </ol>

      <div className="cc-grid">
        <section className="cc-intro" aria-labelledby="cc-title">
          <p className="cc-eyebrow cc-kicker">COLLECTOR CALLS? CREDIT REPORT PROBLEMS?</p>
          <h1 className="v3-display cc-title" id="cc-title">Let&apos;s get a <br />clear <span>picture.</span></h1>
          <p className="cc-intro-copy">Answer 5 quick questions about what&apos;s happening. I&apos;ll point you to the next step: pulling your record so you can see what&apos;s actually there.</p>
          <div className="cc-benefits">
            <span><CheckIcon className="h-4 w-4" /> About 60 seconds</span>
            <span><CheckIcon className="h-4 w-4" /> No payment required</span>
          </div>
          <div className="cc-advocate">
            <div className="cc-portrait"><Image src="/vance.png" alt="Vance Dotson" fill sizes="64px" className="object-cover object-top" /></div>
            <div><strong>Vance Dotson</strong><span>Consumer advocate since 2004</span></div>
          </div>
          <p className="cc-small cc-intro-note">You don&apos;t have to figure this out alone.</p>
        </section>

        <section className="cc-card" aria-labelledby="cc-question-title">
          <div className="cc-card-top"><span className="cc-eyebrow">{isDetails ? "CHECK COMPLETE" : "YOUR SITUATION"}</span><span className="cc-eyebrow">{isDetails ? "ONE LAST STEP" : `0${step + 1} / 0${questions.length}`}</span></div>
          <div className="cc-progress" role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={step}><span style={{ width: `${step / questions.length * 100}%` }} /></div>
          <div className="cc-card-body">
            <h2 className="v3-display cc-question" id="cc-question-title" ref={headingRef} tabIndex={-1}>{isDetails ? "Where can I reach you?" : question.title}</h2>
            <p className="cc-small cc-question-help">{isDetails ? "Add your details to continue to your record-pulling instructions." : question.type === "multi" ? "Select all that apply." : "Choose the answer that fits best."}</p>
            {isDetails ? (
              <form ref={formRef} onSubmit={submit} noValidate aria-busy={busy} className="cc-form">
                {(["name", "email", "phone"] as Field[]).map((field) => (
                  <div key={field} className="cc-field">
                    <label htmlFor={`cc-${field}`}>{field === "name" ? "Full name" : field === "email" ? "Email address" : "Phone number"}</label>
                    <input id={`cc-${field}`} name={field} type={field === "name" ? "text" : field === "email" ? "email" : "tel"} autoComplete={field === "phone" ? "tel" : field} inputMode={field === "phone" ? "tel" : field === "email" ? "email" : "text"} required maxLength={field === "name" ? 160 : field === "email" ? 254 : 40} placeholder={field === "name" ? "Your full name" : field === "email" ? "you@example.com" : "(555) 123-4567"} value={details[field]} disabled={busy} aria-invalid={Boolean(fieldErrors[field])} aria-describedby={fieldErrors[field] ? `cc-${field}-error` : undefined} onChange={(event) => { setDetails((current) => ({ ...current, [field]: event.target.value })); setFieldErrors((current) => ({ ...current, [field]: undefined })); }} />
                    {fieldErrors[field] && <p className="cc-field-error" id={`cc-${field}-error`}>{fieldErrors[field]}</p>}
                  </div>
                ))}
                <p className="cc-small cc-use-note">I&apos;ll use these details to follow up about your check.</p>
                <p className="cc-small cc-use-note">
                  By submitting, you agree to the{" "}
                  <Link className="underline underline-offset-2" href="/terms">Terms of Service</Link>
                  {" "}and acknowledge the{" "}
                  <Link className="underline underline-offset-2" href="/privacy">Privacy Policy</Link>.
                </p>
                {!localMode && <TurnstileWidget onToken={setToken} resetKey={resetKey} />}
                {error && <p className="cc-error" role="alert">{error}</p>}
                <button type="submit" className="cc-primary" disabled={busy}><span>{busy ? "Saving your details…" : "Show me my next step"}</span>{!busy && <ArrowRightIcon className="h-5 w-5" />}</button>
                <p className="cc-small cc-form-reassurance" role="status">{busy ? "Please wait while we save your check." : localMode ? "Local preview · submissions are saved on this computer." : "Free. No payment. No obligation."}</p>
                <button type="button" className="cc-back" disabled={busy} onClick={() => move(step - 1)}>← Back to my answers</button>
              </form>
            ) : (
              <>
                <fieldset className="cc-options" key={question.id}>
                  <legend className="sr-only">{question.title}</legend>
                  {question.options.map((option) => {
                    const selected = Array.isArray(answer) ? answer.includes(option) : answer === option;
                    return <label className={`cc-option ${selected ? "is-selected" : ""}`} key={option}>
                      <input type={question.type === "multi" ? "checkbox" : "radio"} name={question.id} value={option} checked={selected} onChange={() => choose(option)} />
                      <span className={`cc-option-indicator ${question.type === "single" ? "is-radio" : ""}`} aria-hidden="true">{selected && <CheckIcon className="h-3.5 w-3.5" />}</span><span>{option}</span>
                    </label>;
                  })}
                </fieldset>
                <div className="cc-actions"><button type="button" className="cc-back" onClick={() => move(step - 1)} disabled={step === 0}>← Back</button><button type="button" className="cc-primary" disabled={!answered} onClick={() => move(step + 1)}>{step === questions.length - 1 ? "Continue to my details" : "Continue"}<ArrowRightIcon className="h-5 w-5" /></button></div>
                <p className="cc-small cc-card-footnote">{step === 0 ? "Start with what you know. There are no wrong answers." : "Your answers stay here if you go back."}</p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
