"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatIDR, formatPercent } from "@/lib/utils";
import { useEffect, useState, useTransition } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

interface Case {
  totalExVat: number;
  gm: number;
  margin: number;
  tier: number | null;
}
interface SimResponse {
  baseCase: Case;
  simulatedCase: Case;
  delta: { gmPctPoints: number; margin: number; totalExVat: number };
}

/**
 * FR-4.1 — what if the CNY rate or FOB price moves, or the customer
 * asks for more discount, on a quotation whose price is already quoted?
 * Shows the GM and the margin tier the deal would land in.
 */
export function WhatIfSimulator({ proposals }: { proposals: { id: string; label: string }[] }) {
  const [proposalId, setProposalId] = useState(proposals[0]?.id ?? "");
  const [fxDeltaPct, setFx] = useState(0);
  const [fobDeltaPct, setFob] = useState(0);
  const [extraDiscountPct, setDisc] = useState(0);
  const [result, setResult] = useState<SimResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!proposalId) return;
    startTransition(async () => {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, fxDeltaPct, fobDeltaPct, extraDiscountPct }),
      });
      if (res.ok) setResult(await res.json());
    });
  }, [proposalId, fxDeltaPct, fobDeltaPct, extraDiscountPct]);

  const tierTone = (t: number | null) => (t === 1 ? "success" : t === 2 ? "warning" : "danger");

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>&quot;What-If&quot; Sensitivity Simulator</CardTitle>
          <CardDescription>
            Harga quotation tetap; slider menggeser biaya (kurs CNY/IDR, FOB) dan diskon tambahan — lihat GM dan tier yang
            akan berlaku. Tidak mengubah data resmi.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <select value={proposalId} onChange={(e) => setProposalId(e.target.value)} className="pc-input">
          {proposals.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Slider label="Kurs CNY/IDR (RMB)" value={fxDeltaPct} onChange={setFx} min={-10} max={10} step={0.5} />
          <Slider label="Harga FOB (CNY)" value={fobDeltaPct} onChange={setFob} min={-20} max={20} step={1} />
          <Slider label="Diskon tambahan" value={extraDiscountPct} onChange={setDisc} min={0} max={15} step={0.5} />
        </div>

        {result && (
          <div className={`grid grid-cols-1 gap-3 md:grid-cols-3 ${isPending ? "opacity-50" : ""}`}>
            <Metric label="Gross Margin" base={formatPercent(result.baseCase.gm, 2)} sim={formatPercent(result.simulatedCase.gm, 2)} delta={result.delta.gmPctPoints} fmt={(d) => `${d.toFixed(2)} pts`} />
            <Metric label="Margin (Rp)" base={formatIDR(result.baseCase.margin)} sim={formatIDR(result.simulatedCase.margin)} delta={result.delta.margin} fmt={formatIDR} />
            <div className="rounded-lg border border-card-border p-3">
              <div className="text-[11px] text-muted">Tier margin</div>
              <div className="mt-1 flex items-center gap-2">
                <Badge tone={tierTone(result.baseCase.tier)}>Saat ini Tier {result.baseCase.tier ?? "-"}</Badge>
                <span className="text-muted">→</span>
                <Badge tone={tierTone(result.simulatedCase.tier)}>Simulasi Tier {result.simulatedCase.tier ?? "-"}</Badge>
              </div>
              <div className="mt-1 text-[11px] text-muted">Tier 2 = COGS + Profitability Owner · Tier 3 = CCO + CFO</div>
            </div>
          </div>
        )}
        {proposals.length === 0 && <p className="py-6 text-center text-sm text-muted">Belum ada quotation yang sudah di-generate.</p>}
      </CardContent>
    </Card>
  );
}

function Slider({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-semibold">{value > 0 ? "+" : ""}{value}%</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-blue-600" />
    </label>
  );
}

function Metric({ label, base, sim, delta, fmt }: { label: string; base: string; sim: string; delta: number; fmt: (d: number) => string }) {
  const neg = delta < 0;
  return (
    <div className="rounded-lg border border-card-border p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 text-base font-semibold">{sim}</div>
      <div className="mt-0.5 text-[11px] text-muted">Saat ini: {base}</div>
      <div className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${neg ? "text-danger" : "text-success"}`}>
        {neg ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
        {fmt(delta)}
      </div>
    </div>
  );
}
