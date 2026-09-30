import { authorizeNetConfigured } from "@/lib/authorize-net-config";
import { createHostedPaymentToken } from "@/lib/authorize-net";
import {
  hasPaymentSameOrigin,
  hostedFormRedirectPage,
  paymentPageRedirect,
  paymentText,
  requestIp,
} from "@/lib/payment-http";
import { beginPaymentCheckout, recordPaymentRequestEvent } from "@/lib/payment-requests";
import { isPaymentLinkToken } from "@/lib/payments-display";
import { consumeRateLimitForKey } from "@/lib/public-api";
import { publicUrl } from "@/config/public-site";

export const dynamic = "force-dynamic";

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "unknown";
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

/**
 * Same-origin form POST from /pay/<token>. Requests a fresh Accept Hosted token
 * at click time and full-redirects the browser to Authorize.net's hosted form.
 */
export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!hasPaymentSameOrigin(request)) return paymentText("Cross-site request rejected.", 403);
  const { token } = await ctx.params;
  if (!isPaymentLinkToken(token)) return paymentText("Not found.", 404);
  if (!authorizeNetConfigured()) return paymentPageRedirect(token, "state=unavailable");

  try {
    // Identities are hashed before storage; the raw token is never persisted by the limiter.
    const [ipAllowed, tokenAllowed] = await Promise.all([
      consumeRateLimitForKey(`payment-checkout-ip:${requestIp(request)}`, "payment", 10, 600),
      consumeRateLimitForKey(`payment-checkout-token:${token}`, "payment", 6, 600),
    ]);
    if (!ipAllowed || !tokenAllowed) return paymentPageRedirect(token, "state=rate-limited");
  } catch {
    return paymentPageRedirect(token, "state=provider-error");
  }

  let checkout: Awaited<ReturnType<typeof beginPaymentCheckout>>;
  try {
    checkout = await beginPaymentCheckout(token);
  } catch (error) {
    const code = errorCode(error);
    if (code === "payment_request_missing") return paymentText("Not found.", 404);
    if (code === "payment_request_not_payable") return paymentPageRedirect(token);
    return paymentPageRedirect(token, "state=provider-error");
  }

  try {
    const { firstName, lastName } = splitName(checkout.contactName ?? "");
    const hosted = await createHostedPaymentToken({
      amountCents: checkout.amountCents,
      reference: checkout.reference,
      description: checkout.description,
      customerEmail: checkout.contactEmail,
      firstName,
      lastName,
      returnUrl: publicUrl(`/api/pay/${token}/return`),
      cancelUrl: publicUrl(`/pay/${token}?state=cancelled`),
    });
    return hostedFormRedirectPage(hosted.hostedFormUrl, hosted.token);
  } catch (error) {
    const code = errorCode(error);
    console.error("[payments] hosted checkout could not be started", { code });
    try { await recordPaymentRequestEvent(checkout.id, "checkout_failed", "system", { code }); } catch { /* best effort */ }
    return paymentPageRedirect(token, "state=provider-error");
  }
}
