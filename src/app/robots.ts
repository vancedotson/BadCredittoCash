import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/crm",
        "/login",
        "/forgot-password",
        "/auth/",
        "/api/",
        "/credit-check/thank-you",
        "/webinar/confirmed",
        "/webinar/booked",
        "/live/confirmed",
        "/live/booked",
      ],
    },
  };
}
