import { createClient } from "@/lib/supabase/server";
import { requireMenu } from "@/lib/menuAccess";
import { canSeeCostStructure } from "@/lib/rbac";
import { loadLines } from "@/lib/workflow/quotationEngine";
import { evaluateVersion, loadCostItems, loadVersionLines } from "@/lib/costStructure";
import { SCOPE_LABEL, SCOPE_OF_GROUP, SCOPE_ORDER } from "@/lib/pricing/quotation";
import { formatIDR } from "@/lib/utils";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { PrintToolbar } from "../../../PrintToolbar";
import type { PricingProposal, ProductMasterData } from "@/types/database";

/**
 * Internal Cost Structure Sheet (sheet Basic Workflow 6b — "Detail cost
 * structure, highly confidential"). A separate document from the
 * customer Cost Estimate; never merged into it.
 */
export default async function CostStructureSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMenu("cost_structure");
  if (!canSeeCostStructure(me)) notFound();
  const supabase = await createClient();
  const { data: row } = await supabase.from("pricing_proposal").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const p = row as PricingProposal;

  const [lines, items] = await Promise.all([loadLines(supabase, id), loadCostItems(supabase)]);
  const { data: productRows } = await supabase.from("product_master_data").select("*").in("id", lines.map((l) => l.product_id));
  const products = new Map(((productRows ?? []) as ProductMasterData[]).map((x) => [x.id, x]));

  const blocks = await Promise.all(
    lines.map(async (l) => {
      const vLines = l.cost_structure_version_id ? await loadVersionLines(supabase, l.cost_structure_version_id) : [];
      return { line: l, vLines, cs: evaluateVersion(items, vLines, Number(l.locked_fx_rate ?? 0)) };
    })
  );

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <PrintToolbar proposalId={id} kind="COST_STRUCTURE_SHEET" backHref={`/proposals/${id}`} note="Dokumen internal — jangan dikirim ke pelanggan" />
      <article className="mx-auto my-6 w-[210mm] bg-white px-[14mm] py-[12mm] text-[11px] shadow print:my-0 print:w-auto print:px-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-red-700 pb-2">
          <div>
            <div className="text-xl font-bold">COST STRUCTURE SHEET</div>
            <div>{p.proposal_number} · {p.document_number ?? "belum dirilis"} · {p.kyc.company_name}</div>
          </div>
          <div className="rounded border-2 border-red-700 px-2 py-1 font-bold text-red-700">HIGHLY CONFIDENTIAL</div>
        </div>
        <div className="mt-2">
          GM quotation <strong>{p.gm != null ? `${(Number(p.gm) * 100).toFixed(2)}%` : "—"}</strong> · Tier {p.margin_tier ?? "—"} ·
          skenario {p.scenario ?? "—"} · band {p.quantity_band ?? "—"} · total excl. VAT {formatIDR(Number(p.total_ex_vat))}
        </div>

        {blocks.map(({ line, vLines, cs }) => (
          <section key={line.id} className="mt-4 break-inside-avoid">
            <div className="font-semibold">
              {products.get(line.product_id)?.name} × {line.quantity} — kurs terkunci {Number(line.locked_fx_rate ?? 0).toLocaleString("id-ID")}
            </div>
            <table className="mt-1 w-full border-collapse">
              <tbody>
                {SCOPE_ORDER.map((scope) => (
                  <Fragment key={scope}>
                    <tr className="bg-slate-100 font-semibold">
                      <td className="p-1">{SCOPE_LABEL[scope]}</td>
                      <td className="p-1 text-right">{formatIDR(cs.scopeTotals[scope])}</td>
                    </tr>
                    {items
                      .filter((i) => SCOPE_OF_GROUP[i.cost_group] === scope)
                      .map((i) => {
                        const vl = vLines.find((x) => x.cost_item_id === i.id);
                        return (
                          <tr key={`${scope}-${i.id}`} className="border-b border-slate-200">
                            <td className="p-1 pl-4">{i.name}</td>
                            <td className="p-1 text-right">
                              {vl?.is_excluded_at_cost
                                ? "At cost (excluded)"
                                : i.unit_type === "PERCENTAGE"
                                  ? `${Number(vl?.value ?? 0)}% → ${formatIDR(cs.itemAmounts[i.id] ?? 0)}`
                                  : i.denomination === "CNY"
                                    ? `¥ ${Number(vl?.value ?? 0).toLocaleString("id-ID")} → ${formatIDR(cs.itemAmounts[i.id] ?? 0)}`
                                    : formatIDR(cs.itemAmounts[i.id] ?? 0)}
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                ))}
                <tr className="font-semibold">
                  <td className="p-1">Harga dasar excl. VAT</td>
                  <td className="p-1 text-right">{formatIDR(cs.listPriceExVat)}</td>
                </tr>
                <tr>
                  <td className="p-1">Diskon ({Number(line.discount_pct).toFixed(3)}%)</td>
                  <td className="p-1 text-right">− {formatIDR(Number(line.discount_amount))}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="p-1">Harga bersih excl. VAT · GM</td>
                  <td className="p-1 text-right">
                    {formatIDR(Number(line.net_price_ex_vat))} · {line.gm != null ? `${(Number(line.gm) * 100).toFixed(2)}%` : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        ))}
      </article>
    </div>
  );
}
