import { requireCrmUser } from "@/lib/auth";
import { getLeadMagnetWorkspace } from "@/lib/lead-magnet";
import { normalizeLeadMagnetQuery } from "@/lib/lead-magnet-types";
import { LeadMagnetManager } from "@/components/crm/LeadMagnetManager";

export const dynamic = "force-dynamic";

export default async function LeadMagnetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireCrmUser();
  const params = await searchParams;
  const query = normalizeLeadMagnetQuery({ search: params.q, status: params.status, page: params.page, pageSize: params.pageSize });
  const workspace = await getLeadMagnetWorkspace(query);
  return <LeadMagnetManager workspace={workspace} query={{ ...query, page: workspace.page, pageSize: workspace.pageSize }} />;
}
