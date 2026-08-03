import type { CalculationBreakdown, UserRole } from "@/types/database";

/**
 * Field-level access rules (Technical Logic §8). Postgres RLS is
 * row-level, so masking of `raw margin %` from Sales is enforced here
 * in the query/serialization layer — matching §8.1's explicit note that
 * field masking happens in "response serializer ... not client-side".
 */

const ROLES_THAT_SEE_RAW_MARGIN: UserRole[] = [
  "FINANCE_CONTROLLER",
  "C_LEVEL",
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
  return role === "SALES_MANAGER" || role === "C_LEVEL" || role === "SYSTEM_ADMIN";
}

/**
 * Masks MARGIN_FACTOR line items from the breakdown for roles that
 * should only see the final_price target, not the raw margin build-up
 * (PRD NFR: "Sales tidak dapat melihat persentase raw margin ... namun
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
  PROCUREMENT_ANALYST: "Procurement Analyst",
  COST_ENGINEER: "Cost Engineer",
  FINANCE_CONTROLLER: "Finance Controller",
  SALES_MANAGER: "Sales / Account Manager",
  C_LEVEL: "C-Level / BOD",
  SYSTEM_ADMIN: "System Admin",
};

export const ROLE_DEPARTMENT_CODE: Record<UserRole, string> = {
  PROCUREMENT_ANALYST: "PROCUREMENT",
  COST_ENGINEER: "ENGINEERING",
  FINANCE_CONTROLLER: "FINANCE",
  SALES_MANAGER: "SALES",
  C_LEVEL: "C_LEVEL",
  SYSTEM_ADMIN: "ADMIN",
};
