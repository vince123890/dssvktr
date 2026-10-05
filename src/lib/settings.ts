import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Small key/value master config (app_setting) with safe defaults, so a
 * missing row never breaks pricing. Values seeded by migration 0016;
 * edited in Settings → Umum.
 */
export interface AppSettings {
  vatRatePct: number;
  deviationGmThresholdPct: number;
  quotationValidityDays: number;
  fraudGuardMaxPerDay: number;
  documentTitle: string;
  documentNumberPattern: string;
  documentUnitCode: string;
  issuerName: string;
  issuerAddress: string[];
  documentDisclaimer: string;
  defaultSpecialNotes: string[];
  /** Static qualifier lists for the Workflow Template Catalog (v4.1). */
  qualifierSegments: string[];
  qualifierIndustries: string[];
  qualifierRelationships: string[];
  customerBlacklist: string[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  vatRatePct: 11,
  deviationGmThresholdPct: 10,
  quotationValidityDays: 30,
  fraudGuardMaxPerDay: 1,
  documentTitle: "COST ESTIMATE",
  documentNumberPattern: "{seq}/L/VKTR/{scheme}-{unit}/{MM}-{YYYY}",
  documentUnitCode: "EFS",
  issuerName: "PT VKTR Teknologi Mobilitas Tbk.",
  issuerAddress: [],
  documentDisclaimer: "",
  defaultSpecialNotes: [],
  qualifierSegments: ["B2G", "B2B", "B2C"],
  qualifierIndustries: ["Pertambangan", "Perkebunan", "On-road Logistics", "Express Logistics", "Municipality", "Konstruksi", "Lainnya"],
  qualifierRelationships: ["Reguler", "Relasi khusus"],
  customerBlacklist: [],
};

export const SETTING_KEYS: Record<keyof AppSettings, string> = {
  vatRatePct: "vat_rate_pct",
  deviationGmThresholdPct: "deviation_gm_threshold_pct",
  quotationValidityDays: "quotation_validity_days",
  fraudGuardMaxPerDay: "fraud_guard_max_per_day",
  documentTitle: "document_title",
  documentNumberPattern: "document_number_pattern",
  documentUnitCode: "document_unit_code",
  issuerName: "issuer_name",
  issuerAddress: "issuer_address",
  documentDisclaimer: "document_disclaimer",
  defaultSpecialNotes: "default_special_notes",
  qualifierSegments: "qualifier_segments",
  qualifierIndustries: "qualifier_industries",
  qualifierRelationships: "qualifier_relationships",
  customerBlacklist: "customer_blacklist",
};

export async function loadSettings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<AppSettings> {
  const { data } = await supabase.from("app_setting").select("key, value");
  const byKey = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  const out = { ...DEFAULT_SETTINGS };
  for (const [field, key] of Object.entries(SETTING_KEYS) as [keyof AppSettings, string][]) {
    if (!byKey.has(key)) continue;
    const v = byKey.get(key);
    const def = DEFAULT_SETTINGS[field];
    if (typeof def === "number") (out as Record<string, unknown>)[field] = Number(v);
    else if (Array.isArray(def)) (out as Record<string, unknown>)[field] = Array.isArray(v) ? v : [];
    else (out as Record<string, unknown>)[field] = String(v ?? "");
  }
  return out;
}
