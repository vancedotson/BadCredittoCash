import { ReportGuideSteps } from "./ReportGuideSteps";
import { ReportUploadSession } from "./ReportUploadSession";

export function CreditReportGuide() {
  return (
    <main id="credit-check-main" className="cc-container cc-simple-guide">
      <div className="cc-simple-heading">
        <p className="cc-eyebrow cc-kicker">THANK YOU. HERE&apos;S WHAT TO DO NEXT.</p>
        <h1 className="v3-display">Get your reports<br /><span>to Vance.</span></h1>
        <p>Use a computer. Save 3 PDFs. Send them to Vance.</p>
      </div>
      <ReportUploadSession><ReportGuideSteps /></ReportUploadSession>
    </main>
  );
}
