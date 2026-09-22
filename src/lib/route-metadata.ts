import type { Metadata } from "next";

export const noIndexNofollowMetadata = {
  robots: { index: false, follow: false },
} satisfies Metadata;

export const bookPageMetadata = {
  title: "Book a Free Strategy Call",
  description:
    "Schedule a free 30-minute phone call with Vance Dotson to review collector calls, credit report issues, and possible next steps.",
} satisfies Metadata;

export const livePageMetadata = {
  title: "Free Live Session on Debt Collector Conduct",
  description:
    "Join a free online session with Vance Dotson to learn which debt collector conduct the FDCPA restricts and what to document.",
} satisfies Metadata;
