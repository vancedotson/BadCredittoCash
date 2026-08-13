import { hydrateStore, listContacts, getPipelineStats, listOwners } from "@/lib/store";
import { PageTitle } from "@/components/crm/ui";
import { PipelineSummary } from "@/components/crm/PipelineSummary";
import { PipelineBoard } from "@/components/crm/PipelineBoard";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  await hydrateStore();
  const [{ rows }, stats, owners] = await Promise.all([
    listContacts({ pageSize: 1000, sort: "recent" }),
    getPipelineStats(),
    listOwners(),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle title="Pipeline" subtitle="Drag cards between stages, or use a card's dropdown. Moving to Lost asks why." />
      <PipelineSummary stats={stats} />
      <PipelineBoard contacts={rows} owners={owners} />
    </div>
  );
}
