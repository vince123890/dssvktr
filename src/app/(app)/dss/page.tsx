import { createClient } from "@/lib/supabase/server";
import { WhatIfSimulator } from "./WhatIfSimulator";
import { GuardrailAlerts } from "./GuardrailAlerts";
import { WinLossAnalytics, type WinLossPoint, type OptimalBand } from "./WinLossAnalytics";
import type { PricingProposal } from "@/types/database";

export default async function DssPage() {
  const supabase = await createClient();

  const { data: proposalsData } = await supabase
    .from("pricing_proposal")
    .select("*")
    .order("created_at", { ascending: false });

  const proposals = (proposalsData ?? []) as PricingProposal[];

  // Margin guardrail alerts: latest calculation result per proposal that
  // is below its own CBS template's GPM threshold.
  const { data: belowThresholdResults } = await supabase
    .from("proposal_calculation_result")
    .select("*, pricing_proposal_version!inner(proposal_id, is_current)")
    .eq("is_below_gpm_threshold", true)
    .eq("pricing_proposal_version.is_current", true)
    .order("created_at", { ascending: false });

  const proposalById = Object.fromEntries(proposals.map((p) => [p.id, p]));

  const alerts = (belowThresholdResults ?? [])
    .map((r) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const proposalId = (r as any).pricing_proposal_version?.proposal_id;
      const proposal = proposalById[proposalId];
      if (!proposal) return null;
      return {
        proposalId: proposal.id,
        proposalNumber: proposal.proposal_number,
        title: proposal.title,
        gpm: Number(r.gpm),
        minThreshold: 0, // filled below from template
        finalPrice: Number(r.final_price),
        createdAt: r.created_at,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  const { data: templates } = await supabase.from("cbs_template").select("*");
  const thresholdByBusinessLine = Object.fromEntries(
    (templates ?? []).map((t) => [t.business_line, Number(t.min_gpm_threshold)])
  );
  for (const alert of alerts) {
    const proposal = proposalById[alert.proposalId];
    alert.minThreshold = thresholdByBusinessLine[proposal.business_line] ?? 0.12;
  }

  // Win/Loss analytics: proposals with outcome WON/LOST + their latest calc result
  const decidedProposals = proposals.filter(
    (p) => p.outcome === "WON" || p.outcome === "LOST" || p.outcome === "CANCELLED"
  );

  const { data: allResults } = await supabase
    .from("proposal_calculation_result")
    .select("*, pricing_proposal_version!inner(proposal_id, is_current)")
    .eq("pricing_proposal_version.is_current", true);

  const resultByProposalId = new Map<string, { finalPrice: number; totalCost: number }>();
  for (const r of allResults ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pid = (r as any).pricing_proposal_version?.proposal_id;
    if (!pid) continue;
    resultByProposalId.set(pid, {
      finalPrice: Number(r.final_price),
      totalCost: Number(r.total_direct_cost) + Number(r.total_indirect_cost),
    });
  }

  const points: WinLossPoint[] = decidedProposals
    .map((p): WinLossPoint | null => {
      const result = resultByProposalId.get(p.id);
      if (!result || result.totalCost <= 0) return null;
      return {
        proposalNumber: p.proposal_number,
        businessLine: p.business_line,
        markupRatio: (result.finalPrice - result.totalCost) / result.totalCost,
        outcome: p.outcome as "WON" | "LOST" | "CANCELLED",
      };
    })
    .filter((p): p is WinLossPoint => p !== null)
    .sort((a, b) => a.proposalNumber.localeCompare(b.proposalNumber));

  const businessLines = Array.from(new Set(points.map((p) => p.businessLine)));
  const bands: OptimalBand[] = businessLines.map((bl) => {
    const won = points.filter((p) => p.businessLine === bl && p.outcome === "WON");
    const lost = points.filter((p) => p.businessLine === bl && p.outcome === "LOST");
    const wonRatios = won.map((p) => p.markupRatio);
    const wonMin = wonRatios.length ? Math.min(...wonRatios) : 0;
    const wonMax = wonRatios.length ? Math.max(...wonRatios) : 0;
    const wonAvg = wonRatios.length ? wonRatios.reduce((a, b) => a + b, 0) / wonRatios.length : 0;
    const lostRatios = lost.map((p) => p.markupRatio);
    const lostAvg = lostRatios.length
      ? lostRatios.reduce((a, b) => a + b, 0) / lostRatios.length
      : null;

    return {
      businessLine: bl,
      wonMin,
      wonMax,
      wonAvg,
      lostAvg,
      sampleSize: won.length + lost.length,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Decision Support System (DSS)</h1>
        <p className="text-sm text-muted mt-1">
          Modul analitis berbasis data untuk membantu manajemen menetapkan
          harga secara presisi (Module 4 PRD) — simulasi what-if, margin
          guardrails, dan win/loss analytics.
        </p>
      </div>

      <WhatIfSimulator proposals={proposals} />
      <GuardrailAlerts alerts={alerts} />
      <WinLossAnalytics points={points} bands={bands} />
    </div>
  );
}
