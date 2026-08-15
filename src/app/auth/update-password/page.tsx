"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const PASSWORD_REVIEW_STATES = ["missing-password", "password-mismatch", "password-loading", "invalid-link"] as const;
type PasswordReviewState = (typeof PASSWORD_REVIEW_STATES)[number];

export default function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = use(searchParams);
  const reviewState = PASSWORD_REVIEW_STATES.includes(state as PasswordReviewState)
    ? (state as PasswordReviewState)
    : undefined;
  const router = useRouter();
  const authConfigured = hasSupabaseConfig();
  const previewPassword = reviewState === "missing-password" ? "short" : "strong-password-123";
  const [ready, setReady] = useState(Boolean(reviewState && reviewState !== "invalid-link"));
  const [validating, setValidating] = useState(!reviewState && authConfigured);
  const [invalidLink, setInvalidLink] = useState(reviewState === "invalid-link");
  const [password, setPassword] = useState(reviewState ? previewPassword : "");
  const [confirm, setConfirm] = useState(
    reviewState === "password-mismatch" ? "different-password-456" : reviewState ? previewPassword : "",
  );
  const [error, setError] = useState<string | null>(
    reviewState === "missing-password"
      ? "Use at least 12 characters."
      : reviewState === "password-mismatch"
        ? "The passwords do not match."
        : null,
  );
  const [errorField, setErrorField] = useState<"password" | "confirm" | null>(
    reviewState === "missing-password" ? "password" : reviewState === "password-mismatch" ? "confirm" : null,
  );
  const [pending, setPending] = useState(reviewState === "password-loading");
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const unavailable = !authConfigured && !reviewState;

  useEffect(() => {
    if (reviewState || !authConfigured) return;
    const supabase = createClient();
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const hasSession = Boolean(data.session);
      setReady(hasSession);
      setInvalidLink(!hasSession);
      setValidating(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setReady(Boolean(session));
      setInvalidLink(!session);
      setValidating(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [authConfigured, reviewState]);

  useEffect(() => {
    if (!ready || pending) return;
    if (errorField === "confirm") confirmRef.current?.focus();
    else passwordRef.current?.focus();
  }, [errorField, pending, ready]);

  function clearError() {
    setError(null);
    setErrorField(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reviewState || !authConfigured) return;
    clearError();
    if (password.length < 12) {
      setError("Use at least 12 characters.");
      setErrorField("password");
      requestAnimationFrame(() => passwordRef.current?.focus());
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      setErrorField("confirm");
      requestAnimationFrame(() => confirmRef.current?.focus());
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setPending(false);
      setError(updateError.message);
      setErrorField("password");
      requestAnimationFrame(() => passwordRef.current?.focus());
      return;
    }
    router.replace("/crm");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-cloud px-4 py-12">
      <section className="w-full max-w-sm rounded-2xl border border-mist bg-card p-7 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-trust">Vance Dotson</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-heading">Set your CRM password</h1>
        {validating ? (
          <p role="status" className="mt-8 text-sm text-slate">Validating your secure password link...</p>
        ) : invalidLink || unavailable ? (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-heading">
              {invalidLink ? "This password link is invalid or expired" : "Password setup is unavailable locally"}
            </h2>
            <p role="alert" className="text-sm text-body">
              {invalidLink
                ? "For your protection, password links can only be used once and expire after a short time."
                : "Supabase must be configured before a password link can be checked."}
            </p>
            <Link href="/forgot-password" className="inline-block rounded-sm text-sm font-medium text-trust outline-none hover:underline focus-visible:ring-2 focus-visible:ring-trust/30">
              Request a new reset link
            </Link>
          </div>
        ) : ready ? (
          <>
            <p className="mt-2 text-sm text-slate">Use at least 12 characters and a password you do not reuse elsewhere.</p>
            <form onSubmit={submit} className="mt-8 space-y-4" aria-busy={pending}>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-heading">New password</label>
                <input
                  ref={passwordRef}
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  disabled={pending}
                  value={password}
                  onChange={(event) => { setPassword(event.currentTarget.value); clearError(); }}
                  aria-invalid={errorField === "password"}
                  aria-describedby={errorField === "password" ? "password-error" : undefined}
                  className="w-full rounded-lg border border-mist bg-card px-3 py-2.5 text-body outline-none focus-visible:border-trust focus-visible:ring-2 focus-visible:ring-trust/25 aria-invalid:border-red disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-heading">Confirm password</label>
                <input
                  ref={confirmRef}
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  disabled={pending}
                  value={confirm}
                  onChange={(event) => { setConfirm(event.currentTarget.value); clearError(); }}
                  aria-invalid={errorField === "confirm"}
                  aria-describedby={errorField === "confirm" ? "password-error" : undefined}
                  className="w-full rounded-lg border border-mist bg-card px-3 py-2.5 text-body outline-none focus-visible:border-trust focus-visible:ring-2 focus-visible:ring-trust/25 aria-invalid:border-red disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              {error ? <p id="password-error" role="alert" className="text-sm text-red">{error}</p> : null}
              {pending ? <p id="password-loading-status" role="status" className="text-sm text-slate">Saving your new password securely. Please wait.</p> : null}
              <button
                type="submit"
                disabled={pending}
                aria-describedby={pending ? "password-loading-status" : undefined}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 font-semibold text-ink hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : null}
                {pending ? "Saving..." : "Set password"}
              </button>
            </form>
          </>
        ) : null}
      </section>
    </main>
  );
}
