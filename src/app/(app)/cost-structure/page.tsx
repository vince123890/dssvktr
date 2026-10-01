import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { requireMenu } from "@/lib/menuAccess";
import { canSeeCostStructure } from "@/lib/rbac";
import { evaluateVersion, loadCostItems, loadVersionLines } from "@/lib/costStructure";
import { resolveExchangeRate } from "@/lib/pricing/currency";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatIDR } from "@/lib/utils";
import Link from "next/link";
import { NewVersionButton } from "./NewVersionButton";
import type { CostStructureVersion, ProductMasterData } from "@/types/database";
import { AlertTriangle } from "lucide-react";

const STATUS_TONE = { DRAFT: "info", RELEASED: "success", RETIRED: "default" } as const;

export default async function CostStructurePage() {
  const me = await requireMenu("cost_structure");
  if (!canSeeCostStructure(me)) notFound();
  const supabase = await createClient();

  const [{ data: products }, { data: versions }, items, currentRate, { data: rateConfig }] = await Promise.all([
    supabase.from("product_master_data").select("*").order("name"),
    supabase.from("cost_structure_version").select("*").order("version_no", { ascending: false }),
    loadCostItems(supabase),
    resolveExchangeRate(supabase),
    supabase.from("rate_sensitivity_config").select("threshold_pct").eq("is_active", true).limit(1).maybeSingle(),
  ]);
  const threshold = rateConfig ? Number(rateConfig.threshold_pct) : 2;

  const byProduct = new Map<string, CostStructureVersion[]>();
  for (const v of (versions ?? []) as CostStructureVersion[]) {
    byProduct.set(v.product_id, [...(byProduct.get(v.product_id) ?? []), v]);
  }

  const summaries = new Map<string, { list: number; gm: number }>();
  for (const v of (versions ?? []) as CostStructureVersion[]) {
    if (v.status === "RETIRED") continue;
    const cs = evaluateVersion(items, await loadVersionLines(supabase, v.id), Number(v.locked_fx_rate));
    summaries.set(v.id, { list: cs.listPriceExVat, gm: cs.standardGm });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Cost Structure per Varian</h1>
        <p className="mt-1 text-sm text-muted">
          Price book berversi (PRD FR-1.1.2). Setiap scope — COGS, Add-Ons, Margin, Sales — dirilis oleh pemiliknya
          lewat Maker → Checker → Releaser sesuai matriks wewenang di Settings. Hanya versi yang keempat scope-nya
          RELEASED yang dipakai Price Estimate dan Official Quotation. Kurs CNY/IDR dikunci saat versi dibuat.
        </p>
      </div>

      {((products ?? []) as ProductMasterData[]).map((product) => {
        const vs = byProduct.get(product.id) ?? [];
        const released = vs.find((v) => v.status === "RELEASED");
        const draft = vs.find((v) => v.status === "DRAFT");
        const moved =
          released && currentRate
            ? (Math.abs(Number(currentRate.rate) - Number(released.locked_fx_rate)) / Number(released.locked_fx_rate)) * 100
            : 0;
        return (
          <Card key={product.id}>
            <CardHeader>
              <div>
                <CardTitle>{product.name}</CardTitle>
                <CardDescription>{product.document_description ?? product.code}</CardDescription>
              </div>
              {draft ? (
                <Link href={`/cost-structure/${draft.id}`} className="text-xs font-medium text-primary hover:underline">
                  Lanjutkan draft v{draft.version_no} →
                </Link>
              ) : (
                <NewVersionButton productId={product.id} />
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {released && moved > threshold && currentRate && (
                <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-xs text-warning">
                  <AlertTriangle size={14} />
                  Kurs CNY/IDR kini {Number(currentRate.rate).toLocaleString("id-ID")} — bergerak {moved.toFixed(2)}% dari kurs terkunci v
                  {released.version_no} ({Number(released.locked_fx_rate).toLocaleString("id-ID")}), melewati ambang {threshold}%. Buat versi baru
                  (COGS dibuka ulang untuk Maker/Checker/Releaser).
                </div>
              )}
              {vs.length === 0 && <p className="text-xs text-muted">Belum ada cost structure — varian ini belum dapat dikutip.</p>}
              {vs.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-left text-xs text-muted">
                      <th className="py-2 font-medium">Versi</th>
                      <th className="py-2 font-medium">Status</th>
                      <th className="py-2 font-medium">Kurs terkunci</th>
                      <th className="py-2 font-medium text-right">Harga dasar excl. VAT</th>
                      <th className="py-2 font-medium text-right">GM standar</th>
                      <th className="py-2 font-medium">Dirilis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vs.map((v) => {
                      const s = summaries.get(v.id);
                      return (
                        <tr key={v.id} className="border-b border-card-border last:border-0">
                          <td className="py-2">
                            <Link href={`/cost-structure/${v.id}`} className="font-mono text-xs text-primary hover:underline">v{v.version_no}</Link>
                            {v.change_reason && <div className="text-[11px] text-muted">{v.change_reason}</div>}
                          </td>
                          <td className="py-2"><Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge></td>
                          <td className="py-2 text-xs">{Number(v.locked_fx_rate).toLocaleString("id-ID")}</td>
                          <td className="py-2 text-right text-xs">{s ? formatIDR(s.list) : "—"}</td>
                          <td className="py-2 text-right text-xs">{s ? `${(s.gm * 100).toFixed(2)}%` : "—"}</td>
                          <td className="py-2 text-xs text-muted">{v.released_at ? formatDate(v.released_at) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
