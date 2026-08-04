import type {
  ProposalStatus,
  StepStatus,
  WorkflowStepDefinition,
  WorkflowStepInstance,
} from "@/types/database";

/**
 * Workflow State Machine — Technical Logic §4 (v2.0).
 *
 * Pure functions only (no I/O). Callers (server actions / route
 * handlers) are responsible for persisting the resulting state and
 * writing the corresponding audit_log_entry — this mirrors the
 * technical-logic principle that gatekeeping must be enforced in the
 * service layer, not just the UI (§10 "Zero-bypass guarantee").
 *
 * v2.0 supports PARALLEL steps: several step instances may share a
 * step_order (VP Finance alongside VP Operations). A step_order is only
 * complete when *every* member of it is approved — the AND-join
 * described in §4.2.
 */

const APPROVED_STATUSES: StepStatus[] = ["APPROVED", "APPROVED_WITH_CONDITIONS"];

export interface GateCheckResult {
  canAdvance: boolean;
  reason?: string;
}

function isApproved(step: WorkflowStepInstance): boolean {
  return APPROVED_STATUSES.includes(step.status);
}

/** All step instances sharing a step_order (a parallel group, or one step). */
export function stepsAtOrder(
  steps: WorkflowStepInstance[],
  order: number
): WorkflowStepInstance[] {
  return steps.filter((s) => s.step_order === order);
}

/** True once every member of the given step_order has approved (AND-join). */
export function isOrderComplete(
  steps: WorkflowStepInstance[],
  order: number
): boolean {
  const group = stepsAtOrder(steps, order);
  return group.length > 0 && group.every(isApproved);
}

/**
 * FR-2.2 Strict Gatekeeping: an order cannot open until every prior
 * order — including all members of any parallel group — is approved.
 */
export function canAdvanceToStep(
  steps: WorkflowStepInstance[],
  targetStepOrder: number
): GateCheckResult {
  const blocking = steps.filter(
    (s) => s.step_order < targetStepOrder && !isApproved(s)
  );

  if (blocking.length > 0) {
    return {
      canAdvance: false,
      reason: `Masih menunggu ${blocking.length} approver pada tahap sebelumnya — proses tidak boleh melewati COGS Owner (zero-bypass).`,
    };
  }

  return { canAdvance: true };
}

/**
 * FR-2.2: mandatory cost items owned by the step's department must be
 * filled before that step can be approved.
 */
export function checkMandatoryCostItemsFilled(
  mandatoryCostItemIds: string[],
  filledCostItemIds: Set<string>
): GateCheckResult {
  const missing = mandatoryCostItemIds.filter((id) => !filledCostItemIds.has(id));
  if (missing.length > 0) {
    return {
      canAdvance: false,
      reason: `${missing.length} komponen COGS mandatory belum diisi.`,
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

/** The next step_order that exists after the given one, or null. */
export function nextStepOrderAfter(
  stepDefs: WorkflowStepDefinition[],
  order: number
): number | null {
  const later = stepDefs
    .map((d) => d.step_order)
    .filter((o) => o > order)
    .sort((a, b) => a - b);
  return later.length > 0 ? later[0] : null;
}

/**
 * FR-2.3 Rejection & Routing Logic.
 *
 * `TARGETED_REJECT` reopens the target order and resets everything
 * between it and the current step, without touching the proposal
 * version/draft — matching "Reject dari VP Finance dikembalikan ke Chief
 * Sales tanpa membatalkan draft dari awal".
 */
export type DecisionAction =
  | "APPROVE"
  | "APPROVE_WITH_CONDITIONS"
  | "REJECT"
  | "TARGETED_REJECT";

export interface ApplyDecisionParams {
  steps: WorkflowStepInstance[];
  /** The specific step instance being decided on (not just its order). */
  stepInstanceId: string;
  action: DecisionAction;
  targetStepOrder?: number; // required for TARGETED_REJECT
  decisionNote?: string;
  actorId: string;
}

export interface ApplyDecisionResult {
  updatedSteps: WorkflowStepInstance[];
  nextProposalStatus: ProposalStatus;
  nextStepOrder: number | null;
  /** True when this decision completed the whole workflow. */
  isFinalApproval: boolean;
}

function openStep(step: WorkflowStepInstance, now: string): void {
  step.status = "IN_PROGRESS";
  step.started_at = now;
  step.completed_at = null;
  step.decision_note = null;
  step.sla_due_at = new Date(
    Date.now() + step.sla_hours * 60 * 60 * 1000
  ).toISOString();
}

export function applyDecision(
  params: ApplyDecisionParams,
  stepDefs: WorkflowStepDefinition[]
): ApplyDecisionResult {
  const { steps, stepInstanceId, action, targetStepOrder, decisionNote, actorId } =
    params;

  const now = new Date().toISOString();
  const updated = steps.map((s) => ({ ...s }));
  const currentStep = updated.find((s) => s.id === stepInstanceId);

  if (!currentStep) throw new Error("Step instance tidak ditemukan.");
  const currentStepOrder = currentStep.step_order;

  if (action === "APPROVE" || action === "APPROVE_WITH_CONDITIONS") {
    currentStep.status = action === "APPROVE" ? "APPROVED" : "APPROVED_WITH_CONDITIONS";
    currentStep.completed_at = now;
    currentStep.actor_id = actorId;
    currentStep.decision_note = decisionNote ?? null;

    // AND-join: if peers in the same parallel group are still pending,
    // the workflow stays on this order and simply waits for them.
    if (!isOrderComplete(updated, currentStepOrder)) {
      return {
        updatedSteps: updated,
        nextProposalStatus: statusForStepOrder(stepDefs, currentStepOrder),
        nextStepOrder: currentStepOrder,
        isFinalApproval: false,
      };
    }

    const nextOrder = nextStepOrderAfter(stepDefs, currentStepOrder);
    if (nextOrder === null) {
      return {
        updatedSteps: updated,
        nextProposalStatus: "QUOTATION_RELEASED",
        nextStepOrder: null,
        isFinalApproval: true,
      };
    }

    for (const step of stepsAtOrder(updated, nextOrder)) {
      openStep(step, now);
    }

    return {
      updatedSteps: updated,
      nextProposalStatus: statusForStepOrder(stepDefs, nextOrder),
      nextStepOrder: nextOrder,
      isFinalApproval: false,
    };
  }

  if (action === "REJECT") {
    currentStep.status = "REJECTED";
    currentStep.completed_at = now;
    currentStep.actor_id = actorId;
    currentStep.decision_note = decisionNote ?? null;
    return {
      updatedSteps: updated,
      nextProposalStatus: "DRAFT",
      nextStepOrder: null,
      isFinalApproval: false,
    };
  }

  // TARGETED_REJECT
  if (targetStepOrder === undefined) {
    throw new Error("targetStepOrder is required for TARGETED_REJECT");
  }

  currentStep.status = "REJECTED";
  currentStep.completed_at = now;
  currentStep.actor_id = actorId;
  currentStep.decision_note = decisionNote ?? null;

  for (const s of updated) {
    if (s.step_order >= targetStepOrder && s.step_order <= currentStepOrder) {
      if (s.id === currentStep.id) continue; // keep the rejection on record
      if (s.step_order === targetStepOrder) {
        s.actor_id = null;
        openStep(s, now);
      } else {
        s.status = "PENDING";
        s.started_at = null;
        s.completed_at = null;
        s.sla_due_at = null;
        s.actor_id = null;
        s.decision_note = null;
      }
    }
  }

  return {
    updatedSteps: updated,
    nextProposalStatus: statusForStepOrder(stepDefs, targetStepOrder),
    nextStepOrder: targetStepOrder,
    isFinalApproval: false,
  };
}

/**
 * FR-2.4 Dynamic Form Adjustment: when a new mandatory cost item is
 * attached to an in-flight proposal, if its owning COGS Owner's step
 * already passed, that step (and everything after it) is rewound for
 * re-verification.
 */
export function applyDynamicFormAdjustment(
  steps: WorkflowStepInstance[],
  ownerStepOrder: number
): { updatedSteps: WorkflowStepInstance[]; reverted: boolean } {
  const ownerSteps = stepsAtOrder(steps, ownerStepOrder);
  if (ownerSteps.length === 0 || !ownerSteps.some(isApproved)) {
    return { updatedSteps: steps, reverted: false };
  }

  const now = new Date().toISOString();
  const updated = steps.map((s) => {
    if (s.step_order === ownerStepOrder) {
      const copy = { ...s };
      openStep(copy, now);
      return copy;
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
