"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { resolveCurrentVersionId } from "@/lib/pricing/version";
import {
  computeMarginImpact,
  isWithinAuthority,
  loadDiscountLadder,
  resolveRequiredRole,
} from "@/lib/negotiation/authority";
import { canRequestDiscount } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import {
  isNextControlFlowError,
  toActionError,
  type ActionResult,
} from "@/lib/actionResult";
import { z } from "zod";
import type {
  BusinessLine,
  NegotiationDecisionType,
  NegotiationRequest,
  PricingProposal,
} from "@/types/database";

const DiscountSchema = z.coerce.number().min(0.01).max(100);

/**
 * FR-6.2 — raise a customer discount request. The approver is resolved
 * by the server from the discount ladder; the requester cannot pick it.
 */
export async function requestDiscountAction(
  proposalId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    await runRequestDiscount(proposalId, formData);
    return { ok: true };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, "Gagal mengajukan permintaan diskon.");
  }
}

async function runRequestDiscount(proposalId: string, formData: FormData) {
  const profile = await requireProfile();
  if (!canRequestDiscount(profile.role)) {
    throw new Error("Hanya Sales Officer / Chief Sales yang dapat mengajukan diskon.");
  }

  const discountPct = DiscountSchema.parse(formData.get("discount_pct"));
  const customerNote = String(formData.get("customer_note") ?? "") || null;

  const supabase = await createClient();

  const { data: proposalRow } = await supabase
    .from("pricing_proposal")
    .select("*")
    .eq("id", proposalId)
    .single();

  if (!proposalRow) throw new Error("Proposal not found");
  const proposal = proposalRow as PricingProposal;

  const { data: existingPending } = await supabase
    .from("negotiation_request")
    .select("id")
    .eq("proposal_id", proposalId)
    .eq("status", "PENDING_APPROVAL")
    .maybeSingle();

  if (existingPending) {
    throw new Error(
      "Masih ada permintaan diskon yang menunggu keputusan — selesaikan dulu sebelum mengajukan yang baru."
    );
  }

  const impact = await buildMarginImpact(supabase, proposal, discountPct);
  const ladder = await loadDiscountLadder(
    supabase,
    proposal.business_line as BusinessLine
  );
  const requiredRole = resolveRequiredRole(discountPct, ladder);

  const { data: request, error } = await supabase
    .from("negotiation_request")
    .insert({
      proposal_id: proposalId,
      requested_discount_pct: discountPct,
      customer_note: customerNote,
      required_role: requiredRole,
      status: "PENDING_APPROVAL",
      price_before: impact.priceBefore,
      price_after: impact.priceAfter,
      gpm_after: impact.gpmAfter,
      is_below_gpm_threshold: impact.isBelowThreshold,
      requested_by: profile.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await writeAuditLog(supabase, {
    entityType: "negotiation_request",
    entityId: request.id,
    proposalId,
    actorId: profile.id,
    action: "NEGOTIATION_REQUEST",
    reason: customerNote ?? undefined,
    fieldChanges: [
      { field: "requested_discount_pct", old: null, new: discountPct },
      { field: "required_role", old: null, new: requiredRole },
    ],
  });

  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/negotiations");
}

/**
 * FR-6.3 — decide on a discount request. APPROVE applies the discount,
 * REJECT closes it, REVISE supersedes it with a counter-offer whose
 * authority is re-evaluated from scratch (§11.2).
 */
export async function decideNegotiationAction(params: {
  requestId: string;
  decision: NegotiationDecisionType;
  counterDiscountPct?: number;
  note?: string;
}): Promise<ActionResult> {
  try {
    await runDecideNegotiation(params);
    return { ok: true };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, "Gagal memproses keputusan negosiasi.");
  }
}

async function runDecideNegotiation(params: {
  requestId: string;
  decision: NegotiationDecisionType;
  counterDiscountPct?: number;
  note?: string;
}) {
  const { requestId, decision, counterDiscountPct, note } = params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: requestRow } = await supabase
    .from("negotiation_request")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!requestRow) throw new Error("Permintaan negosiasi tidak ditemukan.");
  const request = requestRow as NegotiationRequest;

  if (request.status !== "PENDING_APPROVAL") {
    throw new Error("Permintaan ini sudah diputuskan.");
  }

  const { data: proposalRow } = await supabase
    .from("pricing_proposal")
    .select("*")
    .eq("id", request.proposal_id)
    .single();

  if (!proposalRow) throw new Error("Proposal not found");
  const proposal = proposalRow as PricingProposal;

  const ladder = await loadDiscountLadder(
    supabase,
    proposal.business_line as BusinessLine
  );

  // Authority check — enforced server-side so it cannot be bypassed by
  // calling the action directly (FR-6.2).
  const authorised =
    profile.role === request.required_role ||
    isWithinAuthority(profile.role, Number(request.requested_discount_pct), ladder);

  if (!authorised) {
    throw new Error(
      `Diskon ${request.requested_discount_pct}% berada di luar wewenang Anda — memerlukan ${request.required_role}.`
    );
  }

  if (decision === "REVISE" && !counterDiscountPct) {
    throw new Error("Nilai diskon tandingan wajib diisi untuk keputusan Revise.");
  }

  const { error: decisionError } = await supabase
    .from("negotiation_decision")
    .insert({
      negotiation_request_id: requestId,
      actor_id: profile.id,
      decision,
      counter_discount_pct: counterDiscountPct ?? null,
      note: note ?? null,
    });

  if (decisionError) throw new Error(decisionError.message);

  if (decision === "APPROVE") {
    await supabase
      .from("negotiation_request")
      .update({ status: "APPROVED" })
      .eq("id", requestId);

    // Applying the discount is what actually moves the quotation price.
    // A sub-threshold margin is only permitted when the BOD signed it off.
    await supabase
      .from("pricing_proposal")
      .update({
        applied_discount_pct: request.requested_discount_pct,
        has_bod_margin_approval:
          profile.role === "BOD" ? true : proposal.has_bod_margin_approval,
      })
      .eq("id", proposal.id);

    await recalculateWithDiscount(
      supabase,
      proposal,
      Number(request.requested_discount_pct)
    );
  } else if (decision === "REJECT") {
    await supabase
      .from("negotiation_request")
      .update({ status: "REJECTED" })
      .eq("id", requestId);
  } else {
    // REVISE — supersede the old request and open a counter-offer.
    await supabase
      .from("negotiation_request")
      .update({ status: "SUPERSEDED" })
      .eq("id", requestId);

    const impact = await buildMarginImpact(supabase, proposal, counterDiscountPct!);
    const newRequiredRole = resolveRequiredRole(counterDiscountPct!, ladder);

    await supabase.from("negotiation_request").insert({
      proposal_id: proposal.id,
      requested_discount_pct: counterDiscountPct!,
      customer_note: note ?? "Counter-offer dari approver",
      required_role: newRequiredRole,
      status: "PENDING_APPROVAL",
      price_before: impact.priceBefore,
      price_after: impact.priceAfter,
      gpm_after: impact.gpmAfter,
      is_below_gpm_threshold: impact.isBelowThreshold,
      parent_request_id: requestId,
      requested_by: profile.id,
    });
  }

  await writeAuditLog(supabase, {
    entityType: "negotiation_request",
    entityId: requestId,
    proposalId: proposal.id,
    actorId: profile.id,
    action: "NEGOTIATION_DECISION",
    reason: note,
    fieldChanges: [
      { field: "decision", old: request.status, new: decision },
      ...(counterDiscountPct
        ? [{ field: "counter_discount_pct", old: null, new: counterDiscountPct }]
        : []),
    ],
  });

  revalidatePath(`/proposals/${proposal.id}`);
  revalidatePath("/negotiations");
}

async function buildMarginImpact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  proposal: PricingProposal,
  discountPct: number
) {
  const versionId = await resolveCurrentVersionId(supabase, proposal);
  if (!versionId) throw new Error("Proposal ini belum memiliki versi.");

  const [{ data: result }, { data: template }] = await Promise.all([
    supabase
      .from("proposal_calculation_result")
      .select("*")
      .eq("proposal_version_id", versionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("cbs_template")
      .select("min_gpm_threshold")
      .eq("id", proposal.cbs_template_id)
      .maybeSingle(),
  ]);

  if (!result) {
    throw new Error("Belum ada hasil kalkulasi — lengkapi CBS terlebih dahulu.");
  }

  const baseCost =
    Number(result.total_direct_cost) + Number(result.total_indirect_cost);

  return computeMarginImpact({
    priceBefore: Number(result.final_price),
    baseCost,
    discountPct,
    minGpmThreshold: template ? Number(template.min_gpm_threshold) : 0,
  });
}

/**
 * Re-runs the official calculation with the approved discount so the
 * stored result reflects the negotiated price (§11.4). Reuses the same
 * engine as the what-if simulator — no duplicate margin logic.
 */
async function recalculateWithDiscount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  proposal: PricingProposal,
  discountPct: number
) {
  const { recalculateAndPersist } = await import("@/lib/pricing/calculate");
  const versionId = await resolveCurrentVersionId(supabase, proposal);
  if (!versionId) return;

  await recalculateAndPersist(supabase, {
    proposalVersionId: versionId,
    cbsTemplateId: proposal.cbs_template_id,
    unitQuantity: proposal.unit_quantity,
    businessLine: proposal.business_line as BusinessLine,
    inputCurrency: proposal.input_currency,
    baselineHpmValue: proposal.baseline_hpm_value,
    volumeDiscountPct: discountPct,
  });
}
