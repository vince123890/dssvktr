"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { recalculateAndPersist } from "@/lib/pricing/calculate";
import { resolveCurrentVersionId } from "@/lib/pricing/version";
import { createRevisionProposal } from "@/lib/workflow/projectIdentifier";
import { generateProposalNumber } from "@/lib/workflow/proposalNumber";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  isNextControlFlowError,
  toActionError,
  type ActionResult,
} from "@/lib/actionResult";
import type { PricingProposal } from "@/types/database";

/**
 * FR-1.4.6 — explicit "Hitung Ulang" action. A CNY/IDR movement never
 * repriced a running quotation on its own (see rateSensitivity.ts);
 * this is the only way the new rate actually reaches the price.
 */
export async function recalculateAction(
  proposalId: string,
  versionId: string
): Promise<ActionResult> {
  try {
    await requireProfile();
    const supabase = await createClient();

    const { data: proposal } = await supabase
      .from("pricing_proposal")
      .select("*")
      .eq("id", proposalId)
      .single();

    if (!proposal) throw new Error("Proposal not found");

    await recalculateAndPersist(supabase, {
      proposalId,
      proposalVersionId: versionId,
      cbsTemplateId: proposal.cbs_template_id,
      unitQuantity: proposal.unit_quantity,
      volumeDiscountPct: proposal.applied_discount_pct || undefined,
    });

    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, "Gagal menghitung ulang harga.");
  }
}

/**
 * FR-2.5 — manual "Buat Revisi" entry point for a released quotation,
 * distinct from the automatic revision negotiation approval creates.
 */
export async function createManualRevisionAction(proposalId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: proposalRow } = await supabase
    .from("pricing_proposal")
    .select("*")
    .eq("id", proposalId)
    .single();

  if (!proposalRow) throw new Error("Proposal not found");
  const proposal = proposalRow as PricingProposal;

  if (proposal.current_status !== "QUOTATION_RELEASED") {
    throw new Error("Hanya quotation yang sudah dirilis dapat direvisi.");
  }

  const currentVersionId = await resolveCurrentVersionId(supabase, proposal);
  const proposalNumber = await generateProposalNumber(supabase);

  const { proposalId: newProposalId, versionId: newVersionId } =
    await createRevisionProposal(supabase, {
      existingProposal: proposal,
      changeReason: "Revisi manual oleh pengguna",
      actorId: profile.id,
      proposalNumber,
    });

  // Copy the predecessor's cost lines as a starting point so the
  // revision isn't a blank slate.
  if (currentVersionId) {
    const { data: priorLines } = await supabase
      .from("proposal_cost_line")
      .select("cost_item_id, value")
      .eq("proposal_version_id", currentVersionId);

    if (priorLines && priorLines.length > 0) {
      await supabase.from("proposal_cost_line").insert(
        priorLines.map((l) => ({
          proposal_version_id: newVersionId,
          cost_item_id: l.cost_item_id,
          value: l.value,
          filled_by: profile.id,
        }))
      );
    }
  }

  revalidatePath("/lifecycle");
  redirect(`/proposals/${newProposalId}`);
}
