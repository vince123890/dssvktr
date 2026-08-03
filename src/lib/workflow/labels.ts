import type { ProposalStatus, StepStatus } from "@/types/database";

export const STATUS_LABEL: Record<ProposalStatus, string> = {
  DRAFT: "Drafting",
  PENDING_PROCUREMENT: "Pending Procurement",
  PENDING_ENGINEERING_REVIEW: "Pending Engineering Review",
  PENDING_FINANCE_APPROVAL: "Pending Finance Approval",
  PENDING_CLEVEL_SIGNOFF: "Pending C-Level Sign-off",
  FINAL_APPROVED: "Final Approved",
  REJECTED: "Rejected",
  CONFIG_ERROR: "Config Error",
};

export const STATUS_TONE: Record<
  ProposalStatus,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  DRAFT: "default",
  PENDING_PROCUREMENT: "info",
  PENDING_ENGINEERING_REVIEW: "info",
  PENDING_FINANCE_APPROVAL: "warning",
  PENDING_CLEVEL_SIGNOFF: "warning",
  FINAL_APPROVED: "success",
  REJECTED: "danger",
  CONFIG_ERROR: "danger",
};

export const KANBAN_COLUMNS: ProposalStatus[] = [
  "DRAFT",
  "PENDING_PROCUREMENT",
  "PENDING_ENGINEERING_REVIEW",
  "PENDING_FINANCE_APPROVAL",
  "PENDING_CLEVEL_SIGNOFF",
  "FINAL_APPROVED",
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
