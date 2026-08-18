import type { TaskStats } from "@/lib/store";

function TaskMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-xl border border-mist bg-card px-3 py-2 sm:block sm:min-h-0 sm:py-2.5">
      <div className="text-xs font-medium text-slate">{label}</div>
      <div className="text-lg font-bold tabular-nums text-heading sm:mt-0.5 sm:text-xl">{value}</div>
    </div>
  );
}

export function TasksSummary({ stats }: { stats: TaskStats }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <TaskMetric label="Overdue" value={stats.overdue} />
      <TaskMetric label="Due today" value={stats.dueToday} />
      <TaskMetric label="This week" value={stats.thisWeek} />
      <TaskMetric label="Completed (7d)" value={stats.completedThisWeek} />
      <TaskMetric label="Completion rate" value={`${stats.completionRatePct}%`} />
    </div>
  );
}
