"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { login } from "./actions";

type LoginReviewState = "missing-password" | "invalid-login" | "login-loading";

export function LoginForm({
  nextPath,
  reviewState,
  authConfigured,
  sessionExpired,
}: {
  nextPath: string;
  reviewState?: LoginReviewState;
  authConfigured: boolean;
  sessionExpired?: boolean;
}) {
  const [state, action, pending] = useActionState(login, undefined);
  const [email, setEmail] = useState(reviewState ? "team@funnelsgenius.com" : "");
  const [password, setPassword] = useState(reviewState === "login-loading" ? "preview-password" : "");
  const [showPassword, setShowPassword] = useState(false);
  const [previewError, setPreviewError] = useState(
    reviewState === "missing-password"
      ? "Enter your password."
      : reviewState === "invalid-login"
        ? "The email or password is incorrect. Try again or reset your password."
        : null,
  );
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const busy = pending || reviewState === "login-loading";
  const error = previewError ?? state?.error ?? null;
  const unavailable = !authConfigured && !reviewState;

  useEffect(() => {
    if (reviewState === "missing-password" || reviewState === "invalid-login") {
      passwordRef.current?.focus();
      return;
    }
    if (!reviewState) emailRef.current?.focus();
  }, [reviewState]);

  return (
    <form
      action={action}
      onSubmit={reviewState ? (event) => event.preventDefault() : undefined}
      className="mt-8 space-y-4"
      aria-busy={busy}
    >
      <input type="hidden" name="next" value={nextPath} />
      {sessionExpired ? <p role="alert" className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2.5 text-sm text-body"><span className="font-semibold">Your session expired.</span> Sign in again to continue where you left off.</p> : null}
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-heading">Email</label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={busy}
          value={email}
          onChange={(event) => { setEmail(event.currentTarget.value); setPreviewError(null); }}
          className="w-full rounded-lg border border-mist bg-card px-3 py-2.5 text-body outline-none focus-visible:border-trust focus-visible:ring-2 focus-visible:ring-trust/25 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-heading">Password</label>
        <div className="relative">
          <input
            ref={passwordRef}
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={busy}
            value={password}
            onChange={(event) => { setPassword(event.currentTarget.value); setPreviewError(null); }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
            className="w-full rounded-lg border border-mist bg-card py-2.5 pl-3 pr-16 text-body outline-none focus-visible:border-trust focus-visible:ring-2 focus-visible:ring-trust/25 aria-invalid:border-red disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button type="button" disabled={busy} onClick={() => setShowPassword((shown) => !shown)} aria-pressed={showPassword} className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-trust disabled:opacity-50">{showPassword ? "Hide" : "Show"}</button>
        </div>
      </div>
      {error ? <p id="login-error" role="alert" className="text-sm text-red">{error}</p> : null}
      {busy ? <p id="login-loading-status" role="status" className="text-sm text-slate">Signing in securely. Please wait.</p> : null}
      {unavailable ? (
        <p id="login-setup-status" role="status" className="rounded-lg border border-mist bg-cloud px-3 py-2.5 text-sm text-slate">
          Local sign-in is unavailable until Supabase is configured.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || unavailable}
        aria-describedby={busy ? "login-loading-status" : unavailable ? "login-setup-status" : undefined}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 font-semibold text-ink hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : null}
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-trust hover:underline">Forgot your password?</Link>
      </p>
    </form>
  );
}
