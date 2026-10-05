"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { aggregateGm, computeLine, resolveTier } from "@/lib/pricing/quotation";
import { formatIDR } from "@/lib/utils";
import type { DiscountInputMode, MarginTierAuthority } from "@/types/database";
import { useMemo, useState, useTransition } from "react";
import { RefreshCw, Save } from "lucide-react";
import { recalculateQuotationAction, savePricingAction } from "./quotation-actions";

export interface EditableLine {
  id: string;
  productName: string;
  quantity: number;
  band: number | null;
  listPriceExVat: number;
  baseCost: number;
  salesCost: number;
  discountMode: DiscountInputMode;
  discountAmount: number;
  discountPct: number;
  discountSource: string | null;
  scheme: "PURCHASE" | "RENTAL";
  rentalTenorMonths: number | null;
  rentalMonthlyInclVat: number | null;
}

const TIER_TONE: Record<number, "success" | "warning" | "danger"> = { 1: "success", 2: "warning", 3: "danger" };

/**
 * Sheet Basic Workflow steps 5 & 7: Sales Operations sets the discount
 * level (Rupiah or %) — Head of Sales may revise it. The margin impact
 * (net price, GM after discount, the tier that will apply and who must
 * approve) is shown BEFORE saving (PRD FR-6.4).
 */
export function PricingEditor({
  proposalId,
  lines,
  ladder,
  vatRatePct,
  inclusions,
  exclusions,
  specialNotes,
  role,
  slotNames,
}: {
  proposalId: string;
  lines: EditableLine[];
  ladder: MarginTierAuthority[];
  vatRatePct: number;
  inclusions: string[];
  exclusions: string[];
  specialNotes: string[];
  role: "SALES_OPERATIONS" | "HEAD_OF_SALES";
  slotNames: Record<string, string>;
}) {
  const [state, setState] = useState(() =>
    Object.fromEntries(
      lines.map((l) => [
        l.id,
        {
          mode: l.discountMode,
          value: l.discountMode === "AMOUNT" ? l.discountAmount : l.discountPct,
          scheme: l.scheme,
          tenor: l.rentalTenorMonths ?? 60,
          rental: l.rentalMonthlyInclVat ?? 0,
        },
      ])
    )
  );
  const [incText, setIncText] = useState(inclusions.join("\n"));
  const [excText, setExcText] = useState(exclusions.join("\n"));
  const [notesText, setNotesText] = useState(specialNotes.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const preview = useMemo(() => {
    const perLine = lines.map((l) => {
      const s = state[l.id];
      const r = computeLine({
        quantity: l.quantity,
        listPriceExVat: l.listPriceExVat,
        baseCost: l.baseCost,
        salesCost: l.salesCost,
        discountMode: s.mode,
        discountAmount: s.mode === "AMOUNT" ? s.value : undefined,
        discountPct: s.mode === "PERCENTAGE" ? s.value : undefined,
        vatRatePct,
      });
      return { line: l, r };
    });
    const gm = aggregateGm(
      perLine.map(({ line, r }) => ({
        quantity: line.quantity,
        netPriceExVat: r.netPriceExVat,
        baseCost: line.baseCost,
        salesCost: line.salesCost,
      }))
    );
    return {
      perLine,
      gm,
      tier: resolveTier(gm * 100, ladder),
      totalEx: perLine.reduce((s, x) => s + x.r.lineTotalExVat, 0),
      totalIncl: perLine.reduce((s, x) => s + x.r.lineTotalInclVat, 0),
    };
  }, [lines, state, ladder, vatRatePct]);

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await savePricingAction(proposalId, {
        lines: Object.fromEntries(
          lines.map((l) => {
            const s = state[l.id];
            return [
              l.id,
              {
                discountMode: s.mode,
                discountValue: Number(s.value) || 0,
                scheme: s.scheme,
                rentalTenorMonths: s.scheme === "RENTAL" ? Number(s.tenor) || 60 : null,
                rentalMonthlyInclVat: s.scheme === "RENTAL" ? Number(s.rental) || null : null,
              },
            ];
          })
        ),
        inclusions: incText.split("\n").map((x) => x.trim()),
        exclusions: excText.split("\n").map((x) => x.trim()),
        specialNotes: notesText.split("\n").map((x) => x.trim()),
      });
      if (result.ok) setMessage("Harga & dokumen tersimpan.");
      else setError(result.error ?? "Gagal menyimpan");
    });
  }

  function recalc() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await recalculateQuotationAction(proposalId);
      if (result.ok) setMessage("Dihitung ulang dari cost structure RELEASED terbaru.");
      else setError(result.error ?? "Gagal menghitung ulang");
    });
  }

  const tier = preview.tier;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>
            {role === "SALES_OPERATIONS" ? "Generate Official Quotation — diskon & dokumen" : "Revise (Head of Sales)"}
          </CardTitle>
          <CardDescription>
            Diskon dapat diinput dalam Rupiah atau persentase. GM dihitung setelah diskon, dari harga excl. VAT.
          </CardDescription>
        </div>
        <Button size="sm" variant="secondary" onClick={recalc} loading={isPending}>
          <RefreshCw size={13} /> Hitung Ulang (kurs)
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="w-[28%] min-w-[260px] py-2 pr-2 font-medium">Varian</th>
                <th className="py-2 pr-2 font-medium">Qty · Band</th>
                <th className="py-2 pr-2 font-medium">Harga dasar excl. VAT</th>
                <th className="py-2 pr-2 font-medium">Diskon</th>
                <th className="py-2 pr-2 font-medium">Skema</th>
                <th className="py-2 pr-2 font-medium text-right">Net / unit excl. VAT</th>
                <th className="py-2 font-medium text-right">GM</th>
              </tr>
            </thead>
            <tbody>
              {preview.perLine.map(({ line, r }) => {
                const s = state[line.id];
                const update = (patch: Partial<typeof s>) =>
                  setState((st) => ({ ...st, [line.id]: { ...st[line.id], ...patch } }));
                return (
                  <tr key={line.id} className="border-b border-card-border align-top last:border-0">
                    <td className="py-2 pr-2 font-medium">{line.productName}</td>
                    <td className="py-2 pr-2">
                      {line.quantity} · band {line.band ?? "-"}
                      {line.discountSource === "BAND_DEFAULT" && (
                        <div className="text-[10px] text-muted">diskon default band</div>
                      )}
                    </td>
                    <td className="py-2 pr-2">{formatIDR(line.listPriceExVat)}</td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-1">
                        <select
                          className="pc-input w-16"
                          value={s.mode}
                          onChange={(e) => update({ mode: e.target.value as DiscountInputMode, value: 0 })}
                        >
                          <option value="PERCENTAGE">%</option>
                          <option value="AMOUNT">Rp</option>
                        </select>
                        <input
                          className="pc-input w-32"
                          type="number"
                          min={0}
                          step={s.mode === "PERCENTAGE" ? 0.1 : 1000000}
                          value={s.value}
                          onChange={(e) => update({ value: Number(e.target.value) })}
                        />
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted">
                        = {formatIDR(r.discountAmount)} ({r.discountPct.toFixed(3)}%) / unit
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        className="pc-input w-28"
                        value={s.scheme}
                        onChange={(e) => update({ scheme: e.target.value as "PURCHASE" | "RENTAL" })}
                      >
                        <option value="PURCHASE">Purchase</option>
                        <option value="RENTAL">Rental</option>
                      </select>
                      {s.scheme === "RENTAL" && (
                        <div className="mt-1 space-y-1">
                          <input className="pc-input w-28" type="number" min={1} value={s.tenor} onChange={(e) => update({ tenor: Number(e.target.value) })} title="Tenor (bulan)" />
                          <input className="pc-input w-28" type="number" min={0} value={s.rental} onChange={(e) => update({ rental: Number(e.target.value) })} title="Sewa/bulan/unit incl. VAT" />
                          <div className="text-[10px] text-warning">Formula rental belum dikonfirmasi — sewa/bulan diinput manual</div>
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right">{formatIDR(r.netPriceExVat)}</td>
                    <td className="py-2 text-right font-semibold">{(r.gm * 100).toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            tier?.tier === 1 ? "border-success/30 bg-success-bg" : tier?.tier === 2 ? "border-warning/30 bg-warning-bg" : "border-danger/30 bg-danger-bg"
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span>
              GM akhir <strong>{(preview.gm * 100).toFixed(2)}%</strong>
            </span>
            {tier && <Badge tone={TIER_TONE[tier.tier] ?? "danger"}>Tier {tier.tier}</Badge>}
            <span className="text-xs">
              {tier?.decision_slots.map((s) => slotNames[s] ?? s).join(" + ")}
              {tier && tier.cc_slots.length > 0 && ` · cc ${tier.cc_slots.map((s) => slotNames[s] ?? s).join(", ")}`}
            </span>
            <span className="ml-auto text-xs">
              Total excl. VAT {formatIDR(preview.totalEx)} · incl. VAT {formatIDR(preview.totalIncl)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block space-y-1 text-xs text-muted">
            <span>Inclusions (satu per baris)</span>
            <textarea className="pc-input" rows={4} value={incText} onChange={(e) => setIncText(e.target.value)} />
          </label>
          <label className="block space-y-1 text-xs text-muted">
            <span>Exclusions — At cost (satu per baris)</span>
            <textarea className="pc-input" rows={4} value={excText} onChange={(e) => setExcText(e.target.value)} />
          </label>
          <label className="block space-y-1 text-xs text-muted">
            <span>Special Notes (satu per baris)</span>
            <textarea className="pc-input" rows={4} value={notesText} onChange={(e) => setNotesText(e.target.value)} />
          </label>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
        {message && <p className="text-xs text-success">{message}</p>}

        <div className="flex justify-end">
          <Button size="sm" onClick={save} loading={isPending}>
            <Save size={13} /> Simpan harga &amp; dokumen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
