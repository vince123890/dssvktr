import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatIDR, formatPercent } from "@/lib/utils";
import type { ProposalCalculationResult, UserRole } from "@/types/database";
import { canViewRawMargin } from "@/lib/rbac";
import { AlertTriangle, TrendingUp, Scale, Target, Coins, Pickaxe } from "lucide-react";
import { formatUSD, fromBaseCurrency } from "@/lib/pricing/currency";
import type { MineralContext } from "@/lib/pricing/mineral";

export function CalculationSummary({
  result,
  role,
  minGpmThreshold,
  mineral,
}: {
  result: ProposalCalculationResult;
  role: UserRole;
  minGpmThreshold: number;
  mineral?: MineralContext | null;
}) {
  const canSeeMargin = canViewRawMargin(role);
  const rate = Number(result.exchange_rate_used) || 0;
  const finalPriceUsd = fromBaseCurrency(Number(result.final_price), "USD", rate);
  const mineralFactor = Number(result.mineral_adjustment_factor) || 1;
  const mineralDeltaPct = (mineralFactor - 1) * 100;

  return (
    <div className="space-y-3">
      {result.is_below_gpm_threshold && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
          <AlertTriangle size={16} />
          <span>
            <strong>Margin Guardrail Alert (FR-4.2):</strong> GPM proyek ini (
            {formatPercent(result.gpm)}) berada di bawah threshold minimum{" "}
            {formatPercent(minGpmThreshold)} untuk lini bisnis ini.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={Target}
          label="Final Price"
          value={formatIDR(result.final_price)}
          subValue={rate > 0 ? formatUSD(finalPriceUsd) : undefined}
          tone="primary"
        />
        <MetricCard
          icon={TrendingUp}
          label="Gross Profit Margin"
          value={canSeeMargin ? formatPercent(result.gpm) : "••••"}
          tone={result.is_below_gpm_threshold ? "danger" : "success"}
        />
        <MetricCard
          icon={Scale}
          label="EBITDA Contribution"
          value={canSeeMargin ? formatIDR(result.ebitda_contribution) : "••••"}
          tone="default"
        />
        <MetricCard
          icon={Scale}
          label="Break-Even Point"
          value={result.bep_units ? `${result.bep_units.toFixed(1)} unit` : "—"}
          tone="default"
        />
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 text-xs lg:grid-cols-4">
          <SubMetric label="Total Direct Cost" value={formatIDR(result.total_direct_cost)} />
          <SubMetric label="Total Indirect Cost" value={formatIDR(result.total_indirect_cost)} />
          <SubMetric
            label="Total Margin Amount"
            value={canSeeMargin ? formatIDR(result.total_margin_amount) : "••••"}
          />
          <SubMetric label="FX Rate Used (USD/IDR)" value={result.fx_usd_idr_rate.toLocaleString("id-ID")} />
        </CardContent>
      </Card>

      {/* FR-8.4 — the basis of the mineral adjustment is shown openly, so a
          price rise is never buried inside the total. */}
      {mineral?.hpm && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-success-bg text-success">
                  <Pickaxe size={14} />
                </div>
                <div>
                  <div className="text-xs font-semibold">
                    Mineral Index Adjustment (HMA → HPM)
                  </div>
                  <div className="text-[11px] text-muted">
                    {mineral.primarySnapshot?.regulation_ref ?? "Kepmen ESDM"} ·
                    periode s/d {mineral.primarySnapshot?.period_end ?? "—"}
                  </div>
                </div>
              </div>
              <Badge tone={Math.abs(mineralDeltaPct) < 0.01 ? "default" : "info"}>
                Faktor {mineralFactor.toFixed(4)}
                {Math.abs(mineralDeltaPct) >= 0.01 &&
                  ` (${mineralDeltaPct > 0 ? "+" : ""}${mineralDeltaPct.toFixed(2)}%)`}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs lg:grid-cols-4">
              <SubMetric
                label={`HMA ${mineral.primarySnapshot?.mineral_code ?? "NI"} (US$/dmt)`}
                value={Number(mineral.primarySnapshot?.hma_value ?? 0).toLocaleString("en-US")}
              />
              <SubMetric
                label="CF Nikel"
                value={`${(mineral.hpm.cfNi * 100).toFixed(1)}%`}
              />
              <SubMetric
                label="HPM berjalan (US$/WMT)"
                value={mineral.hpm.hpmWet.toFixed(2)}
              />
              <SubMetric
                label="HPM baseline quotation"
                value={
                  result.hpm_value_used && mineralFactor !== 1
                    ? (Number(result.hpm_value_used) / mineralFactor).toFixed(2)
                    : mineral.hpm.hpmWet.toFixed(2)
                }
              />
            </div>

            {mineral.isStale && (
              <div className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-bg px-2.5 py-2 text-xs text-warning">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  <strong>Indeks mineral kedaluwarsa.</strong> HMA terakhir sudah
                  melewati batas kesegaran — dasar harga mineral perlu
                  diperbarui. Quotation tetap dapat diproses.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {rate > 0 && (
        <p className="text-[11px] text-muted flex items-center gap-1.5">
          <Coins size={12} />
          Input quotation ini dalam{" "}
          <strong>{result.input_currency}</strong>; dikonversi memakai kurs{" "}
          {rate.toLocaleString("id-ID")} IDR/USD yang tersimpan bersama hasil ini.
        </p>
      )}

      {!canSeeMargin && (
        <p className="text-[11px] text-muted flex items-center gap-1.5">
          <Badge tone="default">RBAC</Badge>
          Raw margin dan EBITDA disembunyikan sesuai peran Anda (Sales hanya
          melihat final price target — NFR Security).
        </p>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  tone: "primary" | "success" | "danger" | "default";
}) {
  const toneClasses = {
    primary: "text-primary bg-blue-50",
    success: "text-success bg-success-bg",
    danger: "text-danger bg-danger-bg",
    default: "text-muted bg-muted-bg",
  }[tone];

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneClasses}`}>
          <Icon size={16} />
        </div>
        <div className="text-[11px] text-muted">{label}</div>
        <div className="text-lg font-semibold leading-tight">{value}</div>
        {subValue && (
          <div className="text-[11px] text-muted font-medium">≈ {subValue}</div>
        )}
      </CardContent>
    </Card>
  );
}

function SubMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div className="font-medium text-foreground mt-0.5">{value}</div>
    </div>
  );
}
