"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { canUsePriceEstimate } from "@/lib/priceEstimateAccess";
import { loadSettings } from "@/lib/settings";
import { evaluateVersion, loadCostItems, loadReleasedVersion, loadVersionLines } from "@/lib/costStructure";
import { isNextControlFlowError, toActionError } from "@/lib/actionResult";

export interface PriceEstimateResult {
  ok: boolean;
  error?: string;
  priceExVat?: number;
  priceInclVat?: number;
  vatRatePct?: number;
  versionNo?: number;
  releasedAt?: string | null;
}

/**
 * Sheet "Basic Workflow" A — Sales To Obtain Price Estimate (per Unit).
 * Returns ONLY the per-unit basic price excl./incl. VAT (1 unit, no
 * discount) from the product's RELEASED cost structure — an allow-list
 * response, so no cost structure element can ever reach an agency. Each
 * request is logged (FR-2.7).
 */
export async function getPriceEstimateAction(productId: string): Promise<PriceEstimateResult> {
  try {
    const me = await requireProfile();
    const supabase = await createClient();
    if (!(await canUsePriceEstimate(supabase, me))) throw new Error("Role Anda tidak memiliki akses Price Estimate.");

    const version = await loadReleasedVersion(supabase, productId);
    if (!version) throw new Error("Varian ini belum memiliki cost structure RELEASED.");

    const [items, lines, settings] = await Promise.all([
      loadCostItems(supabase),
      loadVersionLines(supabase, version.id),
      loadSettings(supabase),
    ]);
    const cs = evaluateVersion(items, lines, Number(version.locked_fx_rate));
    const priceExVat = cs.listPriceExVat;
    const priceInclVat = priceExVat * (1 + settings.vatRatePct / 100);

    await supabase.from("price_estimate_log").insert({
      user_id: me.id,
      product_id: productId,
      cost_structure_version_id: version.id,
      price_ex_vat: priceExVat,
      price_incl_vat: priceInclVat,
    });
    await writeAuditLog(supabase, {
      entityType: "product_master_data",
      entityId: productId,
      actorId: me.id,
      action: "PRICE_ESTIMATE",
      reason: `Estimasi harga per unit (cost structure v${version.version_no})`,
    });

    return {
      ok: true,
      priceExVat,
      priceInclVat,
      vatRatePct: settings.vatRatePct,
      versionNo: version.version_no,
      releasedAt: version.released_at,
    };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, "Gagal mengambil estimasi harga.");
  }
}
