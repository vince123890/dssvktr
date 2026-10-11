import type { Actor, AppRole, FunctionalRole, PricingProposal, UserRole } from "@/types/database";

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
  "FINANCE",
  "PROJECT_TEAM",
  "EXECUTIVE",
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
  FINANCE: "Finance (status payment termin)",
  PROJECT_TEAM: "Tim Project (progres project)",
  EXECUTIVE: "Chief / Direksi (dashboard, baca saja)",
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

/**
 * v5.0 — the Head of Sales signs outside the app; the Salesperson who
 * owns the quotation (or an Admin) attaches the signed document, which is
 * what actually releases it (PRD FR-2.11).
 */
export function canAttachSignedDocument(
  actor: Pick<Actor, "id" | "app_role">,
  proposal: Pick<PricingProposal, "created_by" | "account_person_ids">
): boolean {
  if (hasFunction(actor, "SYSTEM_ADMIN")) return true;
  if (!hasFunction(actor, "SALESPERSON")) return false;
  return proposal.created_by === actor.id || (proposal.account_person_ids ?? []).includes(actor.id);
}

/**
 * Head of Sales (or Admin) withdraws a final approval while the quotation
 * still waits for the signed document (PRD FR-2.11).
 */
export function canCancelFinalApproval(actor: Pick<Actor, "app_role">): boolean {
  return hasAnyFunction(actor, ["SALES_RELEASER", "SYSTEM_ADMIN"]);
}

/** Admin override of the automatic Expired status (PRD FR-2.9, v5.0). */
export function canOverrideExpired(actor: Pick<Actor, "app_role">): boolean {
  return hasFunction(actor, "SYSTEM_ADMIN");
}

/** Salesperson who owns the project sets the payment terms (PRD FR-9.3). */
export function canSetPaymentTerms(
  actor: Pick<Actor, "id" | "app_role">,
  proposal: Pick<PricingProposal, "created_by" | "account_person_ids">
): boolean {
  return canAttachSignedDocument(actor, proposal);
}

/** Finance marks a term received and uploads the transfer proof (PRD FR-9.3). */
export function canUpdatePaymentStatus(actor: Pick<Actor, "app_role">): boolean {
  return hasAnyFunction(actor, ["FINANCE", "SYSTEM_ADMIN"]);
}

/** Project Team records progress (PRD FR-9.4). */
export function canRecordProjectProgress(actor: Pick<Actor, "app_role">): boolean {
  return hasAnyFunction(actor, ["PROJECT_TEAM", "SYSTEM_ADMIN"]);
}

/**
 * v5.0 — a Salesperson may enter the negotiated discount on a draft
 * *revision* (never on an original draft, which stays at the standard
 * price). The routing tier still applies when it is submitted.
 */
export function canEditRevisionDiscount(
  actor: Pick<Actor, "id" | "app_role">,
  proposal: Pick<PricingProposal, "current_status" | "supersedes_proposal_id" | "created_by">
): boolean {
  return (
    hasFunction(actor, "SALESPERSON") &&
    proposal.current_status === "DRAFT" &&
    proposal.supersedes_proposal_id !== null &&
    proposal.created_by === actor.id
  );
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
