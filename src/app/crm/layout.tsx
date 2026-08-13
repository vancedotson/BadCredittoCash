import type { Metadata } from "next";
import { getNavData, hydrateStore } from "@/lib/store";
import { CrmChrome } from "@/components/crm/CrmChrome";
import { requireCrmUser } from "@/lib/auth";

// Internal tool — keep out of search results.
export const metadata: Metadata = {
  title: "CRM",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  await requireCrmUser();
  await hydrateStore();
  const nav = await getNavData();
  return <CrmChrome nav={nav}>{children}</CrmChrome>;
}
