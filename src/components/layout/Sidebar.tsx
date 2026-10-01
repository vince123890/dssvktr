"use client";

import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/rbac";
import type { MenuKey } from "@/lib/menuAccess";
import type { Actor } from "@/types/database";
import {
  LayoutDashboard,
  Database,
  Calculator,
  KanbanSquare,
  SlidersHorizontal,
  ScrollText,
  Settings,
  LogOut,
  Package,
  Tag,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";

/** Order & icons only — which items show is decided on the server (menuAccess.ts). */
const NAV_ITEMS: { key: MenuKey; href: string; label: string; icon: React.ElementType }[] = [
  { key: "overview", href: "/", label: "Overview", icon: LayoutDashboard },
  { key: "price_estimate", href: "/price-estimate", label: "Price Estimate", icon: Tag },
  { key: "quotations", href: "/proposals", label: "Official Quotation", icon: Calculator },
  { key: "lifecycle", href: "/lifecycle", label: "Lifecycle & Approvals", icon: KanbanSquare },
  { key: "cost_structure", href: "/cost-structure", label: "Cost Structure (M/C/R)", icon: Layers },
  { key: "dss", href: "/dss", label: "Decision Support (DSS)", icon: SlidersHorizontal },
  { key: "master_data", href: "/master-data", label: "Master Data & Kurs", icon: Database },
  { key: "product", href: "/master-data/product", label: "Product Master Data", icon: Package },
  { key: "audit", href: "/audit-log", label: "Audit Trail", icon: ScrollText },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ profile, menus }: { profile: Actor; menus: MenuKey[] }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => menus.includes(item.key));

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-card-border bg-white print:hidden">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-card-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white font-bold text-sm">
          PC
        </div>
        <div>
          <div className="text-sm font-semibold leading-none">VKTR-PriceCore</div>
          <div className="text-[11px] text-muted mt-0.5">Smart Pricing &amp; DSS · v4.0</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {items.map((item) => {
          const isPrefixOfAnother = items.some(
            (other) => other.href !== item.href && other.href.startsWith(`${item.href}/`)
          );
          const active =
            item.href === "/" || isPrefixOfAnother
              ? pathname === item.href
              : pathname.startsWith(item.href);
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
            <div className="truncate text-xs font-medium text-foreground">{profile.full_name}</div>
            <div className="truncate text-[11px] text-muted">{roleLabel(profile)}</div>
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
