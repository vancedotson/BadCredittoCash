import { SEQUENCES, SEGMENT_SEQUENCES } from "@/config/sequences";
import { isLiveEmailTemplate, isLiveMarketingTemplate } from "@/config/live-sequences";
import { OUTBOUND_EMAIL_POLICY_CANCELLATION_REASON } from "@/config/email-policy";
import { evergreenTrainingEnabled } from "./evergreen-training";
import { marketingEmailsEnabled } from "./marketing-emails";
import { paymentsEnabled } from "./authorize-net-config";

export { OUTBOUND_EMAIL_POLICY_CANCELLATION_REASON };

export type OutboundEmailCategory = "booking" | "evergreen" | "marketing" | "live" | "payment" | "unknown";
export type OutboundEmailDecision = {
  allowed: boolean;
  category: OutboundEmailCategory;
  marketing: boolean;
  reason: "allowed" | "training_disabled" | "marketing_disabled" | "live_disabled" | "live_email_unapproved" | "payments_disabled" | "unknown_template";
};

const BOOKING_UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const PAYMENT_TEMPLATE = /^payment_request:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Transactional payment-link email: payment_request:<request uuid>:<message uuid>. */
export function isPaymentRequestTemplate(templateKey: string): boolean {
  return PAYMENT_TEMPLATE.test(templateKey);
}
const EVERGREEN_SEQUENCE_IDS = new Set([
  "pre_webinar",
  "registered_no_show",
  "low_watch",
  "mid_watch",
  "high_watch",
]);
const sequences = { ...SEQUENCES, ...SEGMENT_SEQUENCES };

function classifyTemplate(templateKey: string): { category: OutboundEmailCategory; marketing: boolean } {
  if (isLiveEmailTemplate(templateKey)) {
    return { category: "live", marketing: isLiveMarketingTemplate(templateKey) };
  }

  if (new RegExp(`^booking_(?:rescheduled|reminder|cancelled):${BOOKING_UUID}:${BOOKING_UUID}$`, "i").test(templateKey)) {
    return { category: "booking", marketing: false };
  }

  if (isPaymentRequestTemplate(templateKey)) return { category: "payment", marketing: false };

  const match = templateKey.match(/^([a-z0-9_]+):([1-9]\d*)(?::([0-9a-f-]{36}))?$/i);
  if (!match) return { category: "unknown", marketing: false };

  const [, sequenceId, indexText, suffix] = match;
  const sequence = sequences[sequenceId];
  const index = Number(indexText);
  if (!sequence || index > sequence.emails.length || (suffix && sequenceId !== "onboarding")) {
    return { category: "unknown", marketing: false };
  }

  if (sequenceId === "onboarding") return { category: "booking", marketing: false };
  if (EVERGREEN_SEQUENCE_IDS.has(sequenceId)) return { category: "evergreen", marketing: true };
  return { category: "marketing", marketing: true };
}

export function outboundEmailDecision(templateKey: string): OutboundEmailDecision {
  const { category, marketing } = classifyTemplate(templateKey);

  if (category === "unknown") {
    return { allowed: false, category, marketing: false, reason: "unknown_template" };
  }
  if (category === "booking") {
    return { allowed: true, category, marketing: false, reason: "allowed" };
  }
  if (category === "payment") {
    return paymentsEnabled()
      ? { allowed: true, category, marketing: false, reason: "allowed" }
      : { allowed: false, category, marketing: false, reason: "payments_disabled" };
  }
  if (category === "live") {
    if (process.env.LIVE_WEBINAR_ENABLED !== "true") {
      return { allowed: false, category, marketing, reason: "live_disabled" };
    }
    if (process.env.LIVE_WEBINAR_EMAILS_APPROVED !== "true") {
      return { allowed: false, category, marketing, reason: "live_email_unapproved" };
    }
    if (marketing && !marketingEmailsEnabled()) {
      return { allowed: false, category, marketing, reason: "marketing_disabled" };
    }
    return { allowed: true, category, marketing, reason: "allowed" };
  }
  if (category === "evergreen" && !evergreenTrainingEnabled()) {
    return { allowed: false, category, marketing, reason: "training_disabled" };
  }
  if (!marketingEmailsEnabled()) {
    return { allowed: false, category, marketing, reason: "marketing_disabled" };
  }
  return { allowed: true, category, marketing, reason: "allowed" };
}

export function isOutboundEmailAllowed(templateKey: string): boolean {
  return outboundEmailDecision(templateKey).allowed;
}

export function isOutboundEmailMarketing(templateKey: string): boolean {
  return classifyTemplate(templateKey).marketing;
}
