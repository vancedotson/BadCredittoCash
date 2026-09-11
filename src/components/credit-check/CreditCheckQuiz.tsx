"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CREDIT_CHECK_UNKNOWN_OPTION, CREDIT_REPORT_COMPANIES } from "@/config/credit-check";
import { ArrowRightIcon, CheckIcon } from "@/components/marketing-v2/Icons";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { getAttribution, getVisitorId } from "@/lib/tracking";
import { normalizeCreditCheckPhone } from "@/lib/credit-check-validation";

type Field = "name" | "email" | "phone";
type Details = Record<Field, string>;
type FieldErrors = Partial<Record<Field, string>>;

function validateDetails(details: Details): FieldErrors {
  const errors: FieldErrors = {};
  if (details.name.trim().length < 2) errors.name = "Please enter your full name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(details.email.trim())) errors.email = "Please enter a valid email address.";
  if (!normalizeCreditCheckPhone(details.phone)) errors.phone = "Enter a phone number with an area or country code.";
  return errors;
}

export function CreditCheckQuiz({ localMode }: { localMode: boolean }) {
  const router = useRouter();
  const [companies, setCompanies] = useState<string[]>([]);
  const [details, setDetails] = useState<Details>({ name: "", email: "", phone: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [companyError, setCompanyError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const submittingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  function toggleCompany(company: string) {
    setCompanyError("");
    setCompanies((current) => {
      if (company === CREDIT_CHECK_UNKNOWN_OPTION) return current.includes(company) ? [] : [company];
      const withoutUnknown = current.filter((item) => item !== CREDIT_CHECK_UNKNOWN_OPTION);
      return withoutUnknown.includes(company)
        ? withoutUnknown.filter((item) => item !== company)
        : [...withoutUnknown, company];
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const errors = validateDetails(details);
    setFieldErrors(errors);
    setError("");
    if (companies.length === 0) {
      setCompanyError("Select at least one company, or choose “I’m not sure yet.”");
      formRef.current?.querySelector<HTMLInputElement>('[name="companies"]')?.focus();
      return;
    }
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
        body: JSON.stringify({ ...details, answers: { companies }, turnstileToken: token ?? undefined, attribution: getAttribution(), visitorId: getVisitorId() }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        setFieldErrors(result.fieldErrors ?? {});
        throw new Error(result.fieldErrors?.answers || result.error || "We couldn't save your details. Please try again.");
      }
      router.push("/credit-check/thank-you");
    } catch (problem) {
      setError(problem instanceof Error && problem.name !== "TimeoutError" ? problem.message : "That took longer than expected. Your information is still here. Please try again.");
      setToken(null);
      setResetKey((key) => key + 1);
      submittingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <main id="credit-check-main" className="cc-container cc-main cc-single-page">
      <section className="cc-single-intro" aria-labelledby="cc-title">
        <p className="cc-eyebrow cc-kicker">FREE CREDIT REPORT CHECK</p>
        <h1 className="v3-display cc-title" id="cc-title">See one of these names<br /><span>on your credit report?</span></h1>
        <p className="cc-intro-copy">Tell Vance which companies you see. Then get the simple guide for pulling and sending all three reports.</p>
        <div className="cc-benefits">
          <span><CheckIcon className="h-4 w-4" /> Takes about 60 seconds</span>
          <span><CheckIcon className="h-4 w-4" /> Free—no payment required</span>
        </div>
      </section>

      <form ref={formRef} onSubmit={submit} noValidate aria-busy={busy} className="cc-card cc-single-form">
        <div className="cc-card-top"><span className="cc-eyebrow">ONE QUICK CHECK</span><span className="cc-eyebrow">SELECT ALL THAT APPLY</span></div>
        <div className="cc-card-body cc-single-form-grid">
          <fieldset className="cc-company-fieldset" aria-describedby={companyError ? "cc-companies-error" : "cc-companies-help"}>
            <legend className="v3-display cc-question">Which companies are on your credit reports?</legend>
            <p className="cc-small cc-question-help" id="cc-companies-help">Select every name you recognize.</p>
            <div className="cc-company-options">
              {[...CREDIT_REPORT_COMPANIES, CREDIT_CHECK_UNKNOWN_OPTION].map((company) => {
                const selected = companies.includes(company);
                return <label className={`cc-option ${selected ? "is-selected" : ""}`} key={company}>
                  <input type="checkbox" name="companies" value={company} checked={selected} disabled={busy} onChange={() => toggleCompany(company)} />
                  <span className="cc-option-indicator" aria-hidden="true">{selected && <CheckIcon className="h-3.5 w-3.5" />}</span>
                  <span>{company}</span>
                </label>;
              })}
            </div>
            {companyError && <p className="cc-field-error" id="cc-companies-error" role="alert">{companyError}</p>}
          </fieldset>

          <section className="cc-contact-fields" aria-labelledby="cc-details-heading">
            <h2 className="v3-display cc-question" id="cc-details-heading">Where can Vance reach you?</h2>
            <p className="cc-small cc-question-help">Enter your details to open the report guide.</p>
            {(["name", "phone", "email"] as Field[]).map((field) => (
              <div key={field} className="cc-field">
                <label htmlFor={`cc-${field}`}>{field === "name" ? "Full name" : field === "email" ? "Email address" : "Phone number"}</label>
                <input id={`cc-${field}`} name={field} type={field === "name" ? "text" : field === "email" ? "email" : "tel"} autoComplete={field === "phone" ? "tel" : field} inputMode={field === "phone" ? "tel" : field === "email" ? "email" : "text"} required maxLength={field === "name" ? 160 : field === "email" ? 254 : 40} placeholder={field === "name" ? "Your full name" : field === "email" ? "you@example.com" : "(555) 123-4567"} value={details[field]} disabled={busy} aria-invalid={Boolean(fieldErrors[field])} aria-describedby={fieldErrors[field] ? `cc-${field}-error` : undefined} onChange={(event) => { setDetails((current) => ({ ...current, [field]: event.target.value })); setFieldErrors((current) => ({ ...current, [field]: undefined })); }} />
                {fieldErrors[field] && <p className="cc-field-error" id={`cc-${field}-error`}>{fieldErrors[field]}</p>}
              </div>
            ))}
            <p className="cc-small cc-use-note">Vance will use these details to follow up about your reports.</p>
            <p className="cc-small cc-use-note">By submitting, you agree to the <Link className="underline underline-offset-2" href="/terms">Terms of Service</Link> and acknowledge the <Link className="underline underline-offset-2" href="/privacy">Privacy Policy</Link>.</p>
            {!localMode && <TurnstileWidget onToken={setToken} resetKey={resetKey} />}
            {error && <p className="cc-error" role="alert">{error}</p>}
            <button type="submit" className="cc-primary cc-guide-button" disabled={busy}><span>{busy ? "Saving your details…" : "Show me how to get my reports"}</span>{!busy && <ArrowRightIcon className="h-5 w-5" />}</button>
            <p className="cc-small cc-form-reassurance" role="status">{busy ? "Please wait while we save your check." : localMode ? "Local preview · submissions are saved on this computer." : "Free. No payment. No obligation."}</p>
          </section>
        </div>
      </form>
    </main>
  );
}
