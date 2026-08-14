import Link from "next/link";
import { hydrateStore, getSettings, getOwnerWorkloads, listOwners, listTagsWithCounts, getStoreStatus, getSettingsInsights, listTrashedContacts } from "@/lib/store";
import { SEGMENT_LABELS } from "@/lib/segments";
import { SEQUENCES, SEGMENT_SEQUENCES } from "@/config/sequences";
import { PageTitle, Card, StageBadge, SegmentBadge } from "@/components/crm/ui";
import { ProfileForm, OwnerManager, TagManager, AppearanceForm, NotificationForm, DataManagement, ContactTrash } from "@/components/crm/SettingsClient";
import { getGoogleCalendarStatus } from "@/lib/google-calendar";
import { requireCrmUser } from "@/lib/auth";
import { listAdminAuditEvents } from "@/lib/audit";

export const dynamic = "force-dynamic";

const SEG_DEFS: Record<string, string> = {
  booked: "Booked the strategy call. Converted — no pitch sequences.",
  booking_abandon: "Started booking but didn't finish. High-intent rescue.",
  offer_click_no_book: "Clicked the offer CTA but never started booking.",
  high_watch: "Watched 50 to 90% (or completed). Warmest non-bookers.",
  mid_watch: "Watched 25 to 50%. Saw the problem, not yet the fix.",
  low_watch: "Opened the room but watched under 25%.",
  registered_no_show: "Registered but never opened the training.",
  lead: "Fallback — only a page view, no real engagement yet.",
};

const NAV = [
  { id: "profile", label: "Business profile" },
  { id: "team", label: "Team" },
  { id: "tags", label: "Tags" },
  { id: "pipeline", label: "Pipeline" },
  { id: "segments", label: "Segments" },
  { id: "sequences", label: "Sequences" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
  { id: "calendar", label: "Calendar" },
  { id: "audit", label: "Audit history" },
  { id: "trash", label: "Trash" },
  { id: "data", label: "Data" },
];

export default async function SettingsPage() {
  const user = await requireCrmUser();
  await hydrateStore();
  const [settings, workloads, owners, tags, status, insights, calendar, auditEvents, trashedContacts] = await Promise.all([
    getSettings(), getOwnerWorkloads(), listOwners(), listTagsWithCounts(), getStoreStatus(), getSettingsInsights(), getGoogleCalendarStatus(),
    user.crmRole === "admin" ? listAdminAuditEvents(50) : Promise.resolve([]),
    user.crmRole === "admin" ? listTrashedContacts() : Promise.resolve([]),
  ]);
  const settingsNav = user.crmRole === "admin" ? NAV : NAV.filter((item) => item.id !== "audit");
  const allSeq = [...Object.values(SEQUENCES), ...Object.values(SEGMENT_SEQUENCES)];
  const maxStage = Math.max(1, ...insights.stages.map((s) => s.count));

  return (
    <div className="space-y-6">
      <PageTitle title="Settings" subtitle="Configure the business profile, team, tags, and preferences. Stages, segments, and sequences are code-defined and shown here for reference." />

      <nav className="sticky top-2 z-10 -mx-1 flex flex-wrap gap-1.5 rounded-xl border border-mist bg-card/90 p-1.5 backdrop-blur">
        {settingsNav.map((n) => (
          <a key={n.id} href={`#${n.id}`} className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate hover:bg-cloud hover:text-body">{n.label}</a>
        ))}
      </nav>

      {/* Business profile */}
      <section id="profile" className="scroll-mt-16">
        <Card>
          <h2 className="mb-1 text-lg font-semibold text-heading">Business profile</h2>
          <p className="mb-4 text-sm text-slate">Identity and links used across the CRM. The booking and training links fill the merge fields in every sequence.</p>
          <ProfileForm profile={settings.profile} />
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Team */}
        <section id="team" className="scroll-mt-16">
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-heading">Team &amp; owners</h2>
            <OwnerManager workloads={workloads} defaultOwner={settings.defaultOwner} ownerNames={owners} />
          </Card>
        </section>

        {/* Tags */}
        <section id="tags" className="scroll-mt-16">
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-heading">Tags</h2>
            <TagManager tags={tags} />
          </Card>
        </section>
      </div>

      {/* Pipeline */}
      <section id="pipeline" className="scroll-mt-16">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-heading">Pipeline stages</h2>
            <span className="text-xs text-slate">Configured in code · win probability &amp; live counts</span>
          </div>
          <ul className="space-y-2">
            {insights.stages.map((s) => (
              <li key={s.stage} className="flex items-center gap-3">
                <div className="w-28 shrink-0"><StageBadge stage={s.stage} /></div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-cloud">
                  <div className="h-full rounded-full bg-trust" style={{ width: `${Math.round((s.count / maxStage) * 100)}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right text-sm text-body">{s.count}</span>
                <span className="w-16 shrink-0 text-right text-xs text-slate">{Math.round(s.probability * 100)}% win</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 mb-2 text-xs font-medium uppercase tracking-wide text-slate">Lost reasons</div>
          <div className="flex flex-wrap gap-2">
            {insights.lostReasons.map((r) => (
              <span key={r.reason} className="rounded-lg bg-cloud px-3 py-1.5 text-sm text-slate">{r.reason}{r.count > 0 ? <span className="ml-1 text-body">· {r.count}</span> : null}</span>
            ))}
          </div>
        </Card>
      </section>

      {/* Segments */}
      <section id="segments" className="scroll-mt-16">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-heading">Segments</h2>
            <span className="text-xs text-slate">Derived from behavior · live counts</span>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {insights.segments.map((s) => (
              <li key={s.segment} className="rounded-xl border border-mist p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <SegmentBadge segment={s.segment} />
                  <span className="text-sm font-medium text-body">{s.count}</span>
                </div>
                <p className="text-xs text-slate">{SEG_DEFS[s.segment] ?? SEGMENT_LABELS[s.segment]}</p>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Sequences */}
      <section id="sequences" className="scroll-mt-16">
        <Card>
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-heading">Email sequences</h2>
            <Link href="/crm/sequences" className="text-sm font-medium text-trust hover:underline">Open Sequences →</Link>
          </div>
          <p className="mb-4 text-sm text-slate">Content lives in <code>src/config/sequences.ts</code>; delivery is stubbed behind a seam.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allSeq.map((s) => (
              <div key={s.id} className="rounded-xl border border-mist bg-cloud px-3 py-2.5">
                <div className="text-sm font-medium text-body">{s.name}</div>
                <div className="text-xs text-slate">{s.emails.length} email{s.emails.length === 1 ? "" : "s"}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Appearance */}
        <section id="appearance" className="scroll-mt-16">
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-heading">Appearance &amp; defaults</h2>
            <AppearanceForm prefs={settings.prefs} />
          </Card>
        </section>

        {/* Notifications */}
        <section id="notifications" className="scroll-mt-16">
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-heading">Notifications</h2>
            <NotificationForm notify={settings.prefs.notify} />
          </Card>
        </section>
      </div>

      <section id="calendar" className="scroll-mt-16">
        <Card>
          <h2 className="mb-1 text-lg font-semibold text-heading">Google Calendar</h2>
          <p className="mb-4 text-sm text-slate">
            Checks real availability and keeps strategy-call appointments synchronized.
          </p>
          {calendar.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mist bg-cloud p-4">
              <div>
                <div className="font-medium text-body">Connected</div>
                <div className="text-sm text-slate">{calendar.accountEmail} · {calendar.timezone}</div>
              </div>
              <a href="/api/integrations/google-calendar/connect" className="rounded-lg border border-mist bg-card px-4 py-2 text-sm font-medium text-body hover:bg-white">
                Reconnect
              </a>
            </div>
          ) : (
            <a href="/api/integrations/google-calendar/connect" className="inline-flex rounded-lg bg-trust px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Connect Google Calendar
            </a>
          )}
        </Card>
      </section>

      {user.crmRole === "admin" ? <section id="audit" className="scroll-mt-16">
        <Card>
          <h2 className="mb-1 text-lg font-semibold text-heading">Audit history</h2>
          <p className="mb-4 text-sm text-slate">The 50 most recent administrative CRM changes. Entries are append-only and timestamped by the server.</p>
          {auditEvents.length ? <ul className="divide-y divide-mist rounded-xl border border-mist">
            {auditEvents.map((event) => <li key={event.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><span className="font-medium text-body">{event.action.replaceAll("_", " ").replaceAll(".", " · ")}</span><span className="text-slate"> by {event.actorName}</span></div>
                <time className="text-xs text-slate" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</time>
              </div>
              <div className="mt-1 text-xs text-slate">{event.entityType}{event.entityId ? ` · ${event.entityId}` : ""}</div>
              {event.beforeState || event.afterState ? <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-trust">View recorded changes</summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-cloud p-3 text-[11px] text-body">{JSON.stringify({ before: event.beforeState, after: event.afterState }, null, 2)}</pre>
              </details> : null}
            </li>)}
          </ul> : <p className="rounded-xl border border-mist bg-cloud p-4 text-sm text-slate">No administrative changes recorded yet.</p>}
        </Card>
      </section> : null}

      {user.crmRole === "admin" ? <section id="trash" className="scroll-mt-16">
        <Card>
          <h2 className="mb-1 text-lg font-semibold text-heading">Contact trash</h2>
          <ContactTrash contacts={trashedContacts} />
        </Card>
      </section> : null}

      {/* Data */}
      <section id="data" className="scroll-mt-16">
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-heading">Data management</h2>
          <DataManagement status={status} />
        </Card>
      </section>
    </div>
  );
}
