"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import { indexAgeDays, isIndexStale, type HpmBreakdown } from "@/lib/pricing/mineral";
import type { ExchangeRate, MineralIndexSnapshot } from "@/types/database";
import { AlertTriangle, Coins, Pickaxe } from "lucide-react";
import { useState, useTransition } from "react";
import { createExchangeRateAction, createMineralIndexAction } from "./actions";

const inputClass =
  "w-full rounded-lg border border-card-border px-2.5 py-1.5 text-sm bg-white disabled:bg-slate-50";

export function ExchangeRatePanel({
  rates,
  canEdit,
}: {
  rates: ExchangeRate[];
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const current = rates[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-warning-bg text-warning">
            <Coins size={14} />
          </div>
          <div>
            <CardTitle>Nilai Tukar USD → IDR</CardTitle>
            <p className="text-[11px] text-muted mt-0.5">
              Dasar konversi input quotation berdenominasi USD (FR-1.4.2)
            </p>
          </div>
        </div>
        {current && (
          <Badge tone="info">
            Berlaku: {Number(current.rate).toLocaleString("id-ID")}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {canEdit && (
          <form
            action={(formData) => {
              setError(null);
              startTransition(async () => {
                const result = await createExchangeRateAction(formData);
                if (!result.ok) setError(result.error ?? "Gagal menyimpan");
              });
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <label className="text-xs text-muted space-y-1 flex-1 min-w-[200px]">
              <span>Kurs baru (IDR per 1 USD)</span>
              <input
                type="number"
                name="rate"
                step="0.01"
                min="0.01"
                required
                placeholder="16350"
                disabled={isPending}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-muted space-y-1 flex-1 min-w-[200px]">
              <span>Sumber</span>
              <input
                name="source"
                defaultValue="manual"
                disabled={isPending}
                className={inputClass}
              />
            </label>
            <Button type="submit" size="sm" loading={isPending}>
              Simpan Kurs
            </Button>
          </form>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <p className="text-[11px] text-muted">
          Kurs bersifat <strong>append-only</strong> — menyimpan nilai baru tidak
          menimpa yang lama, sehingga quotation lama tetap dapat dijelaskan
          memakai kurs yang berlaku saat itu.
        </p>

        <div className="rounded-lg border border-card-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-muted">
                <th className="px-3 py-2 font-medium">Kurs</th>
                <th className="px-3 py-2 font-medium">Sumber</th>
                <th className="px-3 py-2 font-medium">Berlaku sejak</th>
              </tr>
            </thead>
            <tbody>
              {rates.slice(0, 6).map((r, i) => (
                <tr key={r.id} className="border-t border-card-border">
                  <td className="px-3 py-2 font-medium">
                    {Number(r.rate).toLocaleString("id-ID")}
                    {i === 0 && (
                      <Badge tone="success" className="ml-2">
                        aktif
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted">{r.source}</td>
                  <td className="px-3 py-2 text-muted">
                    {formatDate(r.effective_from)}
                  </td>
                </tr>
              ))}
              {rates.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted">
                    Belum ada kurs tercatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function MineralIndexPanel({
  snapshots,
  canEdit,
  hpm,
}: {
  snapshots: MineralIndexSnapshot[];
  canEdit: boolean;
  hpm: HpmBreakdown | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const latestNi = snapshots.find((s) => s.mineral_code === "NI");
  const stale = isIndexStale(latestNi);
  const age = indexAgeDays(latestNi);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-success-bg text-success">
            <Pickaxe size={14} />
          </div>
          <div>
            <CardTitle>Harga Mineral Acuan (HMA) — ESDM</CardTitle>
            <p className="text-[11px] text-muted mt-0.5">
              Dasar perhitungan HPM, diperbarui mingguan / dua mingguan (FR-8.1)
            </p>
          </div>
        </div>
        {hpm && (
          <Badge tone={stale ? "warning" : "success"}>
            HPM {hpm.hpmWet.toFixed(2)} US$/WMT
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {stale && (
          <div className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-bg px-2.5 py-2 text-xs text-warning">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              <strong>Indeks kedaluwarsa.</strong>{" "}
              {age === null
                ? "Belum ada HMA tercatat."
                : `HMA terakhir berumur ${age} hari.`}{" "}
              Quotation baru tetap dapat dibuat, namun dasar harga mineralnya
              sebaiknya diperbarui.
            </span>
          </div>
        )}

        {hpm && (
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs lg:grid-cols-4">
            <Metric label="CF Nikel" value={`${(hpm.cfNi * 100).toFixed(1)}%`} />
            <Metric label="Nilai Ni (US$/dmt)" value={hpm.valueNi.toFixed(2)} />
            <Metric label="Bonus Co (US$/dmt)" value={hpm.bonusCo.toFixed(2)} />
            <Metric label="HPM basah (US$/WMT)" value={hpm.hpmWet.toFixed(2)} />
          </div>
        )}

        {canEdit && (
          <form
            action={(formData) => {
              setError(null);
              startTransition(async () => {
                const result = await createMineralIndexAction(formData);
                if (!result.ok) setError(result.error ?? "Gagal menyimpan");
              });
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          >
            <label className="text-xs text-muted space-y-1">
              <span>Mineral</span>
              <select name="mineral_code" required disabled={isPending} className={inputClass}>
                <option value="NI">Nikel (NI)</option>
                <option value="CO">Kobalt (CO)</option>
                <option value="LI">Lithium (LI)</option>
              </select>
            </label>
            <label className="text-xs text-muted space-y-1">
              <span>HMA (US$/dmt)</span>
              <input
                type="number"
                name="hma_value"
                step="0.01"
                min="0"
                required
                placeholder="16646"
                disabled={isPending}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-muted space-y-1">
              <span>Periode mulai</span>
              <input
                type="date"
                name="period_start"
                required
                defaultValue={today}
                disabled={isPending}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-muted space-y-1">
              <span>Periode akhir</span>
              <input
                type="date"
                name="period_end"
                required
                defaultValue={today}
                disabled={isPending}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-muted space-y-1 sm:col-span-2 lg:col-span-1">
              <span>Referensi Kepmen</span>
              <input
                name="regulation_ref"
                placeholder="Kepmen ESDM No. …"
                disabled={isPending}
                className={inputClass}
              />
            </label>

            <div className="flex items-end sm:col-span-2 lg:col-span-3 xl:col-span-1">
              <Button
                type="submit"
                size="sm"
                loading={isPending}
                className="w-full xl:w-auto"
              >
                Simpan HMA
              </Button>
            </div>
          </form>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="rounded-lg border border-card-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-muted">
                <th className="px-3 py-2 font-medium">Mineral</th>
                <th className="px-3 py-2 font-medium">HMA (US$/dmt)</th>
                <th className="px-3 py-2 font-medium">Periode</th>
                <th className="px-3 py-2 font-medium">Referensi</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.slice(0, 8).map((s) => (
                <tr key={s.id} className="border-t border-card-border">
                  <td className="px-3 py-2 font-medium">{s.mineral_code}</td>
                  <td className="px-3 py-2">
                    {Number(s.hma_value).toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-2 text-muted whitespace-nowrap">
                    {s.period_start} — {s.period_end}
                  </td>
                  <td className="px-3 py-2 text-muted">{s.regulation_ref ?? "—"}</td>
                </tr>
              ))}
              {snapshots.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted">
                    Belum ada HMA tercatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div className="font-medium text-foreground mt-0.5">{value}</div>
    </div>
  );
}
