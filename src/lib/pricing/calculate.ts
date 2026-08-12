import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CbsTemplate,
  CostItem,
  CurrencyCode,
  ProposalCalculationResult,
} from "@/types/database";
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
 * The rate and mineral index in force are stored alongside the result so
 * an approved price can always be explained by the figures that produced
 * it, and does not drift when either moves (FR-1.4.3, FR-8.4).
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
    /** Currency the cost lines were entered in (FR-1.4.1). */
    inputCurrency?: CurrencyCode;
    /** HPM captured when the quotation was created (FR-8.3). */
    baselineHpmValue?: number | null;
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

  const inputCurrency: CurrencyCode = params.inputCurrency ?? "IDR";

  // Which mineral this quotation's components track. Falls back to
  // nickel, the only index seeded for the demo CBS.
  const mineralCode =
    costItems.find((c) => c.is_mineral_linked)?.mineral_code ?? "NI";

  const [exchangeRate, mineral] = await Promise.all([
    resolveExchangeRate(supabase),
    loadMineralContext(supabase, mineralCode),
  ]);

  const fxRate = exchangeRate ? Number(exchangeRate.rate) : 16350;
  const currentHpm = mineral.hpm?.hpmWet ?? null;
  const factor = mineralAdjustmentFactor(params.baselineHpmValue, currentHpm);

  const result = calculatePricing({
    businessLine: params.businessLine,
    costItems,
    costLineValues,
    unitQuantity: params.unitQuantity,
    fxUsdIdrRate: fxRate,
    fxBaselineRate: fxRate,
    minGpmThreshold: Number(template.min_gpm_threshold),
    inputCurrency,
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
      input_currency: inputCurrency,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return saved as ProposalCalculationResult;
}
