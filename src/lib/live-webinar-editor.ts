import { liveDateInput } from "./live-webinar-display";
import type { LiveWebinarSession } from "./live-webinar-types";

export type SessionDraft = {
  id?: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: LiveWebinarSession["status"];
  embedUrl: string;
  replayUrl: string;
  replayPublished: boolean;
  replayAvailableUntil: string;
  automationEnabled: boolean;
};

export function draftOf(session: LiveWebinarSession | null, date?: string, timezone = "America/Chicago"): SessionDraft {
  if (!session) return {
    slug: "", title: "", startsAt: date ? `${date}T12:00` : "", endsAt: date ? `${date}T13:00` : "",
    timezone, status: "draft", embedUrl: "", replayUrl: "", replayPublished: false,
    replayAvailableUntil: "", automationEnabled: false,
  };
  return {
    id: session.id, slug: session.slug, title: session.title,
    startsAt: liveDateInput(session.startsAt, session.timezone),
    endsAt: liveDateInput(session.endsAt, session.timezone),
    timezone: session.timezone, status: session.status,
    embedUrl: session.embedUrl ?? "", replayUrl: session.replayUrl ?? "",
    replayPublished: session.replayPublished,
    replayAvailableUntil: liveDateInput(session.replayAvailableUntil, session.timezone),
    automationEnabled: session.automationEnabled,
  };
}

export function suggestSessionSlug(title: string, startsAt: string): string {
  const normalized = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!normalized) return "";
  const date = /^(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))(?=T|$)/.exec(startsAt)?.[1];
  const suffix = date ? `-${date}` : "";
  return normalized.slice(0, 80 - suffix.length).replace(/-+$/g, "") + suffix;
}

export function updateSessionDraft<K extends keyof SessionDraft>(current: SessionDraft, key: K, value: SessionDraft[K], manualSlug: boolean): SessionDraft {
  const next = { ...current, [key]: value };
  if (!current.id && !manualSlug && (key === "title" || key === "startsAt")) {
    next.slug = suggestSessionSlug(next.title, next.startsAt);
  }
  return next;
}
