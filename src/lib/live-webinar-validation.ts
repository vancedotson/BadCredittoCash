import { isCloudflareWhepUrl, isLivePlayerUrl, isTimezone, isUuid, type LiveWebinarSession } from "./live-webinar-types";

export type LiveWebinarSessionInput = Omit<LiveWebinarSession, "id" | "scheduleVersion"> & { id?: string };

export function isLivePreviewRequest(request: Request, body: Record<string, unknown> = {}): boolean {
  if (body.preview === true || (body.props && typeof body.props === "object" && (body.props as Record<string, unknown>).preview === true)) return true;
  for (const address of [request.url, request.headers.get("referer")]) {
    if (!address) continue;
    try { const params = new URL(address).searchParams; if (params.get("preview") === "1" || params.has("state")) return true; } catch { /* An invalid referrer carries no preview state. */ }
  }
  return false;
}

export function validateLiveSessionInput(value: unknown): { session?: LiveWebinarSessionInput; error?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Session details are required." };
  const input = value as Record<string, unknown>;
  if (input.id !== undefined && !isUuid(input.id)) return { error: "Invalid session ID." };
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const slug = typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
  if (title.length < 3 || title.length > 160) return { error: "Use a session title between 3 and 160 characters." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return { error: "Use a short session slug with letters, numbers, and hyphens." };
  if (!isTimezone(input.timezone)) return { error: "Choose a valid timezone." };
  if (input.status !== "draft" && input.status !== "scheduled" && input.status !== "cancelled") return { error: "Choose a valid session status." };
  const start = typeof input.startsAt === "string" ? new Date(input.startsAt) : new Date(NaN);
  const end = typeof input.endsAt === "string" ? new Date(input.endsAt) : new Date(NaN);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 86_400_000) return { error: "Set a valid start and end, no more than 24 hours apart." };
  const embedUrl = typeof input.embedUrl === "string" && input.embedUrl.trim() ? input.embedUrl.trim() : null;
  if (embedUrl && !isLivePlayerUrl(embedUrl)) return { error: "Use a supported HTTPS live player URL." };
  const streamProvider = input.streamProvider === "cloudflare" ? "cloudflare" : "external";
  const cloudflareLiveInputId = typeof input.cloudflareLiveInputId === "string" ? input.cloudflareLiveInputId : null;
  if (input.status === "scheduled" && (!embedUrl || streamProvider !== "cloudflare"
    || !cloudflareLiveInputId || !isCloudflareWhepUrl(embedUrl, cloudflareLiveInputId))) {
    return { error: "Prepare a private Cloudflare Stream live input before scheduling this session." };
  }
  if (streamProvider === "cloudflare" && (!cloudflareLiveInputId || !isCloudflareWhepUrl(embedUrl ?? "", cloudflareLiveInputId))) {
    return { error: "The Cloudflare live input is incomplete. Prepare it again before saving." };
  }
  if (input.replayPublished === true || (typeof input.replayUrl === "string" && input.replayUrl.trim())
    || (typeof input.replayAvailableUntil === "string" && input.replayAvailableUntil.trim())) {
    return { error: "Live webinar recordings and replays are disabled." };
  }
  return { session: { id: input.id as string | undefined, title, slug, startsAt: start.toISOString(), endsAt: end.toISOString(), timezone: input.timezone,
    status: input.status, embedUrl, replayUrl: null, replayPublished: false, replayAvailableUntil: null,
    automationEnabled: input.automationEnabled === true, streamProvider, cloudflareLiveInputId } };
}
