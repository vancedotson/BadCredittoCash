import type { Metadata } from "next";
import { noIndexNofollowMetadata } from "@/lib/route-metadata";

export const metadata: Metadata = noIndexNofollowMetadata;

export default function LiveConfirmedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
