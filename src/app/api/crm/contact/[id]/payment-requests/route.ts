import { NextResponse } from "next/server";

import { requireCrmApiUser } from "@/lib/auth";
import { recordAdminAudit } from "@/lib/audit";
import { isCrmDemoMode } from "@/lib/demo";
import { deliverPaymentRequestEmail } from "@/lib/email";
import { readLimitedJson } from "@/lib/public-api";
import { createClient } from "@/lib/supabase/server";
import {
  authorizeNetAcceptUiScriptUrl,
  authorizeNetConfigured,
  authorizeNetEnvironment,
  authorizeNetPublicClientKey,
} from "@/lib/authorize-net-config";
import {
  cancelPaymentRequest,
  checkPaymentRequestStatus,
  createPaymentRequest,
  listPaymentRequests,
  paymentLinkUrl,
} from "@/lib/payment-requests";
import { normalizePaymentDescription, parseUsdToCents } from "@/lib/payments-display";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: NO_STORE }); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return null;
  const parsed = await readLimitedJson<unknown>(request, 2048);
  return parsed.ok && isRecord(parsed.value) ? parsed.value : null;
}
function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "unknown";
}
function paymentsReady(): boolean { return authorizeNetConfigured(); }

/** Authorize through the signed-in user's RLS view of contacts, never a cached or service-role read. */
async function visibleContact(id: string): Promise<{ id: string; email: string; name: string; email_suppressed_at: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contacts").select("id,email,name,email_suppressed_at").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not verify contact access.");
  return data?.id === id ? data : null;
}

async function audit(actorId: string, action: string, entityId: string, afterState: Record<string, unknown>) {
  try {
    await recordAdminAudit({ actorId, action, entityType: "payment_request", entityId, afterState });
  } catch {
    console.warn("[payments] audit record failed", { action });
  }
}

const MUTATION_ERRORS: Record<string, [number, string]> = {
  payment_request_not_cancellable: [409, "Paid requests cannot be cancelled. Refund in Authorize.net instead."],
  payment_email_too_soon: [429, "The link was just emailed. Please wait a minute before resending."],
  payment_email_suppressed: [409, "Email is suppressed for this contact; copy the link instead."],
  payment_request_missing: [404, "Payment request not found."],
  payment_request_not_payable: [409, "This request can no longer be paid."],
  payment_request_contact_unavailable: [404, "Contact not found."],
  payment_request_actor_invalid: [403, "This account cannot manage payment requests."],
};

function mutationError(error: unknown, fallback: string) {
  const mapped = MUTATION_ERRORS[errorCode(error)];
  return mapped ? json({ error: mapped[1] }, mapped[0]) : json({ error: fallback }, 503);
}

export async function GET(request: Request, ctx: Context) {
  const auth = await requireCrmApiUser(request, "read");
  if (auth.response) return json({ error: "CRM access required." }, auth.response.status);
  if (isCrmDemoMode()) return json({ enabled: false, demo: true, environment: null, emailSuppressed: false, items: [] });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return json({ error: "Contact not found." }, 404);
  try {
    const contact = await visibleContact(id);
    if (!contact) return json({ error: "Contact not found." }, 404);
    const enabled = paymentsReady();
    const scriptUrl = authorizeNetAcceptUiScriptUrl();
    const apiLoginId = process.env.AUTHNET_API_LOGIN_ID?.trim();
    const clientKey = authorizeNetPublicClientKey();
    return json({
      enabled,
      environment: enabled ? authorizeNetEnvironment() : null,
      emailSuppressed: Boolean(contact.email_suppressed_at),
      // AcceptUI needs the API login id and public client key in the browser. They
      // come from Worker secrets (never NEXT_PUBLIC) and only reach users who can charge.
      ...(enabled && auth.user?.crmRole !== "readonly" && scriptUrl && apiLoginId && clientKey
        ? { acceptUi: { scriptUrl, apiLoginId, clientKey } } : {}),
      // Fully inert while disabled: no payment RPCs are called. Charge rows have no client link.
      items: enabled
        ? (await listPaymentRequests(id)).map((item) => item.kind === "charge"
          ? { ...item, linkToken: "", link: "" }
          : { ...item, link: paymentLinkUrl(item.linkToken) })
        : [],
    });
  } catch {
    return json({ error: "Payment requests are temporarily unavailable." }, 503);
  }
}

export async function POST(request: Request, ctx: Context) {
  const auth = await requireCrmApiUser(request, "write");
  if (auth.response) return json({ error: "CRM write access required." }, auth.response.status);
  if (isCrmDemoMode() || !paymentsReady()) return json({ error: "Payments are not enabled." }, 503);
  const { id } = await ctx.params;
  if (!UUID.test(id)) return json({ error: "Contact not found." }, 404);
  const body = await parseBody(request);
  if (!body) return json({ error: "A JSON request body is required." }, 400);
  const amountCents = parseUsdToCents(body.amount);
  if (amountCents === null) return json({ error: "Enter an amount between $1.00 and $25,000.00 with at most two decimals." }, 400);
  const description = normalizePaymentDescription(body.description);
  if (!description) return json({ error: "Enter a description of 3 to 255 characters." }, 400);
  if (body.sendEmail !== undefined && typeof body.sendEmail !== "boolean") return json({ error: "sendEmail must be true or false." }, 400);

  const actorId = String(auth.user?.sub ?? "");
  try {
    const contact = await visibleContact(id);
    if (!contact) return json({ error: "Contact not found." }, 404);
    const item = await createPaymentRequest({ contactId: id, amountCents, description, actorId });
    await audit(actorId, "payment_request.create", item.id, { amountCents, reference: item.reference });
    let emailOutcome: string | undefined;
    let emailError: string | undefined;
    if (body.sendEmail === true) {
      try {
        emailOutcome = (await deliverPaymentRequestEmail(item.id, actorId, id)).outcome;
        await audit(actorId, "payment_request.email", item.id, { reference: item.reference });
      } catch (error) {
        // Creation stands; staff can copy the link or resend.
        emailError = MUTATION_ERRORS[errorCode(error)]?.[1] ?? "The payment link email could not be sent. Copy the link or try again.";
      }
    }
    return json({ item, link: paymentLinkUrl(item.linkToken), ...(emailOutcome ? { emailOutcome } : {}), ...(emailError ? { emailError } : {}) });
  } catch (error) {
    return mutationError(error, "The payment request could not be created.");
  }
}

export async function PATCH(request: Request, ctx: Context) {
  const auth = await requireCrmApiUser(request, "write");
  if (auth.response) return json({ error: "CRM write access required." }, auth.response.status);
  if (isCrmDemoMode() || !paymentsReady()) return json({ error: "Payments are not enabled." }, 503);
  const { id } = await ctx.params;
  if (!UUID.test(id)) return json({ error: "Contact not found." }, 404);
  const body = await parseBody(request);
  if (!body || typeof body.id !== "string" || !UUID.test(body.id) || (body.action !== "cancel" && body.action !== "send_email" && body.action !== "check_status")) {
    return json({ error: "A payment request and a valid action are required." }, 400);
  }
  const actorId = String(auth.user?.sub ?? "");
  try {
    const contact = await visibleContact(id);
    if (!contact) return json({ error: "Contact not found." }, 404);
    if (body.action === "cancel") {
      await cancelPaymentRequest(body.id, actorId, id);
      await audit(actorId, "payment_request.cancel", body.id, {});
      return json({ ok: true });
    }
    if (body.action === "check_status") {
      const result = await checkPaymentRequestStatus(body.id, id, actorId);
      await audit(actorId, "payment_request.check_status", body.id, { result });
      return json({ ok: true, result });
    }
    const { outcome } = await deliverPaymentRequestEmail(body.id, actorId, id);
    await audit(actorId, "payment_request.email", body.id, {});
    return json({ ok: true, emailOutcome: outcome });
  } catch (error) {
    return mutationError(error, body.action === "cancel" ? "The payment request could not be cancelled."
      : body.action === "check_status" ? "The payment status could not be checked. Try again in a moment."
        : "The payment link email could not be sent.");
  }
}
