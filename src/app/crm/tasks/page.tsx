import { listAllTasks, type TaskWithContact } from "@/lib/store";
import { PageTitle, Card } from "@/components/crm/ui";
import { TaskItem } from "@/components/crm/mutations";

export const dynamic = "force-dynamic";

function startOfToday(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}

export default async function TasksPage() {
  const all = await listAllTasks();
  const today = startOfToday();
  const tomorrow = today + 24 * 60 * 60 * 1000;

  const open = all.filter((t) => !t.done);
  const done = all.filter((t) => t.done);
  const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < today);
  const dueToday = open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() >= today && new Date(t.dueDate).getTime() < tomorrow);
  const upcoming = open.filter((t) => !t.dueDate || new Date(t.dueDate).getTime() >= tomorrow);

  const groups: Array<{ title: string; tone: string; items: TaskWithContact[] }> = [
    { title: "Overdue", tone: "text-red", items: overdue },
    { title: "Due today", tone: "text-heading", items: dueToday },
    { title: "Upcoming", tone: "text-heading", items: upcoming },
    { title: "Done", tone: "text-slate", items: done },
  ];

  return (
    <div className="space-y-6">
      <PageTitle title="Tasks" subtitle={`${open.length} open · ${done.length} done`} />

      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.title}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className={`text-lg font-semibold ${g.tone}`}>{g.title}</h2>
              <span className="rounded-full bg-mist/70 px-2 py-0.5 text-xs font-medium tabular-nums text-slate">{g.items.length}</span>
            </div>
            <ul className="space-y-3">
              {g.items.length === 0 ? (
                <li className="text-sm text-slate">Nothing here.</li>
              ) : (
                g.items.map((t) => (
                  <li key={t.id}>
                    <TaskItem
                      task={t}
                      contactName={t.contactName}
                      href={`/crm/contacts/${t.contactId}`}
                      overdue={g.title === "Overdue"}
                    />
                  </li>
                ))
              )}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
