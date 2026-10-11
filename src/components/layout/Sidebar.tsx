"use client";

import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/rbac";
import type { MenuKey } from "@/lib/menuAccess";
import type { Actor } from "@/types/database";
import {
  LayoutDashboard,
  BarChart3,
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
  FolderKanban,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/login/actions";

/** Order & icons only — which items show is decided on the server (menuAccess.ts). */
const NAV_ITEMS: { key: MenuKey; href: string; label: string; icon: React.ElementType }[] = [
  { key: "overview", href: "/", label: "Overview", icon: LayoutDashboard },
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "price_estimate", href: "/price-estimate", label: "Price Estimate", icon: Tag },
  { key: "quotations", href: "/proposals", label: "Official Quotation", icon: Calculator },
  { key: "projects", href: "/projects", label: "Projects", icon: FolderKanban },
  { key: "lifecycle", href: "/lifecycle", label: "Lifecycle & Approvals", icon: KanbanSquare },
  { key: "cost_structure", href: "/cost-structure", label: "Cost Structure (M/C/R)", icon: Layers },
  { key: "dss", href: "/dss", label: "Decision Support (DSS)", icon: SlidersHorizontal },
  { key: "master_data", href: "/master-data", label: "Master Data & Kurs", icon: Database },
  { key: "product", href: "/master-data/product", label: "Product Master Data", icon: Package },
  { key: "audit", href: "/audit-log", label: "Audit Trail", icon: ScrollText },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings },
];

/**
 * App navigation. From the `lg` breakpoint it is a fixed column; below it
 * the column becomes an off-canvas drawer opened from a sticky top bar
 * (PRD FR-5.8, v5.0) so every page is usable on a phone or iPad.
 */
export function Sidebar({ profile, menus }: { profile: Actor; menus: MenuKey[] }) {
  const [open, setOpen] = useState(false);

  // Esc closes the drawer; the page behind does not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      {/* Mobile / tablet top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-card-border bg-white px-4 lg:hidden print:hidden">
        <button
          type="button"
          aria-label="Buka menu"
          aria-expanded={open}
          aria-controls="app-drawer"
          onClick={() => setOpen(true)}
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
        >
          <Menu size={22} />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">PC</div>
        <div className="text-sm font-semibold">VKTR-PriceCore</div>
      </header>

      {/* Overlay (mobile / tablet) */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-200 motion-reduce:transition-none lg:hidden print:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        id="app-drawer"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-card-border bg-white transition-transform duration-200 motion-reduce:transition-none",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0 print:hidden"
        )}
      >
        <SidebarContent profile={profile} menus={menus} onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} />
      </aside>
    </>
  );
}

function SidebarContent({
  profile,
  menus,
  onNavigate,
  onClose,
}: {
  profile: Actor;
  menus: MenuKey[];
  onNavigate: () => void;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => menus.includes(item.key));

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-card-border px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">PC</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-none">VKTR-PriceCore</div>
          <div className="mt-0.5 text-[11px] text-muted">Smart Pricing &amp; DSS · v5.0</div>
        </div>
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={onClose}
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
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
              onClick={onNavigate}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:min-h-0",
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
              aria-label="Logout"
              className="flex h-11 w-11 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:h-7 lg:w-7"
            >
              <LogOut size={14} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
