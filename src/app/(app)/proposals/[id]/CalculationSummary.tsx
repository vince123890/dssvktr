import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatIDR, formatPercent } from "@/lib/utils";
import type { ProposalCalculationResult, UserRole } from "@/types/database";
import { canViewRawMargin } from "@/lib/rbac";
import { AlertTriangle, TrendingUp, Scale, Target } from "lucide-react";

export function CalculationSummary({
  result,
  role,
  minGpmThreshold,
}: {
  result: ProposalCalculationResult;
  role: UserRole;
  minGpmThreshold: number;
}) {
  const canSeeMargin = canViewRawMargin(role);

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
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
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
