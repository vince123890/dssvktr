import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessLine, DiscountAuthority, UserRole } from "@/types/database";

/**
 * Discount Authority Resolution — Technical Logic §11.1 (FR-6.1, FR-6.2).
 *
 * The core rule: **the requester never chooses the approver**. The
 * required role is derived from the discount size against a configurable
 * ladder, so authority cannot be bypassed from the client.
 */

/** Lowest rung of the ladder still authorised for this discount. */
export function resolveRequiredRole(
  discountPct: number,
  ladder: DiscountAuthority[]
): UserRole {
  const ordered = [...ladder].sort((a, b) => a.escalation_order - b.escalation_order);

  for (const level of ordered) {
    if (discountPct <= Number(level.max_discount_pct)) {
      return level.role;
    }
  }

  // Beyond every configured ceiling — the board decides.
  return "BOD";
}

export async function loadDiscountLadder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  businessLine: BusinessLine
): Promise<DiscountAuthority[]> {
  const { data } = await supabase
    .from("discount_authority")
    .select("*")
    .eq("is_active", true)
    .or(`business_line.is.null,business_line.eq.${businessLine}`)
    .order("escalation_order");

  return (data ?? []) as DiscountAuthority[];
}

/** Can this role sign off a discount of this size? */
export function isWithinAuthority(
  role: UserRole,
  discountPct: number,
  ladder: DiscountAuthority[]
): boolean {
  const level = ladder.find((l) => l.role === role);
  if (!level) return false;
  return discountPct <= Number(level.max_discount_pct);
}

export function maxDiscountFor(
  role: UserRole,
  ladder: DiscountAuthority[]
): number | null {
  const level = ladder.find((l) => l.role === role);
  return level ? Number(level.max_discount_pct) : null;
}

export interface MarginImpact {
  priceBefore: number;
  priceAfter: number;
  gpmAfter: number;
  isBelowThreshold: boolean;
}

/**
 * Margin impact of a discount — Technical Logic §11.3.
 *
 * Computed once, when the request is raised, and stored on the request
 * so the approver sees exactly the figures the requester saw (an FX
 * movement in between must not silently change the decision basis).
 */
export function computeMarginImpact(params: {
  priceBefore: number;
  baseCost: number;
  discountPct: number;
  minGpmThreshold: number;
}): MarginImpact {
  const { priceBefore, baseCost, discountPct, minGpmThreshold } = params;

  const priceAfter = priceBefore * (1 - discountPct / 100);
  const gpmAfter = priceAfter > 0 ? (priceAfter - baseCost) / priceAfter : 0;

  return {
    priceBefore,
    priceAfter,
    gpmAfter,
    isBelowThreshold: gpmAfter < minGpmThreshold,
  };
}
