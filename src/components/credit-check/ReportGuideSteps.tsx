"use client";

import { useEffect, useRef, useState } from "react";
import { CREDIT_CHECK_GUIDE as guide } from "@/config/credit-check";
import { ArrowRightIcon } from "@/components/marketing-v2/Icons";
import { DesktopHandoff } from "./DesktopHandoff";
import { CreditReportUploads } from "./CreditReportUploads";

/**
 * Two steps. Step 2 used to be split into "get your reports" and a separate
 * "send them" step; they now live on one screen so someone who already has the
 * three PDFs can upload straight away, and someone who doesn't gets the guide
 * without a dead-end "next" button in between.
 */
const steps = ["Use a computer", "Upload your reports"];

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
      <nav className="cc-simple-progress" aria-label="Your progress">
        <ol>{steps.map((label, index) => (
          <li key={label} aria-current={step === index ? "step" : undefined}>
            <span className="cc-progress-number">{index + 1}</span>
            <span>{label}</span>
          </li>
        ))}</ol>
      </nav>

      <section className="cc-simple-card" aria-labelledby="cc-current-step">
        <p className="cc-eyebrow cc-simple-step">STEP {step + 1} OF {steps.length}</p>
        {step === 0 && <>
          <div className="cc-simple-stop">
            <div className="cc-stop-sign" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M30 3H70L97 30V70L70 97H30L3 70V30Z" /><path className="cc-stop-outline" d="M32 9H68L91 32V68L68 91H32L9 68V32Z" /></svg><span>STOP</span></div>
            <div><h2 id="cc-current-step" className="v3-display" ref={heading} tabIndex={-1}>Use a laptop<br />or desktop.</h2><p>Do this walkthrough on a computer.</p></div>
          </div>
          <p className="cc-simple-copy">You&apos;ll need to download and send 3 PDF files. Keep your phone nearby for any verification codes.</p>
          <button className="cc-primary cc-guide-button" type="button" onClick={() => setStep(1)}>Yes, I am on my computer <ArrowRightIcon className="h-5 w-5" /></button>
          <div className="cc-simple-handoff"><DesktopHandoff /></div>
        </>}

        {step === 1 && <>
          <h2 id="cc-current-step" className="v3-display" ref={heading} tabIndex={-1}>Upload all 3 credit reports.</h2>
          <p className="cc-simple-copy">Choose one full PDF from <strong>each</strong> company: TransUnion, Equifax and Experian. Add all three, then submit.</p>

          <div id="cc-upload-branch" aria-labelledby="cc-upload-branch-title">
            <p className="cc-eyebrow cc-simple-branch-title" id="cc-upload-branch-title">1 // UPLOAD ALL 3 CREDIT REPORTS</p>
            <CreditReportUploads />
          </div>

          <div className="cc-simple-branch" aria-labelledby="cc-get-branch-title">
            <p className="cc-eyebrow cc-simple-branch-title" id="cc-get-branch-title">2 // DON&apos;T KNOW HOW TO GET YOUR CREDIT REPORTS?</p>
            <p className="cc-report-keep-open"><span aria-hidden="true">!</span><strong>Do not close this page.</strong> AnnualCreditReport.com opens in a new tab.</p>
            <h3 className="cc-report-journey-title v3-display">Get reports <span>→</span> save PDFs <span>→</span> return here</h3>
            <div className="cc-report-journey">
              <section className="cc-report-journey-card" aria-labelledby="cc-get-reports-title">
                <span className="cc-report-journey-letter" aria-hidden="true">A</span>
                <div className="cc-report-journey-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M27 8h13v13M40 8 23 25M38 27v10a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3h10" /></svg></div>
                <h4 id="cc-get-reports-title">Get all 3 reports</h4>
                <p>Use AnnualCreditReport.com and save each one as a PDF.</p>
                <a className="cc-primary cc-guide-button" href="https://www.annualcreditreport.com/" target="_blank" rel="noopener noreferrer">Open AnnualCreditReport.com <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>
                <a className="cc-report-guide-link" href={guide.href} target="_blank" rel="noopener noreferrer">Open the picture guide <span aria-hidden="true">↗</span><span className="sr-only"> (PDF opens in a new tab)</span></a>
              </section>

              <span className="cc-report-journey-arrow" aria-hidden="true">→</span>

              <section className="cc-report-journey-card" aria-labelledby="cc-return-upload-title">
                <span className="cc-report-journey-letter" aria-hidden="true">B</span>
                <div className="cc-report-journey-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M14 5h15l9 9v29H14zM29 5v10h9M8 28h19M14 22l-6 6 6 6" /></svg></div>
                <h4 id="cc-return-upload-title">Come back to upload</h4>
                <p>Return to this page with all 3 saved PDFs.</p>
                <ul className="cc-report-file-slots" aria-label="Reports to bring back">
                  <li><span aria-hidden="true">□</span>TransUnion</li>
                  <li><span aria-hidden="true">□</span>Equifax</li>
                  <li><span aria-hidden="true">□</span>Experian</li>
                </ul>
              </section>
            </div>
          </div>

        </>}
      </section>
      <p className="cc-simple-finish">The finish line: Vance has all 3 of your reports.</p>
    </>
  );
}
