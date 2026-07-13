/**
 * Email delivery seam (stub).
 *
 * Nothing actually sends yet — exactly like src/lib/supabase.ts, this is the one
 * place delivery lives so the rest of the funnel can be fully wired now and go
 * live later without changing a single caller. Today `enqueueSequence` /
 * `sendEmail` just record behaviour events (email_queued / email_sent) so the
 * dashboard shows the automation firing; swap the bodies for a real ESP later.
 *
 *   To go live with Resend (example):
 *     1. npm install resend
 *     2. RESEND_API_KEY in .env.local
 *     3. In sendEmail(): await resend.emails.send({ from, to: email, subject, html })
 *     4. In enqueueSequence(): schedule each SequenceEmail at its delay (a queue /
 *        cron), calling sendEmail for each. Keep recordEvent for observability.
 */

import { recordEvent } from "./store";
import { EVENTS } from "./events";
import { SEQUENCES, SEGMENT_SEQUENCES } from "@/config/sequences";

function resolveSequence(sequenceId: string) {
  return SEQUENCES[sequenceId] ?? SEGMENT_SEQUENCES[sequenceId];
}

/** Enqueue a whole sequence for a lead. Stub: records that it was queued. */
export async function enqueueSequence(
  email: string,
  sequenceId: string,
): Promise<void> {
  const seq = resolveSequence(sequenceId);
  if (!seq) {
    console.warn(`[email] unknown sequence "${sequenceId}" — skipping.`);
    return;
  }
  await recordEvent({
    event: EVENTS.emailQueued,
    email,
    props: { sequence: seq.id, name: seq.name, emails: seq.emails.length },
  });
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[email] queued "${seq.id}" (${seq.emails.length}) for ${email}`);
  }
}

/** Send a single email. Stub: records that it was sent. */
export async function sendEmail(
  email: string,
  msg: { subject: string; body?: string },
): Promise<void> {
  await recordEvent({
    event: EVENTS.emailSent,
    email,
    props: { subject: msg.subject },
  });
}
