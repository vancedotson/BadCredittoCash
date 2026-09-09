"use client";

import { useEffect, useRef, useState } from "react";
import { CREDIT_CHECK_GUIDE as guide } from "@/config/credit-check";
import { ArrowRightIcon, DocumentIcon } from "@/components/marketing-v2/Icons";
import { DesktopHandoff } from "./DesktopHandoff";
import { CreditReportUploads } from "./CreditReportUploads";

const steps = ["Use a computer", "Get 3 reports", "Send to Vance"];
const bureaus = ["TransUnion", "Equifax", "Experian"];

function GuideLink({ page, children }: { page: number; children: React.ReactNode }) {
  return <a href={`${guide.href}#page=${page}`} target="_blank" rel="noopener noreferrer">{children}<span className="sr-only"> (PDF opens in a new tab)</span></a>;
}

export function ReportGuideSteps() {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);

  useEffect(() => {
    if (previousStep.current !== step) {
      heading.current?.focus();
      previousStep.current = step;
    }
  }, [step]);

  return (
    <>
      <nav className="cc-simple-progress" aria-label="Report steps">
        <ol>{steps.map((label, index) => (
          <li key={label}>
            <button type="button" onClick={() => setStep(index)} aria-current={step === index ? "step" : undefined}>
              <span>{index + 1}</span>{label}
            </button>
          </li>
        ))}</ol>
      </nav>

      <section className="cc-simple-card" aria-labelledby="cc-current-step">
        <p className="cc-eyebrow cc-simple-step">STEP {step + 1} OF 3</p>
        {step === 0 && <>
          <div className="cc-simple-stop">
            <div className="cc-stop-sign" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M30 3H70L97 30V70L70 97H30L3 70V30Z" /><path className="cc-stop-outline" d="M32 9H68L91 32V68L68 91H32L9 68V32Z" /></svg><span>STOP</span></div>
            <div><h2 id="cc-current-step" className="v3-display" ref={heading} tabIndex={-1}>Use a laptop<br />or desktop.</h2><p>Do this walkthrough on a computer.</p></div>
          </div>
          <p className="cc-simple-copy">You&apos;ll need to download and send 3 PDF files. Keep your phone nearby for any verification codes.</p>
          <button className="cc-primary cc-guide-button" type="button" onClick={() => setStep(1)}>I&apos;m on a computer <ArrowRightIcon className="h-5 w-5" /></button>
          <div className="cc-simple-handoff"><p>On your phone? Open this page on your computer.</p><DesktopHandoff /></div>
          <button className="cc-simple-text-button" type="button" onClick={() => setStep(2)}>Already have all 3 PDFs? Go to the sending step →</button>
        </>}

        {step === 1 && <>
          <h2 id="cc-current-step" className="v3-display" ref={heading} tabIndex={-1}>Get all 3 credit reports.</h2>
          <p className="cc-simple-copy">Follow the picture guide. Select all 3 companies below and save one full PDF from each.</p>
          <div className="cc-simple-files" aria-label="The three reports you need">{bureaus.map((bureau) => <div key={bureau}><DocumentIcon className="h-7 w-7" /><span>{bureau}</span><small>PDF</small></div>)}</div>
          <div className="cc-simple-save"><strong>Save each report before moving to the next.</strong><span>Choose Download or Print → <b>Save as PDF.</b> Open the saved file to check every page is readable.</span></div>
          <p className="cc-simple-address"><strong>Moved in the last 2 years?</strong> Have your previous address ready.</p>
          <div className="cc-simple-get-actions">
            <a className="cc-guide-open" href={guide.href} target="_blank" rel="noopener noreferrer"><span className="cc-simple-action-number">A</span><span>Open the picture guide<small>Keep it open while you get your reports.</small></span><span aria-hidden="true">↗</span><span className="sr-only"> (PDF opens in a new tab)</span></a>
            <a className="cc-primary cc-guide-button" href="https://www.annualcreditreport.com/" target="_blank" rel="noopener noreferrer"><span className="cc-simple-action-number">B</span>Go get my 3 reports <ArrowRightIcon className="h-5 w-5" /><span className="sr-only"> (AnnualCreditReport.com opens in a new tab)</span></a>
          </div>
          <p className="cc-simple-site">AnnualCreditReport.com · Come back here when you&apos;ve saved your files.</p>
          <details className="cc-simple-help"><summary>Need help? See the key steps</summary><div>
            <p><strong>Moved in the last 2 years?</strong> Include your previous address. Check your information carefully. <GuideLink page={9}>See page 9.</GuideLink></p>
            <p><strong>Select all 3 companies.</strong> TransUnion, Equifax, and Experian. <GuideLink page={11}>See page 11.</GuideLink></p>
            <p><strong>Having trouble saving?</strong> Wait for the full print preview. The guide shows Landscape for TransUnion. <GuideLink page={18}>TransUnion: page 18</GuideLink> · <GuideLink page={33}>Equifax: page 33</GuideLink> · <GuideLink page={41}>Experian: page 41</GuideLink>.</p>
            <p>Screens can look different. If you can&apos;t verify your identity, follow that company&apos;s instructions. Don&apos;t guess at the answers.</p>
            <a href={guide.href} download="Vance-Dotson-Annual-Credit-Report-Guide.pdf">Download the full picture guide ↓</a>
          </div></details>
          <div className="cc-simple-next"><p>All 3 PDFs saved? Your next step is to send them.</p><button className="cc-primary cc-guide-button" type="button" onClick={() => setStep(2)}>I have all 3 PDFs — next <ArrowRightIcon className="h-5 w-5" /></button></div>
        </>}

        {step === 2 && <>
          <h2 id="cc-current-step" className="v3-display" ref={heading} tabIndex={-1}>Send your reports<br />to Vance.</h2>
        </>}
        <div hidden={step !== 2}>
          <CreditReportUploads />
          <button className="cc-simple-text-button" type="button" onClick={() => setStep(1)}>← I still need to get my reports</button>
        </div>
      </section>
      <p className="cc-simple-finish">The finish line: Vance has all 3 of your reports.</p>
    </>
  );
}
