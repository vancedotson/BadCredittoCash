import { hydrateStore, listContacts, getPipelineStats, listOwners } from "@/lib/store";
import { PageTitle } from "@/components/crm/ui";
import { PipelineSummary } from "@/components/crm/PipelineSummary";
import { PipelineBoard } from "@/components/crm/PipelineBoard";

export const dynamic = "force-dynamic";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  await hydrateStore();
  const { focus } = await searchParams;
  const [{ rows }, stats, owners] = await Promise.all([
    listContacts({ pageSize: 1000, sort: "recent" }),
    getPipelineStats(),
    listOwners(),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle title="Pipeline" subtitle="Drag cards between stages, or use a card's dropdown. Moving to Lost asks why." />
      <div className="flex flex-col gap-6">
        <section aria-label="Pipeline summary" className="order-1">
          <PipelineSummary stats={stats} />
        </section>
        <section aria-label="Pipeline board" className="order-2">
          <PipelineBoard contacts={rows} owners={owners} focusId={focus} />
        </section>
      </div>
    </div>
  );
}
