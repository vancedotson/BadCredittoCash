"use client";

import variants from "../config/image-variants.json";

/**
 * next/image loader backed by pre-generated static files (see
 * src/config/image-variants.json and `npm run images`).
 *
 * Cloudflare Workers has no image-optimization binding configured here, so the
 * default loader's /_next/image endpoint returns the original file at every
 * size. This loader instead points each requested width at a real WebP on disk:
 * the smallest generated width that is at least as wide as requested, or the
 * largest one when the request exceeds them all.
 *
 * Images not listed in the manifest fall back to their original URL, so adding
 * a new <Image> never breaks — it just isn't optimized until it's added to the
 * manifest and `npm run images` is re-run.
 */

type Source = { name: string; widths: number[] };
const sources = variants.sources as Record<string, Source>;

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  const source = sources[src];
  if (!source) {
    // Include the width so Next doesn't warn that the loader ignores it.
    return `${src}${src.includes("?") ? "&" : "?"}w=${width}`;
  }
  const widths = source.widths;
  const chosen = widths.find((w) => w >= width) ?? widths[widths.length - 1];
  return `/img/${source.name}-${chosen}.webp`;
}
