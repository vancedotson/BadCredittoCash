"use client";

import { useState } from "react";
import { useReportUploadSession } from "./ReportUploadSession";

export function DesktopHandoff() {
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState("");
  const { phase, handoffToken } = useReportUploadSession();

  async function copyLink() {
    const url = `${window.location.origin}/credit-check/thank-you${handoffToken ? `#upload=${encodeURIComponent(handoffToken)}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setManualLink("");
    } catch {
      setManualLink(url);
    }
  }

  return <div className="cc-handoff">
    <button type="button" className="cc-copy" disabled={phase === "loading"} onClick={copyLink}>{copied ? "Link copied ✓" : handoffToken ? "Copy my personal link" : "Copy this page link"}</button>
    <span className="sr-only" role="status">{copied ? "Page link copied. Open it on your laptop or desktop." : ""}</span>
    {manualLink && <label className="cc-manual-link">Copy this link to open on your computer<input readOnly value={manualLink} onFocus={(event) => event.target.select()} /></label>}
    {handoffToken && <p className="cc-handoff-private">Your personal link keeps your uploads connected to your details. Keep it private.</p>}
  </div>;
}
