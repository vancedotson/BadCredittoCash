import { hydrateStore, listAllTasks, listBookings, listOwners, listContactOptions } from "@/lib/store";
import { PageTitle } from "@/components/crm/ui";
import { CalendarClient } from "@/components/crm/CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await hydrateStore();
  const [allTasks, bookings, owners, contacts] = await Promise.all([listAllTasks(), listBookings(), listOwners(), listContactOptions()]);
  const tasks = allTasks.filter((t) => t.dueDate);
  return (
    <div className="space-y-6">
      <PageTitle title="Calendar" subtitle="Plan your tasks and calls. Click a day for detail, drag a task to reschedule." />
      <CalendarClient tasks={tasks} bookings={bookings} owners={owners} contacts={contacts} />
    </div>
  );
}
