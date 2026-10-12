"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/actionResult";
import {
  adminExpiredOverrideAction,
  attachSignedDocumentAction,
  releaseWithoutSignedDocumentAction,
  cancelFinalApprovalAction,
  createRevisionAction,
  forwardToReviewAction,
  markLostAction,
  markWonAction,
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
  /** v5.0 — approved and waiting for release: the Salesperson releases it, with or without the signed document. */
  awaitingRelease: boolean;
  /** v5.0 — Salesperson attaches (or replaces) the signed document; optional, before or after release. */
  canAttachSigned: boolean;
  /** A signed document is already attached (the form offers to replace it). */
  hasSignedDocument: boolean;
  /** v5.0 — Head of Sales or Admin withdraws the final approval while the signed document is pending. */
  canCancelApproval: boolean;
  /** Won (PO required) / Lost (reason) — manual, by the Salesperson. */
  canRecordOutcome: boolean;
  canRevise: boolean;
  /** v5.0 — Admin declares Expired early (status Released) or undoes it (status Expired). */
  adminExpired: "EXPIRE" | "CLEAR" | null;
  waitingFor: string | null;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function ActionPanel({ proposalId, caps }: { proposalId: string; caps: ActionCapabilities }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [outcomeMode, setOutcomeMode] = useState<"WON" | "LOST" | null>(null);

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      // The action revalidates this page; the fresh UI arrives with its response.
      if (result.ok) {
        setNote("");
        setOutcomeMode(null);
      } else setError(result.error ?? "Terjadi kesalahan");
    });
  }

  /** Forms that carry a file: the browser builds the FormData, the server action validates it. */
  function submitForm(e: React.FormEvent<HTMLFormElement>, action: (fd: FormData) => Promise<ActionResult>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    run(async () => {
      const r = await action(data);
      if (r.ok) form.reset();
      return r;
    });
  }

  const hasAnything =
    caps.canSubmit ||
    caps.stepKind ||
    caps.tierDecision ||
    caps.canRetryRelease ||
    caps.awaitingRelease ||
    caps.canAttachSigned ||
    caps.canCancelApproval ||
    caps.canRecordOutcome ||
    caps.canRevise ||
    caps.adminExpired;

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
            <div className="flex flex-wrap gap-2">
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
            <div className="flex flex-wrap gap-2">
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
              Approve: GM ≥ 15% langsung disetujui final; 10–15% ke COGS & Profitability Owner; &lt; 10% ke CCO & CFO.
              Setelah approval final, dokumen ditandatangani lalu Salesperson melampirkannya — baru dirilis.
              Revise lewat panel harga, atau kembalikan ke Sales Operations.
            </p>
            <NoteField value={note} onChange={setNote} placeholder="Catatan (wajib bila mengembalikan)" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="success" loading={isPending} onClick={() => run(() => reviewDecisionAction(proposalId, "ACCEPT", note))}>
                Approve &amp; rute tier
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
            <div className="flex flex-wrap gap-2">
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
            Setujui final quotation
          </Button>
        )}

        {caps.awaitingRelease && (
          <ReleaseForm proposalId={proposalId} isPending={isPending} run={run} submitForm={submitForm} />
        )}

        {caps.canAttachSigned && !caps.awaitingRelease && (
          <form className="space-y-2" onSubmit={(e) => submitForm(e, (fd) => attachSignedDocumentAction(proposalId, fd))}>
            <p className="text-xs text-muted">
              {caps.hasSignedDocument
                ? "Ganti lampiran dokumen bertanda tangan (opsional)."
                : "Lampirkan dokumen bertanda tangan (opsional) — dapat ditambahkan setelah rilis."}
            </p>
            <input className="pc-input" type="file" name="file" accept="application/pdf,image/png,image/jpeg" required />
            <Button size="sm" type="submit" variant="secondary" loading={isPending}>
              {caps.hasSignedDocument ? "Ganti lampiran" : "Lampirkan"}
            </Button>
          </form>
        )}

        {caps.canCancelApproval && (
          <div className="space-y-2 border-t border-card-border pt-3">
            <p className="text-xs text-muted">
              Harga atau dokumen perlu diubah sebelum dirilis? Batalkan approval final: quotation kembali
              ke review Head of Sales dan nomor dokumen diterbitkan ulang saat disetujui lagi.
            </p>
            <NoteField value={note} onChange={setNote} placeholder="Alasan pembatalan (wajib)" />
            <Button size="sm" variant="danger" loading={isPending} onClick={() => run(() => cancelFinalApprovalAction(proposalId, note))}>
              Batalkan approval final
            </Button>
          </div>
        )}

        {caps.canRecordOutcome && (
          <div className="space-y-2 border-t border-card-border pt-3">
            <p className="text-xs text-muted">Hasil dari pelanggan:</p>
            {outcomeMode === null && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="success" disabled={isPending} onClick={() => setOutcomeMode("WON")}>
                  Diterima (Won)
                </Button>
                <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setOutcomeMode("LOST")}>
                  Ditolak (Lost)
                </Button>
              </div>
            )}
            {outcomeMode === "WON" && (
              <form className="space-y-2" onSubmit={(e) => submitForm(e, (fd) => markWonAction(proposalId, fd))}>
                <p className="text-xs text-muted">Won wajib disertai bukti PO pelanggan; project akan dibuat otomatis.</p>
                <input className="pc-input" name="po_number" placeholder="Nomor PO" required />
                <label className="block text-xs text-muted">
                  Tanggal PO diterima
                  <input className="pc-input mt-1" type="date" name="po_received_at" defaultValue={todayIso()} />
                </label>
                <input className="pc-input" type="file" name="po_file" accept="application/pdf,image/png,image/jpeg" required />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" type="submit" variant="success" loading={isPending}>Simpan Won &amp; buat project</Button>
                  <Button size="sm" type="button" variant="secondary" disabled={isPending} onClick={() => setOutcomeMode(null)}>Batal</Button>
                </div>
              </form>
            )}
            {outcomeMode === "LOST" && (
              <div className="space-y-2">
                <NoteField value={note} onChange={setNote} placeholder="Alasan Lost (wajib)" />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="danger" loading={isPending} onClick={() => run(() => markLostAction(proposalId, note))}>
                    Simpan Lost
                  </Button>
                  <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setOutcomeMode(null)}>Batal</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {caps.adminExpired && <ExpiredOverride mode={caps.adminExpired} proposalId={proposalId} run={run} isPending={isPending} />}

        {caps.canRevise && (
          <div className="space-y-2 border-t border-card-border pt-3">
            <p className="text-xs text-muted">
              Permintaan pelanggan setelah rilis (diskon, qty, perpanjangan) → quotation baru pada Project
              Identifier yang sama. Diskon negosiasi diisi pada draft revisi sebelum submit.
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

/**
 * One form to release an approved quotation (PRD FR-2.11): a dropdown picks
 * whether a signed document goes with it. "Tanpa lampiran" releases at once;
 * "Dengan lampiran" shows the file field and releases when the file is sent.
 */
function ReleaseForm({
  proposalId,
  isPending,
  run,
  submitForm,
}: {
  proposalId: string;
  isPending: boolean;
  run: (fn: () => Promise<ActionResult>) => void;
  submitForm: (e: React.FormEvent<HTMLFormElement>, action: (fd: FormData) => Promise<ActionResult>) => void;
}) {
  const [mode, setMode] = useState<"WITHOUT" | "WITH">("WITHOUT");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        if (mode === "WITHOUT") {
          e.preventDefault();
          run(() => releaseWithoutSignedDocumentAction(proposalId));
        } else {
          submitForm(e, (fd) => attachSignedDocumentAction(proposalId, fd));
        }
      }}
    >
      <p className="text-xs text-muted">
        Quotation sudah disetujui dan bernomor. Pilih cara merilis — lampiran dokumen bertanda tangan{" "}
        <strong>opsional</strong>.
      </p>
      <label className="block text-xs text-muted">
        Rilis
        <select className="pc-input mt-1" value={mode} onChange={(e) => setMode(e.target.value as "WITHOUT" | "WITH")}>
          <option value="WITHOUT">Tanpa lampiran dokumen</option>
          <option value="WITH">Dengan lampiran dokumen bertanda tangan</option>
        </select>
      </label>
      {mode === "WITH" && (
        <div className="space-y-1">
          <p className="text-xs text-muted">
            Cetak dokumen (tombol <strong>Cetak untuk ditandatangani</strong>), minta tanda tangan Head of Sales, lalu
            pilih berkas hasilnya.
          </p>
          <input className="pc-input" type="file" name="file" accept="application/pdf,image/png,image/jpeg" required />
        </div>
      )}
      <Button size="sm" type="submit" variant="success" loading={isPending}>
        Rilis
      </Button>
    </form>
  );
}

/** Admin only: declare Expired before valid_until, or undo a wrong Expired with a new date. */
function ExpiredOverride({
  mode,
  proposalId,
  run,
  isPending,
}: {
  mode: "EXPIRE" | "CLEAR";
  proposalId: string;
  run: (fn: () => Promise<ActionResult>) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  const [validUntil, setValidUntil] = useState("");
  return (
    <div className="space-y-2 border-t border-card-border pt-3">
      <p className="text-xs text-muted">
        {mode === "EXPIRE"
          ? "Admin: nyatakan quotation ini Expired sebelum masa berlakunya habis (kedaluwarsa normal berjalan otomatis)."
          : "Admin: batalkan status Expired dan beri tanggal berlaku baru."}
      </p>
      <NoteField value={reason} onChange={setReason} placeholder="Alasan (wajib, tercatat di audit)" />
      {mode === "CLEAR" && (
        <label className="block text-xs text-muted">
          Berlaku s.d.
          <input className="pc-input mt-1" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </label>
      )}
      <Button
        size="sm"
        variant={mode === "EXPIRE" ? "danger" : "secondary"}
        loading={isPending}
        onClick={() => run(() => adminExpiredOverrideAction(proposalId, mode, reason, validUntil))}
      >
        {mode === "EXPIRE" ? "Nyatakan Expired" : "Batalkan Expired"}
      </Button>
    </div>
  );
}

function NoteField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <textarea className="pc-input" rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}
