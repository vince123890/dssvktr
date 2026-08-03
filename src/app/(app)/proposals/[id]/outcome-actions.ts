"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { canRecordWinLossOutcome } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { ProposalOutcome } from "@/types/database";

export async function recordOutcomeAction(proposalId: string, outcome: ProposalOutcome) {
  const profile = await requireProfile();
  if (!canRecordWinLossOutcome(profile.role)) {
    throw new Error("Hanya Sales/C-Level/Admin yang dapat mencatat hasil tender (FR-4.3).");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pricing_proposal")
    .update({ outcome })
    .eq("id", proposalId);

  if (error) throw new Error(error.message);

  await writeAuditLog(supabase, {
    entityType: "pricing_proposal",
    entityId: proposalId,
    proposalId,
    actorId: profile.id,
    action: "UPDATE",
    fieldChanges: [{ field: "outcome", old: null, new: outcome }],
  });

  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/dss");
}
