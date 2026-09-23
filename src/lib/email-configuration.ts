export type BookingEmailConfiguration = {
  from: string;
  replyTo: string;
};

const LOCAL_PART = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

function isMailbox(value: string): boolean {
  const at = value.lastIndexOf("@");
  if (at < 1 || at !== value.indexOf("@")) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length > 64 || !LOCAL_PART.test(local) || domain.length > 253) return false;
  const labels = domain.split(".");
  return labels.length >= 2 && labels.every((label) => label.length <= 63 && DOMAIN_LABEL.test(label));
}

function isSender(value: string): boolean {
  const wrapped = value.match(/^([^<>\r\n]+?)\s*<([^<>\r\n]+)>$/);
  if (wrapped) return Boolean(wrapped[1].trim()) && isMailbox(wrapped[2].trim());
  return isMailbox(value);
}

export function getBookingEmailConfiguration(
  env: Readonly<Record<string, string | undefined>> = process.env,
): BookingEmailConfiguration | null {
  const from = env.EMAIL_FROM?.trim();
  const replyTo = env.EMAIL_REPLY_TO?.trim();
  if (!from || !isSender(from) || !replyTo || !isMailbox(replyTo)) return null;
  return { from, replyTo };
}

export function isBookingEmailConfigurationReady(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return getBookingEmailConfiguration(env) !== null;
}
