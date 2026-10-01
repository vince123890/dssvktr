import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { requireMenu } from "@/lib/menuAccess";
import { canSeeCostStructure } from "@/lib/rbac";
import { WhatIfSimulator } from "./WhatIfSimulator";
import { GuardrailAlerts } from "./GuardrailAlerts";
import { WinLossAnalytics, type WinLossPoint, type OptimalBand } from "./WinLossAnalytics";
import type { PricingProposal, QuotationLineItem } from "@/types/database";

export default async function DssPage() {
  const me = await requireMenu("dss");
  if (!canSeeCostStructure(me)) notFound();
  const supabase = await createClient();

  const [{ data: proposalsData }, { data: lineRows }] = await Promise.all([
    supabase.from("pricing_proposal").select("*").order("created_at", { ascending: false }),
    supabase.from("quotation_line_item").select("*"),
  ]);
  const proposals = (proposalsData ?? []) as PricingProposal[];
  const lines = (lineRows ?? []) as QuotationLineItem[];
  const priced = proposals.filter((p) => p.gm != null && Number(p.total_ex_vat) > 0);

  // FR-4.2 guardrail: live or released quotations whose GM falls below the Tier 1 bound (15%).
  const alerts = priced
    .filter((p) => Number(p.gm) < 0.15 && !["SUPERSEDED", "EXPIRED", "REJECTED"].includes(p.current_status) && p.outcome === "PENDING")
    .map((p) => ({
      proposalId: p.id,
      proposalNumber: p.document_number ?? p.proposal_number,
      title: p.title,
      gpm: Number(p.gm),
      minThreshold: 0.15,
      finalPrice: Number(p.total_ex_vat),
      createdAt: p.updated_at,
    }));

  // FR-4.3 Win/Loss: markup of net price over base cost, per business line.
  const points: WinLossPoint[] = priced
    .filter((p) => p.outcome === "WON" || p.outcome === "LOST")
    .map((p): WinLossPoint | null => {
      const ls = lines.filter((l) => l.proposal_id === p.id);
      const base = ls.reduce((s, l) => s + Number(l.base_cost) * l.quantity, 0);
      const net = ls.reduce((s, l) => s + (Number(l.net_price_ex_vat) - Number(l.sales_cost)) * l.quantity, 0);
      if (base <= 0) return null;
      return { proposalNumber: p.proposal_number, businessLine: p.business_line, markupRatio: (net - base) / base, outcome: p.outcome as "WON" | "LOST" };
    })
    .filter((x): x is WinLossPoint => x !== null)
    .sort((a, b) => a.proposalNumber.localeCompare(b.proposalNumber));

  const bands: OptimalBand[] = Array.from(new Set(points.map((p) => p.businessLine))).map((bl) => {
    const won = points.filter((p) => p.businessLine === bl && p.outcome === "WON").map((p) => p.markupRatio);
    const lost = points.filter((p) => p.businessLine === bl && p.outcome === "LOST").map((p) => p.markupRatio);
    return {
      businessLine: bl,
      wonMin: won.length ? Math.min(...won) : 0,
      wonMax: won.length ? Math.max(...won) : 0,
      wonAvg: won.length ? won.reduce((a, b) => a + b, 0) / won.length : 0,
      lostAvg: lost.length ? lost.reduce((a, b) => a + b, 0) / lost.length : null,
      sampleSize: won.length + lost.length,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Decision Support System (DSS)</h1>
        <p className="mt-1 text-sm text-muted">
          What-if kurs CNY/IDR, harga FOB, dan diskon tambahan terhadap GM & tier; margin guardrail 15%/10%; win/loss analytics.
        </p>
      </div>
      <WhatIfSimulator proposals={priced.map((p) => ({ id: p.id, label: `${p.document_number ?? p.proposal_number} — ${p.title}` }))} />
      <GuardrailAlerts alerts={alerts} />
      <WinLossAnalytics points={points} bands={bands} />
    </div>
  );
}
