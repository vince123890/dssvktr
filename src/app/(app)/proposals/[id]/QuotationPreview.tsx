"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatIDR, formatPercent } from "@/lib/utils";
import { formatCNY, fromBaseCurrency } from "@/lib/pricing/currency";
import { STATUS_LABEL } from "@/lib/workflow/labels";
import { ROLE_LABELS } from "@/lib/rbac";
import { FileText, X } from "lucide-react";
import type {
  PricingProposal,
  ProductMasterData,
  ProjectIdentifier,
  ProposalCalculationResult,
  UserRole,
} from "@/types/database";

/**
 * FR-1.5.3 Format Quotation — an on-screen preview of the quotation
 * document, laid out to match quotation_document_template.layout_schema
 * (header, customer, project identifier, unit & price, product spec,
 * payment terms, approval metadata). This is NOT a generated PDF file —
 * printing/saving as PDF is left to the browser (Ctrl+P), since a real
 * PDF generator is out of scope for this iteration (see PRD FR-1.5.3
 * note and README §8).
 */

interface ApprovalStepView {
  stepOrder: number;
  departmentName: string;
  status: string;
  actorName: string | null;
  completedAt: string | null;
}

export function QuotationPreview({
  proposal,
  project,
  result,
  product,
  approvalSteps,
  viewerRole,
}: {
  proposal: PricingProposal;
  project: ProjectIdentifier | null;
  result: ProposalCalculationResult | null;
  product: ProductMasterData | null;
  approvalSteps: ApprovalStepView[];
  viewerRole: UserRole;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <FileText size={14} /> Preview Quotation
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 print:bg-white print:p-0"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-xl bg-white shadow-xl print:max-w-none print:shadow-none print:rounded-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-card-border px-5 py-3 print:hidden">
              <div>
                <p className="text-sm font-semibold">Preview Quotation</p>
                <p className="text-[11px] text-muted">
                  Tampilan dokumen — gunakan Ctrl+P / Cmd+P untuk menyimpan sebagai PDF
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => window.print()}>
                  Print / Simpan PDF
                </Button>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Tutup"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <QuotationDocument
              proposal={proposal}
              project={project}
              result={result}
              product={product}
              approvalSteps={approvalSteps}
              viewerRole={viewerRole}
            />
          </div>
        </div>
      )}
    </>
  );
}

function QuotationDocument({
  proposal,
  project,
  result,
  product,
  approvalSteps,
  viewerRole,
}: {
  proposal: PricingProposal;
  project: ProjectIdentifier | null;
  result: ProposalCalculationResult | null;
  product: ProductMasterData | null;
  approvalSteps: ApprovalStepView[];
  viewerRole: UserRole;
}) {
  const rate = result ? Number(result.exchange_rate_used) || 0 : 0;
  const finalPriceCny = result && rate > 0 ? fromBaseCurrency(Number(result.final_price), "CNY", rate) : null;

  return (
    <div className="space-y-6 p-8 text-sm text-slate-800 print:p-10">
      {/* Section: header */}
      <div className="flex items-start justify-between border-b border-slate-300 pb-4">
        <div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            PC
          </div>
          <h1 className="mt-2 text-lg font-semibold">PT VKTR Teknologi Mobilitas Tbk</h1>
          <p className="text-xs text-muted">Commercial Quotation</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs text-muted">{proposal.proposal_number}</p>
          <Badge tone="default">{STATUS_LABEL[proposal.current_status]}</Badge>
          <p className="mt-1 text-[11px] text-muted">Dibuat {formatDate(proposal.created_at)}</p>
        </div>
      </div>

      {/* Section: customer + project_identifier */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Customer</p>
          <p className="mt-1 font-medium">{proposal.customer_name ?? "—"}</p>
          <p className="text-xs text-muted">{proposal.business_line.replaceAll("_", " ")}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Project Identifier
          </p>
          {project ? (
            <>
              <p className="mt-1 font-mono text-xs">{project.identifier_code}</p>
              <p className="text-xs text-muted">{project.project_name}</p>
            </>
          ) : (
            <p className="mt-1 text-xs text-muted">—</p>
          )}
        </div>
      </div>

      {/* Section: unit_and_price */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
          Rincian Unit &amp; Harga
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs text-muted">
              <th className="py-1.5 font-medium">Deskripsi</th>
              <th className="py-1.5 font-medium text-right">Jumlah</th>
              <th className="py-1.5 font-medium text-right">Harga Final</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-2">{proposal.title}</td>
              <td className="py-2 text-right">{proposal.unit_quantity} unit</td>
              <td className="py-2 text-right font-medium">
                {result ? formatIDR(result.final_price) : "Belum dihitung"}
              </td>
            </tr>
          </tbody>
        </table>

        {result && (
          <div className="mt-3 flex items-center justify-end gap-4 rounded-lg bg-slate-50 px-4 py-3">
            <div className="text-right">
              <p className="text-[11px] text-muted">Total Harga Final</p>
              <p className="text-lg font-semibold">{formatIDR(result.final_price)}</p>
              {finalPriceCny !== null && rate > 0 && (
                <p className="text-xs text-muted">≈ {formatCNY(finalPriceCny)} (kurs {rate.toLocaleString("id-ID")})</p>
              )}
            </div>
          </div>
        )}

        {proposal.applied_discount_pct > 0 && (
          <p className="mt-2 text-xs text-muted">
            Termasuk diskon negosiasi {formatPercent(proposal.applied_discount_pct / 100)}.
          </p>
        )}
      </div>

      {/* Section: product_spec */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
          Spesifikasi Produk
        </p>
        {product ? (
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="font-medium">{product.name}</p>
            <p className="text-xs text-muted font-mono">{product.code}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              {product.chassis_variant && (
                <span>
                  <span className="text-muted">Varian Sasis: </span>
                  {product.chassis_variant}
                </span>
              )}
              {product.body_variant && (
                <span>
                  <span className="text-muted">Varian Karoseri: </span>
                  {product.body_variant}
                </span>
              )}
              {Object.entries(product.spec_sheet ?? {}).map(([key, value]) => (
                <span key={key}>
                  <span className="text-muted">{key.replaceAll("_", " ")}: </span>
                  {String(value)}
                </span>
              ))}
            </div>
            {product.image_urls?.length > 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_urls[0]}
                alt={product.name}
                className="mt-3 max-h-40 rounded-md object-cover"
              />
            )}
          </div>
        ) : (
          <p className="text-xs text-muted italic">
            Belum ada produk dipilih pada quotation ini (FR-1.5.2).
          </p>
        )}
      </div>

      {/* Section: payment_terms */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
          Syarat Pembayaran
        </p>
        <p className="text-xs text-muted">
          Syarat pembayaran mengikuti kesepakatan komersial yang berlaku —
          detail metode pembayaran &amp; termin dikonfirmasi terpisah dengan
          tim Sales (Module 7, di luar cakupan POC ini).
        </p>
      </div>

      {/* Section: approval_metadata */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
          Metadata Approval
        </p>
        {approvalSteps.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-300 text-left text-muted">
                <th className="py-1.5 font-medium">#</th>
                <th className="py-1.5 font-medium">Pihak</th>
                <th className="py-1.5 font-medium">Status</th>
                <th className="py-1.5 font-medium">Approver</th>
                <th className="py-1.5 font-medium">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {approvalSteps.map((s) => (
                <tr key={s.stepOrder} className="border-b border-slate-100">
                  <td className="py-1.5">{s.stepOrder}</td>
                  <td className="py-1.5">{s.departmentName}</td>
                  <td className="py-1.5">{s.status}</td>
                  <td className="py-1.5">{s.actorName ?? "—"}</td>
                  <td className="py-1.5">{s.completedAt ? formatDate(s.completedAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-muted italic">Workflow approval belum berjalan.</p>
        )}
      </div>

      <div className="border-t border-slate-300 pt-3 text-[10px] text-muted">
        Dokumen ini adalah preview internal PriceCore, dilihat sebagai{" "}
        {ROLE_LABELS[viewerRole]}. Bukan dokumen resmi berkekuatan hukum
        sebelum status Quotation Released dan ditandatangani sesuai
        governance perusahaan.
      </div>
    </div>
  );
}
