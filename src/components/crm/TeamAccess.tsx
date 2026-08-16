"use client";

import { useState } from "react";
import type { CrmRole, TeamMember } from "@/lib/team-access";

const ROLES: Array<{ value: CrmRole; label: string }> = [
  { value: "admin", label: "Admin" }, { value: "staff", label: "Staff" }, { value: "readonly", label: "Read only" },
];

async function action(body: Record<string, unknown>) {
  const response = await fetch("/api/crm/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => null) as { error?: string; member?: TeamMember } | null;
  if (!response.ok) throw new Error(payload?.error ?? "Team access could not be changed.");
  return payload;
}

export function TeamAccess({ initialMembers, currentUserId }: { initialMembers: TeamMember[]; currentUserId: string }) {
  const [members, setMembers] = useState(initialMembers);
  const [form, setForm] = useState({ displayName: "", email: "", role: "staff" as CrmRole });
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setPending("invite"); setError(""); setMessage("");
    try {
      const payload = await action({ action: "invite", ...form });
      if (payload?.member) setMembers((current) => [...current, payload.member!]);
      setForm({ displayName: "", email: "", role: "staff" }); setMessage("Invitation sent.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Invitation failed."); } finally { setPending(null); }
  }

  async function changeRole(member: TeamMember, role: CrmRole) {
    setPending(member.userId); setError(""); setMessage("");
    try { await action({ action: "role", userId: member.userId, role }); setMembers((current) => current.map((item) => item.userId === member.userId ? { ...item, role } : item)); setMessage("Role updated."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Role update failed."); } finally { setPending(null); }
  }

  async function revoke(member: TeamMember) {
    if (!window.confirm(`Revoke CRM access for ${member.displayName}? They will no longer be able to sign in.`)) return;
    setPending(member.userId); setError(""); setMessage("");
    try { await action({ action: "revoke", userId: member.userId }); setMembers((current) => current.filter((item) => item.userId !== member.userId)); setMessage("Access revoked."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Access could not be revoked."); } finally { setPending(null); }
  }

  return (
    <div className="space-y-4">
      <div><h3 className="font-semibold text-heading">Login access</h3><p className="mt-1 text-sm text-slate">These people can sign in. CRM owners below are only assignment labels.</p></div>
      {error ? <p role="alert" className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg bg-green/10 px-3 py-2 text-sm text-green">{message}</p> : null}
      <ul className="divide-y divide-mist rounded-xl border border-mist">
        {members.map((member) => {
          const self = member.userId === currentUserId;
          return <li key={member.userId} className="flex flex-wrap items-center gap-3 px-3 py-3"><div className="min-w-0 flex-1"><div className="font-medium text-body">{member.displayName}{self ? " (you)" : ""}</div><div className="truncate text-xs text-slate">{member.email}</div></div><span className={`rounded-full px-2 py-1 text-xs ${member.status === "active" ? "bg-green/10 text-green" : "bg-gold/15 text-gold-deep"}`}>{member.status === "active" ? "Active" : "Invited"}</span><select aria-label={`Role for ${member.displayName}`} value={member.role} disabled={self || pending === member.userId} onChange={(event) => changeRole(member, event.target.value as CrmRole)} className="rounded-lg border border-mist bg-card px-2 py-1.5 text-xs text-body disabled:opacity-50">{ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select><button type="button" disabled={self || pending === member.userId} onClick={() => revoke(member)} className="text-xs font-medium text-red underline disabled:opacity-40">Revoke</button></li>;
        })}
      </ul>
      <form onSubmit={invite} className="grid gap-2 rounded-xl border border-mist bg-cloud p-3 sm:grid-cols-2">
        <input required aria-label="Invite name" placeholder="Name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} className="rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body" />
        <input required type="email" aria-label="Invite email" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body" />
        <select aria-label="Invite role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as CrmRole })} className="rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body">{ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select>
        <button type="submit" disabled={pending === "invite"} className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50">{pending === "invite" ? "Sending…" : "Invite team member"}</button>
      </form>
    </div>
  );
}
