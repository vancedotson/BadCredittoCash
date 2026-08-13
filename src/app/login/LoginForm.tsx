"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "./actions";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-heading">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="w-full rounded-lg border border-mist bg-card px-3 py-2.5 text-body outline-none focus:border-trust" />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-heading">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="w-full rounded-lg border border-mist bg-card px-3 py-2.5 text-body outline-none focus:border-trust" />
      </div>
      {state?.error ? <p role="alert" className="text-sm text-red">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-gold px-4 py-2.5 font-semibold text-ink hover:bg-gold-deep disabled:opacity-50">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-trust hover:underline">Forgot your password?</Link>
      </p>
    </form>
  );
}
