import { listAllTasks, getTaskStats, listContactOptions, listOwners } from "@/lib/store";
import { PageTitle } from "@/components/crm/ui";
import { TasksSummary } from "@/components/crm/TasksSummary";
import { TasksClient } from "@/components/crm/TasksClient";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, stats, contacts, owners] = await Promise.all([
    listAllTasks(),
    getTaskStats(),
    listContactOptions(),
    listOwners(),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle title="Tasks" subtitle="Your follow-up command center across every contact." />
      <TasksSummary stats={stats} />
      <TasksClient tasks={tasks} contacts={contacts} owners={owners} />
    </div>
  );
}
