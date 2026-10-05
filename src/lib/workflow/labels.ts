import type { ProposalStatus, ScopeStatus, StepActionKind, StepStatus } from "@/types/database";

export const STATUS_LABEL: Record<ProposalStatus, string> = {
  DRAFT: "Draft (KYC)",
  PENDING_SALES_LEAD_VALIDATION: "Menunggu Validasi Sales Lead",
  PENDING_SALES_OPERATIONS: "Di Sales Operations",
  PENDING_HEAD_OF_SALES_REVIEW: "Review Head of Sales",
  PENDING_ADDITIONAL_APPROVAL: "Persetujuan Tambahan (template)",
  PENDING_OWNER_APPROVAL: "Approval Tier — COGS & Profitability Owner",
  PENDING_PRICING_COMMITTEE_APPROVAL: "Approval Tier — Pricing Committee (CCO & CFO)",
  QUOTATION_RELEASED: "Quotation Released",
  EXPIRED: "Kedaluwarsa",
  SUPERSEDED: "Digantikan (Superseded)",
  REJECTED: "Rejected",
  CONFIG_ERROR: "Config Error",
  PENDING_COGS_VALIDATION: "(v3) Pending COGS Validation",
  PENDING_CHIEF_SALES_REVIEW: "(v3) Pending Chief Sales Review",
  PENDING_BOD_APPROVAL: "(v3) Pending BOD Approval",
};

export const STATUS_TONE: Record<ProposalStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "default",
  PENDING_SALES_LEAD_VALIDATION: "info",
  PENDING_SALES_OPERATIONS: "info",
  PENDING_HEAD_OF_SALES_REVIEW: "info",
  PENDING_ADDITIONAL_APPROVAL: "info",
  PENDING_OWNER_APPROVAL: "warning",
  PENDING_PRICING_COMMITTEE_APPROVAL: "danger",
  QUOTATION_RELEASED: "success",
  EXPIRED: "default",
  SUPERSEDED: "default",
  REJECTED: "danger",
  CONFIG_ERROR: "danger",
  PENDING_COGS_VALIDATION: "default",
  PENDING_CHIEF_SALES_REVIEW: "default",
  PENDING_BOD_APPROVAL: "default",
};

export const KANBAN_COLUMNS: ProposalStatus[] = [
  "DRAFT",
  "PENDING_SALES_LEAD_VALIDATION",
  "PENDING_SALES_OPERATIONS",
  "PENDING_HEAD_OF_SALES_REVIEW",
  "PENDING_OWNER_APPROVAL",
  "PENDING_PRICING_COMMITTEE_APPROVAL",
  "QUOTATION_RELEASED",
];

/** Statuses where the quotation is still moving through approval. */
export const IN_FLIGHT_STATUSES: ProposalStatus[] = [
  "PENDING_SALES_LEAD_VALIDATION",
  "PENDING_SALES_OPERATIONS",
  "PENDING_HEAD_OF_SALES_REVIEW",
  "PENDING_ADDITIONAL_APPROVAL",
  "PENDING_OWNER_APPROVAL",
  "PENDING_PRICING_COMMITTEE_APPROVAL",
];

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  PENDING: "Menunggu",
  IN_PROGRESS: "Sedang berjalan",
  APPROVED: "Selesai",
  APPROVED_WITH_CONDITIONS: "Selesai (bersyarat)",
  REJECTED: "Ditolak / dikembalikan",
  SKIPPED_NOT_APPLICABLE: "Dilewati",
};

export const STEP_STATUS_TONE: Record<StepStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "default",
  IN_PROGRESS: "info",
  APPROVED: "success",
  APPROVED_WITH_CONDITIONS: "warning",
  REJECTED: "danger",
  SKIPPED_NOT_APPLICABLE: "default",
};

export const SCOPE_STATUS_LABEL: Record<ScopeStatus, string> = {
  DRAFT: "Draft (Maker)",
  MADE: "Menunggu Checker",
  CHECKED: "Menunggu Releaser",
  RELEASED: "Released",
  RETURNED: "Dikembalikan ke Maker",
};

export const SCOPE_STATUS_TONE: Record<ScopeStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "default",
  MADE: "info",
  CHECKED: "warning",
  RELEASED: "success",
  RETURNED: "danger",
};

export const BUSINESS_LINE_LABEL: Record<string, string> = {
  B2G_TENDER_BUS: "B2G / Pemerintah",
  B2B_COMMERCIAL_FLEET: "B2B Commercial Fleet",
  CHARGING_INFRA_BUILDOUT: "Charging Infrastructure",
};

export const PROJECT_TYPE_LABEL: Record<string, string> = {
  NEW_PROJECT: "Proyek baru",
  ADDITIONAL_RUNNING_PROJECT: "Tambahan untuk proyek berjalan",
  REPLACEMENT: "Penggantian (replacement)",
};

export const LIKELIHOOD_LABEL: Record<number, string> = {
  5: "5 — High",
  4: "4 — Medium to High",
  3: "3 — Medium",
  2: "2 — Medium to Low",
  1: "1 — Low",
};

export const PERIOD_LABEL: Record<string, string> = {
  TRIP: "per trip",
  CYCLE: "per siklus",
  DAY: "per hari",
  MONTH: "per bulan",
  OTHER: "lainnya",
};

/** Workflow template step kinds (Settings → Workflow). */
export const STEP_KIND_LABEL: Record<StepActionKind, string> = {
  VALIDATE: "Validasi permintaan",
  APPROVE: "Persetujuan tambahan",
  GENERATE_QUOTATION: "Generate quotation (quantity band)",
  REVIEW_AND_ROUTE: "Review & rilis / rute tier",
};
