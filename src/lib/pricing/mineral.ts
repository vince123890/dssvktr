import type { SupabaseClient } from "@supabase/supabase-js";
import type { HpmParameter, MineralIndexSnapshot } from "@/types/database";

/**
 * Mineral Index Engine — Technical Logic §13 (FR-8.1 – FR-8.5, v3.0:
 * reference/transparency only).
 *
 * Battery cost tracks the mineral prices the government publishes: the
 * Harga Mineral Acuan (HMA) sets the Harga Patokan Mineral (HPM). Every
 * constant in the formula comes from `hpm_parameter`, so a change in the
 * Kepmen is a data change rather than a code change.
 *
 * The demo review confirmed HMA/HPM's only real path into VKTR's price
 * is through the CNY/IDR exchange rate (see rateSensitivity.ts) — the
 * mineral-linked cost item (FOB Price) is otherwise stable in CNY.
 * `mineralAdjustmentFactor()` below is therefore dormant: it always
 * returns 1, and the HPM computed here is shown to approvers as market
 * context (FR-8.4), never multiplied into the calculation.
 */

export interface HpmBreakdown {
  cfNi: number;
  valueNi: number;
  bonusCo: number;
  totalDry: number;
  /** US$ per wet metric ton — the figure transacted in the field. */
  hpmWet: number;
}

/**
 * HPM from HMA, per Kepmen ESDM No. 144.K/2026 (nickel with its cobalt
 * companion mineral).
 *
 * The correction factor moves linearly with nickel grade around the
 * 1.6% anchor at 30%: every 0.1% of grade shifts CF by 1.0 point.
 */
export function computeHpm(
  param: HpmParameter,
  hmaNi: number,
  hmaCo: number
): HpmBreakdown {
  const cfNi =
    Number(param.anchor_cf_pct) +
    (Number(param.ni_content_pct) - Number(param.anchor_content_pct)) *
      Number(param.cf_slope);

  const valueNi = Number(param.ni_content_pct) * cfNi * hmaNi;
  const bonusCo = Number(param.co_content_pct) * Number(param.co_cf_pct) * hmaCo;

  const totalDry = valueNi + bonusCo;
  const hpmWet = totalDry * (1 - Number(param.moisture_content_pct));

  return { cfNi, valueNi, bonusCo, totalDry, hpmWet };
}

/**
 * Ratio of the current HPM against the quotation's baseline (FR-8.3).
 *
 * Status v3.0: DORMANT. Always returns 1 (no adjustment) regardless of
 * input — the global HPM adjustment factor is cut from the active
 * calculation path (PRD FR-8.3 "dicabut/nonaktif"). The parameters
 * remain untouched below as a reference specification in case a
 * mineral component is ever found to move independently of the FX
 * rate. Do not resurrect this by reading the baseline/current HPM
 * ratio without an explicit product decision — see Technical Logic
 * §13.2.
 */
export function mineralAdjustmentFactor(
  baselineHpm: number | null | undefined,
  currentHpm: number | null | undefined
): number {
  void baselineHpm;
  void currentHpm;
  return 1;
}

export const DEFAULT_STALE_DAYS = 14;

/**
 * FR-8.5. A stale index flags the quotation but never blocks it —
 * halting commercial work because a regulation was published late costs
 * more than the risk it carries.
 */
export function isIndexStale(
  snapshot: Pick<MineralIndexSnapshot, "period_end"> | null | undefined,
  maxAgeDays: number = DEFAULT_STALE_DAYS
): boolean {
  if (!snapshot) return true;
  const ageMs = Date.now() - new Date(snapshot.period_end).getTime();
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}

export function indexAgeDays(
  snapshot: Pick<MineralIndexSnapshot, "period_end"> | null | undefined
): number | null {
  if (!snapshot) return null;
  const ageMs = Date.now() - new Date(snapshot.period_end).getTime();
  return Math.floor(ageMs / (24 * 60 * 60 * 1000));
}

export interface MineralContext {
  parameter: HpmParameter | null;
  primarySnapshot: MineralIndexSnapshot | null;
  companionSnapshot: MineralIndexSnapshot | null;
  hpm: HpmBreakdown | null;
  isStale: boolean;
}

/** Latest published HMA for a mineral. */
export async function latestSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  mineralCode: string
): Promise<MineralIndexSnapshot | null> {
  const { data } = await supabase
    .from("mineral_index_snapshot")
    .select("*")
    .eq("mineral_code", mineralCode)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as MineralIndexSnapshot | null) ?? null;
}

/**
 * Everything needed to price mineral-linked components: the active
 * parameter set, the latest HMA for the mineral and its companion, and
 * the resulting HPM.
 */
export async function loadMineralContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  mineralCode = "NI"
): Promise<MineralContext> {
  const { data: paramRow } = await supabase
    .from("hpm_parameter")
    .select("*")
    .eq("mineral_code", mineralCode)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const parameter = (paramRow as HpmParameter | null) ?? null;

  if (!parameter) {
    return {
      parameter: null,
      primarySnapshot: null,
      companionSnapshot: null,
      hpm: null,
      isStale: true,
    };
  }

  const [primarySnapshot, companionSnapshot] = await Promise.all([
    latestSnapshot(supabase, mineralCode),
    parameter.companion_mineral_code
      ? latestSnapshot(supabase, parameter.companion_mineral_code)
      : Promise.resolve(null),
  ]);

  const hpm = primarySnapshot
    ? computeHpm(
        parameter,
        Number(primarySnapshot.hma_value),
        companionSnapshot ? Number(companionSnapshot.hma_value) : 0
      )
    : null;

  return {
    parameter,
    primarySnapshot,
    companionSnapshot,
    hpm,
    isStale: isIndexStale(primarySnapshot),
  };
}
