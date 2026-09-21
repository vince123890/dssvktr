import type { ExchangeRate, ProposalCalculationResult } from "@/types/database";
import type { MineralContext } from "./mineral";

/**
 * Flags a quotation whose last saved price no longer matches the
 * CNY/IDR rate currently in force — an admin updated the rate after
 * this quotation was last calculated, so its final price is out of
 * date until someone hits "Hitung Ulang" (FR-1.4.6). See also
 * checkRateSensitivity() in rateSensitivity.ts, which applies the
 * configured threshold percentage rather than a fixed epsilon — this
 * simpler check remains for the compact list/detail badge.
 *
 * `mineralChanged` is always false in v3.0: the HPM adjustment factor
 * is dormant (Technical Logic §13), so a moving HMA/HPM never makes a
 * saved price stale on its own — only the exchange rate does.
 *
 * This never blocks anything — it only surfaces the fact so Sales
 * isn't quoting a price that quietly drifted underneath them.
 */
export interface PriceStalenessInfo {
  isStale: boolean;
  rateChanged: boolean;
  mineralChanged: boolean;
  rateUsed: number | null;
  rateCurrent: number | null;
  hpmUsed: number | null;
  hpmCurrent: number | null;
}

const RATE_EPSILON = 0.005; // ignore sub-cent rounding noise
const HPM_EPSILON = 0.01;

export function evaluatePriceStaleness(
  result:
    | Pick<ProposalCalculationResult, "exchange_rate_used" | "exchange_rate_id" | "hpm_value_used">
    | null
    | undefined,
  currentRate: Pick<ExchangeRate, "rate"> | null | undefined,
  mineral: Pick<MineralContext, "hpm"> | null | undefined
): PriceStalenessInfo {
  // exchange_rate_id is only set when the calculation actually resolved a
  // rate row (see recalculateAndPersist). Older/IDR-only results leave it
  // null with exchange_rate_used defaulted to 1 — that 1 is a sentinel,
  // not a real rate, so it must never be compared against the live rate.
  const rateUsed = result?.exchange_rate_id ? Number(result.exchange_rate_used) || null : null;
  const rateCurrent = currentRate ? Number(currentRate.rate) || null : null;
  const hpmUsed = result?.hpm_value_used != null ? Number(result.hpm_value_used) : null;
  const hpmCurrent = mineral?.hpm ? mineral.hpm.hpmWet : null;

  const rateChanged =
    rateUsed != null && rateCurrent != null && Math.abs(rateCurrent - rateUsed) > RATE_EPSILON;

  // Dormant in v3.0 (Technical Logic §13.2/§13.3) — HMA/HPM movement is
  // reference-only and never drives price on its own, so it never
  // marks a quotation stale by itself.
  const mineralChanged = false;
  void hpmUsed;
  void hpmCurrent;
  void HPM_EPSILON;

  return {
    isStale: rateChanged || mineralChanged,
    rateChanged,
    mineralChanged,
    rateUsed,
    rateCurrent,
    hpmUsed,
    hpmCurrent,
  };
}
