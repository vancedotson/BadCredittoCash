import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { liveWebinar } from "@/config/live-webinar";
import { LIVE_PLAYER_ORIGINS } from "@/lib/live-webinar-types";
import { cloudflareStreamCustomerOrigin } from "@/lib/cloudflare-stream-origin";
import { PUBLIC_SITE_HOSTNAME, PUBLIC_SITE_ORIGIN } from "@/config/public-site";
import { authorizeNetAcceptUiCspOrigins, authorizeNetHostedFormOrigin } from "@/lib/authorize-net-config";

const isDev = process.env.NODE_ENV === "development";

/** WHEP's SDP POST and session DELETE use this one configured customer origin. */
function originOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const frameSrc = [
  ...new Set(
    [
      "https://challenges.cloudflare.com",
      ...LIVE_PLAYER_ORIGINS,
      originOf(liveWebinar.room.embedUrl),
      originOf(liveWebinar.replay.embedUrl),
    ].filter((value): value is string => Boolean(value)),
  ),
].join(" ");
function createContentSecurityPolicy(formActionOrigin: string | null = null, acceptUi = false) {
  const streamOrigin = cloudflareStreamCustomerOrigin();
  // The AcceptUI card lightbox is allowed on signed-in /crm pages only, and only
  // while payments are enabled with a valid AUTHNET_ENV.
  const acceptUiOrigins = acceptUi ? authorizeNetAcceptUiCspOrigins() : null;
  const connectSources = [
    "'self'", "https://gulidnxltrgomjyctjlp.supabase.co", "wss://gulidnxltrgomjyctjlp.supabase.co",
    "https://challenges.cloudflare.com", ...(streamOrigin ? [streamOrigin] : []),
    ...(acceptUiOrigins?.connect ?? []),
  ];
  const frameSources = [...new Set([...frameSrc.split(" "), ...(acceptUiOrigins?.frame ?? [])])].join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com${acceptUiOrigins ? ` ${acceptUiOrigins.script.join(" ")}` : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    `frame-src ${frameSources}`,
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    // Only the payment checkout response may post to the configured
    // Authorize.net hosted form; every other path keeps 'self' only.
    `form-action 'self'${formActionOrigin ? ` ${formActionOrigin}` : ""}`,
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

type SecureOptions = { formActionOrigin?: string | null; noReferrer?: boolean; noStore?: boolean; acceptUi?: boolean };

function secure(response: NextResponse, privateData = false, options: SecureOptions = {}) {
  response.headers.set("Content-Security-Policy", createContentSecurityPolicy(options.formActionOrigin ?? null, options.acceptUi ?? false));
  if (options.noReferrer) response.headers.set("Referrer-Policy", "no-referrer");
  else if (!response.headers.has("Referrer-Policy")) response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  // The authenticated CRM Broadcast Studio needs same-origin camera and
  // microphone access; public pages keep both capabilities disabled.
  const media = privateData ? "camera=(self), microphone=(self)" : "camera=(), microphone=()";
  response.headers.set("Permissions-Policy", `${media}, geolocation=(), payment=(), usb=(), browsing-topics=()`);
  response.headers.set("Strict-Transport-Security", "max-age=31536000");
  if (privateData || options.noStore) response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

const WWW_PUBLIC_SITE_HOSTNAME = `www.${PUBLIC_SITE_HOSTNAME}`;

/** Client-supplied campaign URLs served in place, keyed by lowercase path without trailing slashes. */
const PATH_ALIASES: Readonly<Record<string, string>> = {
  "/creditrepairparty/thankyou": "/credit-check/thank-you",
  "/creditrepairparty/thank-you": "/credit-check/thank-you",
  // Misspelling intentionally kept: this URL was supplied by the client.
  "/creditrepairparty/comfirmation": "/live/confirmed",
  "/creditrepairparty/confirmation": "/live/confirmed",
};

function requestHostname(request: NextRequest) {
  return (request.headers.get("host") ?? request.nextUrl.host).trim().toLowerCase().replace(/:\d+$/, "");
}

// OpenNext 1.20 packages the Edge middleware convention. Next.js 16's new
// Node-runtime proxy convention is not yet supported by Cloudflare Workers.
export async function middleware(request: NextRequest) {
  if (requestHostname(request) === WWW_PUBLIC_SITE_HOSTNAME) {
    // Assign path and query separately so a "//host" path cannot change the redirect origin.
    const canonical = new URL(PUBLIC_SITE_ORIGIN);
    canonical.pathname = request.nextUrl.pathname;
    canonical.search = request.nextUrl.search;
    return secure(NextResponse.redirect(canonical, 308));
  }

  const alias = PATH_ALIASES[request.nextUrl.pathname.toLowerCase().replace(/\/+$/, "")];
  if (alias) {
    // A plain URL, not nextUrl.clone(): NextURL re-appends the incoming trailing slash.
    const url = new URL(alias, request.nextUrl.origin);
    url.search = request.nextUrl.search;
    return secure(NextResponse.rewrite(url));
  }

  // Payment links carry a bearer token in the path: never cache or leak it via Referer.
  const pathname = request.nextUrl.pathname;
  if (/^\/(?:pay|api\/pay)\//.test(pathname)) {
    const checkout = /^\/api\/pay\/[^/]+\/checkout$/.test(pathname);
    return secure(NextResponse.next(), false, {
      formActionOrigin: checkout ? authorizeNetHostedFormOrigin() : null,
      noReferrer: true,
      noStore: true,
    });
  }

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

  const hadAuthCookie = request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
  const { response, claims } = await updateSession(request);
  if (claims?.sub) return secure(response, true, { acceptUi: /^\/crm(?:\/|$)/.test(request.nextUrl.pathname) });

  if (request.nextUrl.pathname.startsWith("/api/crm")) {
    return secure(NextResponse.json({ error: "Authentication required." }, { status: 401 }), true);
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (hadAuthCookie) loginUrl.searchParams.set("reason", "session-expired");
  return secure(NextResponse.redirect(loginUrl), true);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
