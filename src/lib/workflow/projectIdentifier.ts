import type { SupabaseClient } from "@supabase/supabase-js";
import type { PricingProposal, ProjectIdentifier } from "@/types/database";
import { writeAuditLog } from "@/lib/audit";

/**
 * Project Identifier & Quotation Versioning — Technical Logic §4.6
 * (FR-2.5).
 *
 * A revision to an already-released quotation (unit count changed,
 * price renegotiated after release, ...) always creates a NEW
 * pricing_proposal linked to the same Project Identifier, never an
 * in-place edit of a released version — so the price history that was
 * once sent to the customer stays intact for audit.
 */

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

/**
 * System-generated, standardized identifier — Sales only supplies the
 * customer and project names; they never type the code itself, so
 * naming stays consistent (PRD FR-2.5).
 */
export function generateProjectIdentifierCode(
  customerName: string,
  projectName: string,
  sequence: number
): string {
  const customerSlug = slugify(customerName).slice(0, 12) || "CUST";
  const projectSlug = slugify(projectName).slice(0, 12) || "PROJ";
  const year = new Date().getFullYear();
  const seq = String(sequence).padStart(3, "0");
  return `PRJ-${customerSlug}-${projectSlug}-${year}-${seq}`;
}

export async function createProjectIdentifier(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  params: { customerName: string; projectName: string; createdBy: string }
): Promise<ProjectIdentifier> {
  const { customerName, projectName, createdBy } = params;

  const { count } = await supabase
    .from("project_identifier")
    .select("id", { count: "exact", head: true });

  const code = generateProjectIdentifierCode(
    customerName,
    projectName,
    (count ?? 0) + 1
  );

  const { data, error } = await supabase
    .from("project_identifier")
    .insert({
      identifier_code: code,
      customer_name: customerName,
      project_name: projectName,
      created_by: createdBy,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ProjectIdentifier;
}

/**
 * Creates the next quotation on an existing project. The prior
 * proposal is NOT marked SUPERSEDED here — that happens only once the
 * new one actually reaches QUOTATION_RELEASED (see workflow-actions.ts),
 * so the old price stays authoritative until its replacement is truly
 * final.
 */
export async function createRevisionProposal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  params: {
    existingProposal: PricingProposal;
    changeReason: string;
    actorId: string;
    proposalNumber: string;
  }
): Promise<{ proposalId: string; versionId: string }> {
  const { existingProposal, changeReason, actorId, proposalNumber } = params;

  const { data: proposal, error } = await supabase
    .from("pricing_proposal")
    .insert({
      proposal_number: proposalNumber,
      title: existingProposal.title,
      business_line: existingProposal.business_line,
      customer_name: existingProposal.customer_name,
      cbs_template_id: existingProposal.cbs_template_id,
      project_identifier_id: existingProposal.project_identifier_id,
      supersedes_proposal_id: existingProposal.id,
      unit_quantity: existingProposal.unit_quantity,
      input_currency: existingProposal.input_currency,
      current_status: "DRAFT",
      created_by: actorId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { data: version, error: versionError } = await supabase
    .from("pricing_proposal_version")
    .insert({
      proposal_id: proposal.id,
      version_label: "v1.0",
      change_reason: changeReason,
      is_current: true,
      created_by: actorId,
    })
    .select("id")
    .single();

  if (versionError) throw new Error(versionError.message);

  await supabase
    .from("pricing_proposal")
    .update({ current_version_id: version.id })
    .eq("id", proposal.id);

  await writeAuditLog(supabase, {
    entityType: "pricing_proposal",
    entityId: proposal.id,
    proposalId: proposal.id,
    actorId,
    action: "CREATE",
    reason: changeReason,
    fieldChanges: [
      { field: "supersedes_proposal_id", old: null, new: existingProposal.id },
    ],
  });

  return { proposalId: proposal.id, versionId: version.id };
}

/**
 * Marks the predecessor SUPERSEDED once its replacement is released
 * (called from the release path in workflow-actions.ts).
 */
export async function supersedePredecessor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  params: { newProposal: PricingProposal; actorId: string }
): Promise<void> {
  const { newProposal, actorId } = params;
  if (!newProposal.supersedes_proposal_id) return;

  await supabase
    .from("pricing_proposal")
    .update({ current_status: "SUPERSEDED" })
    .eq("id", newProposal.supersedes_proposal_id);

  await writeAuditLog(supabase, {
    entityType: "pricing_proposal",
    entityId: newProposal.supersedes_proposal_id,
    proposalId: newProposal.supersedes_proposal_id,
    actorId,
    action: "SUPERSEDE",
    reason: `Digantikan oleh ${newProposal.proposal_number}`,
  });
}
