import "server-only";
import { NextResponse } from "next/server";

export function reportJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0", "Referrer-Policy": "no-referrer", ...headers } });
}

/** Reject cross-site traffic; mutation requests must carry the browser Origin. */
export function hasReportSameOrigin(request: Request, required = true): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return !required;
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host && /[\s/\\?#@]/.test(host)) return false;
  try { return origin === new URL(`${url.protocol}//${host ?? url.host}`).origin; }
  catch { return false; }
}
