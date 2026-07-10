import {
  getDashboardStats,
  listLeads,
  listEvents,
} from "@/lib/store";

// Always render fresh — this data changes as registrations come in.
export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const [stats, leads, events] = await Promise.all([
    getDashboardStats(),
    listLeads(),
    listEvents(10),
  ]);

  const tiles = [
    { label: "Total registrations", value: stats.totalLeads },
    { label: "Today", value: stats.leadsToday },
    { label: "Last 7 days", value: stats.leadsLast7Days },
    { label: "Behaviour events", value: stats.totalEvents },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-slate">
          Reading from the in-memory store. Swap{" "}
          <code>src/lib/store.ts</code> for Supabase to make this live.
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-mist bg-cloud p-5"
          >
            <div className="text-3xl font-bold tabular-nums">{tile.value}</div>
            <div className="mt-1 text-sm text-slate">{tile.label}</div>
          </div>
        ))}
      </div>

      {/* Registrations table */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent registrations</h2>
        <div className="overflow-x-auto rounded-2xl border border-mist">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-mist bg-cloud text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate">
                    No registrations yet.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-4 py-3 font-medium">{lead.name}</td>
                    <td className="px-4 py-3 text-slate">{lead.email}</td>
                    <td className="px-4 py-3 text-slate">
                      {lead.utm?.utm_source ?? lead.source ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate">
                      {formatDate(lead.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent behaviour */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent behaviour</h2>
        <div className="rounded-2xl border border-mist divide-y divide-mist">
          {events.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate">
              No events yet.
            </p>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-sky px-2 py-0.5 text-xs font-medium text-trust">
                    {event.event}
                  </span>
                  <span className="text-slate">{event.email ?? "anonymous"}</span>
                </div>
                <span className="text-xs text-slate">
                  {formatDate(event.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
