"use client";

import { useEffect, useState } from "react";
import "./v3.css";
import {
  PageSwitcher,
  type V3Variant,
  V3_VARIANTS,
} from "@/components/marketing-v3/shared/PageSwitcher";
import { Canvas } from "@/components/marketing-v3/shared/primitives";
import { StickyCta } from "@/components/marketing-v3/shared/StickyCta";
import { usePageProgress } from "@/components/marketing-v3/shared/hooks";
import { CaseFilePage } from "@/components/marketing-v3/casefile/CaseFilePage";
import { SignalRoomPage } from "@/components/marketing-v3/signalroom/SignalRoomPage";
import { LedgerPage } from "@/components/marketing-v3/ledger/LedgerPage";

const IDS = V3_VARIANTS.map((v) => v.id);
function isVariant(v: string | null): v is V3Variant {
  return !!v && (IDS as string[]).includes(v);
}

/**
 * /v3 — the "Evidence Room" concept: three switchable full-page dark designs.
 * A client route (state + scroll animation). Only the active variant tree is
 * mounted, so three sets of scroll observers never run at once. The design is
 * dark-only and self-contained under `.v3` (see v3.css) — it ignores the site
 * theme toggle and never touches the live / or /v2 pages.
 */
export default function V3Page() {
  const [variant, setVariant] = useState<V3Variant>("casefile");
  const [ready, setReady] = useState(false);
  usePageProgress();

  // Resolve the initial variant from ?v= then localStorage (client-only).
  // Deferred to an animation frame so the resolve happens outside the effect
  // body (avoids a synchronous setState-in-effect cascade).
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const q = new URLSearchParams(window.location.search).get("v");
      const stored = window.localStorage.getItem("v3-variant");
      const initial = isVariant(q) ? q : isVariant(stored) ? stored : "casefile";
      setVariant(initial);
      setReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function choose(v: V3Variant) {
    setVariant(v);
    try {
      window.localStorage.setItem("v3-variant", v);
      const url = new URL(window.location.href);
      url.searchParams.set("v", v);
      window.history.replaceState({}, "", url);
    } catch {
      /* non-fatal */
    }
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="v3" data-variant={variant}>
      <Canvas />
      <div className="v3-rail" aria-hidden>
        <span />
      </div>

      <div className="v3-content">
        {ready && variant === "casefile" ? <CaseFilePage /> : null}
        {ready && variant === "signalroom" ? <SignalRoomPage /> : null}
        {ready && variant === "ledger" ? <LedgerPage /> : null}
      </div>

      <StickyCta />
      <PageSwitcher value={variant} onChange={choose} />
    </div>
  );
}
