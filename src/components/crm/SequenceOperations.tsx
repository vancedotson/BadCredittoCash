"use client";

import { useState } from "react";
import Link from "next/link";
import { SEQUENCES, SEGMENT_SEQUENCES } from "@/config/sequences";
import type { SequenceEnrollment, SequenceFailure } from "@/lib/store";
import { Card } from "@/components/crm/ui";

const sequenceNames: Record<string, string> = Object.fromEntries(
  [...Object.values(SEQUENCES), ...Object.values(SEGMENT_SEQUENCES)].map((sequence) => [sequence.id, sequence.name]),
);

async function act(body: Record<string, string>) {
  const response = await fetch("/api/crm/sequences", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? "The sequence action failed.");
  }
}

export function SequenceOperations({ initialEnrollments, initialFailures }: { initialEnrollments: SequenceEnrollment[]; initialFailures: SequenceFailure[] }) {
  const [enrollments, setEnrollments] = useState(initialEnrollments);
  const [failures, setFailures] = useState(initialFailures);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function toggle(enrollment: SequenceEnrollment) {
    const action = enrollment.status === "active" ? "pause" : "resume";
    setPending(enrollment.id); setError(""); setMessage("");
    try {
      await act({ action, enrollmentId: enrollment.id });
      const status = action === "pause" ? "paused" as const : "active" as const;
      setEnrollments((current) => current.map((item) => item.id === enrollment.id ? { ...item, status } : item));
      setMessage(action === "pause" ? "Sequence paused. Scheduled email is held." : "Sequence resumed. Scheduled email can send again.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The sequence could not be changed.");
    } finally { setPending(null); }
  }

  async function retry(failure: SequenceFailure) {
    if (!window.confirm(`Retry ${failure.templateKey} for ${failure.contactName}? This queues the email to send again.`)) return;
    setPending(failure.id); setError(""); setMessage("");
    try {
      await act({ action: "retry", messageId: failure.id });
      setFailures((current) => current.filter((item) => item.id !== failure.id));
      setMessage("Failed email queued for retry.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The email could not be retried.");
    } finally { setPending(null); }
  }

  return (
    <div className="space-y-6">
      {message ? <p role="status" className="rounded-xl border border-green/30 bg-green/10 px-4 py-3 text-sm text-green">{message}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">{error}</p> : null}

      <Card>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-heading">Enrollment queue</h2><p className="mt-1 text-xs text-slate">Pause holds scheduled email. Resume lets the queue continue.</p></div>
          <span className="rounded-full bg-mist/70 px-2.5 py-1 text-xs font-medium text-slate">{enrollments.length} shown</span>
        </div>
        {enrollments.length === 0 ? <p className="text-sm text-slate">No active or paused enrollments.</p> : (
          <div className="divide-y divide-mist overflow-hidden rounded-xl border border-mist">
            {enrollments.map((enrollment) => (
              <div key={enrollment.id} className="grid gap-2 bg-card px-4 py-3 text-sm md:grid-cols-[1.1fr_1.2fr_auto] md:items-center md:gap-4">
                <div><Link href={`/crm/contacts/${enrollment.contactId}`} className="font-medium text-heading hover:text-trust hover:underline">{enrollment.contactName}</Link><div className="text-xs text-slate">{enrollment.email}</div></div>
                <div><div className="text-body">{sequenceNames[enrollment.sequenceKey] ?? enrollment.sequenceKey}</div><div className="mt-0.5 text-xs text-slate">{enrollment.scheduledMessages} scheduled{enrollment.nextScheduledAt ? ` · next ${new Date(enrollment.nextScheduledAt).toLocaleString()}` : ""}</div></div>
                <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-medium ${enrollment.status === "active" ? "bg-green/10 text-green" : "bg-gold/15 text-gold-deep"}`}>{enrollment.status === "active" ? "Active" : "Paused"}</span><button type="button" disabled={pending === enrollment.id} onClick={() => toggle(enrollment)} className="rounded-lg border border-mist px-3 py-1.5 text-xs font-medium text-body hover:bg-cloud disabled:opacity-50">{enrollment.status === "active" ? "Pause" : "Resume"}</button></div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {failures.length > 0 ? (
        <Card>
          <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-heading">Permanent failures</h2><p className="mt-1 text-xs text-slate">Retry only after the address or provider problem is fixed.</p></div><span className="rounded-full bg-red/10 px-2.5 py-1 text-xs font-medium text-red">Needs attention</span></div>
          <div className="divide-y divide-mist overflow-hidden rounded-xl border border-mist">
            {failures.map((failure) => (
              <div key={failure.id} className="grid gap-2 bg-card px-4 py-3 text-sm md:grid-cols-[1.1fr_1fr_auto] md:items-center md:gap-4">
                <div>{failure.contactId ? <Link href={`/crm/contacts/${failure.contactId}`} className="font-medium text-heading hover:text-trust hover:underline">{failure.contactName}</Link> : <div className="font-medium text-heading">{failure.contactName}</div>}<div className="text-xs text-slate">{failure.email}</div></div>
                <div><div className="text-body">{failure.templateKey} · {failure.attempts} attempts</div><div className="mt-0.5 line-clamp-2 text-xs text-red">{failure.error}</div></div>
                <button type="button" disabled={pending === failure.id} onClick={() => retry(failure)} className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-ink hover:bg-gold-deep disabled:opacity-50">Retry email</button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
