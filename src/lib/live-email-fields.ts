import "server-only";

import { createLiveParticipantToken } from "./live-webinar-token";
import { isUuid, isTimezone } from "./live-webinar-types";

export type LiveMessagePayload = {
  registrationId?: string; sessionId?: string; accessVersion?: number; sessionVersion?: number;
  title?: string; startsAt?: string; endsAt?: string; timezone?: string;
  replayAvailableUntil?: string | null; sendDeadline?: string | null;
};

export function mergeLiveEmailFields(value: string, payload: LiveMessagePayload, baseUrl: string): string {
  const start = new Date(payload.startsAt ?? "").getTime();
  const end = new Date(payload.endsAt ?? "").getTime();
  const expiry = payload.replayAvailableUntil ? new Date(payload.replayAvailableUntil).getTime() : null;
  const deadline = payload.sendDeadline ? new Date(payload.sendDeadline).getTime() : null;
  if (!isUuid(payload.registrationId) || !isUuid(payload.sessionId) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start
    || typeof payload.title !== "string" || !payload.title.trim() || !isTimezone(payload.timezone)
    || !Number.isInteger(payload.accessVersion) || Number(payload.accessVersion) < 1
    || (deadline !== null && !Number.isFinite(deadline))
    || (expiry !== null && (!Number.isFinite(expiry) || expiry <= end))) throw new Error("Live email is missing valid session context.");
  // All inputs are durable queue values, keeping the provider request identical on retry.
  const expiresAt = Math.max(end + 90 * 86_400_000, expiry === null ? 0 : expiry + 86_400_000, deadline === null ? 0 : deadline + 86_400_000);
  const token = createLiveParticipantToken({ registrationId: payload.registrationId, sessionId: payload.sessionId, accessVersion: Number(payload.accessVersion), expiresAt });
  const join = `${baseUrl}/api/live/join?token=${encodeURIComponent(token)}`;
  const calendar = `${baseUrl}/api/live/calendar?session=${encodeURIComponent(payload.sessionId)}`;
  const expired = payload.replayAvailableUntil
    ? `Available until ${new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: payload.timezone || "UTC" }).format(new Date(payload.replayAvailableUntil))} (${payload.timezone || "UTC"}).`
    : "No expiry date is currently set.";
  return value.replaceAll("{{session_title}}", payload.title)
    .replaceAll("{{join_link}}", join).replaceAll("{{replay_link}}", `${join}&replay=1`)
    .replaceAll("{{calendar_link}}", calendar).replaceAll("{{replay_expiry}}", expired)
    .replaceAll("{{call_link}}", `${baseUrl}/live/call?session=${encodeURIComponent(payload.sessionId)}`);
}
