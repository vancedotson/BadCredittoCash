"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("team@funnelsgenius.com");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    setPending(false);
    if (resetError) {
      setError(resetError.message || "We could not send the reset email. Wait a minute and try again.");
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
            <p className="text-sm text-body">Check your email for a secure password-reset link. It may take a minute to arrive.</p>
            <Link href="/login" className="inline-block text-sm text-trust hover:underline">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-heading">Email</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-mist bg-card px-3 py-2.5 text-body outline-none focus:border-trust" />
            </div>
            {error ? <p role="alert" className="text-sm text-red">{error}</p> : null}
            <button type="submit" disabled={pending} className="w-full rounded-lg bg-gold px-4 py-2.5 font-semibold text-ink hover:bg-gold-deep disabled:opacity-50">{pending ? "Sending…" : "Send reset link"}</button>
            <p className="text-center text-sm"><Link href="/login" className="text-trust hover:underline">Back to sign in</Link></p>
          </form>
        )}
      </section>
    </main>
  );
}
