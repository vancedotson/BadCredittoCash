"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getUtmParams, getVisitorId, rememberLead } from "@/lib/tracking";
import { ButtonShine } from "./ButtonShine";
import { CheckIcon } from "./Icons";

/**
 * Webinar registration form. Posts to /api/lead and tracks the behaviour.
 * Brand-styled: gold submit (Ink text), legible inputs, low-pressure copy.
 *
 * CRO: email captured first (abandon recovery), single column, minimum fields,
 * inline valid/invalid states with fix-it messages (inputs stay uncontrolled so
 * a failed validate never wipes what was typed), a stated reason for the phone
 * field, and visible focus rings.
 */
type FieldStatus = "idle" | "valid" | "invalid";
type FieldKey = "email" | "name" | "phone";

const validators: Record<FieldKey, (v: string) => string | null> = {
  // return an error message string when invalid, else null
  email: (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
      ? null
      : "Enter a valid email so we can send your link.",
  name: (v) => (v.trim().length >= 2 ? null : "Please enter your name."),
  phone: (v) => {
    const digits = v.replace(/\D/g, "");
    if (digits.length === 0) return null; // optional
    return digits.length >= 10 ? null : "Enter a 10-digit phone number.";
  },
};

export function RegistrationForm() {
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
    // an untouched optional field (phone) stays neutral, not "valid"
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

    // validate everything up-front; focus the first problem
    let firstInvalid: FieldKey | null = null;
    (Object.keys(validators) as FieldKey[]).forEach((k) => {
      const next = statusFor(k, values[k]);
      if (next.status === "invalid" && !firstInvalid) firstInvalid = k;
      setFields((prev) => ({ ...prev, [k]: next }));
    });
    if (firstInvalid) {
      form.querySelector<HTMLInputElement>(`#${firstInvalid}`)?.focus();
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
          visitorId: getVisitorId(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Registration failed.");
      }
      rememberLead({ email: values.email.trim(), name: values.name.trim() });
      router.push("/webinar/confirmed");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function inputClass(key: FieldKey) {
    const s = fields[key].status;
    const ring =
      "outline-none focus:ring-2 focus:ring-trust/40 focus:border-trust";
    const border =
      s === "invalid"
        ? "border-red"
        : s === "valid"
          ? "border-green"
          : "border-mist";
    return `w-full rounded-lg border bg-card px-4 py-3 pr-10 text-body transition-colors placeholder:text-slate/60 ${border} ${ring}`;
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
      label: (
        <>
          Phone <span className="font-normal text-slate">(optional)</span>
        </>
      ),
      placeholder: "(405) 000-0000",
      autoComplete: "tel",
      inputMode: "tel",
      hint: "So I can reach you if your email link bounces.",
    },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 text-left">
      {fieldOrder.map((f) => {
        const state = fields[f.key];
        return (
          <div key={f.key}>
            <label
              htmlFor={f.key}
              className="mb-1 block text-sm font-medium text-body"
            >
              {f.label}
            </label>
            <div className="relative">
              <input
                id={f.key}
                name={f.key}
                type={f.type}
                inputMode={f.inputMode}
                required={f.key !== "phone"}
                autoComplete={f.autoComplete}
                placeholder={f.placeholder}
                aria-invalid={state.status === "invalid"}
                aria-describedby={
                  state.message ? `${f.key}-msg` : f.hint ? `${f.key}-hint` : undefined
                }
                onBlur={(e) => setField(f.key, e.currentTarget.value)}
                onInput={(e) => setField(f.key, e.currentTarget.value, true)}
                className={inputClass(f.key)}
              />
              {state.status === "valid" ? (
                <CheckIcon
                  aria-hidden
                  className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-green"
                />
              ) : null}
            </div>
            {state.status === "invalid" && state.message ? (
              <p id={`${f.key}-msg`} className="mt-1 text-sm text-red">
                {state.message}
              </p>
            ) : f.hint ? (
              <p id={`${f.key}-hint`} className="mt-1 text-xs text-slate">
                {f.hint}
              </p>
            ) : null}
          </div>
        );
      })}

      {error ? (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "loading"}
        className="relative min-h-[52px] w-full overflow-hidden rounded-full bg-gold px-6 py-4 font-heading text-[17px] font-semibold text-ink outline-none transition-colors hover:bg-gold-deep focus-visible:ring-2 focus-visible:ring-ink/30 disabled:opacity-60"
      >
        {status === "loading" ? "Reserving your seat…" : "Save my seat — free"}
        <ButtonShine />
      </button>
      <p className="text-center text-sm text-slate">
        Free. No judgment. We&apos;ll email you the link. No spam, ever.
      </p>
    </form>
  );
}
