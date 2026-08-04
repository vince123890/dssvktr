import type { CalculationBreakdown, UserRole } from "@/types/database";

/**
 * Field-level access rules (Technical Logic §8). Postgres RLS is
 * row-level, so masking of `raw margin %` from Sales is enforced here
 * in the query/serialization layer — matching §8.1's explicit note that
 * field masking happens in "response serializer ... not client-side".
 *
 * v2.0: roles follow the VKTR Commercial Quotation SOP.
 */

const ROLES_THAT_SEE_RAW_MARGIN: UserRole[] = [
  "VP_FINANCE",
  "CHIEF_SALES",
  "BOD",
  "SYSTEM_ADMIN",
];

export function canViewRawMargin(role: UserRole): boolean {
  return ROLES_THAT_SEE_RAW_MARGIN.includes(role);
}

export function canConfigureMasterData(role: UserRole): boolean {
  return role === "SYSTEM_ADMIN";
}

export function canManageWorkflowDefinitions(role: UserRole): boolean {
  return role === "SYSTEM_ADMIN";
}

export function canRecordWinLossOutcome(role: UserRole): boolean {
  return role === "SALES_OFFICER" || role === "CHIEF_SALES" || role === "BOD" || role === "SYSTEM_ADMIN";
}

/** Who may raise a customer discount request (FR-6.2). */
export function canRequestDiscount(role: UserRole): boolean {
  return role === "SALES_OFFICER" || role === "CHIEF_SALES" || role === "SYSTEM_ADMIN";
}

/**
 * Masks MARGIN_FACTOR line items from the breakdown for roles that
 * should only see the final_price target, not the raw margin build-up
 * (PRD NFR: "Sales Officer tidak dapat melihat raw margin ... namun
 * dapat melihat final price target").
 */
export function maskBreakdownForRole(
  breakdown: CalculationBreakdown,
  role: UserRole
): CalculationBreakdown {
  if (canViewRawMargin(role)) return breakdown;

  return {
    ...breakdown,
    items: breakdown.items.map((item) =>
      item.category === "MARGIN_FACTOR"
        ? { ...item, raw_value: 0, computed_amount: 0 }
        : item
    ),
  };
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SALES_OFFICER: "Sales Officer",
  CHIEF_SALES: "Chief Sales",
  VP_FINANCE: "VP Finance",
  VP_OPERATIONS: "VP Operations",
  BOD: "Board of Directors",
  SYSTEM_ADMIN: "System Admin",
};

export const ROLE_DEPARTMENT_CODE: Record<UserRole, string> = {
  SALES_OFFICER: "SALES",
  CHIEF_SALES: "CHIEF_SALES",
  VP_FINANCE: "VP_FINANCE",
  VP_OPERATIONS: "VP_OPERATIONS",
  BOD: "BOD",
  SYSTEM_ADMIN: "ADMIN",
};
