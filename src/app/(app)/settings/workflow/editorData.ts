import { loadSettings } from "@/lib/settings";
import { BUSINESS_LINE_LABEL } from "@/lib/workflow/labels";
import { loadTemplateBundle } from "@/lib/workflow/templateCatalog";
import type { createClient } from "@/lib/supabase/server";
import type { TemplateInput } from "../actions";
import type { QualifierLists, StepDraft } from "../WorkflowCatalog";

type Db = Awaited<ReturnType<typeof createClient>>;

export async function loadQualifierLists(supabase: Db): Promise<QualifierLists> {
  const settings = await loadSettings(supabase);
  return {
    segments: settings.qualifierSegments,
    industries: settings.qualifierIndustries,
    relationships: settings.qualifierRelationships,
    businessLines: Object.keys(BUSINESS_LINE_LABEL),
  };
}

/**
 * Initial editor values. Editing = the template's latest version; a new
 * workflow starts from `from` (duplicate) or from OQ-STANDARD's steps.
 */
export async function loadEditorInitial(
  supabase: Db,
  mode: { edit: string } | { from: string | null }
): Promise<{ initial: TemplateInput; isFallback: boolean } | null> {
  const isNew = !("edit" in mode);
  const code = "edit" in mode ? mode.edit : mode.from ?? "OQ-STANDARD";
  const bundle = (await loadTemplateBundle(supabase, code)) ?? (isNew ? await loadTemplateBundle(supabase, "OQ-STANDARD") : null);
  if (!bundle && !isNew) return null;
  const source = bundle?.latest ?? null;
  const duplicating = isNew && "from" in mode && Boolean(mode.from) && Boolean(source);
  const steps: StepDraft[] = (bundle?.steps ?? []).map((s) => ({
    step_name: s.step_name ?? `Langkah ${s.step_order}`,
    action_kind: s.action_kind ?? "APPROVE",
    performer_function: s.performer_function ?? "SALES_RELEASER",
    skip_if_initiator_function: s.skip_if_initiator_function,
    reject_to_step_order: s.reject_to_step_order,
    sla_hours: s.sla_hours,
  }));
  // A brand-new workflow copies only the fallback's steps, not its identity.
  const copyQualifiers = !isNew || duplicating;
  return {
    isFallback: !isNew && Boolean(source?.is_fallback),
    initial: {
      name: !isNew ? source?.name ?? "" : duplicating ? `${source!.name} (salinan)` : "",
      description: copyQualifiers ? source?.description ?? "" : "",
      priority: !isNew ? source?.priority ?? 0 : duplicating ? source!.priority : 10,
      q_segments: copyQualifiers ? source?.q_segments ?? [] : [],
      q_industries: copyQualifiers ? source?.q_industries ?? [] : [],
      q_relationships: copyQualifiers ? source?.q_relationships ?? [] : [],
      q_business_lines: copyQualifiers ? source?.q_business_lines ?? [] : [],
      q_min_qty: copyQualifiers ? source?.q_min_qty ?? null : null,
      q_max_qty: copyQualifiers ? source?.q_max_qty ?? null : null,
      min_value: copyQualifiers ? Number(source?.min_value ?? 0) : 0,
      max_value: copyQualifiers && source?.max_value != null ? Number(source.max_value) : null,
      q_blacklist: copyQualifiers ? source?.q_blacklist ?? null : null,
      steps,
    },
  };
}
