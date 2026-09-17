import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PriceStalenessBadge } from "@/components/ui/PriceStalenessBadge";
import { formatCompactIDR, formatDate } from "@/lib/utils";
import type { PricingProposal, ProposalCalculationResult } from "@/types/database";
import Link from "next/link";
import { Plus } from "lucide-react";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/workflow/labels";
import { resolveExchangeRate } from "@/lib/pricing/currency";
import { loadMineralContext } from "@/lib/pricing/mineral";
import { evaluatePriceStaleness } from "@/lib/pricing/staleness";

export default async function ProposalsPage() {
  const supabase = await createClient();
  const [{ data }, currentExchangeRate, mineralContext] = await Promise.all([
    supabase
      .from("pricing_proposal")
      .select("*, current_version_id")
      .order("created_at", { ascending: false }),
    resolveExchangeRate(supabase),
    loadMineralContext(supabase),
  ]);

  const proposals = (data ?? []) as PricingProposal[];

  const versionIds = proposals.map((p) => p.current_version_id).filter(Boolean) as string[];
  const { data: latestResults } = versionIds.length
    ? await supabase
        .from("proposal_calculation_result")
        .select("*")
        .in("proposal_version_id", versionIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Keep only the newest result per version (query is already newest-first).
  const latestResultByVersionId = new Map<string, ProposalCalculationResult>();
  for (const r of (latestResults ?? []) as ProposalCalculationResult[]) {
    if (!latestResultByVersionId.has(r.proposal_version_id)) {
      latestResultByVersionId.set(r.proposal_version_id, r);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pricing Proposals</h1>
          <p className="text-sm text-muted mt-1">
            Seluruh penawaran harga — draft, dalam proses approval, hingga final.
          </p>
        </div>
        <Link href="/proposals/new">
          <Button>
            <Plus size={15} /> Proposal Baru
          </Button>
        </Link>
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border bg-slate-50 text-left text-xs text-muted">
              <th className="px-5 py-3 font-medium">Proposal #</th>
              <th className="px-5 py-3 font-medium">Judul</th>
              <th className="px-5 py-3 font-medium">Lini Bisnis</th>
              <th className="px-5 py-3 font-medium">Nilai Transaksi</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Dibuat</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map((p) => {
              const latestResult = p.current_version_id
                ? latestResultByVersionId.get(p.current_version_id)
                : undefined;
              const staleness = evaluatePriceStaleness(
                latestResult,
                currentExchangeRate,
                mineralContext
              );

              return (
                <tr
                  key={p.id}
                  className="border-b border-card-border last:border-0 hover:bg-slate-50"
                >
                  <td className="px-5 py-3">
                    <Link href={`/proposals/${p.id}`} className="font-mono text-xs text-primary hover:underline">
                      {p.proposal_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-medium">{p.title}</td>
                  <td className="px-5 py-3 text-muted">{p.business_line.replaceAll("_", " ")}</td>
                  <td className="px-5 py-3 text-muted">
                    {p.transaction_value > 0 ? formatCompactIDR(p.transaction_value) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={STATUS_TONE[p.current_status]}>
                        {STATUS_LABEL[p.current_status]}
                      </Badge>
                      <PriceStalenessBadge info={staleness} />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">{formatDate(p.created_at)}</td>
                </tr>
              );
            })}
            {proposals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted">
                  Belum ada proposal. Klik &quot;Proposal Baru&quot; untuk membuat draft pertama.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
