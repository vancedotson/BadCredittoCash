import type { PipelineStats } from "@/lib/store";
import { STAGE_LABELS, ACTIVE_STAGES } from "@/lib/stages";
import { KpiTile } from "./ui";

export function PipelineSummary({ stats }: { stats: PipelineStats }) {
  const active = stats.byStage.filter((s) => ACTIVE_STAGES.includes(s.stage));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiTile label="Active pipeline" value={stats.active} />
        <KpiTile label="Booked (7 days)" value={stats.bookedThisWeek} />
        <KpiTile label="Win rate" value={`${stats.winRatePct}%`} hint={`${stats.won} won · ${stats.lost} lost`} />
        <KpiTile label="Forecast" value={stats.expectedClients} hint="expected clients" />
        <KpiTile label="Clients" value={stats.won} />
        <KpiTile label="Lost" value={stats.lost} />
      </div>

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
