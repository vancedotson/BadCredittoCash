import type { Metadata } from "next";
import {
  PUBLIC_SITE_NAME,
  PUBLIC_SOCIAL_IMAGE_ALT,
  PUBLIC_SOCIAL_IMAGE_PATH,
  PUBLIC_SOCIAL_IMAGE_SIZE,
  publicUrl,
} from "@/config/public-site";

export const noIndexNofollowMetadata = {
  robots: { index: false, follow: false },
} satisfies Metadata;

type PublicRouteMetadataInput = {
  path: string;
  title: string;
  description: string;
};

export function publicRouteMetadata({ path, title, description }: PublicRouteMetadataInput): Metadata {
  const canonical = publicUrl(path);
  const image = publicUrl(PUBLIC_SOCIAL_IMAGE_PATH);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: PUBLIC_SITE_NAME,
      title,
      description,
      url: canonical,
      images: [{ url: image, ...PUBLIC_SOCIAL_IMAGE_SIZE, alt: PUBLIC_SOCIAL_IMAGE_ALT }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, alt: PUBLIC_SOCIAL_IMAGE_ALT }],
    },
  } satisfies Metadata;
}

export const homePageMetadata = publicRouteMetadata({
  path: "/",
  title: "FCRA & FDCPA Information | Vance Dotson",
  description:
    "Learn about the FCRA and FDCPA, get a free credit-report guide, or book a free strategy call in Oklahoma City.",
});

export const creditCheckPageMetadata = publicRouteMetadata({
  path: "/credit-check",
  title: "Check the companies on your credit report",
  description:
    "Select the companies you recognize, share your contact details, and get the simple guide for pulling your three credit reports.",
});

export const bookPageMetadata = publicRouteMetadata({
  path: "/book",
  title: "Book a Free Strategy Call",
  description:
    "Schedule a free 30-minute phone call with Vance Dotson to review collector calls, credit report issues, and possible next steps.",
});

export const livePageMetadata = publicRouteMetadata({
  path: "/live",
  title: "Free Live Session on Debt Collector Conduct",
  description:
    "Join a free online session with Vance Dotson to learn which debt collector conduct the FDCPA restricts and what to document.",
});

export const privacyPageMetadata = publicRouteMetadata({
  path: "/privacy",
  title: "Privacy Policy",
  description:
    "How Vance Dotson collects, uses, shares, and protects information submitted through this website.",
});

export const termsPageMetadata = publicRouteMetadata({
  path: "/terms",
  title: "Terms of Service",
  description:
    "Terms governing access to and use of the Vance Dotson website, training, credit-check and report-upload features, and booking services.",
});
