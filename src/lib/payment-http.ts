import "server-only";

import { NextResponse } from "next/server";
import { isPaymentLinkToken } from "./payments-display";

/** Headers for every public payment response (the token is a bearer secret). */
export const PAYMENT_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

/** Same semantics as hasReportSameOrigin: reject cross-site traffic; POSTs must carry Origin. */
export function hasPaymentSameOrigin(request: Request, required = true): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return !required;
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host && /[\s/\\?#@]/.test(host)) return false;
  try { return origin === new URL(`${url.protocol}//${host ?? url.host}`).origin; }
  catch { return false; }
}

/** Relative 303 so the browser stays on the origin it used; the token path is validated first. */
export function paymentPageRedirect(token: string, state?: string): Response {
  const path = isPaymentLinkToken(token) ? `/pay/${token}` : "/";
  const location = state ? `${path}?${state}` : path;
  return new Response(null, { status: 303, headers: { ...PAYMENT_RESPONSE_HEADERS, Location: location } });
}

export function paymentText(body: string, status: number): Response {
  return new NextResponse(body, { status, headers: { ...PAYMENT_RESPONSE_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
}

export function requestIp(request: Request): string {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? `unknown:${request.headers.get("user-agent") ?? "none"}`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

/**
 * Tiny auto-submitting page that full-redirects the browser to Authorize.net's
 * hosted form with the short-lived token. No iframe; card data is entered only
 * on Authorize.net. The inline script is allowed by the global script-src.
 */
export function hostedFormRedirectPage(hostedFormUrl: string, token: string): Response {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Redirecting to secure payment</title></head><body><p>Taking you to Authorize.net's secure payment page…</p><form id="f" method="post" action="${escapeHtml(hostedFormUrl)}"><input type="hidden" name="token" value="${escapeHtml(token)}"><noscript><button type="submit">Continue to secure payment</button></noscript></form><script>document.getElementById("f").submit();</script></body></html>`;
  return new NextResponse(body, {
    status: 200,
    headers: { ...PAYMENT_RESPONSE_HEADERS, "Content-Type": "text/html; charset=utf-8" },
  });
}
