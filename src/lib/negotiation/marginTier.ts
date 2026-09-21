import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BusinessLine,
  DiscountInputMode,
  MarginTier,
  MarginTierAuthority,
  NegotiationDecision,
  UserRole,
} from "@/types/database";

/**
 * Margin-Tier Discount Authority — Technical Logic §11.1 (FR-6.1,
 * v3.0). Replaces the v2.0 percentage-based discount ladder: the
 * approval tier is resolved from the GPM that results *after* a
 * discount, never from the discount percentage itself. The requester
 * never picks their own approver — authority bypass from the client is
 * impossible by construction.
 */

const FALLBACK_TIER: MarginTier = 3;

export async function loadMarginTierLadder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  businessLine: BusinessLine
): Promise<MarginTierAuthority[]> {
  const { data } = await supabase
    .from("margin_tier_authority")
    .select("*")
    .eq("is_active", true)
    .or(`business_line.is.null,business_line.eq.${businessLine}`)
    .order("tier");

  return (data ?? []) as MarginTierAuthority[];
}

/**
 * The tier whose [lower, upper) GPM bound contains gpmAfter. Falls
 * back to the highest-numbered (most restrictive) tier when nothing
 * matches — e.g. a deeply negative GPM below every configured bound.
 */
export function resolveMarginTier(
  gpmAfterPct: number,
  ladder: MarginTierAuthority[]
): MarginTierAuthority {
  const ordered = [...ladder].sort((a, b) => a.tier - b.tier);

  for (const level of ordered) {
    const lowerOk = level.gpm_lower_bound_pct == null || gpmAfterPct >= Number(level.gpm_lower_bound_pct);
    const upperOk = level.gpm_upper_bound_pct == null || gpmAfterPct < Number(level.gpm_upper_bound_pct);
    if (lowerOk && upperOk) return level;
  }

  const fallback = ordered.find((l) => l.tier === FALLBACK_TIER);
  return (
    fallback ?? {
      id: "fallback",
      tier: FALLBACK_TIER,
      business_line: null,
      gpm_lower_bound_pct: null,
      gpm_upper_bound_pct: null,
      required_roles: ["BOD", "BOD"],
      allow_bod_delegation: false,
      is_active: true,
      created_at: new Date().toISOString(),
    }
  );
}

/**
 * Converts between the two ways a discount can be entered (FR-6.1.1):
 * both always resolve to a percentage, since resolveMarginTier works
 * off GPM percentage regardless of how the requester typed it.
 */
export function normalizeDiscountInput(params: {
  mode: DiscountInputMode;
  amount?: number;
  pct?: number;
  priceBeforeDiscount: number;
}): { amount: number; pct: number } {
  const { mode, amount, pct, priceBeforeDiscount } = params;

  if (mode === "AMOUNT") {
    const resolvedAmount = amount ?? 0;
    const resolvedPct =
      priceBeforeDiscount > 0 ? (resolvedAmount / priceBeforeDiscount) * 100 : 0;
    return { amount: resolvedAmount, pct: resolvedPct };
  }

  const resolvedPct = pct ?? 0;
  const resolvedAmount = priceBeforeDiscount * (resolvedPct / 100);
  return { amount: resolvedAmount, pct: resolvedPct };
}

export interface MarginImpact {
  priceBefore: number;
  priceAfter: number;
  gpmAfter: number;
  tier: MarginTierAuthority;
}

/**
 * Margin impact of a discount — Technical Logic §11.3. Computed once,
 * when the request is raised, and stored on the request so every
 * approver sees exactly the figures the requester saw (an FX movement
 * in between must not silently change the decision basis).
 */
export function computeMarginImpact(params: {
  priceBefore: number;
  baseCost: number;
  discountAmount: number;
  ladder: MarginTierAuthority[];
}): MarginImpact {
  const { priceBefore, baseCost, discountAmount, ladder } = params;

  const priceAfter = priceBefore - discountAmount;
  const gpmAfterPct = priceAfter > 0 ? ((priceAfter - baseCost) / priceAfter) * 100 : 0;
  const tier = resolveMarginTier(gpmAfterPct, ladder);

  return { priceBefore, priceAfter, gpmAfter: gpmAfterPct / 100, tier };
}

/**
 * AND-join completion check across the required_roles of a tier.
 *
 *  - Tier 1: always complete (no approval required).
 *  - Tier 2: every required role must have at least one APPROVE from a
 *    distinct actor.
 *  - Tier 3 (two BOD members): needs two APPROVE decisions with
 *    approver_role='BOD' from two *different* actor_id — matching by
 *    role alone would let one person "count twice".
 *
 * Any REJECT decision from anyone on the tier closes the request
 * immediately — the caller should treat that as REJECTED without
 * waiting for the rest of the AND-join.
 */
export function checkTierApprovalComplete(
  tier: MarginTierAuthority,
  decisions: Pick<NegotiationDecision, "actor_id" | "approver_role" | "decision">[]
): boolean {
  if (tier.tier === 1) return true;

  if (decisions.some((d) => d.decision === "REJECT")) return false;

  const approvals = decisions.filter((d) => d.decision === "APPROVE");

  if (tier.tier === 3) {
    const distinctBodActors = new Set(
      approvals.filter((d) => d.approver_role === "BOD").map((d) => d.actor_id)
    );
    return distinctBodActors.size >= 2;
  }

  // Tier 2 — every required role needs at least one distinct approver.
  const requiredRoles = tier.required_roles as UserRole[];
  return requiredRoles.every((role) =>
    approvals.some((d) => d.approver_role === role)
  );
}

export function hasAnyRejection(
  decisions: Pick<NegotiationDecision, "decision">[]
): boolean {
  return decisions.some((d) => d.decision === "REJECT");
}
