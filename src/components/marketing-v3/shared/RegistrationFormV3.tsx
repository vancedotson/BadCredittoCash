"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { track, getUtmParams } from "@/lib/tracking";
import { CheckIcon } from "@/components/marketing-v2/Icons";

/**
 * v3 "terminal" registration form. Same behaviour as the v1/v2 forms — posts to
 * /api/lead, tracks, then routes to /thank-you — restyled for the dark Evidence
 * Room. Email-first (abandon recovery), uncontrolled inputs (a failed validate
 * never wipes typing), per-field inline valid/invalid states, focus rings.
 */
type FieldStatus = "idle" | "valid" | "invalid";
type FieldKey = "email" | "name" | "phone";

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

export function RegistrationFormV3() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<
    Record<FieldKey, { status: FieldStatus; message: string | null }>
  >({
    email: { status: "idle", message: null },
    name: { status: "idle", message: null },
    phone: { status: "idle", message: null },
  });

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
      form.querySelector<HTMLInputElement>(`#v3-${firstInvalid}`)?.focus();
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
          source: "vance-webinar",
          utm: getUtmParams(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Registration failed.");
      }
      track("webinar_registered", { source: "vance-webinar", variant: "v3" });
      router.push("/thank-you");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const fieldOrder: Array<{
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

  function borderColor(s: FieldStatus) {
    if (s === "invalid") return "var(--v3-danger)";
    if (s === "valid") return "var(--v3-accent)";
    return "var(--v3-line)";
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
      {fieldOrder.map((f) => {
        const state = fields[f.key];
        return (
          <div key={f.key}>
            <label
              htmlFor={`v3-${f.key}`}
              className="v3-mono mb-1.5 block"
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--v3-faint)",
              }}
            >
              {f.label}
            </label>
            <div className="relative">
              <input
                id={`v3-${f.key}`}
                name={f.key}
                type={f.type}
                inputMode={f.inputMode}
                required={f.key !== "phone"}
                autoComplete={f.autoComplete}
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
                className="w-full rounded-sm px-4 py-3 pr-10 outline-none transition-colors"
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

      {error ? (
        <p role="alert" style={{ fontSize: 13, color: "var(--v3-danger)" }}>
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "loading"}
        className="v3-btn v3-btn-primary mt-1 w-full disabled:opacity-60"
      >
        {status === "loading" ? "Opening your case…" : "Open my case"}
      </button>
      <p
        className="text-center"
        style={{ fontSize: 12.5, color: "var(--v3-faint)" }}
      >
        Free. No judgment. We&apos;ll email you the link. No spam, ever.
      </p>
    </form>
  );
}
