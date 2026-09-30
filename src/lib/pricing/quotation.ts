import type {
  CostGroup,
  CostItem,
  CostScope,
  DiscountInputMode,
  MarginTierAuthority,
  QuantityBand,
} from "@/types/database";

/**
 * Pricing Engine v4.0 — Technical Logic §3.3. Pure functions only, so
 * the same arithmetic serves the official path (cost structure release,
 * quotation generation), Price Estimate, the What-If simulator and the
 * seed script — no second copy of the margin logic anywhere.
 *
 *   base_cost         = Σ COGS + Σ ADD_ONS                  (IDR / unit)
 *   margin_amount     = base_cost × Σ PROFITABILITY(%) + Σ PROFITABILITY(Rp)
 *   sales_cost        = Σ SALES
 *   list_price_ex_vat = base_cost + margin_amount + sales_cost
 *   net_price_ex_vat  = list_price_ex_vat − discount
 *   GM                = (net − sales_cost − base_cost) ÷ (net − sales_cost)
 *
 * Sales costs are a pass-through: they neither raise nor lower GM
 * (pending Corporate Finance confirmation, Technical Logic §14 no. 9).
 * GM is always measured on the price EXCLUDING VAT, after discount —
 * that is the figure the margin tiers are defined on.
 */

export const SCOPE_OF_GROUP: Record<CostGroup, CostScope> = {
  COGS: "COGS",
  ADD_ONS: "ADD_ONS",
  PROFITABILITY: "MARGIN",
  SALES: "SALES",
};

export const GROUP_OF_SCOPE: Record<CostScope, CostGroup> = {
  COGS: "COGS",
  ADD_ONS: "ADD_ONS",
  MARGIN: "PROFITABILITY",
  SALES: "SALES",
};

export const SCOPE_ORDER: CostScope[] = ["COGS", "ADD_ONS", "MARGIN", "SALES"];

export const SCOPE_LABEL: Record<CostScope, string> = {
  COGS: "COGS",
  ADD_ONS: "Add-Ons",
  MARGIN: "Margin (Profitability)",
  SALES: "Sales",
};

export interface CostStructureInput {
  items: Pick<
    CostItem,
    "id" | "code" | "cost_group" | "unit_type" | "denomination" | "is_derived" | "active"
  >[];
  /** cost_item_id -> value as typed (CNY for CNY items, % for percentage items). */
  values: Record<string, number>;
  /** cost_item_ids released as "Exclusion — At cost" (valued 0). */
  excluded?: Set<string>;
  fxRate: number;
}

export interface CostStructureResult {
  baseCost: number;
  marginAmount: number;
  salesCost: number;
  listPriceExVat: number;
  /** Margin on the undiscounted price — the version's standard GM. */
  standardGm: number;
  /** Per item amount in IDR per unit (derived items included for display). */
  itemAmounts: Record<string, number>;
  scopeTotals: Record<CostScope, number>;
}

function toIdr(value: number, denomination: string, fxRate: number): number {
  return denomination === "CNY" ? value * fxRate : value;
}

export function computeCostStructure(input: CostStructureInput): CostStructureResult {
  const { items, values, excluded, fxRate } = input;
  const itemAmounts: Record<string, number> = {};
  const scopeTotals: Record<CostScope, number> = { COGS: 0, ADD_ONS: 0, MARGIN: 0, SALES: 0 };

  let baseCost = 0;
  let salesCost = 0;
  let fobIdr = 0;

  for (const item of items) {
    if (!item.active || item.cost_group === "PROFITABILITY" || item.is_derived) continue;
    const raw = excluded?.has(item.id) ? 0 : (values[item.id] ?? 0);
    const amount = toIdr(raw, item.denomination, fxRate);
    itemAmounts[item.id] = amount;
    if (item.denomination === "CNY" && item.cost_group === "COGS") fobIdr += amount;
    if (item.cost_group === "COGS" || item.cost_group === "ADD_ONS") baseCost += amount;
    if (item.cost_group === "SALES") salesCost += amount;
    scopeTotals[SCOPE_OF_GROUP[item.cost_group]] += amount;
  }

  // Derived items (FOB Price in IDR) show the converted CNY figure but
  // never add to the total a second time.
  for (const item of items) {
    if (item.active && item.is_derived) itemAmounts[item.id] = fobIdr;
  }

  let pctSum = 0;
  let fixedSum = 0;
  for (const item of items) {
    if (!item.active || item.cost_group !== "PROFITABILITY") continue;
    const raw = values[item.id] ?? 0;
    if (item.unit_type === "PERCENTAGE") {
      pctSum += raw / 100;
      itemAmounts[item.id] = baseCost * (raw / 100);
    } else {
      const amount = toIdr(raw, item.denomination, fxRate);
      fixedSum += amount;
      itemAmounts[item.id] = amount;
    }
  }

  const marginAmount = baseCost * pctSum + fixedSum;
  scopeTotals.MARGIN = marginAmount;
  const listPriceExVat = baseCost + marginAmount + salesCost;
  const standardGm =
    baseCost + marginAmount > 0 ? marginAmount / (baseCost + marginAmount) : 0;

  return { baseCost, marginAmount, salesCost, listPriceExVat, standardGm, itemAmounts, scopeTotals };
}

/** GM after discount (Technical Logic §3.3 B5). Sales costs are a pass-through. */
export function gmAfterDiscount(netPriceExVat: number, baseCost: number, salesCost: number): number {
  const denominator = netPriceExVat - salesCost;
  return denominator > 0 ? (denominator - baseCost) / denominator : -1;
}

/** Converts between the two ways a discount can be entered (FR-6.1.1). */
export function normalizeDiscount(params: {
  mode: DiscountInputMode;
  amount?: number;
  pct?: number;
  listPriceExVat: number;
}): { amount: number; pct: number } {
  const { mode, amount, pct, listPriceExVat } = params;
  if (mode === "AMOUNT") {
    const a = Math.max(0, amount ?? 0);
    return { amount: a, pct: listPriceExVat > 0 ? (a / listPriceExVat) * 100 : 0 };
  }
  const p = Math.max(0, pct ?? 0);
  return { amount: listPriceExVat * (p / 100), pct: p };
}

export interface LineInput {
  quantity: number;
  listPriceExVat: number;
  baseCost: number;
  salesCost: number;
  discountMode: DiscountInputMode;
  discountAmount?: number;
  discountPct?: number;
  vatRatePct: number;
}

export interface LineResult {
  discountAmount: number;
  discountPct: number;
  netPriceExVat: number;
  netPriceInclVat: number;
  lineTotalExVat: number;
  lineTotalInclVat: number;
  gm: number;
}

export function computeLine(input: LineInput): LineResult {
  const discount = normalizeDiscount({
    mode: input.discountMode,
    amount: input.discountAmount,
    pct: input.discountPct,
    listPriceExVat: input.listPriceExVat,
  });
  const net = input.listPriceExVat - discount.amount;
  const vat = 1 + input.vatRatePct / 100;
  // Totals come from the unrounded unit price — the sample Cost Estimate
  // prints 1.412.375.872 for 40 × 35.309.397 for exactly this reason.
  return {
    discountAmount: discount.amount,
    discountPct: discount.pct,
    netPriceExVat: net,
    netPriceInclVat: net * vat,
    lineTotalExVat: net * input.quantity,
    lineTotalInclVat: net * vat * input.quantity,
    gm: gmAfterDiscount(net, input.baseCost, input.salesCost),
  };
}

/** Weighted GM across line items (Technical Logic §3.3 B8). */
export function aggregateGm(
  lines: { quantity: number; netPriceExVat: number; baseCost: number; salesCost: number }[]
): number {
  let margin = 0;
  let revenue = 0;
  for (const l of lines) {
    margin += (l.netPriceExVat - l.salesCost - l.baseCost) * l.quantity;
    revenue += (l.netPriceExVat - l.salesCost) * l.quantity;
  }
  return revenue > 0 ? margin / revenue : -1;
}

/**
 * The tier whose [lower, upper) GM bound contains the GM (in %). Falls
 * back to the most restrictive tier when nothing matches.
 */
export function resolveTier(gmPct: number, ladder: MarginTierAuthority[]): MarginTierAuthority | null {
  const ordered = [...ladder].sort((a, b) => a.tier - b.tier);
  for (const level of ordered) {
    const lowerOk = level.gpm_lower_bound_pct == null || gmPct >= Number(level.gpm_lower_bound_pct);
    const upperOk = level.gpm_upper_bound_pct == null || gmPct < Number(level.gpm_upper_bound_pct);
    if (lowerOk && upperOk) return level;
  }
  return ordered[ordered.length - 1] ?? null;
}

export function resolveBand(qty: number, bands: QuantityBand[]): QuantityBand | null {
  return (
    [...bands]
      .sort((a, b) => a.band - b.band)
      .find((b) => qty >= b.min_qty && (b.max_qty == null || qty <= b.max_qty)) ?? null
  );
}

const MODE_RANK: Record<QuantityBand["processing_mode"], number> = {
  AUTO: 0,
  AUTO_WITH_MANUAL: 1,
  MANUAL: 2,
};

/** A quotation is processed in the most manual mode any of its lines needs (§4.10). */
export function strictestMode(
  modes: QuantityBand["processing_mode"][]
): QuantityBand["processing_mode"] {
  return modes.reduce<QuantityBand["processing_mode"]>(
    (acc, m) => (MODE_RANK[m] > MODE_RANK[acc] ? m : acc),
    "AUTO"
  );
}
