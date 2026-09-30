import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit";

/**
 * Duplicate/Fraud Guard — Technical Logic §4.7 (FR-2.6, v4.0).
 *
 * One Salesperson may open at most N new Official Quotations per day
 * (N = app_setting fraud_guard_max_per_day, default 1) for the same
 * customer + variant. Revisions on a Project Identifier are exempt —
 * they continue an existing deal rather than start a new one.
 */

export interface DuplicateGuardResult {
  allowed: boolean;
  reason?: string;
}

export async function canCreateNewQuotation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  params: {
    salespersonId: string;
    companyName: string;
    productIds: string[];
    maxPerDay: number;
  }
): Promise<DuplicateGuardResult> {
  const { salespersonId, companyName, productIds, maxPerDay } = params;

  const windowStart = new Date();
  windowStart.setHours(0, 0, 0, 0);

  const { data: todays, error } = await supabase
    .from("pricing_proposal")
    .select("id")
    .eq("created_by", salespersonId)
    .is("supersedes_proposal_id", null)
    .filter("kyc->>company_name", "eq", companyName)
    .gte("created_at", windowStart.toISOString());

  // A guard failure must never hard-block legitimate work: this is a
  // fraud-signal check, not a data-integrity constraint.
  if (error || !todays || todays.length === 0) return { allowed: true };

  const { data: overlapping } = await supabase
    .from("quotation_line_item")
    .select("proposal_id")
    .in("proposal_id", todays.map((p: { id: string }) => p.id))
    .in("product_id", productIds);

  const count = new Set((overlapping ?? []).map((r: { proposal_id: string }) => r.proposal_id)).size;
  if (count < maxPerDay) return { allowed: true };

  await writeAuditLog(supabase, {
    entityType: "pricing_proposal",
    entityId: salespersonId,
    actorId: salespersonId,
    action: "BLOCKED_DUPLICATE_ATTEMPT",
    reason: `Melebihi batas ${maxPerDay} quotation/hari untuk customer "${companyName}" + varian yang sama.`,
  });

  return {
    allowed: false,
    reason:
      "Batas quotation harian untuk customer & varian ini sudah tercapai — coba lagi besok atau hubungi Head of Sales bila ini bukan duplikat.",
  };
}
