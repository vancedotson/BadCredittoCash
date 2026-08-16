import { hydrateStore, listAllTasks, getTaskStats, listContactOptions, listOwners } from "@/lib/store";
import { PageTitle } from "@/components/crm/ui";
import { TasksSummary } from "@/components/crm/TasksSummary";
import { TasksClient } from "@/components/crm/TasksClient";
import { requireCrmUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  await hydrateStore();
  const [user, tasks, contacts, owners] = await Promise.all([
    requireCrmUser(),
    listAllTasks(),
    listContactOptions(),
    listOwners(),
  ]);
  const currentOwner = user.displayName && owners.includes(user.displayName) ? user.displayName : owners[0];
  const stats = await getTaskStats(currentOwner);

  return (
    <div className="space-y-6">
      <PageTitle title="Tasks" subtitle="Your follow-up command center across every contact." />
      <TasksSummary stats={stats} />
      <TasksClient tasks={tasks} contacts={contacts} owners={owners} initialOwner={currentOwner} />
    </div>
  );
}
