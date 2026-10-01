import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { canSeeCostStructure } from "@/lib/rbac";
import { actorCanUseMenu } from "@/lib/menuAccess";
import { loadCostItems, loadVersionLines } from "@/lib/costStructure";
import { computeCostStructure, resolveTier } from "@/lib/pricing/quotation";
import { loadLadder, loadLines } from "@/lib/workflow/quotationEngine";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { PricingProposal } from "@/types/database";

/**
 * FR-4.1 What-If — stateless. Re-runs the same pricing engine as the
 * official path (Technical Logic §7.1) on a quotation's locked cost
 * structures with the slider overrides, and never writes anything.
 *
 * The price stays as quoted; the sliders move the COST (CNY rate, FOB
 * price) and add an extra discount, so the result answers "what margin
 * and which tier would this deal land in if ...".
 */

const BodySchema = z.object({
  proposalId: z.string().min(1),
  fxDeltaPct: z.number().default(0),
  fobDeltaPct: z.number().default(0),
  extraDiscountPct: z.number().default(0),
});

export async function POST(request: Request) {
  const me = await getCurrentProfile();
  if (!me || !canSeeCostStructure(me) || !(await actorCanUseMenu(me, "dss"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = BodySchema.parse(await request.json());
  const supabase = await createClient();

  const { data: row } = await supabase.from("pricing_proposal").select("*").eq("id", body.proposalId).maybeSingle();
  if (!row) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  const proposal = row as PricingProposal;

  const [items, lines, ladder] = await Promise.all([
    loadCostItems(supabase),
    loadLines(supabase, proposal.id),
    loadLadder(supabase, proposal.business_line),
  ]);

  let baseMargin = 0, baseRevenue = 0, simMargin = 0, simRevenue = 0, baseTotal = 0, simTotal = 0;
  for (const l of lines) {
    if (!l.cost_structure_version_id) continue;
    const vLines = await loadVersionLines(supabase, l.cost_structure_version_id);
    const values: Record<string, number> = {};
    const excluded = new Set<string>();
    for (const vl of vLines) {
      const item = items.find((i) => i.id === vl.cost_item_id);
      const fobMove = item?.denomination === "CNY" ? 1 + body.fobDeltaPct / 100 : 1;
      values[vl.cost_item_id] = Number(vl.value) * fobMove;
      if (vl.is_excluded_at_cost) excluded.add(vl.cost_item_id);
    }
    const rate = Number(l.locked_fx_rate ?? 0) * (1 + body.fxDeltaPct / 100);
    const cs = computeCostStructure({ items, values, excluded, fxRate: rate });

    const net = Number(l.net_price_ex_vat);
    const simNet = net * (1 - body.extraDiscountPct / 100);
    const sales = Number(l.sales_cost);
    baseMargin += (net - sales - Number(l.base_cost)) * l.quantity;
    baseRevenue += (net - sales) * l.quantity;
    simMargin += (simNet - sales - cs.baseCost) * l.quantity;
    simRevenue += (simNet - sales) * l.quantity;
    baseTotal += net * l.quantity;
    simTotal += simNet * l.quantity;

  }

  const baseGm = baseRevenue > 0 ? baseMargin / baseRevenue : 0;
  const simGm = simRevenue > 0 ? simMargin / simRevenue : 0;
  const baseTier = resolveTier(baseGm * 100, ladder)?.tier ?? null;
  const simTier = resolveTier(simGm * 100, ladder)?.tier ?? null;

  return NextResponse.json({
    baseCase: { totalExVat: baseTotal, gm: baseGm, margin: baseMargin, tier: baseTier },
    simulatedCase: { totalExVat: simTotal, gm: simGm, margin: simMargin, tier: simTier },
    delta: { gmPctPoints: (simGm - baseGm) * 100, margin: simMargin - baseMargin, totalExVat: simTotal - baseTotal },
  });
}
