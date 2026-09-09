"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export const REPORT_BUREAUS = [
  { id: "transunion", label: "TransUnion" },
  { id: "equifax", label: "Equifax" },
  { id: "experian", label: "Experian" },
] as const;
export type ReportBureau = typeof REPORT_BUREAUS[number]["id"];
export type ReportReceipt = { bureau: ReportBureau; fileName: string; uploadedAt: string };
type SessionState = {
  phase: "loading" | "ready" | "missing" | "error" | "changed";
  sessionId: string;
  mode: "local" | "live";
  reports: ReportReceipt[];
  handoffToken: string;
};
type SessionContext = SessionState & {
  refresh: () => Promise<void>;
  recordReceipt: (receipt: ReportReceipt) => void;
  markChanged: () => void;
};
const UploadSession = createContext<SessionContext | null>(null);

export function ReportUploadSession({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ phase: "loading", mode: "live", reports: [], handoffToken: "", sessionId: "" });
  const transferToken = useRef<string | null | undefined>(undefined);
  const boundSessionId = useRef<string | null>(null);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const currentGeneration = ++generation.current;
    if (transferToken.current === undefined) {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      transferToken.current = fragment.get("upload");
      if (fragment.has("upload")) {
        fragment.delete("upload");
        const remaining = fragment.toString();
        // Keep the upload capability out of later navigation and copied generic URLs.
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${remaining ? `#${remaining}` : ""}`);
      }
    }
    try {
      const token = transferToken.current;
      const response = await fetch("/api/credit-check/reports/session", {
        method: token ? "POST" : "GET",
        ...(token ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (currentGeneration !== generation.current) return;
      if (response.status === 401) {
        transferToken.current = null;
        setState({ phase: "missing", mode: "live", reports: [], handoffToken: "", sessionId: "" });
        return;
      }
      const result = await response.json();
      if (!response.ok || result.ok !== true || !Array.isArray(result.reports)
        || !["local", "live"].includes(result.mode) || typeof result.handoffToken !== "string" || typeof result.sessionId !== "string") throw new Error("Session unavailable");
      if (currentGeneration !== generation.current) return;
      transferToken.current = null;
      if (boundSessionId.current && boundSessionId.current !== result.sessionId) {
        setState((previous) => ({ ...previous, phase: "changed" }));
        return;
      }
      boundSessionId.current = result.sessionId;
      setState({ phase: "ready", mode: result.mode, reports: result.reports, handoffToken: result.handoffToken, sessionId: result.sessionId });
    } catch {
      if (currentGeneration === generation.current) setState((previous) => ({ ...previous, phase: "error" }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    // Defer the request so React's initial effect cleanup does not redeem twice.
    queueMicrotask(() => { if (active) void refresh(); });
    return () => { active = false; generation.current += 1; };
  }, [refresh]);

  const recordReceipt = useCallback((receipt: ReportReceipt) => {
    setState((previous) => ({ ...previous, reports: [...previous.reports.filter((report) => report.bureau !== receipt.bureau), receipt] }));
  }, []);
  const markChanged = useCallback(() => setState((previous) => ({ ...previous, phase: "changed" })), []);

  return <UploadSession.Provider value={{ ...state, refresh, recordReceipt, markChanged }}>{children}</UploadSession.Provider>;
}

export function useReportUploadSession() {
  const session = useContext(UploadSession);
  if (!session) throw new Error("Report uploads require a session provider.");
  return session;
}
