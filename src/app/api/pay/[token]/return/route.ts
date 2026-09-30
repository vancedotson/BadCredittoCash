import { authorizeNetConfigured } from "@/lib/authorize-net-config";
import { paymentPageRedirect, paymentText } from "@/lib/payment-http";
import { confirmPaymentRequestFromProvider } from "@/lib/payment-requests";
import { isPaymentLinkToken } from "@/lib/payments-display";
import { consumeRateLimitForKey } from "@/lib/public-api";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

/**
 * Authorize.net's "Continue" link from its receipt page. Plan section 9.8:
 * whether the browser arrives by GET or POST is unverified, and no transaction
 * fields are sent, so both methods are accepted and nothing in the request body
 * is trusted. The webhook remains the primary confirmation.
 */
async function handle(ctx: Context): Promise<Response> {
  const { token } = await ctx.params;
  if (!isPaymentLinkToken(token)) return paymentText("Not found.", 404);
  if (!authorizeNetConfigured()) return paymentPageRedirect(token, "state=unavailable");
  let allowed = false;
  try {
    allowed = await consumeRateLimitForKey(`payment-return-token:${token}`, "payment", 12, 600);
  } catch {
    allowed = false;
  }
  if (allowed) await confirmPaymentRequestFromProvider(token);
  return paymentPageRedirect(token, "returned=1");
}

export async function GET(_request: Request, ctx: Context) {
  return handle(ctx);
}

export async function POST(_request: Request, ctx: Context) {
  return handle(ctx);
}
