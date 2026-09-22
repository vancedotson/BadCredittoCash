import { site } from "@/config/site";

export const PUBLIC_SITE_ORIGIN = "https://badcredittocash.com";
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
