import type {
  ProposalStatus,
  StepStatus,
  WorkflowStepDefinition,
  WorkflowStepInstance,
} from "@/types/database";

/**
 * Workflow State Machine — Technical Logic §4.
 *
 * Pure functions only (no I/O). Callers (server actions / route
 * handlers) are responsible for persisting the resulting state and
 * writing the corresponding audit_log_entry — this mirrors the
 * technical-logic principle that gatekeeping must be enforced in the
 * service layer, not just the UI (§10 "Zero-bypass guarantee").
 */

export interface GateCheckResult {
  canAdvance: boolean;
  reason?: string;
}

/**
 * FR-2.2 Strict Gatekeeping: a step cannot move to IN_PROGRESS until the
 * previous step is APPROVED / APPROVED_WITH_CONDITIONS.
 */
export function canAdvanceToStep(
  steps: WorkflowStepInstance[],
  targetStepOrder: number
): GateCheckResult {
  const previousSteps = steps.filter((s) => s.step_order < targetStepOrder);
  const blocking = previousSteps.find(
    (s) => s.status !== "APPROVED" && s.status !== "APPROVED_WITH_CONDITIONS"
  );

  if (blocking) {
    return {
      canAdvance: false,
      reason: `Step ${blocking.step_order} (${blocking.department_id}) belum APPROVED — proses tidak boleh melewati departemen ini (zero-bypass).`,
    };
  }

  return { canAdvance: true };
}

/**
 * FR-2.2: mandatory cost items owned by the step's department must be
 * filled before that step can be worked on.
 */
export function checkMandatoryCostItemsFilled(
  mandatoryCostItemIds: string[],
  filledCostItemIds: Set<string>
): GateCheckResult {
  const missing = mandatoryCostItemIds.filter((id) => !filledCostItemIds.has(id));
  if (missing.length > 0) {
    return {
      canAdvance: false,
      reason: `${missing.length} mandatory cost item(s) belum diisi.`,
    };
  }
  return { canAdvance: true };
}

export function statusForStepOrder(
  stepDefs: WorkflowStepDefinition[],
  stepOrder: number
): ProposalStatus {
  const def = stepDefs.find((s) => s.step_order === stepOrder);
  return def?.status_label ?? "DRAFT";
}

/**
 * FR-2.3 Rejection & Routing Logic.
 *
 * `TARGETED_REJECT` resets every step from `targetStepOrder` up to (and
 * including) the currently-active step back to PENDING, without
 * touching the proposal version/draft itself — matching "Reject dari
 * Finance dikembalikan ke Procurement tanpa membatalkan draft dari awal".
 */
export type DecisionAction =
  | "APPROVE"
  | "APPROVE_WITH_CONDITIONS"
  | "REJECT"
  | "TARGETED_REJECT";

export interface ApplyDecisionParams {
  steps: WorkflowStepInstance[];
  currentStepOrder: number;
  action: DecisionAction;
  targetStepOrder?: number; // required for TARGETED_REJECT
  decisionNote?: string;
  actorId: string;
}

export interface ApplyDecisionResult {
  updatedSteps: WorkflowStepInstance[];
  nextProposalStatus: ProposalStatus | "REJECTED" | "AWAITING_NEXT";
  nextStepOrder: number | null;
}

export function applyDecision(
  params: ApplyDecisionParams,
  stepDefs: WorkflowStepDefinition[]
): ApplyDecisionResult {
  const { steps, currentStepOrder, action, targetStepOrder, decisionNote, actorId } =
    params;

  const now = new Date().toISOString();
  const updated = steps.map((s) => ({ ...s }));
  const currentStep = updated.find((s) => s.step_order === currentStepOrder)!;

  if (action === "APPROVE" || action === "APPROVE_WITH_CONDITIONS") {
    currentStep.status = action === "APPROVE" ? "APPROVED" : "APPROVED_WITH_CONDITIONS";
    currentStep.completed_at = now;
    currentStep.actor_id = actorId;
    currentStep.decision_note = decisionNote ?? null;

    const nextDef = stepDefs.find((d) => d.step_order === currentStepOrder + 1);
    if (!nextDef) {
      return {
        updatedSteps: updated,
        nextProposalStatus: "FINAL_APPROVED",
        nextStepOrder: null,
      };
    }

    const nextStep = updated.find((s) => s.step_order === currentStepOrder + 1);
    if (nextStep) {
      nextStep.status = "IN_PROGRESS";
      nextStep.started_at = now;
      nextStep.sla_due_at = new Date(
        Date.now() + nextStep.sla_hours * 60 * 60 * 1000
      ).toISOString();
    }

    return {
      updatedSteps: updated,
      nextProposalStatus: statusForStepOrder(stepDefs, currentStepOrder + 1),
      nextStepOrder: currentStepOrder + 1,
    };
  }

  if (action === "REJECT") {
    currentStep.status = "REJECTED";
    currentStep.completed_at = now;
    currentStep.actor_id = actorId;
    currentStep.decision_note = decisionNote ?? null;
    return { updatedSteps: updated, nextProposalStatus: "DRAFT", nextStepOrder: null };
  }

  // TARGETED_REJECT
  if (!targetStepOrder) {
    throw new Error("targetStepOrder is required for TARGETED_REJECT");
  }

  currentStep.status = "REJECTED";
  currentStep.completed_at = now;
  currentStep.actor_id = actorId;
  currentStep.decision_note = decisionNote ?? null;

  for (const s of updated) {
    if (s.step_order >= targetStepOrder && s.step_order < currentStepOrder) {
      s.status = s.step_order === targetStepOrder ? "IN_PROGRESS" : "PENDING";
      s.completed_at = null;
      s.actor_id = null;
      s.decision_note = null;
      if (s.step_order === targetStepOrder) {
        s.started_at = now;
        s.sla_due_at = new Date(
          Date.now() + s.sla_hours * 60 * 60 * 1000
        ).toISOString();
      }
    }
  }

  return {
    updatedSteps: updated,
    nextProposalStatus: statusForStepOrder(stepDefs, targetStepOrder),
    nextStepOrder: targetStepOrder,
  };
}

/**
 * FR-2.4 Dynamic Form Adjustment: when a new mandatory cost item is
 * attached to an in-flight proposal, if its owning department's step
 * already passed, that step (and everything after it) is rewound to
 * PENDING for re-verification.
 */
export function applyDynamicFormAdjustment(
  steps: WorkflowStepInstance[],
  ownerStepOrder: number
): { updatedSteps: WorkflowStepInstance[]; reverted: boolean } {
  const ownerStep = steps.find((s) => s.step_order === ownerStepOrder);
  if (!ownerStep || ownerStep.status !== "APPROVED" && ownerStep.status !== "APPROVED_WITH_CONDITIONS") {
    return { updatedSteps: steps, reverted: false };
  }

  const now = new Date().toISOString();
  const updated = steps.map((s) => {
    if (s.step_order === ownerStepOrder) {
      return {
        ...s,
        status: "IN_PROGRESS" as StepStatus,
        started_at: now,
        completed_at: null,
        decision_note: null,
        sla_due_at: new Date(Date.now() + s.sla_hours * 60 * 60 * 1000).toISOString(),
      };
    }
    if (s.step_order > ownerStepOrder) {
      return {
        ...s,
        status: "PENDING" as StepStatus,
        started_at: null,
        completed_at: null,
        sla_due_at: null,
        decision_note: null,
      };
    }
    return s;
  });

  return { updatedSteps: updated, reverted: true };
}

export function isSlaBreached(step: WorkflowStepInstance): boolean {
  if (step.status !== "IN_PROGRESS" || !step.sla_due_at) return false;
  return new Date(step.sla_due_at).getTime() < Date.now();
}
