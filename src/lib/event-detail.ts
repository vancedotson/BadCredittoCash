import { formatUsdCents } from "./payments-display";

type DetailEvent = {
  event: string;
  props?: Record<string, unknown>;
};

const stringValue = (value: unknown) => typeof value === "string" ? value.trim() : "";
const PAYMENT_EVENTS = new Set(["payment_request_created", "payment_received", "payment_failed", "payment_request_cancelled"]);

/** Plain text only: callers render this as React text, never as HTML. */
export function eventDetail(event: DetailEvent): string {
  const props = event.props ?? {};
  if (event.event === "live_question_asked") return stringValue(props.question);
  if (event.event === "quiz_completed") return [props.concern, props.tried, props.urgency].map(stringValue).filter(Boolean).join(" · ");
  if (event.event === "goal_replied" && stringValue(props.goal)) return `"${stringValue(props.goal)}"`;
  if (event.event === "call_booked" && stringValue(props.preferredTime)) return `Preferred: ${stringValue(props.preferredTime)}`;
  if (event.event === "email_queued" && stringValue(props.sequence)) return `Sequence: ${stringValue(props.sequence)}`;
  if (event.event === "webinar_registered" && stringValue(props.source)) return `Source: ${stringValue(props.source)}`;
  if (PAYMENT_EVENTS.has(event.event)) {
    const amount = typeof props.amountCents === "number" && Number.isInteger(props.amountCents) ? formatUsdCents(props.amountCents) : "";
    return [amount, stringValue(props.description)].filter(Boolean).join(" · ");
  }
  return "";
}

export function eventSessionId(event: DetailEvent): string {
  return stringValue(event.props?.sessionId);
}

export function eventSessionLabel(event: DetailEvent): string {
  const id = eventSessionId(event);
  return id ? `Session: ${stringValue(event.props?.sessionTitle) || id}` : "";
}

export function activityGroupKey(event: DetailEvent & { contactId?: string; email?: string; visitorId?: string; createdAt: string }): string {
  const eventName = event.event.startsWith("webinar_watch_") ? "webinar_watch_progress" : event.event;
  return JSON.stringify([event.contactId || event.email || event.visitorId || "anonymous", event.createdAt.slice(0, 10), eventName, eventSessionId(event), stringValue(event.props?.funnel)]);
}
