import type { SupabaseClient } from "@supabase/supabase-js";
import type { CostItem, ProposalCalculationResult } from "@/types/database";
import { calculatePricing } from "./engine";
import { resolveExchangeRate } from "./currency";
import { loadMineralContext, mineralAdjustmentFactor } from "./mineral";

/**
 * Shared helper: load everything needed to (re)calculate a proposal
 * version, run the pricing engine, and persist an immutable
 * `proposal_calculation_result` snapshot. Used both by the "official"
 * calculation path (on submit) and can be reused for what-if endpoints
 * in read-only mode (Technical Logic §3.3/§7.1 — same engine, two
 * callers).
 *
 * The rate in force is stored alongside the result so an approved
 * price can always be explained by the figures that produced it, and
 * does not drift when it moves later (FR-1.4.3). HMA/HPM is stored for
 * reference/transparency only (FR-8.4) — it no longer drives the
 * price (§13).
 */
export async function recalculateAndPersist(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  params: {
    proposalId: string;
    proposalVersionId: string;
    cbsTemplateId: string;
    unitQuantity: number;
    /** Approved negotiation discount, applied to the official price (§11.4). */
    volumeDiscountPct?: number;
  }
): Promise<ProposalCalculationResult> {
  const [{ data: template }, { data: templateItems }, { data: costLines }] =
    await Promise.all([
      supabase.from("cbs_template").select("*").eq("id", params.cbsTemplateId).single(),
      supabase
        .from("cbs_template_item")
        .select("cost_item_id, cost_item(*)")
        .eq("template_id", params.cbsTemplateId),
      supabase
        .from("proposal_cost_line")
        .select("*")
        .eq("proposal_version_id", params.proposalVersionId),
    ]);

  if (!template) throw new Error("CBS template not found");

  const costItems: CostItem[] = (templateItems ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => row.cost_item)
    .filter(Boolean);

  const costLineValues: Record<string, number> = {};
  for (const line of costLines ?? []) {
    costLineValues[line.cost_item_id] = Number(line.value);
  }

  // Which mineral this quotation's components track (reference only —
  // see mineral.ts). Falls back to nickel, the only index seeded.
  const mineralCode =
    costItems.find((c) => c.is_mineral_linked)?.mineral_code ?? "NI";

  const [exchangeRate, mineral] = await Promise.all([
    resolveExchangeRate(supabase),
    loadMineralContext(supabase, mineralCode),
  ]);

  const fxRate = exchangeRate ? Number(exchangeRate.rate) : 2600;
  const currentHpm = mineral.hpm?.hpmWet ?? null;
  // Dormant in v3.0 — always 1 regardless of baseline/current HPM.
  const factor = mineralAdjustmentFactor(null, currentHpm);

  const result = calculatePricing({
    costItems,
    costLineValues,
    unitQuantity: params.unitQuantity,
    fxRate,
    fxBaselineRate: fxRate,
    minGpmThreshold: Number(template.min_gpm_threshold),
    mineralAdjustmentFactor: factor,
    simulation: params.volumeDiscountPct
      ? { volumeDiscountPct: params.volumeDiscountPct }
      : undefined,
  });

  const { data: saved, error } = await supabase
    .from("proposal_calculation_result")
    .insert({
      proposal_version_id: params.proposalVersionId,
      total_direct_cost: result.totalDirectCost,
      total_indirect_cost: result.totalIndirectCost,
      total_margin_amount: result.totalMarginAmount,
      final_price: result.finalPrice,
      gpm: result.gpm,
      ebitda_contribution: result.ebitdaContribution,
      bep_units: result.bepUnits,
      fx_usd_idr_rate: result.effectiveFxRate,
      breakdown: result.breakdown,
      is_below_gpm_threshold: result.isBelowGpmThreshold,
      exchange_rate_used: result.effectiveFxRate,
      exchange_rate_id: exchangeRate?.id ?? null,
      hpm_value_used: currentHpm,
      mineral_adjustment_factor: result.effectiveMineralFactor,
      input_currency: "CNY",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await supabase
    .from("pricing_proposal")
    .update({ last_calculated_rate_id: exchangeRate?.id ?? null })
    .eq("id", params.proposalId);

  return saved as ProposalCalculationResult;
}
