"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "dark";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;
const scriptSelector = "script[data-vance-turnstile]";
const scriptSource = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const loadTimeoutMs = 10_000;
// Turnstile site keys are public identifiers. Keep the production key available
// at build time because Next.js inlines NEXT_PUBLIC_* values while compiling,
// before Wrangler's runtime vars are attached to the Worker.
const productionSitekey = "0x4AAAAAAEJgbygCL0OAMxvi";

function loadTurnstile(forceReload = false): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (forceReload) {
    document.querySelector<HTMLScriptElement>(scriptSelector)?.remove();
    scriptPromise = null;
  }
  if (scriptPromise) return scriptPromise;

  const pending = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(scriptSelector);
    const script = existing ?? document.createElement("script");
    let settled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      script.removeEventListener("load", checkReady);
      script.removeEventListener("error", fail);
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
    const finish = (api: TurnstileApi) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(api);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      script.remove();
      reject(new Error("Turnstile could not load."));
    };
    const checkReady = () => {
      if (window.turnstile) finish(window.turnstile);
    };

    script.addEventListener("load", checkReady);
    script.addEventListener("error", fail);
    pollTimer = setInterval(checkReady, 100);
    timeoutTimer = setTimeout(fail, loadTimeoutMs);

    if (!existing) {
      script.src = scriptSource;
      script.async = true;
      script.defer = true;
      script.dataset.vanceTurnstile = "true";
      document.head.appendChild(script);
    }
    checkReady();
  });

  scriptPromise = pending.catch((error) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

export function TurnstileWidget({
  onToken,
  resetKey,
}: {
  onToken: (token: string | null) => void;
  resetKey: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onToken);
  callbackRef.current = onToken;
  const sitekey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || productionSitekey;
  const [retryCount, setRetryCount] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    callbackRef.current(null);
    setStatus("loading");

    if (!sitekey || !containerRef.current) {
      setStatus("error");
      return;
    }

    const renderWidget = async (forceReload: boolean) => {
      try {
        const turnstile = await loadTurnstile(forceReload);
        if (cancelled || !containerRef.current) return;
        containerRef.current.replaceChildren();
        widgetId = turnstile.render(containerRef.current, {
          sitekey,
          action: "turnstile-spin-v2",
          theme: "dark",
          callback: (token) => {
            setStatus("ready");
            callbackRef.current(token);
          },
          "expired-callback": () => callbackRef.current(null),
          "error-callback": () => {
            callbackRef.current(null);
            setStatus("error");
          },
        });
        setStatus("ready");
      } catch {
        if (cancelled) return;
        if (!forceReload) {
          retryTimer = setTimeout(() => void renderWidget(true), 750);
        } else {
          setStatus("error");
        }
      }
    };

    void renderWidget(retryCount > 0);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (widgetId !== null && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [resetKey, retryCount, sitekey]);

  return (
    <div className="min-h-[65px]">
      <div
        ref={containerRef}
        className="cf-turnstile"
        data-sitekey={sitekey}
        data-action="turnstile-spin-v2"
        aria-label="Security verification"
      />
      {status === "loading" ? (
        <p className="mt-2 text-xs text-zinc-500">Loading security check…</p>
      ) : null}
      {status === "error" ? (
        <div className="mt-2 flex items-center gap-3 text-xs text-red-400">
          <span>Security check didn&apos;t load.</span>
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => setRetryCount((count) => count + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}
