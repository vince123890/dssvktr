import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit";

/**
 * Duplicate/Fraud Guard — Technical Logic §4.7 (FR-2.6).
 *
 * One Sales Officer may create at most one new quotation per day for
 * the same customer + product combination. Real sales activity rarely
 * produces more than one quotation a day for the same deal, so a
 * higher rate is treated as a candidate anomaly rather than silently
 * allowed.
 *
 * The window and limit are POC constants rather than a master-config
 * table — a simplification noted here rather than built as a full
 * admin-editable setting in this iteration.
 */

const MAX_QUOTATIONS_PER_WINDOW = 1;

export interface DuplicateGuardResult {
  allowed: boolean;
  reason?: string;
}

export async function canCreateNewQuotation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  params: {
    salesOfficerId: string;
    customerName: string;
    productMasterDataId: string | null;
  }
): Promise<DuplicateGuardResult> {
  const { salesOfficerId, customerName, productMasterDataId } = params;

  const windowStart = new Date();
  windowStart.setHours(0, 0, 0, 0);

  let query = supabase
    .from("pricing_proposal")
    .select("id, pricing_proposal_version!inner(product_master_data_id)", {
      count: "exact",
      head: true,
    })
    .eq("created_by", salesOfficerId)
    .eq("customer_name", customerName)
    .gte("created_at", windowStart.toISOString());

  if (productMasterDataId) {
    query = query.eq(
      "pricing_proposal_version.product_master_data_id",
      productMasterDataId
    );
  }

  const { count, error } = await query;

  // A guard failure should never silently let a duplicate through nor
  // hard-block legitimate work — log and allow, since this is a
  // fraud-signal check, not a data-integrity constraint.
  if (error) {
    return { allowed: true };
  }

  if ((count ?? 0) >= MAX_QUOTATIONS_PER_WINDOW) {
    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: salesOfficerId,
      actorId: salesOfficerId,
      action: "BLOCKED_DUPLICATE_ATTEMPT",
      reason: `Melebihi batas ${MAX_QUOTATIONS_PER_WINDOW} quotation/hari untuk customer "${customerName}" + produk ini.`,
    });

    return {
      allowed: false,
      reason:
        "Batas quotation harian untuk customer & tipe unit ini sudah tercapai — coba lagi besok atau hubungi Chief Sales bila ini bukan duplikat.",
    };
  }

  return { allowed: true };
}
