"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/actionResult";
import {
  createRevisionAction,
  forwardToReviewAction,
  recordOutcomeAction,
  retryReleaseAction,
  reviewDecisionAction,
  stepDecisionAction,
  submitQuotationAction,
  tierDecisionAction,
} from "./quotation-actions";

export interface ActionCapabilities {
  canSubmit: boolean;
  canEditDraft: boolean;
  stepKind: "VALIDATE" | "APPROVE" | "GENERATE_QUOTATION" | "REVIEW_AND_ROUTE" | null;
  stepName: string | null;
  tierDecision: { tier: number; slotName: string } | null;
  canRetryRelease: boolean;
  canRecordOutcome: boolean;
  canRevise: boolean;
  waitingFor: string | null;
}

export function ActionPanel({ proposalId, caps }: { proposalId: string; caps: ActionCapabilities }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setNote("");
        router.refresh();
      } else setError(result.error ?? "Terjadi kesalahan");
    });
  }

  const hasAnything =
    caps.canSubmit ||
    caps.stepKind ||
    caps.tierDecision ||
    caps.canRetryRelease ||
    caps.canRecordOutcome ||
    caps.canRevise;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aksi Anda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasAnything && (
          <p className="text-xs text-muted">
            Tidak ada aksi untuk role Anda pada tahap ini.
            {caps.waitingFor && (
              <>
                {" "}
                Menunggu: <strong>{caps.waitingFor}</strong>.
              </>
            )}
          </p>
        )}

        {caps.canSubmit && (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Tinjau kembali seluruh KYC dan varian di halaman ini. Setelah submit, draft terkunci.
            </p>
            <div className="flex gap-2">
              {caps.canEditDraft && (
                <Link href={`/proposals/${proposalId}/edit`}>
                  <Button size="sm" variant="secondary">Ubah draft</Button>
                </Link>
              )}
              <Button size="sm" loading={isPending} onClick={() => run(() => submitQuotationAction(proposalId))}>
                Submit Official Quotation
              </Button>
            </div>
          </div>
        )}

        {(caps.stepKind === "VALIDATE" || caps.stepKind === "APPROVE") && (
          <div className="space-y-2">
            <p className="text-xs text-muted">Langkah aktif: <strong>{caps.stepName}</strong></p>
            <NoteField value={note} onChange={setNote} placeholder="Catatan (wajib bila menolak)" />
            <div className="flex gap-2">
              <Button size="sm" variant="success" loading={isPending} onClick={() => run(() => stepDecisionAction(proposalId, "APPROVE", note))}>
                {caps.stepKind === "VALIDATE" ? "Validasi & teruskan ke Sales Operations" : "Setujui"}
              </Button>
              <Button size="sm" variant="danger" disabled={isPending} onClick={() => run(() => stepDecisionAction(proposalId, "REJECT", note))}>
                Tolak
              </Button>
            </div>
          </div>
        )}

        {caps.stepKind === "GENERATE_QUOTATION" && (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Atur diskon & dokumen di panel harga, simpan, lalu teruskan ke Head of Sales beserta detail
              cost structure.
            </p>
            <Button size="sm" loading={isPending} onClick={() => run(() => forwardToReviewAction(proposalId))}>
              Teruskan ke Head of Sales
            </Button>
          </div>
        )}

        {caps.stepKind === "REVIEW_AND_ROUTE" && (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Accept: GM ≥ 15% langsung dirilis; 10–15% ke COGS & Profitability Owner; &lt; 10% ke CCO & CFO.
              Revise lewat panel harga, atau kembalikan ke Sales Operations.
            </p>
            <NoteField value={note} onChange={setNote} placeholder="Catatan (wajib bila mengembalikan)" />
            <div className="flex gap-2">
              <Button size="sm" variant="success" loading={isPending} onClick={() => run(() => reviewDecisionAction(proposalId, "ACCEPT", note))}>
                Accept &amp; rilis / rute
              </Button>
              <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run(() => reviewDecisionAction(proposalId, "RETURN", note))}>
                Kembalikan ke Sales Operations
              </Button>
            </div>
          </div>
        )}

        {caps.tierDecision && (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Persetujuan Tier {caps.tierDecision.tier} sebagai <strong>{caps.tierDecision.slotName}</strong>.
              Semua slot wajib setuju (AND-join); penolakan mengembalikan quotation ke Sales Operations.
            </p>
            <NoteField value={note} onChange={setNote} placeholder="Catatan (wajib bila menolak)" />
            <div className="flex gap-2">
              <Button size="sm" variant="success" loading={isPending} onClick={() => run(() => tierDecisionAction(proposalId, "APPROVE", note))}>
                Approve
              </Button>
              <Button size="sm" variant="danger" disabled={isPending} onClick={() => run(() => tierDecisionAction(proposalId, "REJECT", note))}>
                Reject
              </Button>
            </div>
          </div>
        )}

        {caps.canRetryRelease && (
          <Button size="sm" loading={isPending} onClick={() => run(() => retryReleaseAction(proposalId))}>
            Rilis quotation
          </Button>
        )}

        {caps.canRecordOutcome && (
          <div className="space-y-2 border-t border-card-border pt-3">
            <p className="text-xs text-muted">Hasil dari pelanggan (dokumen penerimaan bertanda tangan):</p>
            <input className="pc-input" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="URL salinan bertanda tangan (opsional)" />
            <div className="flex gap-2">
              <Button size="sm" variant="success" disabled={isPending} onClick={() => run(() => recordOutcomeAction(proposalId, "WON", note, docUrl))}>
                Diterima (WON)
              </Button>
              <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run(() => recordOutcomeAction(proposalId, "LOST", note, docUrl))}>
                Ditolak (LOST)
              </Button>
            </div>
          </div>
        )}

        {caps.canRevise && (
          <div className="space-y-2 border-t border-card-border pt-3">
            <p className="text-xs text-muted">
              Permintaan pelanggan setelah rilis (diskon, qty, perpanjangan) → quotation baru pada Project
              Identifier yang sama.
            </p>
            <NoteField value={note} onChange={setNote} placeholder="Alasan / permintaan pelanggan" />
            <Button
              size="sm"
              variant="secondary"
              loading={isPending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const r = await createRevisionAction(proposalId, note);
                  if (r.ok && r.newProposalId) router.push(`/proposals/${r.newProposalId}`);
                  else setError(r.error ?? "Gagal membuat revisi");
                });
              }}
            >
              Buat Revisi
            </Button>
          </div>
        )}

        {error && <p className="rounded bg-danger-bg px-2 py-1.5 text-xs text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}

function NoteField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <textarea className="pc-input" rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}
