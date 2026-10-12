import type { WorkflowStepInstance } from "@/types/database";

/**
 * Which workflow steps the "Alur Official Quotation" card lists. Steps that
 * finished by themselves ("Auto-generated") or were skipped need nobody, and
 * showing them as "Selesai"/"Dilewati" only confuses the reader — the card
 * lists the steps a person actually acts on (Head of Sales review, extra
 * approvals, manual Sales Operations) and nothing else.
 */
export function isAutomaticOrSkipped(
  step: Pick<WorkflowStepInstance, "status" | "decision_note">
): boolean {
  if (step.status === "SKIPPED_NOT_APPLICABLE") return true;
  return step.status === "APPROVED" && /^auto-generated/i.test(step.decision_note ?? "");
}

export function visibleSteps<T extends Pick<WorkflowStepInstance, "status" | "decision_note">>(steps: T[]): T[] {
  return steps.filter((s) => !isAutomaticOrSkipped(s));
}
