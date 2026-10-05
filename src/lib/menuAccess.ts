import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { hasAnyFunction, hasFunction } from "@/lib/rbac";
import type { Actor, FunctionalRole, PricingProposal } from "@/types/database";

/**
 * Menu & page access per role — PRD FR-5.7, Technical Logic §8.4.
 *
 * Each role only sees the menus it works in. A menu outside the matrix
 * is hidden from the sidebar AND its pages answer 404 when opened by
 * URL — the page's existence is not even acknowledged. The matrix maps
 * menus to functional roles (not role names), so a role added in
 * Settings inherits the menus of the functions it carries. Admin can
 * override the defaults in Settings → Akses Menu (app_setting
 * "menu_access"); Settings itself is always System Admin only.
 */

export type MenuKey =
  | "overview"
  | "price_estimate"
  | "quotations"
  | "lifecycle"
  | "cost_structure"
  | "dss"
  | "master_data"
  | "product"
  | "audit"
  | "settings";

export interface MenuDef {
  key: MenuKey;
  href: string;
  label: string;
  /** Functional roles that may open this menu by default. */
  defaultFunctions: FunctionalRole[];
  /** Cannot be edited in Settings (prevents an admin locking themselves out). */
  locked?: boolean;
}

export const MENUS: MenuDef[] = [
  {
    key: "overview",
    href: "/",
    label: "Overview",
    defaultFunctions: ["SALESPERSON", "SALES_OPERATIONS", "SALES_RELEASER", "COGS_OWNER", "PROFITABILITY_OWNER", "PRICING_COMMITTEE", "SYSTEM_ADMIN"],
  },
  {
    key: "price_estimate",
    href: "/price-estimate",
    label: "Price Estimate",
    defaultFunctions: ["EXTERNAL_AGENCY", "SALESPERSON", "SALES_OPERATIONS", "SALES_RELEASER", "SYSTEM_ADMIN"],
  },
  {
    key: "quotations",
    href: "/proposals",
    label: "Official Quotation",
    defaultFunctions: ["SALESPERSON", "SALES_OPERATIONS", "SALES_RELEASER", "COGS_OWNER", "PROFITABILITY_OWNER", "PRICING_COMMITTEE", "SYSTEM_ADMIN"],
  },
  {
    key: "lifecycle",
    href: "/lifecycle",
    label: "Lifecycle & Approvals",
    defaultFunctions: ["SALES_OPERATIONS", "SALES_RELEASER", "COGS_OWNER", "PROFITABILITY_OWNER", "PRICING_COMMITTEE", "SYSTEM_ADMIN"],
  },
  {
    key: "cost_structure",
    href: "/cost-structure",
    label: "Cost Structure (M/C/R)",
    defaultFunctions: ["SALES_PRICING_OWNER", "COGS_OWNER", "PROFITABILITY_OWNER", "PRICING_COMMITTEE", "SYSTEM_ADMIN"],
  },
  {
    key: "dss",
    href: "/dss",
    label: "Decision Support (DSS)",
    defaultFunctions: ["SALES_OPERATIONS", "SALES_RELEASER", "COGS_OWNER", "PROFITABILITY_OWNER", "PRICING_COMMITTEE", "SYSTEM_ADMIN"],
  },
  {
    key: "master_data",
    href: "/master-data",
    label: "Master Data & Kurs",
    defaultFunctions: ["COGS_OWNER", "PROFITABILITY_OWNER", "PRICING_COMMITTEE", "SYSTEM_ADMIN"],
  },
  {
    key: "product",
    href: "/master-data/product",
    label: "Product Master Data",
    defaultFunctions: ["PRODUCT_OWNER", "SYSTEM_ADMIN"],
  },
  {
    key: "audit",
    href: "/audit-log",
    label: "Audit Trail",
    defaultFunctions: ["SALES_RELEASER", "PRICING_COMMITTEE", "SYSTEM_ADMIN"],
  },
  {
    key: "settings",
    href: "/settings",
    label: "Settings",
    defaultFunctions: ["SYSTEM_ADMIN"],
    locked: true,
  },
];

export type MenuAccess = Record<MenuKey, FunctionalRole[]>;

export const DEFAULT_MENU_ACCESS: MenuAccess = Object.fromEntries(
  MENUS.map((m) => [m.key, m.defaultFunctions])
) as MenuAccess;

export async function loadMenuAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<MenuAccess> {
  const { data } = await supabase.from("app_setting").select("value").eq("key", "menu_access").maybeSingle();
  const overrides = (data?.value ?? {}) as Partial<Record<MenuKey, FunctionalRole[]>>;
  const access = { ...DEFAULT_MENU_ACCESS };
  for (const m of MENUS) {
    if (!m.locked && Array.isArray(overrides[m.key])) access[m.key] = overrides[m.key]!;
  }
  return access;
}

/** Menu access for the current request — layout, page and actions share one query. */
export const getMenuAccess = cache(async (): Promise<MenuAccess> => loadMenuAccess(await createClient()));

export function canAccessMenu(actor: Pick<Actor, "app_role">, key: MenuKey, access: MenuAccess): boolean {
  return hasAnyFunction(actor, access[key] ?? []);
}

export function allowedMenus(actor: Pick<Actor, "app_role">, access: MenuAccess): MenuKey[] {
  return MENUS.filter((m) => canAccessMenu(actor, m.key, access)).map((m) => m.key);
}

/** Where a role lands after login: its first permitted menu. */
export function landingHref(actor: Pick<Actor, "app_role">, access: MenuAccess): string {
  return MENUS.find((m) => canAccessMenu(actor, m.key, access))?.href ?? "/no-access";
}

/**
 * Page guard: returns the actor when the menu is permitted, otherwise
 * answers 404 — the page is treated as if it did not exist.
 */
export async function requireMenu(key: MenuKey): Promise<Actor> {
  const [actor, access] = await Promise.all([requireProfile(), getMenuAccess()]);
  if (!canAccessMenu(actor, key, access)) {
    if (key === "overview") redirect(landingHref(actor, access));
    notFound();
  }
  return actor;
}

/** Same check for route handlers / server actions (no redirect, no 404 page). */
export async function actorCanUseMenu(actor: Actor, key: MenuKey): Promise<boolean> {
  return canAccessMenu(actor, key, await getMenuAccess());
}

/**
 * Row-level quotation visibility (Technical Logic §8.5). Roles that
 * price or approve see every quotation; a Salesperson sees only the
 * quotations they initiated or are account person on; a Sales Lead
 * additionally sees requests from salespeople that await (or passed)
 * validation — the POC has no team hierarchy, so that is every request
 * initiated by a salesperson without validator rights.
 */
const SEES_ALL_QUOTATIONS: FunctionalRole[] = [
  "SALES_OPERATIONS",
  "SALES_RELEASER",
  "COGS_OWNER",
  "PROFITABILITY_OWNER",
  "PRICING_COMMITTEE",
  "SYSTEM_ADMIN",
];

export function canViewQuotation(
  actor: Actor,
  proposal: Pick<PricingProposal, "created_by" | "account_person_ids" | "initiator_role_code">,
  validatorVisibleRoles: string[]
): boolean {
  if (hasAnyFunction(actor, SEES_ALL_QUOTATIONS)) return true;
  if (proposal.created_by === actor.id) return true;
  if ((proposal.account_person_ids ?? []).includes(actor.id)) return true;
  if (hasFunction(actor, "SALES_VALIDATOR") && proposal.initiator_role_code) {
    return validatorVisibleRoles.includes(proposal.initiator_role_code);
  }
  return false;
}

/** App roles whose requests a validator reviews: salespeople who cannot validate themselves. */
export async function loadValidatorVisibleRoles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<string[]> {
  const { data } = await supabase.from("app_role").select("code, functional_roles");
  return ((data ?? []) as { code: string; functional_roles: FunctionalRole[] }[])
    .filter((r) => r.functional_roles.includes("SALESPERSON") && !r.functional_roles.includes("SALES_VALIDATOR"))
    .map((r) => r.code);
}

export function seesAllQuotations(actor: Actor): boolean {
  return hasAnyFunction(actor, SEES_ALL_QUOTATIONS);
}

