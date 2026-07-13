"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LightbulbIcon,
  PersonIcon,
  DollarIcon,
  CheckIcon,
} from "@/components/marketing-v2/Icons";

const NAV = [
  { href: "/crm", label: "Overview", Icon: LightbulbIcon, exact: true },
  { href: "/crm/contacts", label: "Contacts", Icon: PersonIcon },
  { href: "/crm/pipeline", label: "Pipeline", Icon: DollarIcon },
  { href: "/crm/tasks", label: "Tasks", Icon: CheckIcon },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

export function CrmSidebar() {
  const isActive = useIsActive();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-navy text-white md:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="font-heading text-lg font-bold tracking-tight text-white">Vance</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-gold">CRM</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map(({ href, label, Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-5 py-4">
          <Link href="/" className="text-sm text-white/70 transition-colors hover:text-gold">
            View site &#8599;
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 bg-navy text-white md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold tracking-tight text-white">Vance</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-gold">CRM</span>
          </div>
          <Link href="/" className="text-sm text-white/70 hover:text-gold">
            Site &#8599;
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(({ href, label, Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-white/12 text-white" : "text-white/70"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
