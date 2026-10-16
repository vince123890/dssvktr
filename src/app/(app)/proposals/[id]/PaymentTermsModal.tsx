"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { validateTermsTemplate, MAX_QUOTATION_TERMS, type TermTemplate } from "@/lib/projects";
import { updateQuotationTermsAction } from "./quotation-actions";

/**
 * "Update TOP" (v5.0): every quotation starts with the standard 50/50 terms; the Salesperson changes them here
 * after negotiating with the customer. The terms are copied to the project when the quotation is Won.
 */
export function PaymentTermsModal({ proposalId, terms }: { proposalId: string; terms: TermTemplate[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() => terms.map((t) => ({ label: t.label, pct: String(t.pct) })));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsed = rows.map((r) => ({ label: r.label, pct: Number(r.pct) }));
  const total = parsed.reduce((s, t) => s + (Number.isFinite(t.pct) ? t.pct : 0), 0);
  const totalOk = Math.abs(total - 100) < 0.001;

  function openModal() {
    setRows(terms.map((t) => ({ label: t.label, pct: String(t.pct) })));
    setError(null);
    setOpen(true);
  }

  function save() {
    const invalid = validateTermsTemplate(parsed);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await updateQuotationTermsAction(proposalId, parsed);
      if (r.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(r.error ?? "Gagal menyimpan TOP.");
      }
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={openModal}>
        <Wallet size={15} /> Update TOP
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Update TOP"
            className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Update TOP</h2>
                <p className="text-xs text-muted">Termin pembayaran pada quotation. Standar awal 50–50; total harus 100%.</p>
              </div>
              <button type="button" aria-label="Tutup" className="rounded p-1 text-muted hover:bg-slate-100" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex items-end gap-2">
                  <label className="min-w-0 flex-1 text-xs text-muted">
                    Termin {i + 1}
                    <input
                      className="pc-input mt-1"
                      aria-label={`Nama termin ${i + 1}`}
                      value={r.label}
                      onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    />
                  </label>
                  <label className="w-24 text-xs text-muted">
                    %
                    <input
                      className="pc-input mt-1"
                      aria-label={`Persen termin ${i + 1}`}
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      inputMode="decimal"
                      value={r.pct}
                      onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))}
                    />
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Hapus termin ${i + 1}`}
                    disabled={rows.length <= 1}
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between text-xs">
              <Button
                size="sm"
                variant="secondary"
                disabled={rows.length >= MAX_QUOTATION_TERMS}
                onClick={() => setRows([...rows, { label: "", pct: "" }])}
              >
                <Plus size={14} /> Tambah termin
              </Button>
              <span className={totalOk ? "font-medium text-success" : "font-medium text-danger"}>Total {Number(total.toFixed(3))}%</span>
            </div>

            {error && <p className="mt-2 rounded bg-danger-bg px-2 py-1.5 text-xs text-danger">{error}</p>}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
              <Button loading={isPending} onClick={save}>Simpan TOP</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
