import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExchangeRate, PricingProposal, RateSensitivityConfig } from "@/types/database";
import { resolveExchangeRate } from "./currency";

/**
 * Rate Sensitivity Threshold — Technical Logic §12.5 (FR-1.4.6, v3.0).
 *
 * A CNY/IDR movement never repriced a running quotation on its own —
 * it only surfaces a notification once it exceeds a configured
 * percentage. Recalculation always requires an explicit "Hitung
 * Ulang" action; this function never mutates anything.
 */

export interface RateSensitivityResult {
  needsAttention: boolean;
  message?: string;
  currentRate?: ExchangeRate;
}

export async function checkRateSensitivity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  proposal: Pick<PricingProposal, "last_calculated_rate_id">
): Promise<RateSensitivityResult> {
  const currentRate = await resolveExchangeRate(supabase);
  if (!currentRate) return { needsAttention: false };

  if (!proposal.last_calculated_rate_id) {
    return { needsAttention: false, currentRate };
  }

  const { data: lastRateRow } = await supabase
    .from("exchange_rate")
    .select("rate")
    .eq("id", proposal.last_calculated_rate_id)
    .maybeSingle();

  const lastRate = lastRateRow ? Number(lastRateRow.rate) : null;
  if (!lastRate || lastRate <= 0 || currentRate.id === proposal.last_calculated_rate_id) {
    return { needsAttention: false, currentRate };
  }

  const { data: configRow } = await supabase
    .from("rate_sensitivity_config")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const config = configRow as RateSensitivityConfig | null;
  const thresholdPct = config ? Number(config.threshold_pct) : 2;

  const movementPct =
    (Math.abs(Number(currentRate.rate) - lastRate) / lastRate) * 100;

  if (movementPct > thresholdPct) {
    return {
      needsAttention: true,
      message: `Kurs CNY/IDR (RMB) telah diperbarui menjadi ${Number(currentRate.rate).toLocaleString("id-ID")} — melebihi ambang sensitivitas ${thresholdPct}%. Harga masih memakai kurs lama sampai "Hitung Ulang" ditekan.`,
      currentRate,
    };
  }

  return { needsAttention: false, currentRate };
}
