import type { PipelineStats } from "@/lib/store";
import { STAGE_LABELS, ACTIVE_STAGES } from "@/lib/stages";

function MetricTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 bg-card px-4 py-4 sm:px-5">
      <dt className="text-xs font-medium text-slate">{label}</dt>
      <dd className="mt-1.5 text-3xl font-bold leading-none tracking-tight tabular-nums text-heading">{value}</dd>
      {hint ? <dd className="mt-2 text-[11px] leading-relaxed text-slate">{hint}</dd> : null}
    </div>
  );
}

export function PipelineSummary({ stats }: { stats: PipelineStats }) {
  const active = stats.byStage.filter((s) => ACTIVE_STAGES.includes(s.stage));
  const total = stats.byStage.reduce((sum, stage) => sum + stage.count, 0);
  const closed = stats.won + stats.lost;
  return (
    <div className="space-y-3">
      <dl aria-label="Pipeline metrics for all contacts" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-mist bg-mist shadow-[0_2px_5px_rgba(15,44,76,0.025)] md:grid-cols-3 xl:grid-cols-6">
        <MetricTile label="Active pipeline" value={stats.active} />
        <MetricTile label="Booked (7 days)" value={stats.bookedThisWeek} />
        <MetricTile label="Win rate" value={`${stats.winRatePct}%`} hint={`${stats.won} won / ${closed} closed`} />
        <MetricTile label="Forecast" value={stats.expectedClients} hint={`stage-weighted estimate from ${total} contacts`} />
        <MetricTile label="Clients" value={stats.won} />
        <MetricTile label="Lost" value={stats.lost} />
      </dl>

      <details className="px-1 text-xs text-slate">
        <summary className="w-fit cursor-pointer rounded py-1 font-medium hover:text-heading focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust">How the forecast works</summary>
        <p className="mt-2 max-w-5xl pb-1 leading-relaxed">Each contact is weighted by stage: New 5%, Registered 15%, Engaged 35%, Call booked 65%, Client 100%, Lost 0%. The rounded total is an estimate, not a promise.</p>
      </details>

      {/* Velocity: how long contacts are sitting in each active stage */}
      <div className="rounded-xl border border-mist bg-card px-4 py-3 lg:flex lg:items-center lg:gap-6">
        <div className="mb-3 flex items-baseline gap-2 lg:mb-0 lg:block lg:shrink-0">
          <h2 className="text-xs font-semibold text-heading">Time in stage</h2>
          <p className="text-[11px] text-slate lg:mt-1">All contacts</p>
        </div>
        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4 lg:border-l lg:border-mist lg:pl-6">
          {active.map((s) => {
            const stale = s.avgAgeDays >= 7;
            return (
              <div key={s.stage} className="min-w-0">
                <dt className="text-xs font-medium text-slate">{STAGE_LABELS[s.stage]}</dt>
                <dd className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-lg font-semibold leading-none tabular-nums text-heading">{s.count}</span>
                  <span className={`text-[11px] tabular-nums ${stale ? "text-red dark:text-[#ff9b8f]" : "text-slate"}`}>
                    {s.count ? `avg ${s.avgAgeDays}d` : "—"}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}
