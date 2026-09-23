/** Marketing delivery is opt-in only; all unspecified values fail closed. */
export function marketingEmailsEnabled(): boolean {
  return process.env.MARKETING_EMAILS_ENABLED === "true";
}
