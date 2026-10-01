"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { hasFunction } from "@/lib/rbac";
import { generateProposalNumber } from "@/lib/workflow/proposalNumber";
import { canViewQuotation, loadValidatorVisibleRoles } from "@/lib/menuAccess";
import {
  activeStep,
  actorCanActOnStep,
  advanceFrom,
  decideTier,
  loadCurrentInstance,
  loadLines,
  loadRole,
  priceQuotation,
  releaseQuotation,
  returnToSalesOperations,
  routeAfterReview,
  type LineEdit,
} from "@/lib/workflow/quotationEngine";
import { isNextControlFlowError, toActionError, type ActionResult } from "@/lib/actionResult";
import { revalidatePath } from "next/cache";
import type {
  Actor,
  PricingProposal,
  WorkflowDefinition,
  WorkflowStepDefinition,
} from "@/types/database";

type Db = Awaited<ReturnType<typeof createClient>>;

async function run(
  proposalId: string,
  fallback: string,
  fn: (ctx: { supabase: Db; actor: Actor; proposal: PricingProposal }) => Promise<void>
): Promise<ActionResult> {
  try {
    const actor = await requireProfile();
    const supabase = await createClient();
    const proposal = await loadProposal(supabase, proposalId);
    // Row-level policy (FR-5.7): acting on an invisible quotation looks like it does not exist.
    if (!canViewQuotation(actor, proposal, await loadValidatorVisibleRoles(supabase))) {
      throw new Error("Quotation tidak ditemukan.");
    }
    await fn({ supabase, actor, proposal });
    revalidatePath(`/proposals/${proposalId}`);
    revalidatePath("/proposals");
    revalidatePath("/lifecycle");
    return { ok: true };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, fallback);
  }
}

async function loadProposal(supabase: Db, id: string): Promise<PricingProposal> {
  const { data } = await supabase.from("pricing_proposal").select("*").eq("id", id).single();
  if (!data) throw new Error("Quotation tidak ditemukan.");
  return data as PricingProposal;
}

function sameLines(
  a: { product_id: string; quantity: number }[],
  b: { product_id: string; quantity: number }[]
): boolean {
  const key = (l: { product_id: string; quantity: number }) => `${l.product_id}:${l.quantity}`;
  return a.map(key).sort().join("|") === b.map(key).sort().join("|");
}

// ---------------------------------------------------------------------
// Step 3 → 4: submit
// ---------------------------------------------------------------------

export async function submitQuotationAction(proposalId: string): Promise<ActionResult> {
  return run(proposalId, "Gagal submit quotation.", async ({ supabase, actor, proposal }) => {
    if (proposal.current_status !== "DRAFT") throw new Error("Hanya quotation DRAFT yang dapat disubmit.");
    if (proposal.created_by !== actor.id) throw new Error("Hanya pengaju yang dapat submit quotation ini.");
    if (!proposal.current_version_id) throw new Error("Quotation belum memiliki versi.");

    const lines = await loadLines(supabase, proposal.id);
    if (lines.length === 0) throw new Error("b. Minimal satu varian kendaraan & kuantitas.");

    const { data: defs } = await supabase
      .from("workflow_definition")
      .select("*")
      .eq("is_active", true)
      .eq("workflow_kind", "OFFICIAL_QUOTATION")
      .order("version", { ascending: false });
    const candidates = (defs ?? []) as WorkflowDefinition[];
    const template =
      candidates.find((d) => d.qualifier_type === "BUSINESS_LINE" && d.business_line === proposal.business_line) ??
      candidates.find((d) => d.qualifier_type !== "BUSINESS_LINE");
    if (!template) {
      await supabase.from("pricing_proposal").update({ current_status: "CONFIG_ERROR" }).eq("id", proposal.id);
      throw new Error("Tidak ada Workflow Template Official Quotation yang aktif (CONFIG_ERROR).");
    }

    const { data: stepDefRows } = await supabase
      .from("workflow_step_definition")
      .select("*")
      .eq("workflow_definition_id", template.id)
      .order("step_order");
    const stepDefs = (stepDefRows ?? []) as WorkflowStepDefinition[];
    if (!stepDefs.some((s) => s.action_kind === "GENERATE_QUOTATION")) {
      throw new Error("Workflow Template tidak memiliki langkah Generate (Sales Operations).");
    }

    // Close any earlier (rejected) instance of this version.
    await supabase
      .from("workflow_instance")
      .update({ status: "REJECTED" })
      .eq("proposal_version_id", proposal.current_version_id)
      .eq("status", "RUNNING");

    const { data: instance, error: instanceError } = await supabase
      .from("workflow_instance")
      .insert({
        proposal_version_id: proposal.current_version_id,
        workflow_definition_id: template.id,
        status: "RUNNING",
      })
      .select("*")
      .single();
    if (instanceError) throw new Error(instanceError.message);

    // Step definitions are copied onto the instance so a later template
    // edit never changes a quotation already in flight.
    const { data: stepRows, error: stepsError } = await supabase
      .from("workflow_step_instance")
      .insert(
        stepDefs.map((d) => ({
          workflow_instance_id: instance.id,
          step_definition_id: d.id,
          step_order: d.step_order,
          department_id: d.department_id,
          status: "PENDING",
          sla_hours: d.sla_hours,
          step_name: d.step_name,
          action_kind: d.action_kind,
          performer_function: d.performer_function,
          skip_if_initiator_function: d.skip_if_initiator_function,
          reject_to_step_order: d.reject_to_step_order,
          status_label: d.status_label,
        }))
      )
      .select("*");
    if (stepsError) throw new Error(stepsError.message);

    await supabase
      .from("pricing_proposal")
      .update({ workflow_definition_id: template.id, tier_round: 0 })
      .eq("id", proposal.id);

    // A revision whose KYC and vehicles are unchanged goes straight to
    // Sales Operations (FR-2.5) — nothing new for the Sales Lead to validate.
    let skipValidation = false;
    if (proposal.supersedes_proposal_id) {
      const predecessor = await loadProposal(supabase, proposal.supersedes_proposal_id);
      const predecessorLines = await loadLines(supabase, predecessor.id);
      skipValidation =
        JSON.stringify(predecessor.kyc) === JSON.stringify(proposal.kyc) && sameLines(predecessorLines, lines);
    }

    const initiatorRole = await loadRole(supabase, proposal.initiator_role_code);

    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: proposal.id,
      proposalId: proposal.id,
      actorId: actor.id,
      action: "SUBMIT",
      reason: `Workflow: ${template.name} v${template.version}`,
    });

    await advanceFrom(
      supabase,
      {
        proposal,
        instance,
        steps: stepRows ?? [],
        actor,
        initiatorFunctions: initiatorRole?.functional_roles ?? [],
        skipValidation,
      },
      0
    );
  });
}

// ---------------------------------------------------------------------
// VALIDATE / APPROVE steps (Sales Lead, or any extra template step)
// ---------------------------------------------------------------------

export async function stepDecisionAction(
  proposalId: string,
  decision: "APPROVE" | "REJECT",
  note: string
): Promise<ActionResult> {
  return run(proposalId, "Gagal menyimpan keputusan.", async ({ supabase, actor, proposal }) => {
    const { instance, steps } = await loadCurrentInstance(supabase, proposal);
    const step = activeStep(steps);
    if (!instance || !step) throw new Error("Tidak ada langkah aktif.");
    if (step.action_kind !== "VALIDATE" && step.action_kind !== "APPROVE") {
      throw new Error("Langkah aktif bukan langkah validasi/persetujuan.");
    }
    if (!actorCanActOnStep(actor, step)) throw new Error("Role Anda bukan pelaksana langkah ini.");
    if (decision === "REJECT" && !note.trim()) throw new Error("Catatan wajib diisi saat menolak.");

    const now = new Date().toISOString();
    await supabase
      .from("workflow_step_instance")
      .update({
        status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        completed_at: now,
        actor_id: actor.id,
        decision_note: note || null,
      })
      .eq("id", step.id);

    await writeAuditLog(supabase, {
      entityType: "workflow_step_instance",
      entityId: step.id,
      proposalId,
      actorId: actor.id,
      action: decision === "APPROVE" ? (step.action_kind === "VALIDATE" ? "VALIDATE" : "APPROVE") : "REJECT",
      reason: note || undefined,
    });

    if (decision === "REJECT") {
      if (step.reject_to_step_order) {
        const target = steps.find((s) => s.step_order === step.reject_to_step_order);
        if (target?.action_kind === "GENERATE_QUOTATION") {
          await returnToSalesOperations(supabase, proposal, note);
          return;
        }
      }
      // Default: back to the Salesperson as a DRAFT, KYC intact.
      await supabase.from("workflow_instance").update({ status: "REJECTED" }).eq("id", instance.id);
      await supabase
        .from("pricing_proposal")
        .update({ current_status: "DRAFT", current_step_order: 0 })
        .eq("id", proposalId);
      return;
    }

    const initiatorRole = await loadRole(supabase, proposal.initiator_role_code);
    step.status = "APPROVED";
    await advanceFrom(
      supabase,
      { proposal, instance, steps, actor, initiatorFunctions: initiatorRole?.functional_roles ?? [] },
      step.step_order
    );
  });
}

// ---------------------------------------------------------------------
// GENERATE / REVIEW: pricing edits (discount Rp/%, scheme, document text)
// ---------------------------------------------------------------------

export interface PricingEditInput {
  lines: Record<string, LineEdit>;
  inclusions: string[];
  exclusions: string[];
  specialNotes: string[];
}

export async function savePricingAction(proposalId: string, input: PricingEditInput): Promise<ActionResult> {
  return run(proposalId, "Gagal menyimpan harga.", async ({ supabase, actor, proposal }) => {
    const { steps } = await loadCurrentInstance(supabase, proposal);
    const step = activeStep(steps);
    const editable =
      step &&
      (step.action_kind === "GENERATE_QUOTATION" || step.action_kind === "REVIEW_AND_ROUTE") &&
      actorCanActOnStep(actor, step);
    if (!editable) {
      throw new Error("Harga hanya dapat diubah oleh Sales Operations (generate) atau Head of Sales (revise).");
    }

    for (const edit of Object.values(input.lines)) {
      if (edit.discountValue !== undefined && (edit.discountValue < 0 || Number.isNaN(edit.discountValue))) {
        throw new Error("Nilai diskon tidak valid.");
      }
    }

    await supabase
      .from("pricing_proposal")
      .update({
        inclusions: input.inclusions.filter(Boolean),
        exclusions: input.exclusions.filter(Boolean),
        special_notes: input.specialNotes.filter(Boolean),
      })
      .eq("id", proposalId);

    const fresh = await loadProposal(supabase, proposalId);
    const summary = await priceQuotation(supabase, fresh, {
      refreshVersions: false,
      applyBandDefaults: false,
      edits: input.lines,
      discountSource: step.action_kind === "REVIEW_AND_ROUTE" ? "HEAD_OF_SALES_REVISE" : "SALES_OPS_MANUAL",
    });

    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: proposalId,
      proposalId,
      actorId: actor.id,
      action: step.action_kind === "REVIEW_AND_ROUTE" ? "REVISE" : "UPDATE",
      reason: `Harga disimpan — GM ${(summary.gm * 100).toFixed(2)}%, Tier ${summary.tier?.tier ?? "?"}`,
      fieldChanges: Object.entries(input.lines).map(([lineId, e]) => ({
        field: `discount_${lineId.slice(0, 8)}`,
        old: null,
        new: `${e.discountValue ?? "-"} ${e.discountMode ?? ""}`.trim(),
      })),
    });
  });
}

/** "Hitung Ulang" — re-resolve the latest RELEASED cost structure (kurs baru). */
export async function recalculateQuotationAction(proposalId: string): Promise<ActionResult> {
  return run(proposalId, "Gagal menghitung ulang.", async ({ supabase, actor, proposal }) => {
    const { steps } = await loadCurrentInstance(supabase, proposal);
    const step = activeStep(steps);
    if (
      !step ||
      !(step.action_kind === "GENERATE_QUOTATION" || step.action_kind === "REVIEW_AND_ROUTE") ||
      !actorCanActOnStep(actor, step)
    ) {
      throw new Error("Hitung Ulang hanya oleh Sales Operations / Head of Sales pada langkahnya.");
    }
    const summary = await priceQuotation(supabase, proposal, { refreshVersions: true, applyBandDefaults: false });
    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: proposalId,
      proposalId,
      actorId: actor.id,
      action: "RECALCULATE",
      reason: `Hitung Ulang dari cost structure RELEASED terbaru — GM ${(summary.gm * 100).toFixed(2)}%`,
    });
  });
}

/** Sales Operations: "Teruskan ke Head of Sales" (sheet step 5 → 6). */
export async function forwardToReviewAction(proposalId: string): Promise<ActionResult> {
  return run(proposalId, "Gagal meneruskan quotation.", async ({ supabase, actor, proposal }) => {
    const { instance, steps } = await loadCurrentInstance(supabase, proposal);
    const step = activeStep(steps);
    if (!instance || !step || step.action_kind !== "GENERATE_QUOTATION" || !actorCanActOnStep(actor, step)) {
      throw new Error("Hanya Sales Operations pada langkah Generate yang dapat meneruskan.");
    }
    await supabase
      .from("workflow_step_instance")
      .update({ status: "APPROVED", completed_at: new Date().toISOString(), actor_id: actor.id })
      .eq("id", step.id);
    await supabase.from("pricing_proposal").update({ prepared_by: actor.id }).eq("id", proposalId);
    step.status = "APPROVED";

    await writeAuditLog(supabase, {
      entityType: "workflow_step_instance",
      entityId: step.id,
      proposalId,
      actorId: actor.id,
      action: "APPROVE",
      reason: "Official Quotation diteruskan ke Head of Sales",
    });

    const initiatorRole = await loadRole(supabase, proposal.initiator_role_code);
    await advanceFrom(
      supabase,
      { proposal, instance, steps, actor, initiatorFunctions: initiatorRole?.functional_roles ?? [] },
      step.step_order
    );
  });
}

/** Head of Sales (sheet step 7): accept → tier routing, or return to Sales Operations. */
export async function reviewDecisionAction(
  proposalId: string,
  decision: "ACCEPT" | "RETURN",
  note: string
): Promise<ActionResult> {
  return run(proposalId, "Gagal menyimpan keputusan review.", async ({ supabase, actor, proposal }) => {
    const { steps } = await loadCurrentInstance(supabase, proposal);
    const step = activeStep(steps);
    if (!step || step.action_kind !== "REVIEW_AND_ROUTE" || !actorCanActOnStep(actor, step)) {
      throw new Error("Hanya Head of Sales pada langkah review yang dapat memutus.");
    }

    if (decision === "RETURN") {
      if (!note.trim()) throw new Error("Catatan wajib diisi saat mengembalikan ke Sales Operations.");
      await supabase
        .from("workflow_step_instance")
        .update({ status: "REJECTED", completed_at: new Date().toISOString(), actor_id: actor.id, decision_note: note })
        .eq("id", step.id);
      await writeAuditLog(supabase, {
        entityType: "workflow_step_instance",
        entityId: step.id,
        proposalId,
        actorId: actor.id,
        action: "RETURN",
        reason: note,
      });
      await returnToSalesOperations(supabase, proposal, note);
      return;
    }

    await supabase
      .from("workflow_step_instance")
      .update({
        status: "APPROVED",
        completed_at: new Date().toISOString(),
        actor_id: actor.id,
        decision_note: note || null,
      })
      .eq("id", step.id);
    await writeAuditLog(supabase, {
      entityType: "workflow_step_instance",
      entityId: step.id,
      proposalId,
      actorId: actor.id,
      action: "APPROVE",
      reason: note || "Head of Sales accept",
    });

    try {
      await routeAfterReview(supabase, await loadProposal(supabase, proposalId), actor);
    } catch (e) {
      // Release gate failed on a Tier 1 quotation: keep the review open
      // so the Head of Sales sees why and can act on it.
      await supabase
        .from("workflow_step_instance")
        .update({ status: "IN_PROGRESS", completed_at: null, actor_id: null })
        .eq("id", step.id);
      throw e;
    }
  });
}

/** COGS/Profitability Owner (Tier 2) or CCO/CFO (Tier 3). */
export async function tierDecisionAction(
  proposalId: string,
  decision: "APPROVE" | "REJECT",
  note: string
): Promise<ActionResult> {
  return run(proposalId, "Gagal menyimpan keputusan tier.", async ({ supabase, actor, proposal }) => {
    if (
      proposal.current_status !== "PENDING_OWNER_APPROVAL" &&
      proposal.current_status !== "PENDING_PRICING_COMMITTEE_APPROVAL"
    ) {
      throw new Error("Quotation tidak sedang menunggu persetujuan tier.");
    }
    if (decision === "REJECT" && !note.trim()) throw new Error("Catatan wajib diisi saat menolak.");
    await decideTier(supabase, proposal, actor, decision, note || null);
  });
}

/** Manual release fallback — used only if a tier round completed but release failed (e.g. kurs basi). */
export async function retryReleaseAction(proposalId: string): Promise<ActionResult> {
  return run(proposalId, "Gagal merilis quotation.", async ({ supabase, actor, proposal }) => {
    if (!hasFunction(actor, "SALES_RELEASER")) throw new Error("Hanya Head of Sales yang dapat merilis.");
    await releaseQuotation(supabase, proposal, actor);
  });
}

// ---------------------------------------------------------------------
// After release: outcome, revision, printing
// ---------------------------------------------------------------------

export async function recordOutcomeAction(
  proposalId: string,
  outcome: "WON" | "LOST",
  note: string,
  acceptedDocumentUrl: string
): Promise<ActionResult> {
  return run(proposalId, "Gagal mencatat hasil.", async ({ supabase, actor, proposal }) => {
    if (!hasFunction(actor, "SALESPERSON") && !hasFunction(actor, "SALES_RELEASER") && !hasFunction(actor, "SYSTEM_ADMIN")) {
      throw new Error("Hanya Salesperson / Head of Sales yang dapat mencatat hasil.");
    }
    if (proposal.current_status !== "QUOTATION_RELEASED") {
      throw new Error("Hasil hanya dicatat untuk quotation yang masih berlaku (Released).");
    }
    await supabase
      .from("pricing_proposal")
      .update({ outcome, accepted_document_url: acceptedDocumentUrl.trim() || null })
      .eq("id", proposalId);
    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: proposalId,
      proposalId,
      actorId: actor.id,
      action: "UPDATE",
      reason: note || (outcome === "WON" ? "Pelanggan menandatangani penerimaan" : "Pelanggan menolak"),
      fieldChanges: [{ field: "outcome", old: proposal.outcome, new: outcome }],
    });
  });
}

export interface RevisionResult extends ActionResult {
  newProposalId?: string;
}

/** Customer request after release (FR-6.3) → a new quotation on the same Project Identifier. */
export async function createRevisionAction(proposalId: string, reason: string): Promise<RevisionResult> {
  try {
    const actor = await requireProfile();
    const supabase = await createClient();
    const proposal = await loadProposal(supabase, proposalId);
    if (!canViewQuotation(actor, proposal, await loadValidatorVisibleRoles(supabase))) {
      throw new Error("Quotation tidak ditemukan.");
    }
    if (!hasFunction(actor, "SALESPERSON")) throw new Error("Revisi diajukan oleh Salesperson.");
    if (proposal.current_status !== "QUOTATION_RELEASED" && proposal.current_status !== "EXPIRED") {
      throw new Error("Revisi hanya untuk quotation yang sudah dirilis atau kedaluwarsa.");
    }
    if (!reason.trim()) throw new Error("Isi alasan/permintaan pelanggan.");

    const lines = await loadLines(supabase, proposalId);
    const proposalNumber = await generateProposalNumber(supabase);

    const { data: created, error } = await supabase
      .from("pricing_proposal")
      .insert({
        proposal_number: proposalNumber,
        title: proposal.title,
        business_line: proposal.business_line,
        customer_name: proposal.customer_name,
        cbs_template_id: proposal.cbs_template_id,
        project_identifier_id: proposal.project_identifier_id,
        supersedes_proposal_id: proposal.id,
        unit_quantity: proposal.unit_quantity,
        input_currency: "CNY",
        current_status: "DRAFT",
        kyc: proposal.kyc,
        initiator_role_code: actor.app_role_code,
        account_person_ids: proposal.account_person_ids,
        inclusions: proposal.inclusions,
        exclusions: proposal.exclusions,
        special_notes: proposal.special_notes,
        created_by: actor.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { data: version } = await supabase
      .from("pricing_proposal_version")
      .insert({
        proposal_id: created.id,
        version_label: "v1.0",
        change_reason: reason,
        is_current: true,
        created_by: actor.id,
      })
      .select("id")
      .single();
    await supabase.from("pricing_proposal").update({ current_version_id: version?.id }).eq("id", created.id);

    await supabase.from("quotation_line_item").insert(
      lines.map((l) => ({
        proposal_id: created.id,
        product_id: l.product_id,
        quantity: l.quantity,
        sort_order: l.sort_order,
        scheme: l.scheme,
        rental_tenor_months: l.rental_tenor_months,
        rental_monthly_incl_vat: l.rental_monthly_incl_vat,
        // Keep the negotiated discount as a starting point for Sales Operations.
        discount_input_mode: l.discount_input_mode,
        discount_amount: l.discount_amount,
        discount_pct: l.discount_pct,
        discount_source: l.discount_source,
      }))
    );

    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: created.id,
      proposalId: created.id,
      actorId: actor.id,
      action: "CREATE",
      reason: `Revisi dari ${proposal.proposal_number}: ${reason}`,
      fieldChanges: [{ field: "supersedes_proposal_id", old: null, new: proposal.id }],
    });

    revalidatePath("/proposals");
    return { ok: true, newProposalId: created.id };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, "Gagal membuat revisi.");
  }
}

export async function logDocumentRenderAction(
  proposalId: string,
  kind: "PRINT" | "COST_STRUCTURE_SHEET"
): Promise<void> {
  const actor = await requireProfile();
  const supabase = await createClient();
  await writeAuditLog(supabase, {
    entityType: "pricing_proposal",
    entityId: proposalId,
    proposalId,
    actorId: actor.id,
    action: "PRINT",
    reason: kind === "PRINT" ? "Cetak / simpan PDF dokumen Cost Estimate" : "Cetak Cost Structure Sheet (internal)",
  });
}
