"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setReady(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 12) return setError("Use at least 12 characters.");
    if (password !== confirm) return setError("The passwords do not match.");

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setPending(false);
      setError(updateError.message);
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
        <p className="mt-2 text-sm text-slate">Use at least 12 characters and a password you do not reuse elsewhere.</p>
        {!ready ? (
          <p className="mt-8 text-sm text-slate">Validating your invitation…</p>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-heading">New password</label>
              <input id="password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-mist bg-card px-3 py-2.5 text-body outline-none focus:border-trust" />
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-heading">Confirm password</label>
              <input id="confirm" type="password" autoComplete="new-password" required minLength={12} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-lg border border-mist bg-card px-3 py-2.5 text-body outline-none focus:border-trust" />
            </div>
            {error ? <p role="alert" className="text-sm text-red">{error}</p> : null}
            <button type="submit" disabled={pending} className="w-full rounded-lg bg-gold px-4 py-2.5 font-semibold text-ink hover:bg-gold-deep disabled:opacity-50">{pending ? "Saving…" : "Set password"}</button>
          </form>
        )}
      </section>
    </main>
  );
}
