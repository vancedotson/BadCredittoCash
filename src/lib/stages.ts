/**
 * CRM pipeline stages — the sales-managed status of a contact, distinct from the
 * behavioral `Segment` (which is derived purely from events in segments.ts).
 *
 * A contact's stage defaults from their furthest event (stageFromEvents) but can
 * be set manually in the CRM (e.g. moved to "Client" after the call, or "Lost").
 * Kept here as a small config so the pipeline columns are easy to adjust.
 */

export type Stage = "new" | "registered" | "engaged" | "booked" | "won" | "lost";

export type Tone = "neutral" | "info" | "active" | "success" | "warn" | "danger";

export const STAGES_IN_ORDER: Stage[] = [
  "new",
  "registered",
  "engaged",
  "booked",
  "won",
  "lost",
];

export const STAGE_LABELS: Record<Stage, string> = {
  new: "New",
  registered: "Registered",
  engaged: "Engaged",
  booked: "Call booked",
  won: "Client",
  lost: "Lost",
};

export const STAGE_TONES: Record<Stage, Tone> = {
  new: "neutral",
  registered: "info",
  engaged: "active",
  booked: "success",
  won: "success",
  lost: "danger",
};

/** Active pipeline (the working board) vs closed outcomes (Won/Lost). */
export const ACTIVE_STAGES: Stage[] = ["new", "registered", "engaged", "booked"];
export const CLOSED_STAGES: Stage[] = ["won", "lost"];

/** Rough win probability per stage — powers the weighted forecast. */
export const STAGE_PROBABILITY: Record<Stage, number> = {
  new: 0.05,
  registered: 0.15,
  engaged: 0.35,
  booked: 0.65,
  won: 1,
  lost: 0,
};

/** Treat blank or legacy database values as unset instead of crashing CRM views. */
export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && STAGES_IN_ORDER.includes(value as Stage);
}

/** Preset reasons captured when a contact is moved to Lost. */
export const LOST_REASONS = [
  "No-show",
  "Not a fit",
  "Went silent",
  "Chose someone else",
  "Not ready yet",
  "Bad contact info",
  "Other",
];

/**
 * Default pipeline stage from a contact's fired event names. Manual `stage` on
 * the Lead overrides this. "won"/"lost" are never auto-assigned (human calls).
 */
export function stageFromEvents(eventNames: string[]): Stage {
  const has = (needle: string) => eventNames.some((e) => e === needle);
  const hasPrefix = (p: string) => eventNames.some((e) => e.startsWith(p));

  if (has("call_booked")) return "booked";
  if (
    hasPrefix("webinar_watch") ||
    has("webinar_room_opened") ||
    has("webinar_completed") ||
    has("quiz_started") ||
    has("quiz_completed") ||
    has("offer_cta_clicked") ||
    has("call_booking_started")
  )
    return "engaged";
  if (has("webinar_registered") || has("webinar_confirmed_view"))
    return "registered";
  return "new";
}
