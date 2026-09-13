// Generates right-sized WebP files for every image in
// src/config/image-variants.json into public/img/.
//
//   npm run images
//
// Why this exists: the site deploys to Cloudflare Workers via OpenNext, and no
// Cloudflare Images binding is configured, so /_next/image returns the original
// file untouched — a 5 MB PNG for a 56px avatar. Pre-generating the variants
// makes every size a small static asset served straight from the CDN, with no
// runtime image service and no per-request cost.
//
// Output is deterministic and committed. Re-run after adding or changing a
// source; widths larger than the source are skipped (never upscaled).

import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(join(root, "src/config/image-variants.json"), "utf8"));
const outDir = join(root, config.outDir);
await mkdir(outDir, { recursive: true });

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
let totalIn = 0;
let totalOut = 0;

for (const [publicPath, source] of Object.entries(config.sources)) {
  const input = join(root, source.input);
  const inputBytes = (await stat(input)).size;
  let base = sharp(input);
  if (source.crop) base = base.extract(source.crop);
  // Optional per-source overrides for images that compress badly at the
  // default quality (fine grain/noise).
  const quality = source.quality ?? config.quality;
  if (source.blur) base = base.blur(source.blur);
  const meta = source.crop ? source.crop : await sharp(input).metadata();

  const lines = [];
  for (const width of source.widths) {
    if (width > meta.width) {
      lines.push(`  skip ${width}w (source is ${meta.width}px)`);
      continue;
    }
    const file = join(outDir, `${source.name}-${width}.webp`);
    const info = await base
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, alphaQuality: 90, effort: 5, smartSubsample: true })
      .toFile(file);
    totalOut += info.size;
    lines.push(`  ${String(width).padStart(4)}w  ${kb(info.size).padStart(7)}  ${info.width}x${info.height}`);
  }
  totalIn += inputBytes;
  console.log(`${publicPath}  (original ${kb(inputBytes)})`);
  console.log(lines.join("\n"));
}

console.log(`\nOriginals: ${kb(totalIn)} · all generated variants combined: ${kb(totalOut)}`);
