"use client";

import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/rbac";
import type { Profile } from "@/types/database";
import {
  LayoutDashboard,
  Database,
  Calculator,
  KanbanSquare,
  SlidersHorizontal,
  ScrollText,
  Settings,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/proposals", label: "Pricing Proposals", icon: Calculator },
  { href: "/lifecycle", label: "Lifecycle & Approvals", icon: KanbanSquare },
  { href: "/dss", label: "Decision Support (DSS)", icon: SlidersHorizontal },
  { href: "/master-data", label: "Master Data & CBS", icon: Database },
  { href: "/audit-log", label: "Audit Trail", icon: ScrollText },
  { href: "/admin", label: "Workflow Admin", icon: Settings },
];

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-card-border bg-white">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-card-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white font-bold text-sm">
          PC
        </div>
        <div>
          <div className="text-sm font-semibold leading-none">VKTR-PriceCore</div>
          <div className="text-[11px] text-muted mt-0.5">Smart Pricing &amp; DSS</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50 text-primary"
                  : "text-slate-600 hover:bg-slate-50 hover:text-foreground"
              )}
            >
              <Icon size={16} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-card-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
            {profile.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-foreground">
              {profile.full_name}
            </div>
            <div className="truncate text-[11px] text-muted">
              {ROLE_LABELS[profile.role]}
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Logout"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut size={14} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
