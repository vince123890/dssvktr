import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatIDR, formatPercent, timeAgo } from "@/lib/utils";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface AlertRow {
  proposalId: string;
  proposalNumber: string;
  title: string;
  gpm: number;
  minThreshold: number;
  finalPrice: number;
  createdAt: string;
}

export function GuardrailAlerts({ alerts }: { alerts: AlertRow[] }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Intelligent Margin Guardrails</CardTitle>
          <CardDescription>
            FR-4.2 — proposal dengan kombinasi biaya yang membuat GPM di
            bawah threshold minimum lini bisnis.
          </CardDescription>
        </div>
        <Badge tone={alerts.length > 0 ? "danger" : "success"}>
          {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.length === 0 && (
          <p className="text-sm text-muted text-center py-6">
            Tidak ada proposal yang melanggar margin threshold saat ini.
          </p>
        )}
        {alerts.map((a) => (
          <Link
            key={a.proposalId}
            href={`/proposals/${a.proposalId}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger-bg px-4 py-3 hover:border-danger/40"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-danger mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium">{a.title}</div>
                <div className="text-[11px] text-muted font-mono">{a.proposalNumber}</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-semibold text-danger">{formatPercent(a.gpm)}</div>
              <div className="text-[11px] text-muted">min. {formatPercent(a.minThreshold)}</div>
            </div>
            <div className="text-right shrink-0 hidden sm:block">
              <div className="text-xs font-medium">{formatIDR(a.finalPrice)}</div>
              <div className="text-[11px] text-muted">{timeAgo(a.createdAt)}</div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
