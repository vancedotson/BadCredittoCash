"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAttribution, getVisitorId, rememberLead, track } from "@/lib/tracking";
import { EVENTS } from "@/lib/events";
import { CheckIcon, ArrowRightIcon } from "@/components/marketing-v2/Icons";
import { TurnstileWidget } from "@/components/TurnstileWidget";

/**
 * v3 "terminal" registration form. Posts to /api/lead, tracks, then routes on.
 * Email-first (abandon recovery), uncontrolled inputs (a failed validate never
 * wipes typing), per-field inline valid/invalid states, focus rings.
 *
 * `redirectTo` / `source` are optional and default to the pre-funnel behaviour
 * ("/thank-you", "vance-webinar") so /, /v2, /v3 are unchanged. The webinar
 * funnel (/v4) passes "/webinar/confirmed" to enter the confirmation step.
 */
type FieldStatus = "idle" | "valid" | "invalid";
type FieldKey = "email" | "name" | "phone";
type RegistrationPreviewState = "invalid" | "server-error" | "submitting";

const validators: Record<FieldKey, (v: string) => string | null> = {
  email: (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
      ? null
      : "Enter a valid email so we can send your link.",
  name: (v) => (v.trim().length >= 2 ? null : "Please enter your name."),
  phone: (v) => {
    const digits = v.replace(/\D/g, "");
    if (digits.length === 0) return null;
    return digits.length >= 10 ? null : "Enter a 10-digit phone number.";
  },
};

export function RegistrationFormV3({
  redirectTo = "/webinar/confirmed",
  source = "vance-webinar",
  showPhone = true,
  submitLabel = "Open my case",
  loadingLabel = "Opening your case...",
  reassurance = "Free. No judgment. We'll email you the link. No spam, ever.",
  previewState,
}: {
  redirectTo?: string;
  source?: string;
  showPhone?: boolean;
  submitLabel?: string;
  loadingLabel?: string;
  reassurance?: string;
  previewState?: RegistrationPreviewState;
} = {}) {
  const router = useRouter();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const serverErrorPreview = previewState === "server-error";
  const submittingPreview = previewState === "submitting";
  const filledPreview = serverErrorPreview || submittingPreview;
  const [status, setStatus] = useState<"idle" | "loading" | "error">(
    serverErrorPreview ? "error" : submittingPreview ? "loading" : "idle",
  );
  const [error, setError] = useState<string | null>(
    serverErrorPreview ? "Your information is still here. Please try again." : null,
  );
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const invalidPreview = previewState === "invalid";
  const [fields, setFields] = useState<
    Record<FieldKey, { status: FieldStatus; message: string | null }>
  >({
    email: {
      status: invalidPreview ? "invalid" : filledPreview ? "valid" : "idle",
      message: invalidPreview ? validators.email("") : null,
    },
    name: {
      status: invalidPreview ? "invalid" : filledPreview ? "valid" : "idle",
      message: invalidPreview ? validators.name("") : null,
    },
    phone: { status: "idle", message: null },
  });

  useEffect(() => {
    if (!invalidPreview && !serverErrorPreview && !submittingPreview) return;
    let loadingScrollTimer: ReturnType<typeof setTimeout> | null = null;
    const frame = requestAnimationFrame(() => {
      if (invalidPreview) firstFieldRef.current?.focus({ preventScroll: true });
      if (serverErrorPreview) errorRef.current?.scrollIntoView({ block: "center" });
      if (submittingPreview) {
        loadingScrollTimer = setTimeout(
          () => loadingRef.current?.scrollIntoView({ block: "center" }),
          350,
        );
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      if (loadingScrollTimer) clearTimeout(loadingScrollTimer);
    };
  }, [invalidPreview, serverErrorPreview, submittingPreview]);

  function statusFor(key: FieldKey, value: string) {
    if (key === "phone" && value.trim() === "")
      return { status: "idle" as FieldStatus, message: null };
    const message = validators[key](value);
    return {
      status: (message ? "invalid" : "valid") as FieldStatus,
      message,
    };
  }

  function setField(key: FieldKey, value: string, onlyIfTouched = false) {
    setFields((prev) => {
      if (onlyIfTouched && prev[key].status === "idle") return prev;
      return { ...prev, [key]: statusFor(key, value) };
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("idle");
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const values: Record<FieldKey, string> = {
      email: String(data.get("email") ?? ""),
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
    };

    let firstInvalid: FieldKey | null = null;
    (Object.keys(validators) as FieldKey[]).forEach((k) => {
      const next = statusFor(k, values[k]);
      if (next.status === "invalid" && !firstInvalid) firstInvalid = k;
      setFields((prev) => ({ ...prev, [k]: next }));
    });
    if (firstInvalid) {
      track(EVENTS.funnelError, { action: "registration", reason: `invalid_${firstInvalid}` });
      form.querySelector<HTMLInputElement>(`#v3-${firstInvalid}`)?.focus();
      return;
    }
    if (!turnstileToken) {
      track(EVENTS.funnelError, { action: "registration", reason: "turnstile_missing" });
      setStatus("error");
      setError("Please complete the security check.");
      return;
    }

    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          source,
          attribution: getAttribution(),
          marketingConsent: data.get("marketingConsent") === "yes",
          visitorId: getVisitorId(),
          turnstileToken,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as {
          error?: string;
          fieldErrors?: Partial<Record<FieldKey, string>>;
        };
        const serverFieldErrors = body.fieldErrors;
        if (serverFieldErrors && Object.keys(serverFieldErrors).length > 0) {
          let firstServerInvalid: FieldKey | null = null;
          setFields((previous) => {
            const next = { ...previous };
            for (const key of Object.keys(serverFieldErrors) as FieldKey[]) {
              const message = serverFieldErrors[key];
              if (!message) continue;
              if (!firstServerInvalid) firstServerInvalid = key;
              next[key] = { status: "invalid", message };
            }
            return next;
          });
          const invalidField = firstServerInvalid;
          if (invalidField) {
            requestAnimationFrame(() => {
              form.querySelector<HTMLInputElement>(`#v3-${invalidField}`)?.focus();
            });
          }
        }
        throw new Error(body.error ?? "Registration failed.");
      }
      rememberLead({ email: values.email.trim(), name: values.name.trim() });
      router.push(redirectTo);
    } catch (err) {
      track(EVENTS.funnelError, { action: "registration", reason: "request_failed" });
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setTurnstileToken(null);
      setTurnstileReset((value) => value + 1);
    }
  }

  const allFields: Array<{
    key: FieldKey;
    type: string;
    label: React.ReactNode;
    placeholder: string;
    autoComplete: string;
    inputMode?: "email" | "tel";
    hint?: string;
  }> = [
    {
      key: "email",
      type: "email",
      label: "Email",
      placeholder: "you@example.com",
      autoComplete: "email",
      inputMode: "email",
    },
    {
      key: "name",
      type: "text",
      label: "Name",
      placeholder: "Your name",
      autoComplete: "name",
    },
    {
      key: "phone",
      type: "tel",
      label: "Phone (optional)",
      placeholder: "(405) 000-0000",
      autoComplete: "tel",
      inputMode: "tel",
      hint: "So I can reach you if your email link bounces.",
    },
  ];
  const fieldOrder = allFields.filter((field) => showPhone || field.key !== "phone");

  function borderColor(s: FieldStatus) {
    if (s === "invalid") return "var(--v3-danger)";
    if (s === "valid") return "var(--v3-accent)";
    return "var(--v3-line)";
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={status === "loading"}
      className="flex flex-col gap-3.5"
    >
      {fieldOrder.map((f) => {
        const state = fields[f.key];
        return (
          <div key={f.key}>
            <label
              htmlFor={`v3-${f.key}`}
              className="v3-mono mb-1.5 block"
              style={{
                fontSize: 11.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--v3-mut)",
              }}
            >
              {f.label}
            </label>
            <div className="relative">
              <input
                id={`v3-${f.key}`}
                ref={f.key === "email" ? firstFieldRef : undefined}
                name={f.key}
                type={f.type}
                inputMode={f.inputMode}
                required={f.key !== "phone"}
                defaultValue={
                  filledPreview
                    ? f.key === "email"
                      ? "alex@example.com"
                      : f.key === "name"
                        ? "Alex"
                        : undefined
                    : undefined
                }
                autoComplete={f.autoComplete}
                disabled={status === "loading"}
                placeholder={f.placeholder}
                aria-invalid={state.status === "invalid"}
                aria-describedby={
                  state.message
                    ? `v3-${f.key}-msg`
                    : f.hint
                      ? `v3-${f.key}-hint`
                      : undefined
                }
                onBlur={(e) => setField(f.key, e.currentTarget.value)}
                onInput={(e) => setField(f.key, e.currentTarget.value, true)}
                className="v4-registration-input w-full rounded-sm px-4 py-3 pr-10 outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                style={{
                  background: "rgba(0,0,0,0.35)",
                  border: `1px solid ${borderColor(state.status)}`,
                  color: "var(--v3-ink)",
                  fontFamily: "var(--v3-mono)",
                  fontSize: 15,
                }}
              />
              {state.status === "valid" ? (
                <span
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--v3-accent)" }}
                >
                  <CheckIcon className="h-5 w-5" />
                  <span className="sr-only">valid</span>
                </span>
              ) : null}
            </div>
            {state.status === "invalid" && state.message ? (
              <p
                id={`v3-${f.key}-msg`}
                className="mt-1.5"
                style={{ fontSize: 13, color: "var(--v3-danger)" }}
              >
                {state.message}
              </p>
            ) : f.hint ? (
              <p
                id={`v3-${f.key}-hint`}
                className="mt-1.5"
                style={{ fontSize: 12, color: "var(--v3-faint)" }}
              >
                {f.hint}
              </p>
            ) : null}
          </div>
        );
      })}

      <label
        className="flex items-start gap-2.5"
        style={{ fontSize: 12, color: "var(--v3-faint)" }}
      >
        <input
          name="marketingConsent"
          type="checkbox"
          value="yes"
          disabled={status === "loading"}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--v3-accent)] disabled:cursor-not-allowed disabled:opacity-70"
        />
        <span>Email me helpful follow-up tips. Optional. Unsubscribe anytime.</span>
      </label>

      {previewState ? (
        <div
          className="flex min-h-[65px] items-center rounded-sm border border-[var(--v3-line)] px-4"
          role="group"
          aria-label="Security verification"
        >
          <p style={{ fontSize: 12.5, color: "var(--v3-faint)" }}>
            Security check appears here on the live form.
          </p>
        </div>
      ) : (
        <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileReset} />
      )}

      {error ? (
        <div
          ref={errorRef}
          role="alert"
          className="rounded-sm border px-4 py-3"
          style={{ borderColor: "var(--v3-danger)", background: "rgba(239,68,68,0.08)" }}
        >
          <p className="font-semibold" style={{ fontSize: 14, color: "var(--v3-danger)" }}>
            We couldn&apos;t send your link.
          </p>
          <p className="mt-1" style={{ fontSize: 13, color: "var(--v3-mut)" }}>
            {error}
          </p>
        </div>
      ) : null}

      {status === "loading" ? (
        <div
          ref={loadingRef}
          role="status"
          className="rounded-sm border border-[var(--v3-accent)] px-4 py-3"
          style={{ background: "color-mix(in srgb, var(--v3-accent) 8%, transparent)" }}
        >
          <p className="font-semibold" style={{ fontSize: 14, color: "var(--v3-ink)" }}>
            Sending your private training link.
          </p>
          <p className="mt-1" style={{ fontSize: 13, color: "var(--v3-mut)" }}>
            Please wait. Keep this page open.
          </p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={status === "loading"}
        className="v3-btn v3-btn-primary v3-clip mt-1 w-full disabled:opacity-60"
        style={{ paddingLeft: 12 }}
      >
        <span className="v3-btn-badge">
          {status === "loading" ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
              aria-hidden="true"
            />
          ) : (
            <ArrowRightIcon className="h-4 w-4" />
          )}
        </span>
        {status === "loading" ? loadingLabel : submitLabel}
      </button>
      <p
        className="text-center"
        style={{ fontSize: 12.5, color: "var(--v3-faint)" }}
      >
        {reassurance}
      </p>
    </form>
  );
}
