import { NextResponse } from "next/server";
import { type Lead } from "@/lib/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSequenceMessages, deliverImmediateSequenceMessage } from "@/lib/email";
import { verifyTurnstile } from "@/lib/turnstile";
import { consumePublicRateLimit, readLimitedJson } from "@/lib/public-api";

const CONSENT_VERSION = "registration-marketing-v1";
const CONSENT_TEXT = "Send me occasional follow-up tips and updates by email. Optional; unsubscribe anytime.";

type Attribution = {
  firstTouch?: Record<string, unknown>;
  lastTouch?: Record<string, unknown>;
};

function cleanTouch(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowed = new Set([
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "ref", "gclid", "fbclid", "msclkid", "ttclid", "landing_page", "referrer",
  ]);
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (allowed.has(key) && typeof raw === "string" && raw.length <= 2000) result[key] = raw;
  }
  return result;
}

function normalizePhone(value: unknown): string | null | undefined {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return undefined;
}

/**
 * Receives webinar registrations and saves them to our own data store
 * (in-memory today, Supabase later — see src/lib/store.ts).
 * Called by the registration form (src/components/marketing/RegistrationForm.tsx).
 */
export async function POST(request: Request) {
  type LeadRequest = Partial<Lead> & {
    visitorId?: string;
    turnstileToken?: string;
    attribution?: Attribution;
    marketingConsent?: boolean;
  };
  const parsed = await readLimitedJson<LeadRequest>(request);
  if (!parsed.ok) return NextResponse.json(
    { error: parsed.status === 413 ? "Request is too large." : "Invalid JSON." },
    { status: parsed.status },
  );
  const body = parsed.value;

  try {
    if (!await consumePublicRateLimit(request, "registration", 10, 600)) {
      return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429 });
    }
  } catch (error) {
    console.error("[api/lead] rate limit failed:", error);
    return NextResponse.json({ error: "Please try again in a moment." }, { status: 503 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const phone = normalizePhone(body.phone);

  const fieldErrors: Partial<Record<"name" | "email" | "phone", string>> = {};
  if (!name || name.length < 2) fieldErrors.name = "Please enter your name.";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fieldErrors.email = "Enter a valid email so we can send your link.";
  }
  if (phone === undefined) {
    fieldErrors.phone = "Enter a valid phone number with an area or country code.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: "Please check the highlighted fields.", fieldErrors },
      { status: 400 },
    );
  }
  if (!await verifyTurnstile(request, body.turnstileToken)) {
    return NextResponse.json({ error: "Please complete the security check and try again." }, { status: 403 });
  }

  try {
    const supabase = createAdminClient();
    const firstTouch = cleanTouch(body.attribution?.firstTouch ?? body.utm);
    const lastTouch = cleanTouch(body.attribution?.lastTouch ?? body.utm);
    const country = request.headers.get("cf-ipcountry")?.toUpperCase();
    const { data: lead, error } = await supabase.rpc("register_webinar_lead_and_enqueue_v1", {
      p_name: name,
      p_email: email,
      p_phone: phone,
      p_source: body.source || "vance-webinar",
      p_first_touch: firstTouch,
      p_last_touch: lastTouch,
      p_visitor_id: body.visitorId?.trim() || null,
      p_marketing_consent: body.marketingConsent === true,
      p_consent_version: CONSENT_VERSION,
      p_consent_text: CONSENT_TEXT,
      p_consent_country: country && /^[A-Z]{2}$/.test(country) ? country : null,
      p_messages: buildSequenceMessages("pre_webinar"),
    }).single();
    if (error || !lead) throw new Error(error?.message ?? "Could not register lead.");
    const savedLead = lead as { id: string; email: string };

    // The durable queue is already committed atomically with registration.
    // Provider delivery is deliberately best-effort here; cron retries the queue.
    try {
      await deliverImmediateSequenceMessage(savedLead.email, "pre_webinar");
    } catch (deliveryError) {
      console.error("[api/lead] immediate email delivery deferred:", deliveryError);
    }

    return NextResponse.json({ ok: true, id: savedLead.id });
  } catch (err) {
    console.error("[api/lead] failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }
}
