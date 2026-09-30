import { NextResponse } from "next/server";

import { requireCrmApiUser } from "@/lib/auth";
import { recordAdminAudit } from "@/lib/audit";
import { isCrmDemoMode } from "@/lib/demo";
import { readLimitedJson } from "@/lib/public-api";
import { createClient } from "@/lib/supabase/server";
import { authorizeNetConfigured } from "@/lib/authorize-net-config";
import { chargePaymentRequest } from "@/lib/payment-requests";
import { containsCardNumber, normalizePaymentDescription, parseUsdToCents } from "@/lib/payments-display";

export const dynamic = "force-dynamic";

/**
 * Manual "Charge card". The browser tokenizes the card with the Authorize.net
 * AcceptUI lightbox and sends only the opaque payment nonce here. Card numbers,
 * security codes and expirations are never accepted, stored or logged.
 */

const NO_STORE = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPAQUE_DESCRIPTOR = "COMMON.ACCEPT.INAPP.PAYMENT";
const MAX_BODY_BYTES = 8192;
const MAX_OPAQUE_VALUE = 4096;
type Context = { params: Promise<{ id: string }> };

function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: NO_STORE }); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "unknown";
}
/** chargePaymentRequest tags errors thrown before Authorize.net was called. */
function chargeNotStarted(error: unknown): boolean {
  return Boolean(error) && typeof error === "object" && (error as { chargeNotStarted?: unknown }).chargeNotStarted === true;
}

/** Any key that looks like raw card data anywhere in the body (bounded depth). */
function hasCardDataKey(value: unknown, depth = 0): boolean {
  if (depth > 4 || !isRecord(value)) return false;
  return Object.entries(value).some(([key, child]) => {
    const name = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    return /cardnumber|cardcode|cvv|cvc|cvn|expir|expdate|expmonth|expyear|accountnumber|creditcard|^pan$|^number$|^card$/.test(name)
      || hasCardDataKey(child, depth + 1);
  });
}

function shortName(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text.length <= 50 && !/[\u0000-\u001f\u007f-\u009f]/.test(text) ? text || null : undefined;
}

async function visibleContact(id: string): Promise<{ id: string; email: string; name: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contacts").select("id,email,name").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not verify contact access.");
  return data?.id === id ? data : null;
}

async function audit(actorId: string, entityId: string, afterState: Record<string, unknown>) {
  try {
    await recordAdminAudit({ actorId, action: "payment_request.charge", entityType: "payment_request", entityId, afterState });
  } catch {
    console.warn("[payments] audit record failed", { action: "payment_request.charge" });
  }
}

const CHARGE_ERRORS: Record<string, [number, string]> = {
  payment_charge_in_progress: [409, "A charge for this contact started less than 2 minutes ago. Check its status before trying again."],
  payment_charge_unresolved: [409, "An earlier charge for this contact has an unknown result. Use Check status on it, or cancel it after confirming in Authorize.net that the card was not charged, before charging again."],
  payment_request_contact_unavailable: [404, "Contact not found."],
  payment_request_actor_invalid: [403, "This account cannot charge cards."],
};

/** The client IP as Cloudflare reports it; forwarded-for style headers are user-controlled. */
function customerIp(request: Request): string | null {
  const value = request.headers.get("cf-connecting-ip")?.trim();
  return value && value.length <= 45 && /^[0-9a-fA-F:.]+$/.test(value) ? value : null;
}

export async function POST(request: Request, ctx: Context) {
  const auth = await requireCrmApiUser(request, "write");
  if (auth.response) return json({ error: "CRM write access required." }, auth.response.status);
  if (isCrmDemoMode() || !authorizeNetConfigured()) return json({ error: "Payments are not enabled." }, 503);
  const { id } = await ctx.params;
  if (!UUID.test(id)) return json({ error: "Contact not found." }, 404);

  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return json({ error: "A JSON request body is required." }, 400);
  }
  const parsed = await readLimitedJson<unknown>(request, MAX_BODY_BYTES);
  if (!parsed.ok) return json({ error: parsed.status === 413 ? "The request is too large." : "A JSON request body is required." }, parsed.status === 413 ? 413 : 400);
  const body = parsed.value;
  if (!isRecord(body)) return json({ error: "A JSON request body is required." }, 400);
  if (hasCardDataKey(body)) return json({ error: "Card details must never be sent to this endpoint. Use the secure card form." }, 400);

  const amountCents = parseUsdToCents(body.amount);
  if (amountCents === null) return json({ error: "Enter an amount between $1.00 and $25,000.00 with at most two decimals." }, 400);
  const description = normalizePaymentDescription(body.description);
  if (!description) return json({ error: "Enter a description of 3 to 255 characters." }, 400);
  if (containsCardNumber(description)) return json({ error: "The description must not contain a card number." }, 400);
  if (body.confirm !== true) return json({ error: "Confirm the charge before submitting." }, 400);

  const opaque = body.opaqueData;
  if (
    !isRecord(opaque)
    || opaque.dataDescriptor !== OPAQUE_DESCRIPTOR
    || typeof opaque.dataValue !== "string"
    || opaque.dataValue.length < 1
    || opaque.dataValue.length > MAX_OPAQUE_VALUE
    || !/^[\x21-\x7e]+$/.test(opaque.dataValue)
  ) {
    return json({ error: "The secure card token is missing or invalid. Open the card form and try again." }, 400);
  }
  let firstName: string | null = null;
  let lastName: string | null = null;
  if (body.billTo !== undefined) {
    if (!isRecord(body.billTo)) return json({ error: "billTo is invalid." }, 400);
    const first = shortName(body.billTo.firstName);
    const last = shortName(body.billTo.lastName);
    if (first === undefined || last === undefined) return json({ error: "billTo is invalid." }, 400);
    firstName = first;
    lastName = last;
  }

  const actorId = String(auth.user?.sub ?? "");
  let contact: Awaited<ReturnType<typeof visibleContact>>;
  try {
    contact = await visibleContact(id);
  } catch {
    return json({ error: "The charge could not be started. Nothing was charged." }, 503);
  }
  if (!contact) return json({ error: "Contact not found." }, 404);
  try {
    const response = await chargePaymentRequest({
      contactId: id,
      actorId,
      actorName: auth.user && "displayName" in auth.user && typeof auth.user.displayName === "string" ? auth.user.displayName : undefined,
      amountCents,
      description,
      opaqueData: { dataDescriptor: OPAQUE_DESCRIPTOR, dataValue: opaque.dataValue },
      customerEmail: contact.email,
      firstName,
      lastName,
      customerIp: customerIp(request),
    });
    await audit(actorId, response.item.id, { amountCents, reference: response.item.reference, outcome: response.outcome });
    // The item never carries the (unused) link token of a charge row.
    const item = { ...response.item, linkToken: "" };
    return json({
      item,
      outcome: response.outcome,
      reason: response.reason,
      transactionId: response.transactionId,
      cardLast4: response.cardLast4,
    });
  } catch (error) {
    if (chargeNotStarted(error)) {
      const mapped = CHARGE_ERRORS[errorCode(error)];
      return mapped ? json({ error: mapped[1] }, mapped[0]) : json({ error: "The charge could not be started. Nothing was charged." }, 503);
    }
    // Anything else may have happened after Authorize.net was called. Never say
    // nothing was charged, and carry no `error` key: the panel reads `error` on a
    // failed response as "stopped before charging".
    console.error("[payments] charge outcome unknown", { code: errorCode(error) });
    return json({
      item: null,
      outcome: "unknown",
      reason: "The result could not be confirmed. The card may have been charged. Use Check status on the request below before trying again.",
      transactionId: null,
      cardLast4: null,
    }, 500);
  }
}
