"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const RESET_REVIEW_STATES = ["reset-sent", "reset-error", "reset-loading"] as const;
type ResetReviewState = (typeof RESET_REVIEW_STATES)[number];

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = use(searchParams);
  const reviewState = RESET_REVIEW_STATES.includes(state as ResetReviewState)
    ? (state as ResetReviewState)
    : undefined;
  const authConfigured = hasSupabaseConfig();
  const [email, setEmail] = useState(reviewState ? "team@funnelsgenius.com" : "");
  const [pending, setPending] = useState(reviewState === "reset-loading");
  const [sent, setSent] = useState(reviewState === "reset-sent");
  const [error, setError] = useState<string | null>(
    reviewState === "reset-error"
      ? "We could not send the reset email. Wait a minute and try again."
      : null,
  );
  const emailRef = useRef<HTMLInputElement>(null);
  const unavailable = !authConfigured && !reviewState;

  useEffect(() => {
    if (!sent && !pending) emailRef.current?.focus();
  }, [pending, sent]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reviewState || !authConfigured) return;
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    setPending(false);
    if (resetError) {
      setError(resetError.message || "We could not send the reset email. Wait a minute and try again.");
      requestAnimationFrame(() => emailRef.current?.focus());
      return;
    }
    setSent(true);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-cloud px-4 py-12">
      <section className="w-full max-w-sm rounded-2xl border border-mist bg-card p-7 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-trust">Vance Dotson</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-heading">Reset your password</h1>
        {sent ? (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-heading">Check your email</h2>
            <p role="status" className="text-sm text-body">
              We sent a secure password-reset link to {email}. It may take a minute to arrive.
            </p>
            <p className="text-sm text-slate">The link expires for your protection. Check your spam folder if you do not see it.</p>
            <Link href="/login" className="inline-block text-sm text-trust hover:underline">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4" aria-busy={pending}>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-heading">Email</label>
              <input
                ref={emailRef}
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={pending}
                value={email}
                onChange={(event) => { setEmail(event.currentTarget.value); setError(null); }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "reset-error" : undefined}
                className="w-full rounded-lg border border-mist bg-card px-3 py-2.5 text-body outline-none focus-visible:border-trust focus-visible:ring-2 focus-visible:ring-trust/25 aria-invalid:border-red disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            {error ? <p id="reset-error" role="alert" className="text-sm text-red">{error}</p> : null}
            {pending ? <p id="reset-loading-status" role="status" className="text-sm text-slate">Sending a secure reset link. Please wait.</p> : null}
            {unavailable ? (
              <p id="reset-setup-status" role="status" className="rounded-lg border border-mist bg-cloud px-3 py-2.5 text-sm text-slate">
                Local password reset is unavailable until Supabase is configured.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending || unavailable}
              aria-describedby={pending ? "reset-loading-status" : unavailable ? "reset-setup-status" : undefined}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 font-semibold text-ink hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : null}
              {pending ? "Sending…" : "Send reset link"}
            </button>
            <p className="text-center text-sm"><Link href="/login" className="text-trust hover:underline">Back to sign in</Link></p>
          </form>
        )}
      </section>
    </main>
  );
}
