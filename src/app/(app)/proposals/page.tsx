import { createClient } from "@/lib/supabase/server";
import { requireInternal } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCompactIDR, formatDate } from "@/lib/utils";
import { canInitiateQuotation, canSeeCostStructure } from "@/lib/rbac";
import { expireStaleQuotations } from "@/lib/workflow/quotationEngine";
import type { PricingProposal } from "@/types/database";
import Link from "next/link";
import { Plus } from "lucide-react";
import { BUSINESS_LINE_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/workflow/labels";

export default async function ProposalsPage() {
  const me = await requireInternal();
  const supabase = await createClient();
  await expireStaleQuotations(supabase, me.id);

  const { data } = await supabase.from("pricing_proposal").select("*").order("created_at", { ascending: false });
  const proposals = (data ?? []) as PricingProposal[];
  const seesCost = canSeeCostStructure(me);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Official Quotation</h1>
          <p className="mt-1 text-sm text-muted">
            Sales To Obtain Official Quotation — draft KYC, validasi, generate, review, persetujuan tier, hingga rilis.
          </p>
        </div>
        {canInitiateQuotation(me) && (
          <Link href="/proposals/new">
            <Button><Plus size={15} /> Official Quotation Baru</Button>
          </Link>
        )}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border bg-slate-50 text-left text-xs text-muted">
              <th className="px-5 py-3 font-medium">Nomor</th>
              <th className="px-5 py-3 font-medium">Customer / judul</th>
              <th className="px-5 py-3 font-medium">Lini bisnis</th>
              <th className="px-5 py-3 font-medium">Total incl. VAT</th>
              {seesCost && <th className="px-5 py-3 font-medium">GM · Tier</th>}
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Dibuat</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map((p) => (
              <tr key={p.id} className="border-b border-card-border last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link href={`/proposals/${p.id}`} className="font-mono text-xs text-primary hover:underline">{p.proposal_number}</Link>
                  {p.document_number && <div className="font-mono text-[10px] text-muted">{p.document_number}</div>}
                </td>
                <td className="px-5 py-3 font-medium">{p.title}</td>
                <td className="px-5 py-3 text-xs text-muted">{BUSINESS_LINE_LABEL[p.business_line] ?? p.business_line}</td>
                <td className="px-5 py-3 text-muted">
                  {(seesCost || p.current_status === "QUOTATION_RELEASED") && Number(p.total_incl_vat) > 0 ? formatCompactIDR(Number(p.total_incl_vat)) : "—"}
                </td>
                {seesCost && (
                  <td className="px-5 py-3 text-xs">
                    {p.gm != null ? `${(Number(p.gm) * 100).toFixed(2)}%` : "—"}
                    {p.margin_tier && <Badge className="ml-1.5" tone={p.margin_tier === 1 ? "success" : p.margin_tier === 2 ? "warning" : "danger"}>T{p.margin_tier}</Badge>}
                  </td>
                )}
                <td className="px-5 py-3">
                  <Badge tone={STATUS_TONE[p.current_status]}>{STATUS_LABEL[p.current_status]}</Badge>
                  {p.outcome !== "PENDING" && <Badge className="ml-1" tone={p.outcome === "WON" ? "success" : "danger"}>{p.outcome}</Badge>}
                </td>
                <td className="px-5 py-3 text-xs text-muted">{formatDate(p.created_at)}</td>
              </tr>
            ))}
            {proposals.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted">Belum ada quotation.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
