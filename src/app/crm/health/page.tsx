import { Card, PageTitle } from "@/components/crm/ui";
import { requireCrmUser } from "@/lib/auth";
import { getSystemHealth, type HealthState } from "@/lib/system-health";
import { HealthHistory } from "@/components/crm/HealthHistory";

export const dynamic = "force-dynamic";

const styles: Record<HealthState, { dot: string; badge: string; label: string }> = {
  healthy: { dot: "bg-green", badge: "bg-green/12 text-green", label: "Healthy" },
  warning: { dot: "bg-gold", badge: "bg-gold/15 text-gold-deep", label: "Attention" },
  error: { dot: "bg-red", badge: "border border-red/30 bg-card text-red", label: "Unavailable" },
};

const fixLinks = {
  database: { href: "/crm/settings#data", label: "Review data setup" },
  email: { href: "/crm/settings#sequences", label: "Review email setup" },
  queue: { href: "/crm/sequences", label: "Open failed emails" },
  calendar: { href: "/crm/settings#calendar", label: "Open Calendar settings" },
} as const;

export default async function HealthPage() {
  await requireCrmUser();
  const health = await getSystemHealth();
  const overall = health.checks.some((check) => check.state === "error")
    ? "Some services need attention."
    : health.checks.some((check) => check.state === "warning")
      ? "Core services are working; review the warnings below."
      : "All checked services are working.";

  return (
    <div className="space-y-6">
      <PageTitle title="System health" subtitle="A live, read-only check of the services that keep the funnel running." />
      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-heading">{overall}</h2>
            <p className="mt-1 text-xs text-slate">Checked {new Date(health.checkedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
          <a href="/crm/health" className="rounded-lg border border-mist bg-card px-3 py-2 text-sm font-medium text-body hover:bg-cloud">Run checks again</a>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {health.checks.map((check) => {
            const style = styles[check.state];
            const fix = fixLinks[check.key];
            return (
              <li key={check.key} className="rounded-xl border border-mist bg-cloud p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} aria-hidden="true" />
                    <h3 className="font-medium text-body">{check.label}</h3>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${style.badge}`}>{style.label}</span>
                </div>
                <p className="mt-2 text-sm text-slate">{check.detail}</p>
                {check.state !== "healthy" ? <a href={fix.href} className="mt-3 inline-block text-sm font-medium text-trust hover:underline">{fix.label} →</a> : null}
              </li>
            );
          })}
        </ul>
      </Card>
      <HealthHistory checkedAt={health.checkedAt} checks={health.checks} />
    </div>
  );
}
