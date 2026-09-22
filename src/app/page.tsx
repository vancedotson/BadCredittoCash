import type { Metadata } from "next";
import { V4Home } from "@/components/marketing-v4/V4Home";
import { homePageMetadata } from "@/lib/route-metadata";

export const metadata: Metadata = homePageMetadata;

/**
 * Home (/) — the v4 "Case File" experience is now the main home page. The
 * original v1 marketing home lives at /v1spare. /v4 renders the same thing.
 */
export default function Home() {
  return <V4Home />;
}
