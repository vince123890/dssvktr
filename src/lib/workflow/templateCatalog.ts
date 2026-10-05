import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowDefinition } from "@/types/database";

/**
 * Workflow Template Catalog — Technical Logic §4.1a (PRD FR-2.0.1, v4.1).
 *
 * VKTR expects ~30 workflow variations to appear after go-live
 * (transcribe.md): the QUALIFIERS are static — segment, relationship,
 * industry, business line, quantity, estimated value, blacklist — and
 * the catalog of TEMPLATES grows. A deal gets the most specific active
 * template whose qualifiers all match; ties go to the higher priority,
 * then the newer version; the fallback template catches everything else.
 */

export interface DealAttributes {
  segment: string | null;
  industry: string | null;
  relationship: string | null;
  businessLine: string | null;
  quantity: number;
  estimatedValue: number;
  isBlacklisted: boolean;
}

export interface Resolution {
  template: WorkflowDefinition | null;
  reason: string;
  /** Every active template with whether it matched — for the Settings tester. */
  evaluated: { template: WorkflowDefinition; matched: boolean; specificity: number; failed: string[] }[];
}

const inList = (list: string[], value: string | null) => list.length === 0 || (value !== null && list.includes(value));

export function evaluateTemplate(t: WorkflowDefinition, d: DealAttributes): { matched: boolean; specificity: number; failed: string[]; matchedOn: string[] } {
  const failed: string[] = [];
  const matchedOn: string[] = [];
  let specificity = 0;

  const check = (active: boolean, ok: boolean, label: string) => {
    if (!active) return;
    if (ok) {
      specificity += 1;
      matchedOn.push(label);
    } else failed.push(label);
  };

  check(t.q_segments.length > 0, inList(t.q_segments, d.segment), `segmen ${t.q_segments.join("/")}`);
  check(t.q_industries.length > 0, inList(t.q_industries, d.industry), `industri ${t.q_industries.join("/")}`);
  check(t.q_relationships.length > 0, inList(t.q_relationships, d.relationship), `relasi ${t.q_relationships.join("/")}`);
  check(t.q_business_lines.length > 0, inList(t.q_business_lines, d.businessLine), `lini bisnis ${t.q_business_lines.join("/")}`);
  check(
    t.q_min_qty !== null || t.q_max_qty !== null,
    (t.q_min_qty === null || d.quantity >= t.q_min_qty) && (t.q_max_qty === null || d.quantity <= t.q_max_qty),
    `qty ${t.q_min_qty ?? 1}–${t.q_max_qty ?? "∞"}`
  );
  const minV = Number(t.min_value ?? 0);
  const maxV = t.max_value === null ? null : Number(t.max_value);
  check(
    minV > 0 || maxV !== null,
    d.estimatedValue >= minV && (maxV === null || d.estimatedValue <= maxV),
    `nilai Rp ${minV.toLocaleString("id-ID")}–${maxV === null ? "∞" : maxV.toLocaleString("id-ID")}`
  );
  check(t.q_blacklist !== null, t.q_blacklist === d.isBlacklisted, t.q_blacklist ? "customer blacklist" : "bukan blacklist");

  return { matched: failed.length === 0, specificity, failed, matchedOn };
}

export function resolveTemplate(templates: WorkflowDefinition[], d: DealAttributes): Resolution {
  const active = templates.filter((t) => t.is_active && t.workflow_kind === "OFFICIAL_QUOTATION");
  const evaluated = active.map((t) => ({ template: t, ...evaluateTemplate(t, d) }));

  const candidates = evaluated
    .filter((e) => e.matched && !e.template.is_fallback)
    .sort(
      (a, b) =>
        b.template.priority - a.template.priority ||
        b.specificity - a.specificity ||
        b.template.version - a.template.version
    );

  if (candidates[0]) {
    const c = candidates[0];
    return {
      template: c.template,
      reason: `Cocok: ${c.matchedOn.join(", ") || "tanpa qualifier"} (prioritas ${c.template.priority})`,
      evaluated: evaluated.map(({ template, matched, specificity, failed }) => ({ template, matched, specificity, failed })),
    };
  }

  const fallback = active.find((t) => t.is_fallback) ?? null;
  return {
    template: fallback,
    reason: fallback ? "Tidak ada template spesifik yang cocok — memakai template dasar" : "Tidak ada template aktif (CONFIG_ERROR)",
    evaluated: evaluated.map(({ template, matched, specificity, failed }) => ({ template, matched, specificity, failed })),
  };
}

export async function loadActiveQuotationTemplates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<WorkflowDefinition[]> {
  const { data } = await supabase
    .from("workflow_definition")
    .select("*")
    .eq("workflow_kind", "OFFICIAL_QUOTATION")
    .eq("is_active", true);
  return (data ?? []) as WorkflowDefinition[];
}

/** Customer blacklist match (Settings → Umum), case/space-insensitive. */
export function isBlacklisted(companyName: string | undefined, blacklist: string[]): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return Boolean(companyName) && blacklist.some((b) => norm(b) === norm(companyName!));
}
