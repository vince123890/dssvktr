"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCompactIDR, formatDate, formatIDR } from "@/lib/utils";
import { plannedAmountOf } from "@/lib/projects";
import type { ActionResult } from "@/lib/actionResult";
import { addPaymentTermAction, deletePaymentTermAction, markTermReceivedAction } from "../actions";

export interface TermView {
  id: string;
  termNo: number;
  label: string;
  plannedPct: number | null;
  plannedAmount: number | null;
  dueDate: string | null;
  status: "PENDING" | "RECEIVED";
  receivedAmount: number | null;
  receivedAt: string | null;
  proofUrl: string | null;
}

/**
 * Payment terms (PRD FR-9.3): the owning Salesperson sets the terms;
 * Finance marks each one received with the transfer proof. Everyone with
 * access to the project reads the status.
 */
export function PaymentTerms({
  projectId,
  terms,
  contractValueExVat,
  canSet,
  canUpdateStatus,
}: {
  projectId: string;
  terms: TermView[];
  contractValueExVat: number;
  canSet: boolean;
  canUpdateStatus: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const locked = terms.some((t) => t.status === "RECEIVED");

  function run(fn: () => Promise<ActionResult>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.ok) after?.();
      else setError(r.error ?? "Terjadi kesalahan.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Payment termin</CardTitle>
          <CardDescription>
            Termin ditetapkan Salesperson; status diterima + bukti transfer diisi Finance. Persentase dihitung dari
            nilai kontrak {formatCompactIDR(contractValueExVat)} (excl. VAT).
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {terms.length === 0 && <p className="text-sm text-muted">Belum ada termin. {canSet ? "Tambahkan di bawah." : "Menunggu Salesperson."}</p>}

        {terms.map((t) => {
          const planned = plannedAmountOf(
            { planned_pct: t.plannedPct, planned_amount: t.plannedAmount },
            contractValueExVat
          );
          return (
            <div key={t.id} className="rounded-lg border border-card-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    Termin {t.termNo} — {t.label}
                  </div>
                  <div className="text-xs text-muted">
                    {t.plannedPct !== null ? `${t.plannedPct}% · ` : ""}
                    {formatIDR(planned)}
                    {t.dueDate && <> · jatuh tempo {formatDate(t.dueDate)}</>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={t.status === "RECEIVED" ? "success" : "default"}>
                    {t.status === "RECEIVED" ? "Diterima" : "Belum"}
                  </Badge>
                  {canSet && !locked && t.status === "PENDING" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => run(() => deletePaymentTermAction(projectId, t.id))}
                    >
                      Hapus
                    </Button>
                  )}
                </div>
              </div>

              {t.status === "RECEIVED" && (
                <div className="mt-2 text-xs text-muted">
                  Diterima {t.receivedAmount !== null ? formatIDR(t.receivedAmount) : ""}
                  {t.receivedAt && <> pada {formatDate(t.receivedAt)}</>}
                  {t.proofUrl && (
                    <>
                      {" · "}
                      <a className="text-primary underline" href={t.proofUrl} target="_blank" rel="noreferrer">
                        bukti transfer
                      </a>
                    </>
                  )}
                </div>
              )}

              {canUpdateStatus && t.status === "PENDING" && (
                <>
                  {openTerm !== t.id ? (
                    <Button size="sm" className="mt-2" variant="secondary" onClick={() => setOpenTerm(t.id)}>
                      Tandai diterima
                    </Button>
                  ) : (
                    <form
                      className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const data = new FormData(form);
                        run(() => markTermReceivedAction(projectId, t.id, data), () => setOpenTerm(null));
                      }}
                    >
                      <label className="text-xs text-muted">
                        Jumlah diterima (Rp, sesuai termin)
                        <input className="pc-input mt-1 bg-slate-50" name="received_amount" type="number" readOnly required defaultValue={planned || undefined} />
                      </label>
                      <label className="text-xs text-muted">
                        Tanggal diterima
                        <input className="pc-input mt-1" name="received_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                      </label>
                      <label className="text-xs text-muted sm:col-span-2">
                        Bukti transfer (screenshot / PDF)
                        <input className="pc-input mt-1" name="proof_file" type="file" accept="application/pdf,image/png,image/jpeg" required />
                      </label>
                      <div className="flex flex-wrap gap-2 sm:col-span-2">
                        <Button size="sm" type="submit" variant="success" loading={isPending}>Simpan &amp; centang diterima</Button>
                        <Button size="sm" type="button" variant="secondary" disabled={isPending} onClick={() => setOpenTerm(null)}>Batal</Button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          );
        })}

        {canSet && !locked && (
          <form
            className="grid grid-cols-1 gap-2 rounded-lg border border-dashed border-card-border p-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              const mode = String(fd.get("mode"));
              const value = Number(String(fd.get("value") ?? "").replace(",", "."));
              run(
                () =>
                  addPaymentTermAction(projectId, {
                    label: String(fd.get("label") ?? ""),
                    plannedPct: mode === "PCT" ? value : null,
                    plannedAmount: mode === "AMOUNT" ? value : null,
                    dueDate: String(fd.get("due_date") ?? "") || null,
                  }),
                () => form.reset()
              );
            }}
          >
            <div className="text-xs font-medium sm:col-span-2">Tambah termin</div>
            <label className="text-xs text-muted">
              Nama termin
              <input className="pc-input mt-1" name="label" placeholder="mis. DP" required />
            </label>
            <label className="text-xs text-muted">
              Jatuh tempo (opsional)
              <input className="pc-input mt-1" name="due_date" type="date" />
            </label>
            <label className="text-xs text-muted">
              Satuan
              <select className="pc-input mt-1" name="mode" defaultValue="PCT">
                <option value="PCT">Persen (%) dari nilai kontrak</option>
                <option value="AMOUNT">Jumlah (Rp)</option>
              </select>
            </label>
            <label className="text-xs text-muted">
              Nilai
              <input className="pc-input mt-1" name="value" type="number" min={0} step="any" inputMode="decimal" required />
            </label>
            <div className="sm:col-span-2">
              <Button size="sm" type="submit" loading={isPending}>Tambah termin</Button>
            </div>
          </form>
        )}
        {canSet && locked && (
          <p className="text-xs text-muted">Termin terkunci karena sudah ada yang diterima Finance.</p>
        )}

        {error && <p className="rounded bg-danger-bg px-2 py-1.5 text-xs text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
