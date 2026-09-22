export const EMAIL_MODE_UNAVAILABLE_ERROR = "This service is temporarily unavailable. Please try again later.";

export function isProductionEmailMode(): boolean {
  return process.env.EMAIL_MODE === "production";
}

export function emailModeUnavailableResponse(): Response {
  return Response.json(
    { error: EMAIL_MODE_UNAVAILABLE_ERROR },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "300",
      },
    },
  );
}
