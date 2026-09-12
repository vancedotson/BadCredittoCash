import { hydrateStore, listContacts, getPipelineStats, listOwners } from "@/lib/store";
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
    <div data-testid="pipeline-workspace" className="min-w-0 space-y-5">
      <header>
        <p className="mb-2 flex items-center gap-2 text-xs text-slate"><span>CRM</span><span aria-hidden="true">/</span><span>Pipeline</span></p>
        <h1 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">Pipeline</h1>
        <p className="mt-2 text-sm text-slate">Drag cards between stages, or use a card&apos;s dropdown. Moving to Lost asks why.</p>
      </header>
      <div className="flex min-w-0 flex-col gap-5">
        <section aria-label="Pipeline summary" className="order-2 min-w-0 md:order-1">
          <PipelineSummary stats={stats} />
        </section>
        <section aria-label="Pipeline board" className="order-1 min-w-0 md:order-2">
          <PipelineBoard contacts={rows} owners={owners} focusId={focus} />
        </section>
      </div>
    </div>
  );
}
