const CUSTOMER_HOST = /^customer-[a-z0-9]+\.cloudflarestream\.com$/i;

/**
 * The exact Stream customer origin is learned when the account provisions its
 * customer subdomain. It is public configuration, but deliberately fail-closed:
 * until set, no Cloudflare Stream origin is added to CSP or accepted for play.
 */
export function cloudflareStreamCustomerOrigin(value = process.env.CLOUDFLARE_STREAM_CUSTOMER_ORIGIN): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !CUSTOMER_HOST.test(url.hostname)
      || url.origin !== value || url.username || url.password || url.pathname !== "/"
      || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isConfiguredCloudflareStreamUrl(value: string): boolean {
  try {
    return Boolean(cloudflareStreamCustomerOrigin() && new URL(value).origin === cloudflareStreamCustomerOrigin());
  } catch {
    return false;
  }
}
