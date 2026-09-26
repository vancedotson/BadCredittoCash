import "server-only";

const MAX_ALLOWED_ORIGINS = 2;
const DNS_LABEL = /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i;

/**
 * Parses attendee app origins for Stream's hostname-only allowedOrigins field.
 * Invalid input rejects the complete setting so Stream is never configured
 * with an accidental valid subset or an empty (provider-permissive) list.
 */
export function cloudflareStreamAllowedOriginHosts(
  value = process.env.CLOUDFLARE_STREAM_ALLOWED_ORIGINS,
): string[] | null {
  if (typeof value !== "string") return null;

  const hosts = new Set<string>();
  for (const segment of value.split(",")) {
    const origin = segment.trim();
    if (!origin) continue;

    // Only an exact HTTPS origin, with an optional root slash, is accepted.
    if (!/^https:\/\/[^/?#]+\/?$/i.test(origin)) return null;

    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return null;
    }

    const hostname = url.hostname.toLowerCase();
    const labels = hostname.split(".");
    if (url.protocol !== "https:" || url.username || url.password || url.port
      || url.pathname !== "/" || url.search || url.hash
      || hostname.length > 253 || labels.length < 2 || hostname.endsWith(".")
      || labels.some((label) => !DNS_LABEL.test(label))
      // Reject IPv4 literals and numeric final labels to avoid URL parser IP
      // normalization and ambiguous numeric host forms.
      || /^\d+(?:\.\d+){3}$/.test(hostname)
      || !/[a-z]/i.test(labels[labels.length - 1])) {
      return null;
    }

    hosts.add(hostname);
    if (hosts.size > MAX_ALLOWED_ORIGINS) return null;
  }

  if (hosts.size === 0) return null;
  return [...hosts].sort();
}
