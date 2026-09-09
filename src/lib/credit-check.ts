import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { CreditCheckSubmission } from "@/lib/credit-check-validation";

export function hasCreditCheckDatabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

/** Local storage is available only under next dev, never in a production build. */
export function isCreditCheckLocalMode(): boolean {
  return process.env.NODE_ENV === "development" && !hasCreditCheckDatabaseConfig();
}

export async function saveCreditCheckSubmission(submission: CreditCheckSubmission): Promise<{ id: string; mode: "local" | "live" }> {
  if (isCreditCheckLocalMode()) {
    const { saveLocalCreditCheckSubmission } = await import("./credit-check-local");
    return { id: await saveLocalCreditCheckSubmission(submission), mode: "local" };
  }

  if (!hasCreditCheckDatabaseConfig()) throw new Error("Credit-check database is not configured.");
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("submit_credit_check_v1", {
    p_name: submission.name,
    p_email: submission.email,
    p_phone: submission.phone,
    p_answers: submission.answers,
    p_first_touch: submission.attribution.firstTouch,
    p_last_touch: submission.attribution.lastTouch,
    p_visitor_id: submission.visitorId ?? null,
  });
  if (error || typeof data !== "string" || !data) throw new Error("Credit-check submission could not be saved.");
  return { id: data, mode: "live" };
}

// The normal limiter uses Supabase. This bounded, process-local limiter is used
// only in development without database credentials, for the same 10/10m policy.
const localAttempts = new Map<string, { count: number; resetAt: number }>();

export function consumeLocalCreditCheckRateLimit(request: Request): boolean {
  if (!isCreditCheckLocalMode()) return false;
  const now = Date.now();
  for (const [key, value] of localAttempts) {
    if (value.resetAt <= now) localAttempts.delete(key);
  }
  const identity = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "local";
  const existing = localAttempts.get(identity);
  if (existing) {
    if (existing.count >= 10) return false;
    existing.count += 1;
  } else {
    if (localAttempts.size >= 1000) return false;
    localAttempts.set(identity, { count: 1, resetAt: now + 600_000 });
  }
  return true;
}
