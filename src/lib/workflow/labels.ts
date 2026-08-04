import type {
  NegotiationStatus,
  ProposalStatus,
  StepStatus,
} from "@/types/database";

export const STATUS_LABEL: Record<ProposalStatus, string> = {
  DRAFT: "Drafting",
  PENDING_COGS_VALIDATION: "Pending COGS Validation",
  PENDING_CHIEF_SALES_REVIEW: "Pending Chief Sales Review",
  PENDING_BOD_APPROVAL: "Pending BOD Approval",
  QUOTATION_RELEASED: "Quotation Released",
  REJECTED: "Rejected",
  CONFIG_ERROR: "Config Error",
};

export const STATUS_TONE: Record<
  ProposalStatus,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  DRAFT: "default",
  PENDING_COGS_VALIDATION: "info",
  PENDING_CHIEF_SALES_REVIEW: "info",
  PENDING_BOD_APPROVAL: "warning",
  QUOTATION_RELEASED: "success",
  REJECTED: "danger",
  CONFIG_ERROR: "danger",
};

export const KANBAN_COLUMNS: ProposalStatus[] = [
  "DRAFT",
  "PENDING_COGS_VALIDATION",
  "PENDING_CHIEF_SALES_REVIEW",
  "PENDING_BOD_APPROVAL",
  "QUOTATION_RELEASED",
];

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  APPROVED: "Approved",
  APPROVED_WITH_CONDITIONS: "Approved (Conditions)",
  REJECTED: "Rejected",
  SKIPPED_NOT_APPLICABLE: "N/A",
};

export const STEP_STATUS_TONE: Record<
  StepStatus,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  PENDING: "default",
  IN_PROGRESS: "info",
  APPROVED: "success",
  APPROVED_WITH_CONDITIONS: "warning",
  REJECTED: "danger",
  SKIPPED_NOT_APPLICABLE: "default",
};

export const NEGOTIATION_STATUS_LABEL: Record<NegotiationStatus, string> = {
  PENDING_APPROVAL: "Menunggu Persetujuan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  REVISED: "Direvisi",
  SUPERSEDED: "Digantikan",
};

export const NEGOTIATION_STATUS_TONE: Record<
  NegotiationStatus,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  REVISED: "info",
  SUPERSEDED: "default",
};
