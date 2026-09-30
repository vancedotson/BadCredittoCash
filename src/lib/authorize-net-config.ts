/**
 * Payment feature gate and Authorize.net endpoints. Pure and Edge-safe: the
 * middleware imports this module to build the CRM/checkout CSP, so it must not
 * import server-only code or read secrets beyond presence checks.
 */

export type AuthorizeNetEnvironment = "sandbox" | "production";

export const AUTHORIZE_NET_ENDPOINTS: Readonly<Record<AuthorizeNetEnvironment, { api: string; hostedForm: string; acceptUiScript: string }>> = {
  sandbox: {
    api: "https://apitest.authorize.net/xml/v1/request.api",
    hostedForm: "https://test.authorize.net/payment/payment",
    acceptUiScript: "https://jstest.authorize.net/v3/AcceptUI.js",
  },
  production: {
    api: "https://api.authorize.net/xml/v1/request.api",
    hostedForm: "https://accept.authorize.net/payment/payment",
    acceptUiScript: "https://js.authorize.net/v3/AcceptUI.js",
  },
};

/** Payments are opt-in only; every other value fails closed. */
export function paymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED === "true";
}

/** Exact match only, so a typo can never select production by accident. */
export function authorizeNetEnvironment(): AuthorizeNetEnvironment | null {
  const value = process.env.AUTHNET_ENV;
  return value === "sandbox" || value === "production" ? value : null;
}

/** Origin of the hosted payment form for the configured environment. */
export function authorizeNetHostedFormOrigin(): string | null {
  const environment = authorizeNetEnvironment();
  return environment ? new URL(AUTHORIZE_NET_ENDPOINTS[environment].hostedForm).origin : null;
}

/** Origin of the JSON API for the configured environment. */
export function authorizeNetApiOrigin(): string | null {
  const environment = authorizeNetEnvironment();
  return environment ? new URL(AUTHORIZE_NET_ENDPOINTS[environment].api).origin : null;
}

/** AcceptUI.js URL (hosted lightbox) for the configured environment. */
export function authorizeNetAcceptUiScriptUrl(): string | null {
  const environment = authorizeNetEnvironment();
  return environment ? AUTHORIZE_NET_ENDPOINTS[environment].acceptUiScript : null;
}

/**
 * Accept.js public client key. Public by design (it can only tokenize cards),
 * but it is read from a Worker secret, never NEXT_PUBLIC, and is served only to
 * signed-in CRM users who can charge.
 */
export function authorizeNetPublicClientKey(): string | null {
  return process.env.AUTHNET_PUBLIC_CLIENT_KEY?.trim() || null;
}

/**
 * Extra CSP origins the AcceptUI lightbox needs, or null unless payments are
 * enabled and AUTHNET_ENV is valid. Used only for /crm responses.
 * Plan section 9: the exact iframe/XHR hosts AcceptUI uses must be confirmed in
 * the sandbox browser console; widen here (never globally) if it reports blocks.
 */
export function authorizeNetAcceptUiCspOrigins(): { script: string[]; frame: string[]; connect: string[] } | null {
  const environment = authorizeNetEnvironment();
  if (!paymentsEnabled() || !environment) return null;
  const scriptOrigin = new URL(AUTHORIZE_NET_ENDPOINTS[environment].acceptUiScript).origin;
  const hostedOrigin = new URL(AUTHORIZE_NET_ENDPOINTS[environment].hostedForm).origin;
  const apiOrigins = environment === "production"
    ? ["https://api2.authorize.net", "https://api.authorize.net"]
    : ["https://apitest.authorize.net"];
  return {
    script: [scriptOrigin],
    frame: [scriptOrigin, hostedOrigin],
    connect: [scriptOrigin, ...apiOrigins],
  };
}

/** True only when the feature is enabled and every credential is present. */
export function authorizeNetConfigured(): boolean {
  return paymentsEnabled()
    && authorizeNetEnvironment() !== null
    && Boolean(process.env.AUTHNET_API_LOGIN_ID?.trim())
    && Boolean(process.env.AUTHNET_TRANSACTION_KEY?.trim())
    && Boolean(process.env.AUTHNET_SIGNATURE_KEY?.trim())
    && Boolean(process.env.AUTHNET_PUBLIC_CLIENT_KEY?.trim());
}
