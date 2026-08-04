import type { SupabaseClient } from "@supabase/supabase-js";
import type { PricingProposal } from "@/types/database";

export interface ReleaseGateResult {
  canRelease: boolean;
  reason?: string;
}

/**
 * Release Gate — Technical Logic §4.2.1.
 *
 * The single guard that stands between a quotation and the customer.
 * This is the control that directly answers the incident behind the
 * project: a quotation released with incomplete pricing components,
 * producing a margin far below target.
 *
 * Three independent checks, all enforced server-side:
 *   1. every mandatory COGS component is filled — regardless of owner
 *   2. every COGS Owner has approved
 *   3. margin is above threshold, unless BOD explicitly signed it off
 */
export async function checkReleaseGate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  proposal: PricingProposal,
  versionId: string,
  /**
   * The step being approved right now. Its approval has not been
   * persisted yet when this runs, so it must not count as outstanding.
   */
  excludeStepInstanceId?: string
): Promise<ReleaseGateResult> {
  // --- 1. All mandatory cost components filled -------------------------
  const { data: templateItems } = await supabase
    .from("cbs_template_item")
    .select("cost_item(id, code, name, is_mandatory, active)")
    .eq("template_id", proposal.cbs_template_id);

  const mandatory = (templateItems ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => row.cost_item)
    .filter((c: { is_mandatory: boolean; active: boolean } | null) =>
      Boolean(c?.is_mandatory && c?.active)
    );

  const { data: costLines } = await supabase
    .from("proposal_cost_line")
    .select("cost_item_id")
    .eq("proposal_version_id", versionId);

  const filled = new Set((costLines ?? []).map((l) => l.cost_item_id));
  const missing = mandatory.filter((c: { id: string }) => !filled.has(c.id));

  if (missing.length > 0) {
    const names = missing
      .slice(0, 3)
      .map((c: { name: string }) => c.name)
      .join(", ");
    const suffix = missing.length > 3 ? ` (+${missing.length - 3} lainnya)` : "";
    return {
      canRelease: false,
      reason: `Komponen COGS mandatory belum lengkap: ${names}${suffix}.`,
    };
  }

  // --- 2. All COGS owners approved -------------------------------------
  const { data: instance } = await supabase
    .from("workflow_instance")
    .select("id")
    .eq("proposal_version_id", versionId)
    .maybeSingle();

  if (instance) {
    const { data: steps } = await supabase
      .from("workflow_step_instance")
      .select("id, status, department_id")
      .eq("workflow_instance_id", instance.id);

    // The gate runs *before* the approval that triggered it is written,
    // so the approver's own step is still IN_PROGRESS. Excluding it is
    // what stops the final approver from blocking themselves.
    const outstanding = (steps ?? []).filter(
      (s) =>
        s.id !== excludeStepInstanceId &&
        s.status !== "APPROVED" &&
        s.status !== "APPROVED_WITH_CONDITIONS"
    );

    if (outstanding.length > 0) {
      const { data: departments } = await supabase
        .from("department")
        .select("id, name")
        .in(
          "id",
          outstanding.map((s) => s.department_id)
        );

      const names = (departments ?? [])
        .map((d: { name: string }) => d.name)
        .join(", ");

      return {
        canRelease: false,
        reason: `Masih menunggu persetujuan: ${names || outstanding.length + " pihak"}.`,
      };
    }
  }

  // --- 3. Margin guardrail ---------------------------------------------
  const [{ data: result }, { data: template }] = await Promise.all([
    supabase
      .from("proposal_calculation_result")
      .select("gpm, is_below_gpm_threshold")
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

  if (result?.is_below_gpm_threshold && !proposal.has_bod_margin_approval) {
    const threshold = template ? Number(template.min_gpm_threshold) * 100 : null;
    return {
      canRelease: false,
      reason:
        `Margin (${(Number(result.gpm) * 100).toFixed(2)}%) di bawah ambang` +
        (threshold ? ` ${threshold.toFixed(1)}%` : "") +
        " — perlu persetujuan BOD sebelum quotation dapat dirilis.",
    };
  }

  return { canRelease: true };
}
