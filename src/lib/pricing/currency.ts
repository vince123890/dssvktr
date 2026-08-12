import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrencyCode, ExchangeRate } from "@/types/database";

/**
 * Multi-Currency Engine — Technical Logic §12 (FR-1.4).
 *
 * The value a user types is never overwritten by its converted form.
 * `proposal_cost_line.value` holds the number as entered and
 * `pricing_proposal.input_currency` says what it means; conversion
 * happens only at calculation time.
 *
 * That distinction matters for audit: overwrite the original and the
 * figure a vendor actually quoted in USD is lost the moment the rate
 * moves, with no way to prove what was really offered.
 */

/** IDR is the internal unit — thresholds, buckets and history all use it. */
export const BASE_CURRENCY: CurrencyCode = "IDR";

export const CURRENCY_LABEL: Record<CurrencyCode, string> = {
  IDR: "Rupiah (IDR)",
  USD: "US Dollar (USD)",
};

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  IDR: "Rp",
  USD: "US$",
};

/**
 * The rate in force at a given moment: the newest row whose
 * effective_from has not passed it.
 */
export async function resolveExchangeRate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  asOf: Date = new Date()
): Promise<ExchangeRate | null> {
  const { data } = await supabase
    .from("exchange_rate")
    .select("*")
    .eq("base_currency", "USD")
    .eq("quote_currency", "IDR")
    .lte("effective_from", asOf.toISOString())
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ExchangeRate | null) ?? null;
}

/** Convert an entered value into the internal base currency (IDR). */
export function toBaseCurrency(
  value: number,
  inputCurrency: CurrencyCode,
  usdToIdrRate: number
): number {
  if (inputCurrency === "IDR") return value;
  return value * usdToIdrRate;
}

/** Present a base-currency (IDR) figure in USD for dual display (FR-1.4.4). */
export function fromBaseCurrency(
  valueIdr: number,
  targetCurrency: CurrencyCode,
  usdToIdrRate: number
): number {
  if (targetCurrency === "IDR") return valueIdr;
  return usdToIdrRate > 0 ? valueIdr / usdToIdrRate : 0;
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}
