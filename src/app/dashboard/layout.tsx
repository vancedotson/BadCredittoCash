import Link from "next/link";
import type { Metadata } from "next";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/**
 * Dashboard shell. This area is internal/admin.
 *
 * TODO (auth): it's currently unprotected. When Supabase is connected, gate
 * this route with Supabase Auth — e.g. check the session in a proxy/middleware
 * for `/dashboard/:path*` and redirect unauthenticated users to a login page.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-card">
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="font-heading font-bold tracking-tight text-white">
              {site.name}
            </Link>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-gold">
              Dashboard
            </span>
          </div>
          <Link
            href="/"
            className="text-sm text-white/80 transition-colors hover:text-gold"
          >
            View site ↗
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
