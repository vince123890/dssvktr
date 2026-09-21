"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { resolveCurrentVersionId } from "@/lib/pricing/version";
import {
  checkTierApprovalComplete,
  computeMarginImpact,
  loadMarginTierLadder,
  normalizeDiscountInput,
} from "@/lib/negotiation/marginTier";
import { canRequestDiscount } from "@/lib/rbac";
import { createRevisionProposal } from "@/lib/workflow/projectIdentifier";
import { generateProposalNumber } from "@/lib/workflow/proposalNumber";
import { revalidatePath } from "next/cache";
import {
  isNextControlFlowError,
  toActionError,
  type ActionResult,
} from "@/lib/actionResult";
import { z } from "zod";
import type {
  DiscountInputMode,
  MarginTierAuthority,
  NegotiationDecisionType,
  NegotiationRequest,
  PricingProposal,
  UserRole,
} from "@/types/database";

const RequestDiscountSchema = z.object({
  mode: z.enum(["AMOUNT", "PERCENTAGE"]),
  amount: z.coerce.number().min(0).optional(),
  pct: z.coerce.number().min(0.01).max(100).optional(),
  customer_note: z.string().optional(),
});

/**
 * FR-6.2 — raise a customer discount request. The tier (and therefore
 * who must approve) is resolved by the server from the GPM this
 * discount would produce; the requester cannot pick it (v3.0,
 * Technical Logic §11.1).
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

  const parsed = RequestDiscountSchema.parse({
    mode: formData.get("mode"),
    amount: formData.get("amount") || undefined,
    pct: formData.get("pct") || undefined,
    customer_note: formData.get("customer_note") || undefined,
  });

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

  const { impact, discountAmount, discountPct, ladder } = await buildMarginImpact(
    supabase,
    proposal,
    { mode: parsed.mode as DiscountInputMode, amount: parsed.amount, pct: parsed.pct }
  );
  void ladder;

  const { data: request, error } = await supabase
    .from("negotiation_request")
    .insert({
      proposal_id: proposalId,
      requested_discount_pct: discountPct,
      discount_input_mode: parsed.mode,
      requested_discount_amount: discountAmount,
      customer_note: parsed.customer_note ?? null,
      required_tier: impact.tier.tier,
      required_roles_snapshot: impact.tier.required_roles,
      status: "PENDING_APPROVAL",
      price_before: impact.priceBefore,
      price_after: impact.priceAfter,
      gpm_after: impact.gpmAfter,
      is_below_gpm_threshold: impact.tier.tier > 1,
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
    reason: parsed.customer_note ?? undefined,
    fieldChanges: [
      { field: "discount_input_mode", old: null, new: parsed.mode },
      { field: "requested_discount_pct", old: null, new: discountPct },
      { field: "required_tier", old: null, new: impact.tier.tier },
    ],
  });

  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/lifecycle");
}

/**
 * FR-6.3 — decide on a discount request. Every required role for the
 * resolved tier must APPROVE (AND-join, Technical Logic §11.2) before
 * the discount is actually applied. REJECT from anyone on the tier
 * closes the request immediately. REVISE supersedes it with a
 * counter-offer whose tier is re-evaluated from scratch.
 */
export async function decideNegotiationAction(params: {
  requestId: string;
  decision: NegotiationDecisionType;
  counterMode?: DiscountInputMode;
  counterAmount?: number;
  counterPct?: number;
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
  counterMode?: DiscountInputMode;
  counterAmount?: number;
  counterPct?: number;
  note?: string;
}) {
  const { requestId, decision, counterMode, counterAmount, counterPct, note } = params;
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

  const requiredRoles = request.required_roles_snapshot as UserRole[];

  // Authority check — the actor's role must be one of the tier's
  // required roles (or the tier requires none, Tier 1). Enforced
  // server-side so it cannot be bypassed by calling the action directly.
  const authorised = requiredRoles.includes(profile.role);
  if (!authorised) {
    throw new Error(
      `Tier ${request.required_tier} memerlukan persetujuan ${requiredRoles.join(", ")} — peran Anda (${profile.role}) tidak termasuk.`
    );
  }

  const { data: existingDecisionsRaw } = await supabase
    .from("negotiation_decision")
    .select("*")
    .eq("negotiation_request_id", requestId);

  const existingDecisions = existingDecisionsRaw ?? [];

  const alreadyDecided = existingDecisions.some((d) => d.actor_id === profile.id);
  if (alreadyDecided) {
    throw new Error("Anda sudah memberikan keputusan untuk permintaan ini.");
  }

  if (decision === "REVISE" && counterAmount === undefined && counterPct === undefined) {
    throw new Error("Nilai diskon tandingan wajib diisi untuk keputusan Revise.");
  }

  const { error: decisionError } = await supabase
    .from("negotiation_decision")
    .insert({
      negotiation_request_id: requestId,
      actor_id: profile.id,
      approver_role: profile.role,
      decision,
      counter_discount_pct: decision === "REVISE" ? counterPct ?? null : null,
      counter_discount_amount: decision === "REVISE" ? counterAmount ?? null : null,
      note: note ?? null,
    });

  if (decisionError) throw new Error(decisionError.message);

  const ladder = await loadMarginTierLadder(supabase, proposal.business_line);
  const tier = ladder.find((t) => t.tier === request.required_tier) as
    | MarginTierAuthority
    | undefined;

  if (decision === "REJECT") {
    await supabase
      .from("negotiation_request")
      .update({ status: "REJECTED" })
      .eq("id", requestId);
  } else if (decision === "REVISE") {
    await supabase
      .from("negotiation_request")
      .update({ status: "SUPERSEDED" })
      .eq("id", requestId);

    const { impact, discountAmount, discountPct } = await buildMarginImpact(
      supabase,
      proposal,
      {
        mode: counterMode ?? "PERCENTAGE",
        amount: counterAmount,
        pct: counterPct,
      }
    );

    await supabase.from("negotiation_request").insert({
      proposal_id: proposal.id,
      requested_discount_pct: discountPct,
      discount_input_mode: counterMode ?? "PERCENTAGE",
      requested_discount_amount: discountAmount,
      customer_note: note ?? "Counter-offer dari approver",
      required_tier: impact.tier.tier,
      required_roles_snapshot: impact.tier.required_roles,
      status: "PENDING_APPROVAL",
      price_before: impact.priceBefore,
      price_after: impact.priceAfter,
      gpm_after: impact.gpmAfter,
      is_below_gpm_threshold: impact.tier.tier > 1,
      parent_request_id: requestId,
      requested_by: profile.id,
    });
  } else if (decision === "APPROVE" && tier) {
    const allDecisions = [
      ...existingDecisions,
      { actor_id: profile.id, approver_role: profile.role, decision: "APPROVE" as const },
    ];

    if (checkTierApprovalComplete(tier, allDecisions)) {
      await supabase
        .from("negotiation_request")
        .update({ status: "APPROVED" })
        .eq("id", requestId);

      await applyApprovedDiscount(supabase, proposal, request, profile.id);
    }
    // Otherwise the AND-join is still incomplete — request stays
    // PENDING_APPROVAL until the remaining required roles decide.
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
      { field: "approver_role", old: null, new: profile.role },
    ],
  });

  revalidatePath(`/proposals/${proposal.id}`);
  revalidatePath("/lifecycle");
}

/**
 * Applies an APPROVED discount. If the quotation has already been
 * released, the negotiation loop is bounded to that quotation
 * (FR-6.3): the discount is applied to a NEW revision proposal on the
 * same Project Identifier instead of mutating the released one.
 */
async function applyApprovedDiscount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  proposal: PricingProposal,
  request: NegotiationRequest,
  actorId: string
) {
  const discountPct = Number(request.requested_discount_pct);

  if (proposal.current_status === "QUOTATION_RELEASED") {
    const proposalNumber = await generateProposalNumber(supabase);
    const { proposalId: newProposalId } = await createRevisionProposal(supabase, {
      existingProposal: proposal,
      changeReason: `Negosiasi disetujui: diskon ${discountPct.toFixed(2)}%`,
      actorId,
      proposalNumber,
    });

    await supabase
      .from("pricing_proposal")
      .update({ applied_discount_pct: discountPct })
      .eq("id", newProposalId);

    return;
  }

  await supabase
    .from("pricing_proposal")
    .update({
      applied_discount_pct: discountPct,
      has_bod_margin_approval: request.required_tier === 3 ? true : proposal.has_bod_margin_approval,
    })
    .eq("id", proposal.id);

  await recalculateWithDiscount(supabase, proposal, discountPct);
}

async function buildMarginImpact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  proposal: PricingProposal,
  input: { mode: DiscountInputMode; amount?: number; pct?: number }
) {
  const versionId = await resolveCurrentVersionId(supabase, proposal);
  if (!versionId) throw new Error("Proposal ini belum memiliki versi.");

  const { data: result } = await supabase
    .from("proposal_calculation_result")
    .select("*")
    .eq("proposal_version_id", versionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!result) {
    throw new Error("Belum ada hasil kalkulasi — lengkapi CBS terlebih dahulu.");
  }

  const priceBefore = Number(result.final_price);
  const baseCost = Number(result.total_direct_cost) + Number(result.total_margin_amount);

  const { amount: discountAmount, pct: discountPct } = normalizeDiscountInput({
    mode: input.mode,
    amount: input.amount,
    pct: input.pct,
    priceBeforeDiscount: priceBefore,
  });

  const ladder = await loadMarginTierLadder(supabase, proposal.business_line);

  const impact = computeMarginImpact({
    priceBefore,
    baseCost,
    discountAmount,
    ladder,
  });

  return { impact, discountAmount, discountPct, ladder };
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
    proposalId: proposal.id,
    proposalVersionId: versionId,
    cbsTemplateId: proposal.cbs_template_id,
    unitQuantity: proposal.unit_quantity,
    volumeDiscountPct: discountPct,
  });
}
