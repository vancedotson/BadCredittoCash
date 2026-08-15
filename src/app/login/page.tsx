import { redirect } from "next/navigation";
import { getCrmUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

const LOGIN_REVIEW_STATES = ["missing-password", "invalid-login", "login-loading"] as const;
type LoginReviewState = (typeof LOGIN_REVIEW_STATES)[number];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; state?: string }>;
}) {
  const { next, state } = await searchParams;
  const reviewState = LOGIN_REVIEW_STATES.includes(state as LoginReviewState)
    ? (state as LoginReviewState)
    : undefined;
  const authConfigured = hasSupabaseConfig();
  if (!reviewState && authConfigured && await getCrmUser()) redirect("/crm");

  const nextPath = next?.startsWith("/crm") ? next : "/crm";

  return (
    <main className="grid min-h-screen place-items-center bg-cloud px-4 py-12">
      <section className="w-full max-w-sm rounded-2xl border border-mist bg-card p-7 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-trust">Vance Dotson</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-heading">CRM sign in</h1>
        <p className="mt-2 text-sm text-slate">Authorized team members only.</p>
        <LoginForm nextPath={nextPath} reviewState={reviewState} authConfigured={authConfigured} />
      </section>
    </main>
  );
}
