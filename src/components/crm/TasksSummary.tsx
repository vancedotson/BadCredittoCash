import type { TaskStats } from "@/lib/store";
import { KpiTile } from "./ui";

export function TasksSummary({ stats }: { stats: TaskStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      <KpiTile label="Overdue" value={stats.overdue} />
      <KpiTile label="Due today" value={stats.dueToday} />
      <KpiTile label="This week" value={stats.thisWeek} />
      <KpiTile label="Completed (7d)" value={stats.completedThisWeek} />
      <KpiTile label="Completion rate" value={`${stats.completionRatePct}%`} />
    </div>
  );
}
