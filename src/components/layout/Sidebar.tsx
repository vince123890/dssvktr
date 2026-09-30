"use client";

import { cn } from "@/lib/utils";
import { hasAnyFunction, isExternal, roleLabel } from "@/lib/rbac";
import type { Actor, FunctionalRole } from "@/types/database";
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

const INTERNAL: FunctionalRole[] = [
  "SALESPERSON",
  "SALES_VALIDATOR",
  "SALES_OPERATIONS",
  "SALES_RELEASER",
  "SALES_PRICING_OWNER",
  "COGS_OWNER",
  "PROFITABILITY_OWNER",
  "PRICING_COMMITTEE",
  "PRODUCT_OWNER",
  "SYSTEM_ADMIN",
];

const COST_OWNERS: FunctionalRole[] = [
  "COGS_OWNER",
  "PROFITABILITY_OWNER",
  "SALES_PRICING_OWNER",
  "PRICING_COMMITTEE",
  "SYSTEM_ADMIN",
];

/** Menu visibility follows functional roles, so a role added in Settings gets the right menus. */
const NAV_ITEMS: { href: string; label: string; icon: React.ElementType; functions: FunctionalRole[] | "ALL" }[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, functions: INTERNAL },
  { href: "/price-estimate", label: "Price Estimate", icon: Tag, functions: "ALL" },
  { href: "/proposals", label: "Official Quotation", icon: Calculator, functions: INTERNAL },
  { href: "/lifecycle", label: "Lifecycle & Approvals", icon: KanbanSquare, functions: INTERNAL },
  { href: "/cost-structure", label: "Cost Structure (M/C/R)", icon: Layers, functions: COST_OWNERS },
  { href: "/dss", label: "Decision Support (DSS)", icon: SlidersHorizontal, functions: COST_OWNERS.concat(["SALES_RELEASER", "SALES_OPERATIONS"]) },
  { href: "/master-data", label: "Master Data & Kurs", icon: Database, functions: COST_OWNERS },
  { href: "/master-data/product", label: "Product Master Data", icon: Package, functions: INTERNAL },
  { href: "/audit-log", label: "Audit Trail", icon: ScrollText, functions: INTERNAL },
  { href: "/settings", label: "Settings", icon: Settings, functions: ["SYSTEM_ADMIN"] },
];

export function Sidebar({ profile }: { profile: Actor }) {
  const pathname = usePathname();
  const external = isExternal(profile);
  const items = NAV_ITEMS.filter((item) =>
    item.functions === "ALL" ? true : !external && hasAnyFunction(profile, item.functions)
  );

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
