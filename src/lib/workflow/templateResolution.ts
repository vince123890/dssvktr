import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessLine, WorkflowDefinition } from "@/types/database";

/**
 * Workflow Template Catalog resolution — Technical Logic §4.1a
 * (FR-2.0.1). Replaces the old direct business_line match: a proposal
 * now picks its approval flow from a catalog of templates, chosen by
 * qualifier specificity, so Admin can add new templates over time
 * without touching code.
 *
 * Specificity order: a BUSINESS_LINE-qualified template that matches
 * beats a GENERIC one, which beats nothing (CONFIG_ERROR — see
 * workflow-actions.ts, "not a silent bypass" per §4.5).
 */
export async function resolveWorkflowTemplate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  params: { businessLine: BusinessLine; transactionValue: number }
): Promise<WorkflowDefinition | null> {
  const { businessLine, transactionValue } = params;

  const { data } = await supabase
    .from("workflow_definition")
    .select("*")
    .eq("is_active", true)
    .lte("min_value", transactionValue)
    .or(`max_value.is.null,max_value.gte.${transactionValue}`);

  const candidates = (data ?? []) as WorkflowDefinition[];
  if (candidates.length === 0) return null;

  const specificity = (wd: WorkflowDefinition): number => {
    if (wd.qualifier_type === "BUSINESS_LINE" && wd.business_line === businessLine) return 2;
    if (wd.qualifier_type === "GENERIC") return 1;
    return 0; // a BUSINESS_LINE template that doesn't match this line
  };

  const ranked = candidates
    .map((wd) => ({ wd, score: specificity(wd) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || b.wd.version - a.wd.version);

  return ranked[0]?.wd ?? null;
}
