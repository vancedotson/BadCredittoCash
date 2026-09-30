import type { SequenceEmail } from "./sequences";

/**
 * Transactional payment-link email. Placeholder copy for owner review in
 * sandbox: plain, short, and neutral. Merge fields are filled in
 * src/lib/email.ts from the queued message payload.
 */
export const PAYMENT_REQUEST_EMAIL: SequenceEmail = {
  delay: "immediately",
  subject: "Payment request from Vance Dotson: {{payment_description}}",
  body: "Hi {{first_name}},\n\nHere is your secure payment link for {{payment_description}} ({{payment_amount}}):\n\n{{payment_link}}\n\nYou will enter your card on Authorize.net's secure payment page. Vance never sees or stores your card number. Authorize.net emails your receipt after payment.\n\nQuestions? Just reply to this email.\n\nVance Dotson",
};
