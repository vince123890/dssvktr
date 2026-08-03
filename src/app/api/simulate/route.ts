import { createClient } from "@/lib/supabase/server";
import { calculatePricing } from "@/lib/pricing/engine";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { BusinessLine, CostItem } from "@/types/database";

/**
 * FR-4.1 What-If Sensitivity Simulator — stateless endpoint.
 * Re-runs the same pricing engine used for the "official" calculation
 * (Technical Logic §7.1) with slider overrides, but never writes to
 * pricing_proposal_version / proposal_calculation_result.
 */

const BodySchema = z.object({
  proposalId: z.string().uuid(),
  fxDeltaPct: z.number().default(0),
  materialCostDeltaPct: z.number().default(0),
  volumeDiscountPct: z.number().default(0),
});

export async function POST(request: Request) {
  const json = await request.json();
  const body = BodySchema.parse(json);

  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from("pricing_proposal")
    .select("*")
    .eq("id", body.proposalId)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const { data: template } = await supabase
    .from("cbs_template")
    .select("*")
    .eq("id", proposal.cbs_template_id)
    .single();

  const { data: templateItems } = await supabase
    .from("cbs_template_item")
    .select("cost_item_id, cost_item(*)")
    .eq("template_id", proposal.cbs_template_id);

  const costItems: CostItem[] = (templateItems ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => row.cost_item)
    .filter(Boolean);

  const { data: costLines } = await supabase
    .from("proposal_cost_line")
    .select("*")
    .eq("proposal_version_id", proposal.current_version_id);

  const costLineValues: Record<string, number> = {};
  for (const line of costLines ?? []) {
    costLineValues[line.cost_item_id] = Number(line.value);
  }

  const { data: fxSnapshot } = await supabase
    .from("external_rate_snapshot")
    .select("*")
    .eq("rate_type", "FX_USD_IDR")
    .order("effective_at", { ascending: false })
    .limit(1)
    .single();

  const fxRate = fxSnapshot ? Number(fxSnapshot.value) : 16000;

  const baseCase = calculatePricing({
    businessLine: proposal.business_line as BusinessLine,
    costItems,
    costLineValues,
    unitQuantity: proposal.unit_quantity,
    fxUsdIdrRate: fxRate,
    fxBaselineRate: fxRate,
    minGpmThreshold: Number(template?.min_gpm_threshold ?? 0.12),
  });

  const simulatedCase = calculatePricing({
    businessLine: proposal.business_line as BusinessLine,
    costItems,
    costLineValues,
    unitQuantity: proposal.unit_quantity,
    fxUsdIdrRate: fxRate,
    fxBaselineRate: fxRate,
    minGpmThreshold: Number(template?.min_gpm_threshold ?? 0.12),
    simulation: {
      fxDeltaPct: body.fxDeltaPct,
      materialCostDeltaPct: body.materialCostDeltaPct,
      volumeDiscountPct: body.volumeDiscountPct,
    },
  });

  return NextResponse.json({
    baseCase: {
      finalPrice: baseCase.finalPrice,
      gpm: baseCase.gpm,
      ebitdaContribution: baseCase.ebitdaContribution,
      bepUnits: baseCase.bepUnits,
    },
    simulatedCase: {
      finalPrice: simulatedCase.finalPrice,
      gpm: simulatedCase.gpm,
      ebitdaContribution: simulatedCase.ebitdaContribution,
      bepUnits: simulatedCase.bepUnits,
    },
    delta: {
      finalPrice: simulatedCase.finalPrice - baseCase.finalPrice,
      gpmPctPoints: (simulatedCase.gpm - baseCase.gpm) * 100,
      ebitdaContribution: simulatedCase.ebitdaContribution - baseCase.ebitdaContribution,
    },
    isBelowThreshold: simulatedCase.isBelowGpmThreshold,
    minGpmThreshold: Number(template?.min_gpm_threshold ?? 0.12),
  });
}
