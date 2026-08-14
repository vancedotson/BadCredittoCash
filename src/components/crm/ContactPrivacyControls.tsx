"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function postAction(contactId: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/crm/contact/${contactId}/privacy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? "Request failed.");
}

export function ContactPrivacyControls({ contactId, suppressed }: { contactId: string; suppressed: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  async function changeSuppression() {
    const verb = suppressed ? "allow future email" : "suppress all future email";
    if (!window.confirm(`Are you sure you want to ${verb} for this contact?`)) return;
    setPending(true);
    setError("");
    try {
      await postAction(contactId, { action: suppressed ? "unsuppress" : "suppress" });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update email suppression.");
    } finally {
      setPending(false);
    }
  }

  async function permanentlyDelete() {
    if (confirmation !== "DELETE CONTACT") return;
    if (!window.confirm("This cannot be undone. Permanently delete this contact and all related CRM records?")) return;
    setPending(true);
    setError("");
    try {
      await postAction(contactId, { action: "purge", confirmation });
      router.push("/crm/contacts");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not permanently delete this contact.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div>
        <a
          href={`/api/crm/contact/${contactId}/privacy`}
          className="inline-flex rounded-lg border border-mist bg-card px-3 py-2 font-medium text-body hover:border-trust"
        >
          Download complete contact data (JSON)
        </a>
        <p className="mt-1.5 text-xs text-slate">Includes CRM activity, notes, tasks, bookings, sequences, and email delivery events.</p>
      </div>

      <div className="border-t border-mist pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium text-body">Email status: {suppressed ? "Suppressed" : "Allowed"}</div>
            <p className="mt-1 text-xs text-slate">Suppressing cancels queued emails and stops active sequences. Allowing email again does not restart them.</p>
          </div>
          <button type="button" disabled={pending} onClick={changeSuppression} className="rounded-lg border border-mist px-3 py-2 font-medium text-body hover:border-trust disabled:opacity-50">
            {suppressed ? "Allow future email" : "Suppress future email"}
          </button>
        </div>
      </div>

      <div className="border-t border-red/30 pt-4">
        <div className="font-semibold text-red">Permanent deletion</div>
        <p className="mt-1 text-xs text-slate">This removes the contact, related CRM history, email records, and any recoverable Trash copy.</p>
        <label className="mt-3 block text-xs font-medium text-body" htmlFor={`delete-${contactId}`}>Type DELETE CONTACT to confirm</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input id={`delete-${contactId}`} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="min-w-[210px] rounded-lg border border-mist bg-card px-3 py-2 text-sm outline-none focus:border-red" />
          <button type="button" disabled={pending || confirmation !== "DELETE CONTACT"} onClick={permanentlyDelete} className="rounded-lg bg-red px-3 py-2 font-semibold text-white disabled:opacity-40">
            Permanently delete
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-red" role="alert">{error}</p> : null}
    </div>
  );
}
