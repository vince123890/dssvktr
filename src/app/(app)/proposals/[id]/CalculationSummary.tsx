import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatIDR, formatPercent } from "@/lib/utils";
import type { ProposalCalculationResult, UserRole } from "@/types/database";
import { canViewRawMargin } from "@/lib/rbac";
import { AlertTriangle, TrendingUp, Scale, Target, Coins, Pickaxe } from "lucide-react";
import { formatCNY, fromBaseCurrency } from "@/lib/pricing/currency";
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
  const finalPriceCny = fromBaseCurrency(Number(result.final_price), "CNY", rate);

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
          subValue={rate > 0 ? formatCNY(finalPriceCny) : undefined}
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
          <SubMetric label="Base Cost (COGS + Add-Ons)" value={formatIDR(result.total_direct_cost)} />
          <SubMetric
            label="Margin (Profitability)"
            value={canSeeMargin ? formatIDR(result.total_margin_amount) : "••••"}
          />
          <SubMetric label="Kurs CNY/IDR (RMB)" value={rate.toLocaleString("id-ID")} />
        </CardContent>
      </Card>

      {/* FR-8.4 — reference only in v3.0: HMA/HPM is shown as market
          context, not multiplied into the calculation (see mineral.ts). */}
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
                    Mineral Index (Referensi) — HMA → HPM
                  </div>
                  <div className="text-[11px] text-muted">
                    {mineral.primarySnapshot?.regulation_ref ?? "Kepmen ESDM"} ·
                    periode s/d {mineral.primarySnapshot?.period_end ?? "—"}
                  </div>
                </div>
              </div>
              <Badge tone="default">Tidak memengaruhi harga (v3.0)</Badge>
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
            </div>

            <p className="text-[11px] text-muted">
              Dampak pergerakan mineral internasional terhadap harga VKTR berjalan
              melalui kurs CNY/IDR — bukan faktor pengali terpisah (PRD FR-8.3).
            </p>

            {mineral.isStale && (
              <div className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-bg px-2.5 py-2 text-xs text-warning">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  <strong>Indeks mineral kedaluwarsa.</strong> HMA terakhir sudah
                  melewati batas kesegaran. Quotation tetap dapat diproses.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {rate > 0 && (
        <p className="text-[11px] text-muted flex items-center gap-1.5">
          <Coins size={12} />
          Komponen impor (FOB Price) dikonversi memakai kurs{" "}
          {rate.toLocaleString("id-ID")} IDR/CNY yang tersimpan bersama hasil ini.
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
