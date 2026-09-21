"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  isNextControlFlowError,
  toActionError,
  type ActionResult,
} from "@/lib/actionResult";

export async function toggleWorkflowDefinitionActiveAction(id: string, nextActive: boolean) {
  const profile = await requireProfile();
  if (profile.role !== "SYSTEM_ADMIN") {
    throw new Error("Hanya System Admin yang dapat mengubah konfigurasi workflow (FR-2.1).");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("workflow_definition")
    .update({ is_active: nextActive })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await writeAuditLog(supabase, {
    entityType: "workflow_definition",
    entityId: id,
    actorId: profile.id,
    action: "UPDATE",
    fieldChanges: [{ field: "is_active", old: !nextActive, new: nextActive }],
  });

  revalidatePath("/admin");
}

const MarginTierBoundsSchema = z.object({
  id: z.string().uuid(),
  gpm_lower_bound_pct: z.string().optional(),
  gpm_upper_bound_pct: z.string().optional(),
});

/**
 * FR-6.1 — Admin can move a tier's GPM boundary without redeploying
 * (illustrative demo-review figures: Tier 1 >=15%, Tier 2 12-15%,
 * Tier 3 <12% — must be confirmed with Chief Sales/BOD before go-live).
 */
export async function updateMarginTierBoundsAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const profile = await requireProfile();
    if (profile.role !== "SYSTEM_ADMIN") {
      throw new Error("Hanya System Admin yang dapat mengubah Margin Tier Authority.");
    }

    const parsed = MarginTierBoundsSchema.parse({
      id: formData.get("id"),
      gpm_lower_bound_pct: formData.get("gpm_lower_bound_pct") || undefined,
      gpm_upper_bound_pct: formData.get("gpm_upper_bound_pct") || undefined,
    });

    const supabase = await createClient();
    const { error } = await supabase
      .from("margin_tier_authority")
      .update({
        gpm_lower_bound_pct:
          parsed.gpm_lower_bound_pct !== undefined && parsed.gpm_lower_bound_pct !== ""
            ? Number(parsed.gpm_lower_bound_pct)
            : null,
        gpm_upper_bound_pct:
          parsed.gpm_upper_bound_pct !== undefined && parsed.gpm_upper_bound_pct !== ""
            ? Number(parsed.gpm_upper_bound_pct)
            : null,
      })
      .eq("id", parsed.id);

    if (error) throw new Error(error.message);

    await writeAuditLog(supabase, {
      entityType: "margin_tier_authority",
      entityId: parsed.id,
      actorId: profile.id,
      action: "UPDATE",
      fieldChanges: [
        { field: "gpm_lower_bound_pct", old: null, new: parsed.gpm_lower_bound_pct },
        { field: "gpm_upper_bound_pct", old: null, new: parsed.gpm_upper_bound_pct },
      ],
    });

    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, "Gagal menyimpan ambang tier.");
  }
}
