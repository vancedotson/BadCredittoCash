import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const isDev = process.env.NODE_ENV === "development";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://gulidnxltrgomjyctjlp.supabase.co wss://gulidnxltrgomjyctjlp.supabase.co https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "media-src 'self' blob: https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

function secure(response: NextResponse, privateData = false) {
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()");
  response.headers.set("Strict-Transport-Security", "max-age=31536000");
  if (privateData) response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

// OpenNext 1.20 packages the Edge middleware convention. Next.js 16's new
// Node-runtime proxy convention is not yet supported by Cloudflare Workers.
export async function middleware(request: NextRequest) {
  const protectedPath = request.nextUrl.pathname.startsWith("/crm")
    || request.nextUrl.pathname.startsWith("/api/crm");
  if (!protectedPath) return secure(NextResponse.next());

  const localDemo = isDev && process.env.VANCE_ENABLE_DEMO_DATA === "true";
  if (localDemo) return secure(NextResponse.next({ request }), true);

  if (!hasSupabaseConfig()) {
    if (request.nextUrl.pathname.startsWith("/api/crm")) {
      return secure(NextResponse.json({ error: "Authentication required." }, { status: 401 }), true);
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return secure(NextResponse.redirect(loginUrl), true);
  }

  const { response, claims } = await updateSession(request);
  if (claims?.sub) return secure(response, true);

  if (request.nextUrl.pathname.startsWith("/api/crm")) {
    return secure(NextResponse.json({ error: "Authentication required." }, { status: 401 }), true);
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return secure(NextResponse.redirect(loginUrl), true);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
