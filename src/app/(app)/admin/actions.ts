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

const WorkflowStepInputSchema = z.object({
  department_id: z.string().uuid(),
  is_mandatory_gate: z.boolean(),
  sla_hours: z.coerce.number().int().min(1),
});

const CreateWorkflowSchema = z.object({
  name: z.string().min(3),
  qualifier_type: z.enum(["GENERIC", "BUSINESS_LINE", "MARGIN_TIER"]),
  business_line: z
    .enum(["B2G_TENDER_BUS", "B2B_COMMERCIAL_FLEET", "CHARGING_INFRA_BUILDOUT"])
    .optional(),
  min_value: z.coerce.number().min(0).default(0),
  max_value: z.coerce.number().min(0).optional(),
  steps: z.array(WorkflowStepInputSchema).min(1, "Minimal satu step diperlukan"),
});

/**
 * FR-2.0.1 — lets Admin add a new Workflow Template to the catalog
 * from the browser, without ever opening the SQL editor. Steps are
 * inserted in array order as step_order 1..N; parallel groups aren't
 * exposed here yet (all steps created sequential) — see
 * resolveWorkflowTemplate() for how the catalog is then selected.
 */
export async function createWorkflowDefinitionAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const profile = await requireProfile();
    if (profile.role !== "SYSTEM_ADMIN") {
      throw new Error("Hanya System Admin yang dapat menambah Workflow Template (FR-2.1).");
    }

    const rawSteps = JSON.parse(String(formData.get("steps") ?? "[]"));
    const parsed = CreateWorkflowSchema.parse({
      name: formData.get("name"),
      qualifier_type: formData.get("qualifier_type"),
      business_line: formData.get("business_line") || undefined,
      min_value: formData.get("min_value") || 0,
      max_value: formData.get("max_value") || undefined,
      steps: rawSteps,
    });

    if (parsed.qualifier_type === "BUSINESS_LINE" && !parsed.business_line) {
      throw new Error("Qualifier BUSINESS_LINE memerlukan pilihan lini bisnis.");
    }

    const supabase = await createClient();

    // business_line is NOT NULL in the schema even for GENERIC/MARGIN_TIER
    // templates (it's just not used to pick them) — default to the first
    // line so the insert never fails on that constraint.
    const { data: def, error } = await supabase
      .from("workflow_definition")
      .insert({
        name: parsed.name,
        qualifier_type: parsed.qualifier_type,
        business_line: parsed.business_line ?? "B2G_TENDER_BUS",
        min_value: parsed.min_value,
        max_value: parsed.max_value ?? null,
        is_active: true,
        version: 1,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    const stepRows = parsed.steps.map((s, i) => ({
      workflow_definition_id: def.id,
      step_order: i + 1,
      department_id: s.department_id,
      // Reuses the same status labels the two seeded step stages use;
      // the last step is treated as the Chief Sales-style review stage,
      // everything before it as COGS validation.
      status_label:
        i === parsed.steps.length - 1 ? "PENDING_CHIEF_SALES_REVIEW" : "PENDING_COGS_VALIDATION",
      is_mandatory_gate: s.is_mandatory_gate,
      sla_hours: s.sla_hours,
    }));

    const { error: stepsError } = await supabase
      .from("workflow_step_definition")
      .insert(stepRows);

    if (stepsError) throw new Error(stepsError.message);

    await writeAuditLog(supabase, {
      entityType: "workflow_definition",
      entityId: def.id,
      actorId: profile.id,
      action: "CREATE",
      fieldChanges: [
        { field: "name", old: null, new: parsed.name },
        { field: "qualifier_type", old: null, new: parsed.qualifier_type },
        { field: "step_count", old: null, new: parsed.steps.length },
      ],
    });

    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, "Gagal membuat Workflow Template.");
  }
}

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
