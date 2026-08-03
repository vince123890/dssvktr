"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { formatIDR, formatPercent } from "@/lib/utils";
import type { PricingProposal } from "@/types/database";
import { useEffect, useState, useTransition } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

interface SimResponse {
  baseCase: { finalPrice: number; gpm: number; ebitdaContribution: number; bepUnits: number | null };
  simulatedCase: { finalPrice: number; gpm: number; ebitdaContribution: number; bepUnits: number | null };
  delta: { finalPrice: number; gpmPctPoints: number; ebitdaContribution: number };
  isBelowThreshold: boolean;
  minGpmThreshold: number;
}

export function WhatIfSimulator({ proposals }: { proposals: PricingProposal[] }) {
  const eligible = proposals.filter((p) => p.transaction_value > 0);
  const [proposalId, setProposalId] = useState(eligible[0]?.id ?? "");
  const [fxDeltaPct, setFxDeltaPct] = useState(0);
  const [materialCostDeltaPct, setMaterialCostDeltaPct] = useState(0);
  const [volumeDiscountPct, setVolumeDiscountPct] = useState(0);
  const [result, setResult] = useState<SimResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!proposalId) return;
    startTransition(async () => {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, fxDeltaPct, materialCostDeltaPct, volumeDiscountPct }),
      });
      if (res.ok) setResult(await res.json());
    });
  }, [proposalId, fxDeltaPct, materialCostDeltaPct, volumeDiscountPct]);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>&quot;What-If&quot; Sensitivity Simulator</CardTitle>
          <CardDescription>
            FR-4.1 — simulasi real-time dampak kurs, harga material, dan
            diskon volume terhadap GPM/EBITDA/BEP tanpa mengubah data resmi proposal.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="block text-xs font-medium text-muted space-y-1.5">
          <span>Pilih Proposal (harus sudah punya kalkulasi harga)</span>
          <select
            value={proposalId}
            onChange={(e) => setProposalId(e.target.value)}
            className="w-full rounded-lg border border-card-border px-3 py-2 text-sm"
          >
            {eligible.map((p) => (
              <option key={p.id} value={p.id}>
                {p.proposal_number} — {p.title}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <SliderField
            label="Fluktuasi Kurs USD/IDR"
            value={fxDeltaPct}
            onChange={setFxDeltaPct}
            min={-10}
            max={10}
            step={0.5}
            suffix="%"
          />
          <SliderField
            label="Perubahan Harga Material Baterai/Impor"
            value={materialCostDeltaPct}
            onChange={setMaterialCostDeltaPct}
            min={-20}
            max={20}
            step={1}
            suffix="%"
          />
          <SliderField
            label="Volume Discount"
            value={volumeDiscountPct}
            onChange={setVolumeDiscountPct}
            min={0}
            max={15}
            step={0.5}
            suffix="%"
          />
        </div>

        {result && (
          <div className={isPending ? "opacity-50 transition-opacity" : "transition-opacity"}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <ComparisonMetric
                label="Final Price"
                base={formatIDR(result.baseCase.finalPrice)}
                simulated={formatIDR(result.simulatedCase.finalPrice)}
                delta={result.delta.finalPrice}
                formatDelta={(d) => formatIDR(d)}
              />
              <ComparisonMetric
                label="Gross Profit Margin"
                base={formatPercent(result.baseCase.gpm)}
                simulated={formatPercent(result.simulatedCase.gpm)}
                delta={result.delta.gpmPctPoints}
                formatDelta={(d) => `${d.toFixed(2)} pts`}
                warn={result.isBelowThreshold}
              />
              <ComparisonMetric
                label="EBITDA Contribution"
                base={formatIDR(result.baseCase.ebitdaContribution)}
                simulated={formatIDR(result.simulatedCase.ebitdaContribution)}
                delta={result.delta.ebitdaContribution}
                formatDelta={(d) => formatIDR(d)}
              />
            </div>

            {result.isBelowThreshold && (
              <p className="mt-3 text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">
                Pada skenario ini, GPM ({formatPercent(result.simulatedCase.gpm)}) turun di
                bawah threshold minimum ({formatPercent(result.minGpmThreshold)}) — margin
                guardrail akan memicu alert saat kalkulasi resmi (FR-4.2).
              </p>
            )}
          </div>
        )}

        {eligible.length === 0 && (
          <p className="text-sm text-muted text-center py-6">
            Belum ada proposal dengan kalkulasi harga. Isi CBS cost lines pada
            sebuah proposal terlebih dahulu.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-semibold text-foreground">
          {value > 0 ? "+" : ""}
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
    </label>
  );
}

function ComparisonMetric({
  label,
  base,
  simulated,
  delta,
  formatDelta,
  warn,
}: {
  label: string;
  base: string;
  simulated: string;
  delta: number;
  formatDelta: (d: number) => string;
  warn?: boolean;
}) {
  const isNegative = delta < 0;
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-danger/30 bg-danger-bg" : "border-card-border"}`}>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-base font-semibold mt-1">{simulated}</div>
      <div className="text-[11px] text-muted mt-0.5">Base case: {base}</div>
      <div
        className={`flex items-center gap-1 text-[11px] font-medium mt-1 ${
          isNegative ? "text-danger" : "text-success"
        }`}
      >
        {isNegative ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
        {formatDelta(delta)}
      </div>
    </div>
  );
}
