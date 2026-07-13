import type { Metadata } from "next";
import { CrmSidebar } from "@/components/crm/CrmSidebar";

// Internal tool — keep out of search results.
export const metadata: Metadata = {
  title: "CRM",
  robots: { index: false, follow: false },
};

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="crm-scope flex min-h-screen flex-col bg-cloud md:flex-row">
      <CrmSidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
