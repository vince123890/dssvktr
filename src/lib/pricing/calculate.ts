import type { SupabaseClient } from "@supabase/supabase-js";
import type { CbsTemplate, CostItem, ProposalCalculationResult } from "@/types/database";
import { calculatePricing } from "./engine";

/**
 * Shared helper: load everything needed to (re)calculate a proposal
 * version, run the pricing engine, and persist an immutable
 * `proposal_calculation_result` snapshot. Used both by the "official"
 * calculation path (on submit) and can be reused for what-if endpoints
 * in read-only mode (Technical Logic §3.3/§7.1 — same engine, two
 * callers).
 */
export async function recalculateAndPersist(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  params: {
    proposalVersionId: string;
    cbsTemplateId: string;
    unitQuantity: number;
    businessLine: CbsTemplate["business_line"];
    /** Approved negotiation discount, applied to the official price (§11.4). */
    volumeDiscountPct?: number;
  }
): Promise<ProposalCalculationResult> {
  const [{ data: template }, { data: templateItems }, { data: costLines }, { data: fxSnapshot }] =
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
      supabase
        .from("external_rate_snapshot")
        .select("*")
        .eq("rate_type", "FX_USD_IDR")
        .order("effective_at", { ascending: false })
        .limit(1)
        .single(),
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

  const fxRate = fxSnapshot ? Number(fxSnapshot.value) : 16000;

  const result = calculatePricing({
    businessLine: params.businessLine,
    costItems,
    costLineValues,
    unitQuantity: params.unitQuantity,
    fxUsdIdrRate: fxRate,
    fxBaselineRate: fxRate,
    minGpmThreshold: Number(template.min_gpm_threshold),
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
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return saved as ProposalCalculationResult;
}
