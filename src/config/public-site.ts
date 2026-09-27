import { site } from "@/config/site";

const DEFAULT_PUBLIC_SITE_ORIGIN = "https://creditrepairparty.com";

export function resolvePublicSiteOrigin(value: string | undefined): string {
  if (value === undefined) return DEFAULT_PUBLIC_SITE_ORIGIN;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_BASE_URL must be an HTTPS origin.");
  }

  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("APP_BASE_URL must be an HTTPS origin.");
  }

  return url.origin;
}

export const PUBLIC_SITE_ORIGIN = resolvePublicSiteOrigin(process.env.APP_BASE_URL);
export const PUBLIC_SITE_HOSTNAME = new URL(PUBLIC_SITE_ORIGIN).hostname;
export const PUBLIC_SITE_NAME = site.name;
export const PUBLIC_SOCIAL_IMAGE_PATH = "/opengraph-image";
export const PUBLIC_SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const PUBLIC_SOCIAL_IMAGE_ALT = "Text-and-shape Bad Credit to Cash brand graphic with an abstract card illustration";

export const INDEXABLE_PUBLIC_PATHS = [
  "/",
  "/credit-check",
  "/book",
  "/live",
  "/privacy",
  "/terms",
] as const;

export function publicUrl(path: string): string {
  return new URL(path, PUBLIC_SITE_ORIGIN).toString();
}
