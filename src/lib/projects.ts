import { validateUpload, type UploadCandidate } from "./files";

/**
 * Project / payment-term rules that need no database (PRD Module 9,
 * Technical Logic §2.1 `project*`). Kept pure so they can be unit tested.
 */

export interface TermDraft {
  label: string;
  /** Exactly one of pct / amount. */
  plannedPct: number | null;
  plannedAmount: number | null;
  dueDate: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns an error message, or null when the term can be added. */
export function validateTermInput(input: TermDraft, existing: { plannedPct: number | null }[]): string | null {
  if (input.label.trim().length < 2) return "Isi nama termin (mis. DP).";
  const hasPct = input.plannedPct !== null && input.plannedPct !== undefined;
  const hasAmount = input.plannedAmount !== null && input.plannedAmount !== undefined;
  if (hasPct === hasAmount) return "Isi salah satu: persentase atau jumlah.";
  if (hasPct) {
    const pct = input.plannedPct as number;
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return "Persentase harus lebih dari 0 dan paling besar 100.";
    const already = existing.reduce((s, t) => s + (t.plannedPct ?? 0), 0);
    if (already + pct > 100.0001) {
      return `Total persentase termin tidak boleh melebihi 100% (sudah ${already.toFixed(2).replace(/\.00$/, "")}%).`;
    }
  } else {
    const amount = input.plannedAmount as number;
    if (!Number.isFinite(amount) || amount <= 0) return "Jumlah termin harus lebih dari 0.";
  }
  if (input.dueDate && !DATE_RE.test(input.dueDate)) return "Format jatuh tempo tidak valid.";
  return null;
}

export interface TermTemplate {
  label: string;
  pct: number;
}

/** Standard terms every quotation starts with (migration 0023 uses the same default). */
export const DEFAULT_PAYMENT_TERMS: TermTemplate[] = [
  { label: "DP", pct: 50 },
  { label: "Pelunasan", pct: 50 },
];

export const MAX_QUOTATION_TERMS = 10;

/** Returns an error message, or null when the terms can be saved on a quotation. Percentages must add up to 100. */
export function validateTermsTemplate(terms: TermTemplate[]): string | null {
  if (terms.length === 0) return "Minimal satu termin.";
  if (terms.length > MAX_QUOTATION_TERMS) return `Maksimal ${MAX_QUOTATION_TERMS} termin.`;
  for (const t of terms) {
    if (t.label.trim().length < 2) return "Isi nama setiap termin (mis. DP).";
    if (!Number.isFinite(t.pct) || t.pct <= 0 || t.pct > 100) return "Persentase setiap termin harus lebih dari 0 dan paling besar 100.";
  }
  const total = terms.reduce((s, t) => s + t.pct, 0);
  if (Math.abs(total - 100) > 0.001) {
    return `Total persentase harus 100% (saat ini ${Number(total.toFixed(3))}%).`;
  }
  return null;
}

export interface TermLike {
  status: "PENDING" | "RECEIVED";
  planned_pct: number | null;
  planned_amount: number | null;
  received_amount: number | null;
}

/** Planned amount of one term; a percentage is taken of the contract value (excl. VAT). */
export function plannedAmountOf(term: Pick<TermLike, "planned_pct" | "planned_amount">, contractValueExVat: number): number {
  if (term.planned_amount !== null && term.planned_amount !== undefined) return Number(term.planned_amount);
  if (term.planned_pct !== null && term.planned_pct !== undefined) {
    return Math.round((Number(term.planned_pct) / 100) * contractValueExVat);
  }
  return 0;
}

export interface PaymentSummary {
  termCount: number;
  receivedCount: number;
  plannedAmount: number;
  receivedAmount: number;
}

export function paymentSummary(terms: TermLike[], contractValueExVat: number): PaymentSummary {
  return terms.reduce<PaymentSummary>(
    (acc, t) => ({
      termCount: acc.termCount + 1,
      receivedCount: acc.receivedCount + (t.status === "RECEIVED" ? 1 : 0),
      plannedAmount: acc.plannedAmount + plannedAmountOf(t, contractValueExVat),
      receivedAmount: acc.receivedAmount + (t.status === "RECEIVED" ? Number(t.received_amount ?? 0) : 0),
    }),
    { termCount: 0, receivedCount: 0, plannedAmount: 0, receivedAmount: 0 }
  );
}

/** Short label for lists: "2/3 termin" or "Termin belum diatur". */
export function paymentLabel(s: PaymentSummary): string {
  return s.termCount === 0 ? "Termin belum diatur" : `${s.receivedCount}/${s.termCount} termin diterima`;
}

export interface ProgressDraft {
  statusLabel: string;
  progressPct: number;
  /** Photo or document that proves the progress (PDF, PNG, JPG/JPEG) — required for every entry. */
  file: UploadCandidate | null | undefined;
}

/** Returns an error message, or null when the progress entry can be saved (PRD FR-9.4). */
export function validateProgressInput(input: ProgressDraft): string | null {
  if (!input.statusLabel.trim()) return "Isi status project.";
  if (!Number.isInteger(input.progressPct) || input.progressPct < 0 || input.progressPct > 100) {
    return "Progres harus bilangan bulat 0–100.";
  }
  if (!input.file || input.file.size === 0) {
    return "Foto atau dokumen bukti progres wajib dilampirkan (PDF, PNG, atau JPG).";
  }
  return validateUpload(input.file);
}
