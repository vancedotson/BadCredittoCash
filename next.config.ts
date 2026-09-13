import type { NextConfig } from "next";

// OpenNext/Cloudflare applies response security policy in middleware.ts.
const nextConfig: NextConfig = {
  images: {
    // Cloudflare has no image-optimization binding for this Worker, so the
    // built-in /_next/image endpoint would serve the original multi-megabyte
    // file at every size. Images are pre-generated instead (`npm run images`)
    // and this loader picks the right static file per width.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    // Kept to the widths the site actually renders, matching the variants in
    // src/config/image-variants.json so each srcset entry maps to a real file.
    deviceSizes: [640, 828, 1080, 1280, 1920, 2560],
    imageSizes: [64, 128, 256, 384],
  },
};

export default nextConfig;
