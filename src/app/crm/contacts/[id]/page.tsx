import Link from "next/link";
import { notFound } from "next/navigation";
import { hydrateStore, getContact } from "@/lib/store";
import { Card, SegmentBadge, Badge } from "@/components/crm/ui";
import { Timeline } from "@/components/crm/Timeline";
import { StageSelect, AddNoteForm, AddTaskForm, TaskItem } from "@/components/crm/mutations";
import { RecentPin } from "@/components/crm/RecentPin";
import { ContactPrivacyControls } from "@/components/crm/ContactPrivacyControls";
import { requireCrmUser } from "@/lib/auth";
import { getContactPrivacyState } from "@/lib/contact-privacy";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(dueDate: string | undefined, done: boolean): boolean {
  return !!dueDate && !done && new Date(dueDate).getTime() < Date.now();
}

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCrmUser();
  await hydrateStore();
  const { id } = await params;
  const detail = await getContact(id);
  if (!detail) notFound();
  const { contact, events, notes, tasks, sequences } = detail;
  const source = contact.utm?.utm_source ?? contact.source ?? "direct";
  const privacy = user.crmRole === "admin" ? await getContactPrivacyState(contact.id) : null;

  return (
    <div className="space-y-6">
      <Link href="/crm/contacts" className="inline-block text-sm text-trust hover:underline">
        &#8592; All contacts
      </Link>

      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-heading">{contact.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate">
              <span>{contact.email}</span>
              {contact.phone ? <span>{contact.phone}</span> : null}
              <span className="capitalize">Source: {source}</span>
              <span>Added {fmtDate(contact.createdAt)}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SegmentBadge segment={contact.segment} />
              {contact.owner ? <Badge tone="info">Owner: {contact.owner}</Badge> : null}
              {(contact.tags ?? []).map((t) => (
                <Badge key={t} tone="neutral">#{t}</Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <RecentPin id={contact.id} name={contact.name} />
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs uppercase tracking-wide text-slate">Stage</span>
                <StageSelect id={contact.id} stage={contact.stage} updatedAt={contact.updatedAt} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Activity */}
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-heading">Activity</h2>
          <AddNoteForm email={contact.email} />
          <div className="mt-5">
            <Timeline events={events} notes={notes} />
          </div>
        </Card>

        {/* Side: metrics + tasks */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-heading">Snapshot</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate">Watch progress</dt>
                <dd className="tabular-nums text-body">{contact.watchPct ? `${contact.watchPct}%` : "Not started"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate">Events</dt>
                <dd className="tabular-nums text-body">{contact.eventCount}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate">Booked a call</dt>
                <dd className="text-body">{contact.booked ? "Yes" : "No"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate">Sequences</dt>
                <dd className="text-right text-body">
                  {sequences.length ? sequences.map((s) => s.replace(/_/g, " ")).join(", ") : "—"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold text-heading">Tasks</h2>
            <AddTaskForm email={contact.email} />
            <ul className="mt-4 space-y-3">
              {tasks.length === 0 ? (
                <li className="text-sm text-slate">No tasks yet.</li>
              ) : (
                tasks.map((t) => (
                  <li key={t.id}>
                    <TaskItem task={t} overdue={isOverdue(t.dueDate, t.done)} />
                  </li>
                ))
              )}
            </ul>
          </Card>

          {privacy ? (
            <Card>
              <h2 className="mb-3 text-lg font-semibold text-heading">Privacy &amp; data</h2>
              <ContactPrivacyControls contactId={contact.id} suppressed={privacy.suppressed} />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
