"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  applyDecision,
  canAdvanceToStep,
  checkMandatoryCostItemsFilled,
  statusForStepOrder,
  type DecisionAction,
} from "@/lib/workflow/stateMachine";
import type {
  ProposalStatus,
  WorkflowStepDefinition,
  WorkflowStepInstance,
} from "@/types/database";

/**
 * FR-2.1/2.2/4.2: Submit a DRAFT proposal into the workflow. Picks the
 * workflow_definition whose [min_value, max_value) bucket matches the
 * proposal's transaction_value (from the latest calculation result),
 * then instantiates every step as PENDING with step 1 flipped to
 * IN_PROGRESS. If no bucket matches, the proposal is parked in
 * CONFIG_ERROR rather than silently defaulting — this mirrors §4.5 of
 * the technical logic doc exactly ("mencegah silent bypass").
 */
export async function submitProposalAction(proposalId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from("pricing_proposal")
    .select("*")
    .eq("id", proposalId)
    .single();

  if (!proposal) throw new Error("Proposal not found");
  if (proposal.current_status !== "DRAFT") {
    throw new Error("Hanya proposal berstatus DRAFT yang dapat disubmit.");
  }

  const { data: latestResult } = await supabase
    .from("proposal_calculation_result")
    .select("*")
    .eq("proposal_version_id", proposal.current_version_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!latestResult) {
    throw new Error("Lengkapi CBS cost lines dan hitung harga sebelum submit.");
  }

  const transactionValue = Number(latestResult.final_price);

  const { data: workflowDef } = await supabase
    .from("workflow_definition")
    .select("*")
    .eq("business_line", proposal.business_line)
    .eq("is_active", true)
    .lte("min_value", transactionValue)
    .or(`max_value.is.null,max_value.gte.${transactionValue}`)
    .order("min_value", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!workflowDef) {
    await supabase
      .from("pricing_proposal")
      .update({ current_status: "CONFIG_ERROR", transaction_value: transactionValue })
      .eq("id", proposalId);
    revalidatePath(`/proposals/${proposalId}`);
    throw new Error(
      "Tidak ditemukan Workflow Definition yang cocok untuk nilai transaksi ini — Admin perlu menambah konfigurasi (CONFIG_ERROR, bukan silent bypass)."
    );
  }

  const { data: stepDefs } = await supabase
    .from("workflow_step_definition")
    .select("*")
    .eq("workflow_definition_id", workflowDef.id)
    .order("step_order");

  const defs = (stepDefs ?? []) as WorkflowStepDefinition[];

  const { data: instance, error: instanceError } = await supabase
    .from("workflow_instance")
    .insert({
      proposal_version_id: proposal.current_version_id,
      workflow_definition_id: workflowDef.id,
      status: "RUNNING",
    })
    .select("id")
    .single();

  if (instanceError) throw new Error(instanceError.message);

  const now = new Date().toISOString();
  const stepRows = defs.map((d) => ({
    workflow_instance_id: instance.id,
    step_definition_id: d.id,
    step_order: d.step_order,
    department_id: d.department_id,
    status: d.step_order === 1 ? ("IN_PROGRESS" as const) : ("PENDING" as const),
    sla_hours: d.sla_hours,
    started_at: d.step_order === 1 ? now : null,
    sla_due_at:
      d.step_order === 1
        ? new Date(Date.now() + d.sla_hours * 60 * 60 * 1000).toISOString()
        : null,
  }));

  const { error: stepsError } = await supabase
    .from("workflow_step_instance")
    .insert(stepRows);

  if (stepsError) throw new Error(stepsError.message);

  const firstStatus = statusForStepOrder(defs, 1);

  await supabase
    .from("pricing_proposal")
    .update({
      current_status: firstStatus,
      current_step_order: 1,
      transaction_value: transactionValue,
      workflow_definition_id: workflowDef.id,
    })
    .eq("id", proposalId);

  await writeAuditLog(supabase, {
    entityType: "pricing_proposal",
    entityId: proposalId,
    proposalId,
    actorId: profile.id,
    action: "SUBMIT",
    fieldChanges: [
      { field: "current_status", old: "DRAFT", new: firstStatus },
      { field: "transaction_value", old: null, new: transactionValue },
    ],
  });

  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/lifecycle");
}

interface DecisionParams {
  proposalId: string;
  action: DecisionAction;
  targetStepOrder?: number;
  decisionNote?: string;
}

export async function submitDecisionAction({
  proposalId,
  action,
  targetStepOrder,
  decisionNote,
}: DecisionParams) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from("pricing_proposal")
    .select("*")
    .eq("id", proposalId)
    .single();

  if (!proposal) throw new Error("Proposal not found");

  const { data: instance } = await supabase
    .from("workflow_instance")
    .select("*")
    .eq("proposal_version_id", proposal.current_version_id)
    .single();

  if (!instance) throw new Error("Workflow instance not found");

  const { data: stepDefs } = await supabase
    .from("workflow_step_definition")
    .select("*")
    .eq("workflow_definition_id", instance.workflow_definition_id)
    .order("step_order");

  const { data: stepInstances } = await supabase
    .from("workflow_step_instance")
    .select("*")
    .eq("workflow_instance_id", instance.id)
    .order("step_order");

  const defs = (stepDefs ?? []) as WorkflowStepDefinition[];
  const steps = (stepInstances ?? []) as WorkflowStepInstance[];

  const currentStepOrder = proposal.current_step_order;
  const gate = canAdvanceToStep(steps, currentStepOrder);
  const currentStep = steps.find((s) => s.step_order === currentStepOrder);

  if (!currentStep || currentStep.status !== "IN_PROGRESS") {
    throw new Error("Step ini tidak sedang aktif diproses (strict gatekeeping).");
  }
  if (!gate.canAdvance && action !== "REJECT" && action !== "TARGETED_REJECT") {
    throw new Error(gate.reason);
  }

  // FR-2.2: verify mandatory cost items owned by this department are filled.
  const { data: deptCostItems } = await supabase
    .from("cost_item")
    .select("id")
    .eq("owner_department_id", currentStep.department_id)
    .eq("is_mandatory", true);

  if (deptCostItems && deptCostItems.length > 0 && action.startsWith("APPROVE")) {
    const { data: filledLines } = await supabase
      .from("proposal_cost_line")
      .select("cost_item_id")
      .eq("proposal_version_id", proposal.current_version_id);

    const filledSet = new Set((filledLines ?? []).map((l) => l.cost_item_id));
    const gateCheck = checkMandatoryCostItemsFilled(
      deptCostItems.map((c) => c.id),
      filledSet
    );
    if (!gateCheck.canAdvance) {
      throw new Error(gateCheck.reason);
    }
  }

  const result = applyDecision(
    {
      steps,
      currentStepOrder,
      action,
      targetStepOrder,
      decisionNote,
      actorId: profile.id,
    },
    defs
  );

  for (const step of result.updatedSteps) {
    const original = steps.find((s) => s.id === step.id)!;
    const changed =
      original.status !== step.status ||
      original.started_at !== step.started_at ||
      original.completed_at !== step.completed_at;
    if (!changed) continue;

    await supabase
      .from("workflow_step_instance")
      .update({
        status: step.status,
        started_at: step.started_at,
        completed_at: step.completed_at,
        actor_id: step.actor_id,
        decision_note: step.decision_note,
        sla_due_at: step.sla_due_at,
      })
      .eq("id", step.id);
  }

  const nextStatus: ProposalStatus =
    result.nextProposalStatus === "AWAITING_NEXT" || result.nextProposalStatus === "REJECTED"
      ? "REJECTED"
      : (result.nextProposalStatus as ProposalStatus);

  await supabase
    .from("pricing_proposal")
    .update({
      current_status: nextStatus,
      current_step_order: result.nextStepOrder ?? currentStepOrder,
    })
    .eq("id", proposalId);

  if (nextStatus === "FINAL_APPROVED") {
    await supabase
      .from("workflow_instance")
      .update({ status: "COMPLETED" })
      .eq("id", instance.id);
  }

  const auditAction =
    action === "APPROVE"
      ? "APPROVE"
      : action === "APPROVE_WITH_CONDITIONS"
        ? "APPROVE_WITH_CONDITIONS"
        : action === "TARGETED_REJECT"
          ? "TARGETED_REJECT"
          : "REJECT";

  await writeAuditLog(supabase, {
    entityType: "workflow_step_instance",
    entityId: currentStep.id,
    proposalId,
    actorId: profile.id,
    action: auditAction,
    reason: decisionNote,
    fieldChanges: [{ field: "status", old: currentStep.status, new: action }],
  });

  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/lifecycle");
}
