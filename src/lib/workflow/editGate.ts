import type { SupabaseClient } from "@supabase/supabase-js";
import { ROLE_DEPARTMENT_CODE } from "@/lib/rbac";
import { resolveCurrentVersionId } from "@/lib/pricing/version";
import type { PricingProposal, Profile, WorkflowStepInstance } from "@/types/database";

/**
 * Server-side authority on who may write cost lines, mirroring the
 * read-only logic the detail page uses to render the form.
 *
 * Rules:
 *  - FINAL_APPROVED / REJECTED proposals are frozen for everyone.
 *  - A DRAFT is editable by any authenticated user preparing it.
 *  - Once the workflow is running, only the department owning the
 *    currently active step may edit — this is what allows Engineering to
 *    add indirect costs at step 2 and Finance to set margins at step 3,
 *    while preventing edits from departments that are not on the clock.
 */
export async function assertCanEditCostLines(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  proposal: PricingProposal,
  profile: Profile
): Promise<void> {
  if (
    proposal.current_status === "FINAL_APPROVED" ||
    proposal.current_status === "REJECTED"
  ) {
    throw new Error(
      "Proposal ini sudah final — cost line tidak dapat diubah lagi."
    );
  }

  if (proposal.current_status === "DRAFT") return;

  if (profile.role === "SYSTEM_ADMIN") return;

  const versionId = await resolveCurrentVersionId(supabase, proposal);
  if (!versionId) throw new Error("Proposal ini belum memiliki versi.");

  const { data: instance } = await supabase
    .from("workflow_instance")
    .select("id")
    .eq("proposal_version_id", versionId)
    .maybeSingle();

  if (!instance) return;

  const { data: stepRows } = await supabase
    .from("workflow_step_instance")
    .select("*")
    .eq("workflow_instance_id", instance.id)
    .eq("status", "IN_PROGRESS");

  const activeStep = (stepRows ?? [])[0] as WorkflowStepInstance | undefined;
  if (!activeStep) {
    throw new Error("Tidak ada step aktif — cost line terkunci.");
  }

  const { data: department } = await supabase
    .from("department")
    .select("code")
    .eq("id", activeStep.department_id)
    .maybeSingle();

  if (department?.code !== ROLE_DEPARTMENT_CODE[profile.role]) {
    throw new Error(
      `Cost line hanya dapat diisi oleh departemen yang stepnya sedang aktif (${department?.code ?? "?"}).`
    );
  }
}
