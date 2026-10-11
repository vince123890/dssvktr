"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatIDR } from "@/lib/utils";
import type { DiscountInputMode } from "@/types/database";
import { saveRevisionDiscountAction } from "./quotation-actions";

export interface RevisionDiscountLine {
  id: string;
  productName: string;
  quantity: number;
  discountMode: DiscountInputMode;
  discountAmount: number;
  discountPct: number;
  /** Standard / current price per unit incl. VAT once priced; null before the first save. */
  netPriceInclVat: number | null;
}

/**
 * v5.0 (PRD FR-6.0) — on a draft *revision* the Salesperson enters the
 * negotiated discount before submitting. Only prices are shown here: no
 * cost, margin or tier (the Salesperson never sees the cost structure);
 * the routing tier is applied to the discount when the revision is
 * submitted.
 */
export function RevisionDiscountPanel({
  proposalId,
  lines,
}: {
  proposalId: string;
  lines: RevisionDiscountLine[];
}) {
  const [state, setState] = useState(() =>
    Object.fromEntries(
      lines.map((l) => [
        l.id,
        { mode: l.discountMode, value: String(l.discountMode === "AMOUNT" ? l.discountAmount : l.discountPct) },
      ])
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    const edits = Object.fromEntries(
      Object.entries(state).map(([id, s]) => [id, { discountMode: s.mode, discountValue: Number(s.value || 0) }])
    );
    startTransition(async () => {
      const r = await saveRevisionDiscountAction(proposalId, edits);
      if (r.ok) setSaved(true);
      else setError(r.error ?? "Gagal menyimpan diskon.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Diskon negosiasi (revisi)</CardTitle>
          <CardDescription>
            Isi diskon yang disepakati dengan pelanggan, simpan, lalu submit. Persetujuan mengikuti margin
            setelah diskon (otomatis oleh sistem).
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {lines.map((l) => (
          <div key={l.id} className="grid grid-cols-1 gap-2 rounded-lg border border-card-border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{l.productName}</div>
              <div className="text-xs text-muted">
                {l.quantity} unit
                {l.netPriceInclVat !== null && <> · harga/unit incl. VAT {formatIDR(l.netPriceInclVat)}</>}
              </div>
            </div>
            <label className="text-xs text-muted">
              Satuan
              <select
                className="pc-input mt-1"
                value={state[l.id].mode}
                onChange={(e) => setState((s) => ({ ...s, [l.id]: { ...s[l.id], mode: e.target.value as DiscountInputMode } }))}
              >
                <option value="PERCENTAGE">Persen (%)</option>
                <option value="AMOUNT">Rupiah (per unit)</option>
              </select>
            </label>
            <label className="text-xs text-muted">
              Diskon
              <input
                className="pc-input mt-1 sm:w-32"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={state[l.id].value}
                onChange={(e) => setState((s) => ({ ...s, [l.id]: { ...s[l.id], value: e.target.value } }))}
              />
            </label>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" loading={isPending} onClick={save}>
            Simpan diskon
          </Button>
          {saved && <span className="text-xs text-success">Tersimpan — harga dihitung ulang.</span>}
        </div>
        {error && <p className="rounded bg-danger-bg px-2 py-1.5 text-xs text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
