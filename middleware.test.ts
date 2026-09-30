import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { middleware } from "./middleware";

const updateSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/proxy", () => ({ updateSession }));

const canonicalOrigin = "https://creditrepairparty.com";

function requestFor(url: string, host = new URL(url).host) {
  return new NextRequest(url, { headers: { host } });
}

function mediaPolicy(response: Response) {
  const directives = (response.headers.get("Permissions-Policy") ?? "").split(", ");
  return directives.filter((directive) => directive.startsWith("camera=") || directive.startsWith("microphone="));
}

describe("live playback security headers", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("permits WHEP fetches only to the configured exact Cloudflare Stream customer origin", async () => {
    vi.stubEnv("CLOUDFLARE_STREAM_CUSTOMER_ORIGIN", "https://customer-ab12.cloudflarestream.com");
    const response = await middleware(new NextRequest("https://example.test/live/room"));
    const policy = response.headers.get("Content-Security-Policy") ?? "";
    const directives = Object.fromEntries(policy.split("; ").map((part) => {
      const [name, ...sources] = part.split(" ");
      return [name, sources];
    }));
    expect(directives["connect-src"]).toContain("https://customer-ab12.cloudflarestream.com");
    expect(directives["connect-src"]).not.toContain("https://*.cloudflarestream.com");
    expect(directives["connect-src"]).not.toContain("https://customer-other.cloudflarestream.com");
    expect(directives["media-src"]).toEqual(["'self'", "blob:"]);
  });

  it.each([
    "",
    "https://cloudflarestream.com",
    "https://customer-ab12.cloudflarestream.com.evil.example",
    "https://customer-ab12.cloudflarestream.com/path",
    "http://customer-ab12.cloudflarestream.com",
  ])("does not widen CSP for invalid or missing Stream origins: %s", async (origin) => {
    vi.stubEnv("CLOUDFLARE_STREAM_CUSTOMER_ORIGIN", origin);
    const response = await middleware(new NextRequest("https://example.test/live/room"));
    const policy = response.headers.get("Content-Security-Policy") ?? "";
    const connectSrc = policy.split("; ").find((part) => part.startsWith("connect-src ")) ?? "";
    expect(connectSrc).not.toContain("cloudflarestream.com");
    expect(policy).not.toContain("media-src 'self' blob: https:");
  });
});

describe("canonical host redirect", () => {
  it("permanently redirects the www host to the apex origin, keeping path and query", async () => {
    const response = await middleware(requestFor("https://www.creditrepairparty.com/credit-check?utm_source=a"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(`${canonicalOrigin}/credit-check?utm_source=a`);
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });

  it("matches the www host case-insensitively and ignores a port", async () => {
    const response = await middleware(requestFor("https://www.creditrepairparty.com/live", "WWW.CreditRepairParty.com:443"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(`${canonicalOrigin}/live`);
  });

  it("keeps a protocol-relative-looking path on the canonical origin", async () => {
    const response = await middleware(requestFor("https://www.creditrepairparty.com//evil.example/path?x=1"));
    expect(response.status).toBe(308);
    expect(new URL(response.headers.get("location") ?? "").origin).toBe(canonicalOrigin);
  });

  it.each([
    "creditrepairparty.com",
    "vance-dotson.vancedotson.workers.dev",
    "vance.internal",
    "www.creditrepairparty.com.evil.example",
  ])("does not redirect host %s", async (host) => {
    const response = await middleware(requestFor(`https://${host}/credit-check?utm_source=a`));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("client campaign path aliases", () => {
  it.each([
    ["/creditrepairparty/thankyou", "/credit-check/thank-you"],
    ["/creditrepairparty/thank-you", "/credit-check/thank-you"],
    ["/creditrepairparty/comfirmation", "/live/confirmed"],
    ["/creditrepairparty/confirmation", "/live/confirmed"],
    ["/CreditRepairParty/Confirmation/", "/live/confirmed"],
  ])("rewrites %s to %s without redirecting", async (path, target) => {
    const response = await middleware(requestFor(`${canonicalOrigin}${path}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBe(`${canonicalOrigin}${target}`);
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });

  it("matches case-insensitively, strips trailing slashes and preserves the query", async () => {
    const response = await middleware(requestFor(`${canonicalOrigin}/CreditRepairParty/Thankyou/?x=1`));
    expect(response.headers.get("x-middleware-rewrite")).toBe(`${canonicalOrigin}/credit-check/thank-you?x=1`);
  });

  it.each(["/creditrepairparty/other", "/creditrepairparty", "/creditrepairparty/thankyou/extra"])(
    "does not rewrite %s",
    async (path) => {
      const response = await middleware(requestFor(`${canonicalOrigin}${path}`));
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    },
  );
});

describe("camera and microphone permissions", () => {
  afterEach(() => updateSession.mockReset());

  it("keeps camera and microphone disabled on public pages", async () => {
    const response = await middleware(requestFor(`${canonicalOrigin}/live/room`));
    expect(mediaPolicy(response)).toEqual(["camera=()", "microphone=()"]);
    expect(response.headers.get("Permissions-Policy")).not.toContain("display-capture");
  });

  it.each(["/crm/webinars", "/api/crm/webinars"])("allows same-origin camera and microphone on %s", async (path) => {
    updateSession.mockImplementation(async (request: NextRequest) => ({
      response: NextResponse.next({ request }),
      claims: { sub: "operator-1" },
    }));
    const response = await middleware(requestFor(`${canonicalOrigin}${path}`));
    expect(mediaPolicy(response)).toEqual(["camera=(self)", "microphone=(self)"]);
    expect(response.headers.get("Permissions-Policy")).toBe(
      "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()",
    );
    expect(response.headers.get("Permissions-Policy")).not.toContain("display-capture");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
  });

  it("uses the private-data policy on unauthenticated CRM responses", async () => {
    updateSession.mockImplementation(async (request: NextRequest) => ({ response: NextResponse.next({ request }), claims: null }));
    const api = await middleware(requestFor(`${canonicalOrigin}/api/crm/webinars`));
    expect(api.status).toBe(401);
    expect(mediaPolicy(api)).toEqual(["camera=(self)", "microphone=(self)"]);
    const page = await middleware(requestFor(`${canonicalOrigin}/crm`));
    expect(page.headers.get("location")).toContain("/login?next=%2Fcrm");
    expect(mediaPolicy(page)).toEqual(["camera=(self)", "microphone=(self)"]);
  });
});

describe("Authorize.net AcceptUI content security policy", () => {
  function directive(response: Response, name: string): string[] {
    const part = (response.headers.get("Content-Security-Policy") ?? "").split("; ").find((entry) => entry.startsWith(`${name} `)) ?? "";
    return part.split(" ").slice(1);
  }
  function signedIn() {
    updateSession.mockImplementation(async (request: NextRequest) => ({
      response: NextResponse.next({ request }),
      claims: { sub: "operator-1" },
    }));
  }
  function enable(environment = "sandbox") {
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    vi.stubEnv("AUTHNET_ENV", environment);
  }
  afterEach(() => { vi.unstubAllEnvs(); updateSession.mockReset(); });

  it("adds only the sandbox origins to signed-in /crm responses", async () => {
    signedIn();
    enable("sandbox");
    const response = await middleware(requestFor(`${canonicalOrigin}/crm/contacts/abc`));
    expect(directive(response, "script-src")).toContain("https://jstest.authorize.net");
    expect(directive(response, "frame-src")).toEqual(expect.arrayContaining(["https://jstest.authorize.net", "https://test.authorize.net"]));
    expect(directive(response, "connect-src")).toContain("https://apitest.authorize.net");
    const policy = response.headers.get("Content-Security-Policy") ?? "";
    expect(policy).not.toContain("https://js.authorize.net");
    expect(policy).not.toContain("https://api2.authorize.net");
    expect(policy).not.toContain("https://accept.authorize.net");
    expect(directive(response, "script-src")).not.toContain("*");
  });

  it("adds production origins only when AUTHNET_ENV is exactly production", async () => {
    signedIn();
    enable("production");
    const response = await middleware(requestFor(`${canonicalOrigin}/crm`));
    expect(directive(response, "script-src")).toContain("https://js.authorize.net");
    expect(directive(response, "frame-src")).toEqual(expect.arrayContaining(["https://js.authorize.net", "https://accept.authorize.net"]));
    expect(directive(response, "connect-src")).toEqual(expect.arrayContaining(["https://api2.authorize.net", "https://api.authorize.net"]));
    const policy = response.headers.get("Content-Security-Policy") ?? "";
    expect(policy).not.toContain("jstest.authorize.net");
    expect(policy).not.toContain("apitest.authorize.net");
    expect(policy).not.toContain("https://test.authorize.net");
  });

  it.each(["Production", "prod", "", "sandbox "])("does not widen the CSP for invalid AUTHNET_ENV %j", async (environment) => {
    signedIn();
    enable(environment);
    const response = await middleware(requestFor(`${canonicalOrigin}/crm/contacts/abc`));
    expect(response.headers.get("Content-Security-Policy")).not.toContain("authorize.net");
  });

  it.each(["false", "", "TRUE"])("does not widen the CSP when PAYMENTS_ENABLED is %j", async (enabled) => {
    signedIn();
    vi.stubEnv("PAYMENTS_ENABLED", enabled);
    vi.stubEnv("AUTHNET_ENV", "sandbox");
    const response = await middleware(requestFor(`${canonicalOrigin}/crm/contacts/abc`));
    expect(response.headers.get("Content-Security-Policy")).not.toContain("authorize.net");
  });

  it.each(["/", "/live/room", "/api/crm/contact/abc/payment-requests", "/crmx", "/pay/tok", "/login"])(
    "keeps AcceptUI origins off %s",
    async (path) => {
      signedIn();
      enable("sandbox");
      const response = await middleware(requestFor(`${canonicalOrigin}${path}`));
      expect(response.headers.get("Content-Security-Policy")).not.toContain("jstest.authorize.net");
      expect(response.headers.get("Content-Security-Policy")).not.toContain("apitest.authorize.net");
    },
  );

  it("keeps the AcceptUI origins off unauthenticated /crm redirects", async () => {
    updateSession.mockImplementation(async (request: NextRequest) => ({ response: NextResponse.next({ request }), claims: null }));
    enable("sandbox");
    const response = await middleware(requestFor(`${canonicalOrigin}/crm`));
    expect(response.headers.get("Content-Security-Policy")).not.toContain("authorize.net");
  });
});
