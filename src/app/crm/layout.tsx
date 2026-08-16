import type { Metadata } from "next";
import { getNavData, hydrateStore } from "@/lib/store";
import { CrmChrome } from "@/components/crm/CrmChrome";
import { requireCrmUser } from "@/lib/auth";
import { openSans } from "@/app/crm-font";

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
  return <div className={openSans.variable}><CrmChrome nav={nav}>{children}</CrmChrome></div>;
}
