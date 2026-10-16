"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  canAttachSignedDocument,
  canCancelFinalApproval,
  canEditRevisionDiscount,
  canOverrideExpired,
  canRecordWinLossOutcome,
  canSetPaymentTerms,
  hasFunction,
} from "@/lib/rbac";
import { validateTermsTemplate, type TermTemplate } from "@/lib/projects";
import { generateProposalNumber } from "@/lib/workflow/proposalNumber";
import { canViewQuotation, loadValidatorVisibleRoles } from "@/lib/menuAccess";
import { buildStoragePath, removeFile, uploadFile, validateUpload } from "@/lib/files";
import {
  activeStep,
  actorCanActOnStep,
  advanceFrom,
  approveFinal,
  attachSignedDocument,
  releaseWithoutSignedDocument,
  cancelFinalApproval,
  decideTier,
  loadCurrentInstance,
  loadLines,
  loadRole,
  overrideExpired,
  priceQuotation,
  returnToSalesOperations,
  routeAfterReview,
  type LineEdit,
} from "@/lib/workflow/quotationEngine";
import { isNextControlFlowError, toActionError, type ActionResult } from "@/lib/actionResult";
import { revalidatePath } from "next/cache";
import { loadSettings } from "@/lib/settings";
import { evaluateVersion, loadCostItems, loadReleasedVersion, loadVersionLines } from "@/lib/costStructure";
import { isBlacklisted, loadActiveQuotationTemplates, resolveTemplate } from "@/lib/workflow/templateCatalog";
import type { Actor, PricingProposal, WorkflowStepDefinition } from "@/types/database";

type Db = Awaited<ReturnType<typeof createClient>>;

async function run(
  proposalId: string,
  fallback: string,
  fn: (ctx: { supabase: Db; actor: Actor; proposal: PricingProposal }) => Promise<void>
): Promise<ActionResult> {
  try {
    const [actor, supabase] = await Promise.all([requireProfile(), createClient()]);
    const [proposal, validatorRoles] = await Promise.all([
      loadProposal(supabase, proposalId),
      loadValidatorVisibleRoles(supabase),
    ]);
    // Row-level policy (FR-5.7): acting on an invisible quotation looks like it does not exist.
    if (!canViewQuotation(actor, proposal, validatorRoles)) {
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

    // Workflow Template Catalog (FR-2.0.1, v4.1): estimated value from the
    // RELEASED cost structures (basic price × qty), then the most specific
    // template whose qualifiers match this deal.
    const [items, settings, templates] = await Promise.all([
      loadCostItems(supabase),
      loadSettings(supabase),
      loadActiveQuotationTemplates(supabase),
    ]);
    const lineValues = await Promise.all(
      lines.map(async (line) => {
        const version = await loadReleasedVersion(supabase, line.product_id);
        if (!version) throw new Error("Ada varian tanpa cost structure RELEASED — tidak dapat disubmit.");
        const cs = evaluateVersion(items, await loadVersionLines(supabase, version.id), Number(version.locked_fx_rate));
        return cs.listPriceExVat * line.quantity;
      })
    );
    const estimatedValue = lineValues.reduce((s, v) => s + v, 0);
    const blacklisted = isBlacklisted(proposal.kyc.company_name, settings.customerBlacklist);
    const resolution = resolveTemplate(templates, {
      segment: proposal.kyc.customer_segment ?? null,
      industry: proposal.kyc.industry ?? null,
      relationship: proposal.kyc.relationship ?? null,
      businessLine: proposal.business_line,
      quantity: lines.reduce((s, l) => s + l.quantity, 0),
      estimatedValue,
      isBlacklisted: blacklisted,
    });
    const template = resolution.template;
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
      .update({
        workflow_definition_id: template.id,
        workflow_template_code: template.template_code,
        workflow_selection_reason: resolution.reason,
        estimated_value: estimatedValue,
        is_blacklisted: blacklisted,
        tier_round: 0,
      })
      .eq("id", proposal.id);
    proposal.workflow_template_code = template.template_code;

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
      reason: `Workflow: ${template.name} v${template.version} — ${resolution.reason}`,
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

/**
 * Manual fallback — used only if a tier round completed but the final
 * approval failed (e.g. kurs basi). Head of Sales retries it.
 */
export async function retryReleaseAction(proposalId: string): Promise<ActionResult> {
  return run(proposalId, "Gagal menyetujui final quotation.", async ({ supabase, actor, proposal }) => {
    if (!hasFunction(actor, "SALES_RELEASER")) throw new Error("Hanya Head of Sales yang dapat menyetujui final.");
    await approveFinal(supabase, proposal, actor);
  });
}

// ---------------------------------------------------------------------
// v5.0 — signed document → Released (PRD FR-2.11)
// ---------------------------------------------------------------------

/** Head of Sales withdraws the final approval before the signed document is attached. */
export async function cancelFinalApprovalAction(proposalId: string, reason: string): Promise<ActionResult> {
  return run(proposalId, "Gagal membatalkan approval final.", async ({ supabase, actor, proposal }) => {
    if (!canCancelFinalApproval(actor)) throw new Error("Hanya Head of Sales yang dapat membatalkan approval final.");
    await cancelFinalApproval(supabase, proposal, actor, reason);
  });
}

/**
 * Optional (PRD FR-2.11): releases an approved quotation WITHOUT attaching the signed document. The
 * Salesperson who owns it (or an Admin) decides; the document can still be attached later.
 */
export async function releaseWithoutSignedDocumentAction(proposalId: string): Promise<ActionResult> {
  return run(proposalId, "Gagal merilis quotation.", async ({ supabase, actor, proposal }) => {
    if (!canAttachSignedDocument(actor, proposal)) {
      throw new Error("Hanya Salesperson pemilik quotation yang dapat merilis.");
    }
    await releaseWithoutSignedDocument(supabase, proposal, actor);
  });
}

/**
 * The Salesperson attaches the document signed by the Head of Sales (optional). While the quotation
 * waits for release this also releases it; after release it adds or replaces the attachment.
 */
export async function attachSignedDocumentAction(proposalId: string, formData: FormData): Promise<ActionResult> {
  return run(proposalId, "Gagal melampirkan dokumen bertanda tangan.", async ({ supabase, actor, proposal }) => {
    if (proposal.current_status !== "PENDING_SIGNED_DOCUMENT" && proposal.current_status !== "QUOTATION_RELEASED") {
      throw new Error("Lampiran hanya untuk quotation yang disetujui (menunggu rilis) atau sudah dirilis.");
    }
    if (!canAttachSignedDocument(actor, proposal)) {
      throw new Error("Hanya Salesperson pemilik quotation yang dapat melampirkan dokumen bertanda tangan.");
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Lampirkan dokumen bertanda tangan Head of Sales.");
    const invalid = validateUpload(file);
    if (invalid) throw new Error(invalid);

    const path = buildStoragePath("signed", proposal.id, file.name);
    await uploadFile(supabase, path, file);
    try {
      await attachSignedDocument(supabase, proposal, actor, path);
    } catch (e) {
      await removeFile(supabase, path);
      throw e;
    }
  });
}

// ---------------------------------------------------------------------
// v5.0 — discount entered by the Salesperson on a draft revision (PRD FR-6.0)
// ---------------------------------------------------------------------

/**
 * Only on a draft *revision*; the original draft stays at the standard
 * price. The discount is priced against the latest RELEASED cost
 * structure and still goes through the margin-tier routing on submit.
 * GM / tier / cost are deliberately NOT returned to the Salesperson.
 */
export async function saveRevisionDiscountAction(
  proposalId: string,
  lines: Record<string, LineEdit>
): Promise<ActionResult> {
  return run(proposalId, "Gagal menyimpan diskon revisi.", async ({ supabase, actor, proposal }) => {
    if (!canEditRevisionDiscount(actor, proposal)) {
      throw new Error("Diskon hanya dapat diisi Salesperson pada draft revisi miliknya.");
    }
    for (const edit of Object.values(lines)) {
      if (edit.discountValue !== undefined && (edit.discountValue < 0 || Number.isNaN(edit.discountValue))) {
        throw new Error("Nilai diskon tidak valid.");
      }
      if (edit.discountMode === "PERCENTAGE" && (edit.discountValue ?? 0) > 100) {
        throw new Error("Diskon persen tidak boleh lebih dari 100.");
      }
    }
    // Salesperson edits only the discount; scheme / rental fields stay as they are.
    const discountOnly: Record<string, LineEdit> = {};
    for (const [id, e] of Object.entries(lines)) {
      discountOnly[id] = { discountMode: e.discountMode, discountValue: e.discountValue };
    }
    await priceQuotation(supabase, proposal, {
      refreshVersions: true,
      applyBandDefaults: false,
      edits: discountOnly,
      discountSource: "SALESPERSON_REVISION",
    });
    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: proposalId,
      proposalId,
      actorId: actor.id,
      action: "UPDATE",
      reason: "Salesperson mengisi diskon negosiasi pada draft revisi.",
      fieldChanges: Object.entries(discountOnly).map(([lineId, e]) => ({
        field: `discount_${lineId.slice(0, 8)}`,
        old: null,
        new: `${e.discountValue ?? "-"} ${e.discountMode ?? ""}`.trim(),
      })),
    });
  });
}

// ---------------------------------------------------------------------
// After release: outcome, Expired override, revision, printing
// ---------------------------------------------------------------------

/** Won requires the customer's PO; it creates the Project (PRD FR-9.1). */
export async function markWonAction(proposalId: string, formData: FormData): Promise<ActionResult> {
  return run(proposalId, "Gagal mencatat Won.", async ({ supabase, actor, proposal }) => {
    if (!canRecordWinLossOutcome(actor)) {
      throw new Error("Hanya Salesperson / Head of Sales yang dapat mencatat hasil.");
    }
    if (proposal.current_status !== "QUOTATION_RELEASED") {
      throw new Error("Hasil hanya dicatat untuk quotation yang masih berlaku (Released).");
    }
    if (proposal.outcome !== "PENDING") throw new Error("Hasil quotation ini sudah dicatat.");

    const poNumber = String(formData.get("po_number") ?? "").trim();
    const receivedRaw = String(formData.get("po_received_at") ?? "").trim();
    const file = formData.get("po_file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Bukti PO wajib diunggah.");
    const invalid = validateUpload(file);
    if (invalid) throw new Error(invalid);
    if (!poNumber) throw new Error("Nomor PO wajib diisi.");
    const receivedAt = /^\d{4}-\d{2}-\d{2}$/.test(receivedRaw) ? receivedRaw : new Date().toISOString().slice(0, 10);

    const path = buildStoragePath("po", proposal.id, file.name);
    await uploadFile(supabase, path, file);
    const now = new Date().toISOString();
    try {
      const { error: updateError } = await supabase
        .from("pricing_proposal")
        .update({
          outcome: "WON",
          outcome_at: now,
          outcome_by: actor.id,
          po_number: poNumber,
          po_document_path: path,
          po_received_at: receivedAt,
        })
        .eq("id", proposalId)
        .eq("outcome", "PENDING");
      if (updateError) throw new Error(updateError.message);

      const { error: projectError } = await supabase.from("project").upsert(
        {
          proposal_id: proposal.id,
          project_identifier_id: proposal.project_identifier_id,
          customer_name: proposal.customer_name ?? proposal.kyc.company_name,
          po_number: poNumber,
          po_received_at: receivedAt,
          po_document_path: path,
          contract_value_ex_vat: proposal.total_ex_vat,
          created_by: actor.id,
        },
        { onConflict: "proposal_id", ignoreDuplicates: true }
      );
      if (projectError) throw new Error(projectError.message);

      // The quotation's terms (default 50/50, or what the Salesperson set with "Update TOP") become the project's
      // terms; they stay editable there.
      const { data: created } = await supabase.from("project").select("id").eq("proposal_id", proposal.id).maybeSingle();
      if (created) {
        const { count } = await supabase
          .from("project_payment_term")
          .select("id", { count: "exact", head: true })
          .eq("project_id", created.id);
        if (!count) {
          const { error: termError } = await supabase.from("project_payment_term").insert(
            (proposal.payment_terms ?? []).map((t, i) => ({
              project_id: created.id,
              term_no: i + 1,
              label: t.label,
              planned_pct: t.pct,
              created_by: actor.id,
              updated_by: actor.id,
            }))
          );
          if (termError) throw new Error(termError.message);
        }
      }
    } catch (e) {
      await removeFile(supabase, path);
      throw e;
    }

    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: proposalId,
      proposalId,
      actorId: actor.id,
      action: "UPDATE",
      reason: `Won — PO ${poNumber} diterima ${receivedAt}; project dibuat.`,
      fieldChanges: [{ field: "outcome", old: proposal.outcome, new: "WON" }],
    });
    revalidatePath("/projects");
    revalidatePath("/dashboard");
  });
}

/**
 * "Update TOP" on the quotation (v5.0): the Salesperson replaces the payment terms printed on it (default 50/50).
 * Allowed until the outcome is recorded; after Won the terms live on the project.
 */
export async function updateQuotationTermsAction(proposalId: string, terms: TermTemplate[]): Promise<ActionResult> {
  return run(proposalId, "Gagal menyimpan TOP.", async ({ supabase, actor, proposal }) => {
    if (!canSetPaymentTerms(actor, proposal)) throw new Error("Hanya Salesperson pemilik quotation yang mengubah TOP.");
    if (proposal.outcome !== "PENDING" || ["REJECTED", "SUPERSEDED"].includes(proposal.current_status)) {
      throw new Error("TOP quotation tidak dapat diubah lagi; ubah di halaman project bila sudah Won.");
    }
    const clean = terms.map((t) => ({ label: String(t.label ?? "").trim(), pct: Number(t.pct) }));
    const invalid = validateTermsTemplate(clean);
    if (invalid) throw new Error(invalid);
    const { error } = await supabase.from("pricing_proposal").update({ payment_terms: clean }).eq("id", proposal.id);
    if (error) throw new Error(error.message);
    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: proposal.id,
      proposalId: proposal.id,
      actorId: actor.id,
      action: "UPDATE",
      reason: `TOP diubah: ${clean.map((t) => `${t.label} ${t.pct}%`).join(", ")}.`,
      fieldChanges: [
        {
          field: "payment_terms",
          old: (proposal.payment_terms ?? []).map((t) => `${t.label} ${t.pct}%`).join(", "),
          new: clean.map((t) => `${t.label} ${t.pct}%`).join(", "),
        },
      ],
    });
  });
}

export async function markLostAction(proposalId: string, reason: string): Promise<ActionResult> {
  return run(proposalId, "Gagal mencatat Lost.", async ({ supabase, actor, proposal }) => {
    if (!canRecordWinLossOutcome(actor)) {
      throw new Error("Hanya Salesperson / Head of Sales yang dapat mencatat hasil.");
    }
    if (proposal.current_status !== "QUOTATION_RELEASED") {
      throw new Error("Hasil hanya dicatat untuk quotation yang masih berlaku (Released).");
    }
    if (proposal.outcome !== "PENDING") throw new Error("Hasil quotation ini sudah dicatat.");
    if (!reason.trim()) throw new Error("Alasan Lost wajib diisi.");
    const { error } = await supabase
      .from("pricing_proposal")
      .update({ outcome: "LOST", outcome_at: new Date().toISOString(), outcome_by: actor.id, outcome_reason: reason.trim() })
      .eq("id", proposalId)
      .eq("outcome", "PENDING");
    if (error) throw new Error(error.message);
    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: proposalId,
      proposalId,
      actorId: actor.id,
      action: "UPDATE",
      reason: `Lost — ${reason.trim()}`,
      fieldChanges: [{ field: "outcome", old: proposal.outcome, new: "LOST" }],
    });
    revalidatePath("/dashboard");
  });
}

/** Admin may declare Expired early or undo a wrong Expired (PRD FR-2.9, v5.0). */
export async function adminExpiredOverrideAction(
  proposalId: string,
  mode: "EXPIRE" | "CLEAR",
  reason: string,
  newValidUntil: string
): Promise<ActionResult> {
  return run(proposalId, "Gagal mengubah status Expired.", async ({ supabase, actor, proposal }) => {
    if (!canOverrideExpired(actor)) throw new Error("Hanya Admin yang dapat mengubah status Expired.");
    await overrideExpired(supabase, proposal, actor, mode, reason, newValidUntil || undefined);
    revalidatePath("/dashboard");
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
        approval_mode: proposal.approval_mode,
        inclusions: proposal.inclusions,
        exclusions: proposal.exclusions,
        special_notes: proposal.special_notes,
        payment_terms: proposal.payment_terms,
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
