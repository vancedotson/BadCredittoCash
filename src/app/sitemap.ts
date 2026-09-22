import type { MetadataRoute } from "next";
import { INDEXABLE_PUBLIC_PATHS, publicUrl } from "@/config/public-site";

export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_PUBLIC_PATHS.map((path) => ({ url: publicUrl(path) }));
}
