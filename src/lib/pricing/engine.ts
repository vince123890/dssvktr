import type {
  CalculationBreakdown,
  CalculationBreakdownItem,
  CostItem,
  CurrencyCode,
} from "@/types/database";
import { toBaseCurrency } from "./currency";

/**
 * Pricing Engine (PRD FR-1.2 / Technical Logic §3, v3.0).
 *
 * A single formula for every business line, per FR-1.2: variation
 * between lines comes from the Sales add-on group (FR-1.1.1) and the
 * Workflow Template that is selected (Module 2), never from a
 * business-line branch inside the calculation itself.
 *
 * Aggregation basis is cost_group, not the old DIRECT/INDIRECT/
 * MARGIN_FACTOR category:
 *   - COGS + ADD_ONS  -> base cost
 *   - PROFITABILITY   -> margin layered on top of the base cost
 *   - SALES           -> add-on applied above the resulting price,
 *                        excluded from the GPM calculation (FR-1.1.1)
 *
 * Each cost item carries its own `denomination` (the real CBS mixes
 * CNY — FOB Price — and IDR line items in one structure), so currency
 * conversion happens per item rather than against one global
 * `inputCurrency` toggle.
 */

export interface PricingInput {
  costItems: CostItem[]; // full master list, used to categorize lines
  costLineValues: Record<string, number>; // cost_item_id -> raw value
  unitQuantity: number;
  /** CNY -> IDR rate (FOB Price basis, v3.0 — see Technical Logic §12). */
  fxRate: number;
  fxBaselineRate: number; // rate CNY-denominated items were originally priced at
  minGpmThreshold: number;
  /**
   * Mineral factor for is_mineral_linked items (FR-8.3). Dormant by
   * default in v3.0 — callers should pass 1 unless the adjustment is
   * explicitly re-enabled; see src/lib/pricing/mineral.ts.
   */
  mineralAdjustmentFactor?: number;
  /** What-If overrides (FR-4.1) — all optional, default to neutral */
  simulation?: {
    fxDeltaPct?: number; // e.g. 3 => CNY/IDR up 3%
    materialCostDeltaPct?: number; // applies to CNY-denominated (imported) items
    volumeDiscountPct?: number; // reduces final price, applied post-addon
    /** Shifts the referenced HPM (FR-8.5 DSS) — has no price effect while mineral adjustment is dormant. */
    hmaDeltaPct?: number;
  };
}

export interface PricingResult {
  /** COGS + ADD_ONS, before margin and Sales add-on. */
  totalDirectCost: number;
  /** Kept for backward compatibility with callers/columns named total_indirect_cost; always 0 in v3.0 (no separate indirect pool — see cost_group). */
  totalIndirectCost: number;
  totalMarginAmount: number;
  /** Sales group total (FR-1.1.1) — applied above the price, not part of margin. */
  salesAddonTotal: number;
  finalPrice: number;
  gpm: number;
  ebitdaContribution: number;
  bepUnits: number | null;
  effectiveFxRate: number;
  /** Mineral factor actually applied, after any simulation override — always 1 while dormant. */
  effectiveMineralFactor: number;
  isBelowGpmThreshold: boolean;
  breakdown: CalculationBreakdown;
}

function percentageValue(raw: number): number {
  // Percentage cost items are stored as whole percentages (e.g. 5 = 5%)
  return raw / 100;
}

function convertItemValue(
  rawValue: number,
  denomination: CurrencyCode,
  fxRate: number
): number {
  // Step 1: bring the entered value into the base currency (IDR)
  // before anything is scaled by a factor (Technical Logic §13.3) —
  // each item converts using its own denomination, since COGS mixes
  // CNY (FOB Price) and IDR line items in a single CBS.
  return toBaseCurrency(rawValue, denomination, fxRate);
}

export function calculatePricing(input: PricingInput): PricingResult {
  const {
    costItems,
    costLineValues,
    unitQuantity,
    fxRate,
    fxBaselineRate,
    minGpmThreshold,
    mineralAdjustmentFactor = 1,
    simulation,
  } = input;

  const fxDeltaPct = simulation?.fxDeltaPct ?? 0;
  const materialCostDeltaPct = simulation?.materialCostDeltaPct ?? 0;
  const volumeDiscountPct = simulation?.volumeDiscountPct ?? 0;
  const hmaDeltaPct = simulation?.hmaDeltaPct ?? 0;

  const effectiveFxRate = fxRate * (1 + fxDeltaPct / 100);
  const fxAdjustmentFactor =
    fxBaselineRate > 0 ? effectiveFxRate / fxBaselineRate : 1;

  // HPM is linear in HMA (grade, CF and moisture are unchanged), so a
  // percentage move in HMA moves the resulting factor by the same
  // percentage. Neutral (1) while the mineral adjustment is dormant.
  const effectiveMineralFactor = mineralAdjustmentFactor * (1 + hmaDeltaPct / 100);

  const breakdownItems: CalculationBreakdownItem[] = [];

  let baseCost = 0; // COGS + ADD_ONS
  let profitabilityMarginPercentSum = 0;
  let profitabilityMarginFixedAmount = 0;
  let salesAddonTotal = 0;

  for (const item of costItems) {
    if (item.cost_group === "PROFITABILITY") continue; // handled after base cost

    const rawValue = costLineValues[item.id] ?? 0;
    let amount = convertItemValue(rawValue, item.denomination, effectiveFxRate);

    if (item.unit_type === "PER_UNIT") {
      amount = amount * unitQuantity;
    }
    // FIXED and PERCENTAGE (rare on COGS/ADD_ONS/SALES items) are left
    // as the converted absolute value.

    // Imported (CNY-denominated) components move with the FX rate and
    // the What-If material-cost slider.
    if (item.denomination === "CNY") {
      amount = amount * fxAdjustmentFactor * (1 + materialCostDeltaPct / 100);
    }

    // Mineral-linked components follow the published HPM (FR-8.3) —
    // no-op while effectiveMineralFactor is locked at 1.
    if (item.is_mineral_linked) {
      amount = amount * effectiveMineralFactor;
    }

    if (item.cost_group === "COGS" || item.cost_group === "ADD_ONS") {
      baseCost += amount;
    } else if (item.cost_group === "SALES") {
      salesAddonTotal += amount;
    }

    breakdownItems.push({
      cost_item_id: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      cost_group: item.cost_group,
      unit_type: item.unit_type,
      raw_value: rawValue,
      computed_amount: amount,
    });
  }

  for (const item of costItems) {
    if (item.cost_group !== "PROFITABILITY") continue;
    const rawValue = costLineValues[item.id] ?? 0;

    if (item.unit_type === "PERCENTAGE") {
      // Percentages are unit-free — no currency conversion applies.
      profitabilityMarginPercentSum += percentageValue(rawValue);
      breakdownItems.push({
        cost_item_id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        cost_group: item.cost_group,
        unit_type: item.unit_type,
        raw_value: rawValue,
        computed_amount: baseCost * percentageValue(rawValue),
      });
    } else {
      const converted = convertItemValue(rawValue, item.denomination, effectiveFxRate);
      const amount = item.unit_type === "PER_UNIT" ? converted * unitQuantity : converted;
      profitabilityMarginFixedAmount += amount;
      breakdownItems.push({
        cost_item_id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        cost_group: item.cost_group,
        unit_type: item.unit_type,
        raw_value: rawValue,
        computed_amount: amount,
      });
    }
  }

  const totalMarginAmount =
    baseCost * profitabilityMarginPercentSum + profitabilityMarginFixedAmount;

  // Price before the Sales add-on — this is the basis for GPM, because
  // Sales add-on costs (commission, agency fee, ...) are not part of
  // COGS or margin policy (FR-1.1.1).
  const priceBeforeAddon = baseCost + totalMarginAmount;
  const priceBeforeDiscount = priceBeforeAddon + salesAddonTotal;
  const finalPrice = priceBeforeDiscount * (1 - volumeDiscountPct / 100);

  const gpm =
    priceBeforeAddon > 0 ? (priceBeforeAddon - baseCost) / priceBeforeAddon : 0;

  // EBITDA contribution: final price less base cost and Sales add-on —
  // simplified single-deal view.
  const ebitdaContribution = finalPrice - baseCost - salesAddonTotal;

  // Break-even point (units): ADD_ONS items stand in for the
  // fixed-cost pool (operational pass-throughs), everything else in
  // baseCost is treated as variable.
  const addOnsFixedCost = costItems
    .filter((c) => c.cost_group === "ADD_ONS")
    .reduce((sum, c) => {
      const rawValue = costLineValues[c.id] ?? 0;
      const converted = convertItemValue(rawValue, c.denomination, effectiveFxRate);
      const amount = c.unit_type === "PER_UNIT" ? converted * unitQuantity : converted;
      return sum + amount;
    }, 0);

  const unitPrice = unitQuantity > 0 ? finalPrice / unitQuantity : 0;
  const unitVariableCost =
    unitQuantity > 0 ? (baseCost - addOnsFixedCost) / unitQuantity : 0;
  const contributionMargin = unitPrice - unitVariableCost;
  const bepUnits =
    contributionMargin > 0 ? addOnsFixedCost / contributionMargin : null;

  return {
    totalDirectCost: baseCost,
    totalIndirectCost: 0,
    totalMarginAmount,
    salesAddonTotal,
    finalPrice,
    gpm,
    ebitdaContribution,
    bepUnits,
    effectiveFxRate,
    effectiveMineralFactor,
    isBelowGpmThreshold: gpm < minGpmThreshold,
    breakdown: { items: breakdownItems, unit_quantity: unitQuantity },
  };
}
