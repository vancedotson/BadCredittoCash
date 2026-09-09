import { CREDIT_CHECK_QUESTIONS } from "@/config/credit-check";
import type { QuizAnswers } from "@/config/collector-quiz";

export type CreditCheckFieldErrors = Partial<Record<"name" | "email" | "phone" | "answers", string>>;

export type CreditCheckSubmission = {
  name: string;
  email: string;
  phone: string;
  answers: QuizAnswers;
  turnstileToken?: string;
  visitorId?: string;
  attribution: { firstTouch: Record<string, string>; lastTouch: Record<string, string> };
};

type ValidationResult =
  | { ok: true; value: CreditCheckSubmission }
  | { ok: false; error: string; fieldErrors?: CreditCheckFieldErrors };

const BODY_KEYS = new Set(["name", "email", "phone", "answers", "turnstileToken", "visitorId", "attribution"]);
const TOUCH_KEYS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "ref", "gclid", "fbclid", "msclkid", "ttclid", "landing_page", "referrer",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanTouch(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const touch: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    // Attribution is best-effort. The site's tracking helper may include extra
    // utm_* fields or older stored values; these must not prevent a valid lead.
    if (!TOUCH_KEYS.has(key) || typeof entry !== "string" || entry.length > 2000) continue;
    touch[key] = entry;
  }
  return touch;
}

export function normalizeCreditCheckPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > 40 || !/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+") && digits.length === 10) return `+1${digits}`;
  if (!trimmed.startsWith("+") && digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (trimmed.startsWith("+") && /^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  return null;
}

export function validateCreditCheckSubmission(body: unknown): ValidationResult {
  if (!isRecord(body) || Object.keys(body).some((key) => !BODY_KEYS.has(key))) {
    return { ok: false, error: "Invalid submission. Please refresh and try again." };
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = normalizeCreditCheckPhone(body.phone);
  const fieldErrors: CreditCheckFieldErrors = {};
  if (name.length < 2 || name.length > 160 || /[\u0000-\u001f\u007f]/.test(name)) {
    fieldErrors.name = "Please enter your name (2–160 characters).";
  }
  if (email.length > 320 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fieldErrors.email = "Please enter a valid email address.";
  }
  if (!phone) fieldErrors.phone = "Enter a valid phone number with an area or country code.";

  const answers: QuizAnswers = {};
  const inputAnswers = body.answers;
  const questionIds = new Set(CREDIT_CHECK_QUESTIONS.map((question) => question.id));
  if (!isRecord(inputAnswers) || Object.keys(inputAnswers).some((key) => !questionIds.has(key))) {
    fieldErrors.answers = "Please complete all five questions.";
  } else {
    for (const question of CREDIT_CHECK_QUESTIONS) {
      const answer = inputAnswers[question.id];
      if (question.type === "multi") {
        if (!Array.isArray(answer) || answer.length === 0 || answer.length > question.options.length
          || answer.some((option) => typeof option !== "string" || !question.options.includes(option))
          || new Set(answer).size !== answer.length) {
          fieldErrors.answers = "Please complete all five questions using the options shown.";
        } else {
          answers[question.id] = [...answer];
        }
      } else if (typeof answer !== "string" || !question.options.includes(answer)) {
        fieldErrors.answers = "Please complete all five questions using the options shown.";
      } else {
        answers[question.id] = answer;
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  if (body.turnstileToken !== undefined && (typeof body.turnstileToken !== "string" || body.turnstileToken.length > 2048)) {
    return { ok: false, error: "Invalid security check. Please refresh and try again." };
  }
  if (body.visitorId !== undefined && (typeof body.visitorId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(body.visitorId))) {
    return { ok: false, error: "Invalid visitor details. Please refresh and try again." };
  }
  const attribution = isRecord(body.attribution) ? body.attribution : undefined;
  const firstTouch = cleanTouch(attribution?.firstTouch);
  const lastTouch = cleanTouch(attribution?.lastTouch);

  return {
    ok: true,
    value: {
      name,
      email,
      phone: phone!,
      answers,
      turnstileToken: body.turnstileToken as string | undefined,
      visitorId: body.visitorId as string | undefined,
      attribution: { firstTouch, lastTouch },
    },
  };
}
