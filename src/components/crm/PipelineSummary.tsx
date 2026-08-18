import type { PipelineStats } from "@/lib/store";
import { STAGE_LABELS, ACTIVE_STAGES } from "@/lib/stages";

function MetricTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-mist bg-card px-3 py-2.5">
      <div className="text-xs font-medium text-slate">{label}</div>
      <div className="mt-0.5 text-xl font-bold tabular-nums text-heading">{value}</div>
      {hint ? <div className="mt-0.5 text-xs leading-snug text-slate">{hint}</div> : null}
    </div>
  );
}

export function PipelineSummary({ stats }: { stats: PipelineStats }) {
  const active = stats.byStage.filter((s) => ACTIVE_STAGES.includes(s.stage));
  const total = stats.byStage.reduce((sum, stage) => sum + stage.count, 0);
  const closed = stats.won + stats.lost;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricTile label="Active pipeline" value={stats.active} />
        <MetricTile label="Booked (7 days)" value={stats.bookedThisWeek} />
        <MetricTile label="Win rate" value={`${stats.winRatePct}%`} hint={`${stats.won} won / ${closed} closed`} />
        <MetricTile label="Forecast" value={stats.expectedClients} hint={`stage-weighted estimate from ${total} contacts`} />
        <MetricTile label="Clients" value={stats.won} />
        <MetricTile label="Lost" value={stats.lost} />
      </div>

      <details className="rounded-xl border border-mist bg-card px-4 py-3 text-sm text-slate">
        <summary className="cursor-pointer font-medium text-body">How the forecast works</summary>
        <p className="mt-2">Each contact is weighted by stage: New 5%, Registered 15%, Engaged 35%, Call booked 65%, Client 100%, Lost 0%. The rounded total is an estimate, not a promise.</p>
      </details>

      {/* Velocity: how long contacts are sitting in each active stage */}
      <div className="rounded-2xl border border-mist bg-card p-4">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate">Time in stage</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {active.map((s) => {
            const stale = s.avgAgeDays >= 7;
            return (
              <div key={s.stage} className="rounded-xl border border-mist bg-cloud px-3 py-2.5">
                <div className="text-sm font-medium text-heading">{STAGE_LABELS[s.stage]}</div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold tabular-nums text-body">{s.count}</span>
                  <span className={`text-xs tabular-nums ${stale ? "text-red" : "text-slate"}`}>
                    {s.count ? `avg ${s.avgAgeDays}d` : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
