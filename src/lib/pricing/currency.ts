import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrencyCode, ExchangeRate } from "@/types/database";

/**
 * Multi-Currency Engine — Technical Logic §12 (FR-1.4, basis CNY/RMB v3.0).
 *
 * The value a user types is never overwritten by its converted form.
 * `proposal_cost_line.value` holds the number as entered and each
 * `cost_item.denomination` says what it means; conversion happens only
 * at calculation time.
 *
 * That distinction matters for audit: overwrite the original and the
 * figure a vendor actually quoted in CNY is lost the moment the rate
 * moves, with no way to prove what was really offered.
 *
 * Basis corrected from USD to CNY (Renminbi/Yuan) in v3.0: FOB Price,
 * the real COGS import component, is quoted by the vendor in CNY
 * because VKTR's unit source is China — confirmed by the demo review's
 * rate-sensitivity discussion, which was explicitly framed in RMB
 * (illustrative Rp 2,500-2,700/RMB), not USD/IDR. USD is kept only as
 * a possible future customer-facing display currency, independent of
 * this calculation basis.
 */

/** IDR is the internal unit — thresholds, buckets and history all use it. */
export const BASE_CURRENCY: CurrencyCode = "IDR";

/** CNY is the basis for exchange_rate lookups (FOB Price, v3.0). */
export const FX_BASE_CURRENCY: CurrencyCode = "CNY";

export const CURRENCY_LABEL: Record<CurrencyCode, string> = {
  IDR: "Rupiah (IDR)",
  CNY: "Renminbi / Yuan (CNY)",
  USD: "US Dollar (USD)",
};

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  IDR: "Rp",
  CNY: "¥",
  USD: "US$",
};

/**
 * The rate in force at a given moment: the newest row whose
 * effective_from has not passed it.
 */
export async function resolveExchangeRate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  asOf: Date = new Date(),
  baseCurrency: CurrencyCode = FX_BASE_CURRENCY
): Promise<ExchangeRate | null> {
  const { data } = await supabase
    .from("exchange_rate")
    .select("*")
    .eq("base_currency", baseCurrency)
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
  rate: number
): number {
  if (inputCurrency === "IDR") return value;
  return value * rate;
}

/** Present a base-currency (IDR) figure in a foreign currency for dual display (FR-1.4.4). */
export function fromBaseCurrency(
  valueIdr: number,
  targetCurrency: CurrencyCode,
  rate: number
): number {
  if (targetCurrency === "IDR") return valueIdr;
  return rate > 0 ? valueIdr / rate : 0;
}

export function formatCNY(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactCNY(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
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
