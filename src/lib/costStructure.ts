import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Actor,
  CostItem,
  CostScope,
  CostStructureLine,
  CostStructureScopeState,
  CostStructureVersion,
  Scenario,
  ScopeAuthority,
  ScopeSegregationRule,
} from "@/types/database";
import { computeCostStructure, type CostStructureResult } from "@/lib/pricing/quotation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;

/**
 * Cost Structure per variant (PRD FR-1.1.2, Technical Logic §4.8) —
 * server-side loading helpers and the Maker/Checker/Releaser authority
 * rules. All permission decisions go through canPerformScopeAction so
 * the UI and the server actions can never disagree.
 */

export async function loadCostItems(supabase: Db): Promise<CostItem[]> {
  const { data } = await supabase
    .from("cost_item")
    .select("*")
    .eq("active", true)
    .order("cost_group")
    .order("code");
  return (data ?? []) as CostItem[];
}

export async function loadVersionLines(supabase: Db, versionId: string): Promise<CostStructureLine[]> {
  const { data } = await supabase.from("cost_structure_line").select("*").eq("version_id", versionId);
  return (data ?? []) as CostStructureLine[];
}

export function evaluateVersion(
  items: CostItem[],
  lines: CostStructureLine[],
  fxRate: number
): CostStructureResult {
  const values: Record<string, number> = {};
  const excluded = new Set<string>();
  for (const l of lines) {
    values[l.cost_item_id] = Number(l.value);
    if (l.is_excluded_at_cost) excluded.add(l.cost_item_id);
  }
  return computeCostStructure({ items, values, excluded, fxRate });
}

/** The version currently used to price a product, or null when none is released. */
export async function loadReleasedVersion(
  supabase: Db,
  productId: string
): Promise<CostStructureVersion | null> {
  const { data } = await supabase
    .from("cost_structure_version")
    .select("*")
    .eq("product_id", productId)
    .eq("status", "RELEASED")
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as CostStructureVersion | null) ?? null;
}

export async function loadReleasedVersionsByProduct(
  supabase: Db
): Promise<Map<string, CostStructureVersion>> {
  const { data } = await supabase
    .from("cost_structure_version")
    .select("*")
    .eq("status", "RELEASED")
    .order("version_no", { ascending: false });
  const map = new Map<string, CostStructureVersion>();
  for (const v of (data ?? []) as CostStructureVersion[]) {
    if (!map.has(v.product_id)) map.set(v.product_id, v);
  }
  return map;
}

export function scenarioFor(gmFraction: number, deviationThresholdPct: number): Scenario {
  return gmFraction * 100 < deviationThresholdPct ? "DEVIATION" : "REGULAR";
}

/**
 * Scenario of a cost structure version. Until the Margin scope carries
 * a value the standard GM is meaningless (0%), so the version is treated
 * as REGULAR rather than flagged as a Deviation.
 */
export function versionScenario(result: CostStructureResult, deviationThresholdPct: number): Scenario {
  if (result.marginAmount <= 0) return "REGULAR";
  return scenarioFor(result.standardGm, deviationThresholdPct);
}

export type ScopeAction = "make" | "check" | "release";

export interface ScopePermission {
  allowed: boolean;
  reason?: string;
  singleActor?: boolean;
}

/**
 * Maker → Checker → Releaser authority for one scope (sheet Actors),
 * including the segregation-of-duties rule. The Margin scope has a
 * single holder in the seed, so a single-actor release is allowed but
 * flagged (Technical Logic §14 no. 10).
 */
export async function canPerformScopeAction(
  supabase: Db,
  params: {
    actor: Actor;
    scope: CostScope;
    scenario: Scenario;
    action: ScopeAction;
    state: Pick<CostStructureScopeState, "maker_id" | "checker_id"> | null;
  }
): Promise<ScopePermission> {
  const { actor, scope, scenario, action, state } = params;
  if (!actor.app_role_code) return { allowed: false, reason: "Akun Anda belum memiliki role." };

  const { data: authRows } = await supabase
    .from("scope_authority")
    .select("*")
    .eq("scope", scope)
    .eq("scenario", scenario);
  const auths = (authRows ?? []) as ScopeAuthority[];
  const column = `can_${action}` as const;

  const mine = auths.find((a) => a.app_role_code === actor.app_role_code);
  if (!mine || !mine[column]) {
    return {
      allowed: false,
      reason: `Role Anda tidak memiliki wewenang ${action.toUpperCase()} pada scope ${scope} (skenario ${scenario}).`,
    };
  }

  const { data: ruleRow } = await supabase
    .from("scope_segregation_rule")
    .select("*")
    .eq("scope", scope)
    .maybeSingle();
  const rule = (ruleRow as ScopeSegregationRule | null) ?? {
    scope,
    maker_ne_checker: true,
    checker_ne_releaser: false,
    allow_single_actor: true,
  };

  const conflictsWith =
    action === "check" && rule.maker_ne_checker
      ? state?.maker_id
      : action === "release" && rule.checker_ne_releaser
        ? state?.checker_id
        : null;

  if (conflictsWith && conflictsWith === actor.id) {
    // Allowed only when nobody else holds this authority at all.
    const holderRoles = auths.filter((a) => a[column]).map((a) => a.app_role_code);
    const { data: holders } = await supabase
      .from("profile")
      .select("id")
      .in("app_role_code", holderRoles.length ? holderRoles : ["__none__"]);
    const otherHolders = (holders ?? []).filter((h: { id: string }) => h.id !== actor.id);
    if (rule.allow_single_actor && otherHolders.length === 0) {
      return { allowed: true, singleActor: true };
    }
    return {
      allowed: false,
      reason:
        action === "check"
          ? "Checker harus orang yang berbeda dari Maker (pemisahan tugas)."
          : "Releaser harus orang yang berbeda dari Checker (pemisahan tugas).",
    };
  }

  return { allowed: true };
}
