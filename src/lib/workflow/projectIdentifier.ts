import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectIdentifier } from "@/types/database";

/**
 * Project Identifier & Quotation Versioning — Technical Logic §4.6
 * (FR-2.5).
 *
 * A revision to an already-released quotation always creates a NEW
 * pricing_proposal linked to the same Project Identifier (see
 * createRevisionAction in proposals/[id]/quotation-actions.ts), never an
 * in-place edit — so the price history once sent to the customer stays
 * intact for audit.
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
