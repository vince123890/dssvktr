import type { Actor, AppRole, FunctionalRole, UserRole } from "@/types/database";

/**
 * Access rules (Technical Logic §8, v4.0).
 *
 * App roles are configuration (Settings → Roles & Authorities), so code
 * never checks an app role's name — only the fixed functional roles it
 * carries. Adding "Corporate Finance Manager" as a second Profitability
 * Owner is a data change; nothing here needs to know about it.
 */

export const FUNCTIONAL_ROLES: FunctionalRole[] = [
  "SALESPERSON",
  "SALES_VALIDATOR",
  "SALES_OPERATIONS",
  "SALES_RELEASER",
  "SALES_PRICING_OWNER",
  "COGS_OWNER",
  "PROFITABILITY_OWNER",
  "PRICING_COMMITTEE",
  "PRODUCT_OWNER",
  "EXTERNAL_AGENCY",
  "SYSTEM_ADMIN",
];

export const FUNCTIONAL_ROLE_LABEL: Record<FunctionalRole, string> = {
  SALESPERSON: "Salesperson (inisiator)",
  SALES_VALIDATOR: "Validator permintaan (Sales Lead)",
  SALES_OPERATIONS: "Sales Operations (generate quotation)",
  SALES_RELEASER: "Releaser quotation (Head of Sales)",
  SALES_PRICING_OWNER: "Sales Pricing Owner",
  COGS_OWNER: "COGS Owner",
  PROFITABILITY_OWNER: "Profitability Owner",
  PRICING_COMMITTEE: "Pricing Committee",
  PRODUCT_OWNER: "Product Owner",
  EXTERNAL_AGENCY: "Authorized Agency (eksternal)",
  SYSTEM_ADMIN: "System Admin",
};

export function functionsOf(actor: Pick<Actor, "app_role"> | null | undefined): FunctionalRole[] {
  if (!actor?.app_role || !actor.app_role.is_active) return [];
  return actor.app_role.functional_roles ?? [];
}

export function hasFunction(
  actor: Pick<Actor, "app_role"> | null | undefined,
  fn: FunctionalRole
): boolean {
  return functionsOf(actor).includes(fn);
}

export function hasAnyFunction(
  actor: Pick<Actor, "app_role"> | null | undefined,
  fns: FunctionalRole[]
): boolean {
  const mine = functionsOf(actor);
  return fns.some((f) => mine.includes(f));
}

export function roleLabel(actor: Pick<Actor, "app_role"> | null | undefined): string {
  return actor?.app_role?.name ?? "Belum punya role";
}

/**
 * A decision slot on a margin tier is either a functional role
 * ("COGS_OWNER") or one specific app role ("role:CCO") — Tier 3 needs
 * the CCO *and* the CFO, not two members of the Pricing Committee.
 */
export function actorFillsSlot(actor: Pick<Actor, "app_role" | "app_role_code">, slot: string): boolean {
  if (slot.startsWith("role:")) return actor.app_role_code === slot.slice(5);
  return hasFunction(actor, slot as FunctionalRole);
}

export function slotLabel(slot: string, roles: Pick<AppRole, "code" | "name">[]): string {
  if (slot.startsWith("role:")) {
    const code = slot.slice(5);
    return roles.find((r) => r.code === code)?.name ?? code;
  }
  return FUNCTIONAL_ROLE_LABEL[slot as FunctionalRole] ?? slot;
}

/** Who may see the cost structure behind a price (sheet Basic Workflow 6b — "highly confidential"). */
const COST_VISIBLE: FunctionalRole[] = [
  "SALES_OPERATIONS",
  "SALES_RELEASER",
  "SALES_PRICING_OWNER",
  "COGS_OWNER",
  "PROFITABILITY_OWNER",
  "PRICING_COMMITTEE",
  "SYSTEM_ADMIN",
];

export function canSeeCostStructure(actor: Pick<Actor, "app_role"> | null | undefined): boolean {
  return hasAnyFunction(actor, COST_VISIBLE);
}

export function canConfigureMasterData(actor: Pick<Actor, "app_role">): boolean {
  return hasFunction(actor, "SYSTEM_ADMIN");
}

export function canManageSettings(actor: Pick<Actor, "app_role">): boolean {
  return hasFunction(actor, "SYSTEM_ADMIN");
}

export function canManageProductMasterData(actor: Pick<Actor, "app_role">): boolean {
  return hasAnyFunction(actor, ["PRODUCT_OWNER", "SYSTEM_ADMIN"]);
}

export function canInitiateQuotation(actor: Pick<Actor, "app_role">): boolean {
  return hasFunction(actor, "SALESPERSON");
}

export function canRecordWinLossOutcome(actor: Pick<Actor, "app_role">): boolean {
  return hasAnyFunction(actor, ["SALESPERSON", "SALES_RELEASER", "SYSTEM_ADMIN"]);
}

/** External (agency) accounts only ever reach Price Estimate. */
export function isExternal(actor: Pick<Actor, "app_role"> | null | undefined): boolean {
  return Boolean(actor?.app_role?.is_external) || hasFunction(actor, "EXTERNAL_AGENCY");
}

/**
 * The legacy `profile.role` enum is still read by the v1-v3 RLS
 * policies (admin/product writes). Keep it consistent with the app role
 * whenever Settings assigns one.
 */
export function legacyRoleFor(functions: FunctionalRole[]): UserRole {
  if (functions.includes("SYSTEM_ADMIN")) return "SYSTEM_ADMIN";
  if (functions.includes("PRODUCT_OWNER")) return "PRODUCT_OWNER";
  if (functions.includes("PRICING_COMMITTEE")) return "BOD";
  if (functions.includes("PROFITABILITY_OWNER")) return "VP_FINANCE";
  if (functions.includes("COGS_OWNER")) return "VP_OPERATIONS";
  if (functions.includes("SALES_RELEASER") || functions.includes("SALES_OPERATIONS")) {
    return "CHIEF_SALES";
  }
  return "SALES_OFFICER";
}
