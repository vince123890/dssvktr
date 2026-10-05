import type { SupabaseClient } from "@supabase/supabase-js";
import { loadReleasedVersionsByProduct } from "@/lib/costStructure";
import type { ProductOption, ProjectOption, QualifierOptions } from "@/app/(app)/proposals/QuotationForm";
import { loadSettings } from "@/lib/settings";

/** Options for the KYC form: active variants (flagging those with a RELEASED cost structure) and running projects. */
export async function loadQuotationFormOptions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<{ products: ProductOption[]; projects: ProjectOption[]; qualifiers: QualifierOptions }> {
  const [{ data: products }, released, { data: projects }, settings] = await Promise.all([
    supabase
      .from("product_master_data")
      .select("id, name, document_description")
      .eq("status", "ACTIVE")
      .order("name"),
    loadReleasedVersionsByProduct(supabase),
    supabase
      .from("project_identifier")
      .select("id, identifier_code, customer_name, project_name")
      .order("created_at", { ascending: false })
      .limit(200),
    loadSettings(supabase),
  ]);

  return {
    qualifiers: {
      segments: settings.qualifierSegments,
      industries: settings.qualifierIndustries,
      relationships: settings.qualifierRelationships,
    },
    products: (products ?? []).map((p: { id: string; name: string; document_description: string | null }) => ({
      id: p.id,
      name: p.name,
      description: p.document_description ?? p.name,
      hasReleasedCost: released.has(p.id),
    })),
    projects: (projects ?? []).map(
      (p: { id: string; identifier_code: string; customer_name: string; project_name: string }) => ({
        id: p.id,
        code: p.identifier_code,
        customer: p.customer_name,
        project: p.project_name,
      })
    ),
  };
}
