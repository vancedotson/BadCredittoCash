"use client";

import { useReportUploadSession } from "./ReportUploadSession";

export function DesktopHandoff() {
  const { phase, handoffToken } = useReportUploadSession();

  function emailLink() {
    const url = `${window.location.origin}/credit-check/thank-you${handoffToken ? `#upload=${encodeURIComponent(handoffToken)}` : ""}`;
    const subject = "My credit report upload link";
    const body = `Open this personal link on your computer to continue:\n\n${url}\n\nKeep this link private.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return <div className="cc-handoff">
    <button type="button" className="cc-copy" disabled={phase === "loading"} onClick={emailLink}>I&apos;m not on my computer, email the link</button>
    <p className="cc-handoff-help">This opens your email app with the link ready to send.</p>
    {handoffToken && <p className="cc-handoff-private">Your personal link keeps your uploads connected to your details. Keep it private.</p>}
  </div>;
}
