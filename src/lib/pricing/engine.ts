import type {
  BusinessLine,
  CalculationBreakdown,
  CalculationBreakdownItem,
  CostItem,
  CurrencyCode,
} from "@/types/database";
import { toBaseCurrency } from "./currency";

/**
 * Dynamic Pricing Engine (PRD FR-1.2 / Technical Logic §3).
 *
 * POC simplification: instead of a full expression-DSL editor, the
 * *shape* of the formula (direct + indirect -> base cost -> FX-adjusted
 * cost -> + margin factors -> final price) is fixed in code, but every
 * input (which cost items exist, their values, FX rate, business-line
 * GPM threshold) remains fully data-driven from Postgres. This keeps
 * the "no hardcoded cost structure" spirit of FR-1.1/1.2 while avoiding
 * the complexity of a sandboxed expression interpreter for a POC.
 *
 * Business-line specific tuning (e.g. B2B allows volume discount,
 * Charging Infra has a different BEP basis) is expressed as small
 * per-line multipliers below — this is the "Dynamic Formula Builder"
 * analogue: swap this map for a DB-backed DSL in a full build without
 * changing any caller of `calculatePricing`.
 */

export interface PricingInput {
  businessLine: BusinessLine;
  costItems: CostItem[]; // full master list, used to categorize lines
  costLineValues: Record<string, number>; // cost_item_id -> raw value
  unitQuantity: number;
  fxUsdIdrRate: number;
  fxBaselineRate: number; // rate the direct/import costs were originally priced at
  minGpmThreshold: number;
  /**
   * Currency the cost line values are entered in (FR-1.4.1). Values are
   * converted to IDR before any factor is applied — multiplying a factor
   * onto a figure that is not yet in the base unit produces a wrong
   * number that does not look wrong.
   */
  inputCurrency?: CurrencyCode;
  /**
   * HPM-derived factor applied to mineral-linked items (FR-8.3).
   * 1 = no adjustment.
   */
  mineralAdjustmentFactor?: number;
  /** What-If overrides (FR-4.1) — all optional, default to neutral */
  simulation?: {
    fxDeltaPct?: number; // e.g. 3 => USD/IDR up 3%
    materialCostDeltaPct?: number; // applies to BOM subcategory direct costs
    volumeDiscountPct?: number; // reduces final price, applied post-margin
    hmaDeltaPct?: number; // shifts HMA -> HPM -> mineral factor (FR-8.5 DSS)
  };
}

export interface PricingResult {
  totalDirectCost: number;
  totalIndirectCost: number;
  totalMarginAmount: number;
  finalPrice: number;
  gpm: number;
  ebitdaContribution: number;
  bepUnits: number | null;
  effectiveFxRate: number;
  /** Mineral factor actually applied, after any simulation override. */
  effectiveMineralFactor: number;
  isBelowGpmThreshold: boolean;
  breakdown: CalculationBreakdown;
}

const IMPORTED_SUBCATEGORIES = new Set(["BOM"]);

function percentageValue(raw: number): number {
  // Percentage cost items are stored as whole percentages (e.g. 5 = 5%)
  return raw / 100;
}

export function calculatePricing(input: PricingInput): PricingResult {
  const {
    costItems,
    costLineValues,
    unitQuantity,
    fxUsdIdrRate,
    fxBaselineRate,
    minGpmThreshold,
    inputCurrency = "IDR",
    mineralAdjustmentFactor = 1,
    simulation,
  } = input;

  const fxDeltaPct = simulation?.fxDeltaPct ?? 0;
  const materialCostDeltaPct = simulation?.materialCostDeltaPct ?? 0;
  const volumeDiscountPct = simulation?.volumeDiscountPct ?? 0;
  const hmaDeltaPct = simulation?.hmaDeltaPct ?? 0;

  const effectiveFxRate = fxUsdIdrRate * (1 + fxDeltaPct / 100);
  const fxAdjustmentFactor =
    fxBaselineRate > 0 ? effectiveFxRate / fxBaselineRate : 1;

  // HPM is linear in HMA (grade, CF and moisture are unchanged), so a
  // percentage move in HMA moves the resulting factor by the same
  // percentage — no need to re-derive the whole formula for a slider.
  const effectiveMineralFactor = mineralAdjustmentFactor * (1 + hmaDeltaPct / 100);

  const breakdownItems: CalculationBreakdownItem[] = [];

  let totalDirectCost = 0;
  let totalIndirectCost = 0;
  let marginPercentSum = 0;
  let marginFixedAmount = 0;

  for (const item of costItems) {
    const rawValue = costLineValues[item.id] ?? 0;
    if (item.category === "MARGIN_FACTOR") continue; // handled after base cost

    // Step 1: bring the entered value into the base currency (IDR)
    // before anything is scaled by a factor (Technical Logic §13.3).
    const baseValue = toBaseCurrency(rawValue, inputCurrency, effectiveFxRate);

    let amount = 0;
    if (item.unit_type === "PER_UNIT") {
      amount = baseValue * unitQuantity;
    } else if (item.unit_type === "FIXED") {
      amount = baseValue;
    } else {
      amount = baseValue; // PERCENTAGE direct/indirect items are rare; treat as absolute
    }

    // Step 2a: imported (BOM) direct costs move with FX — but only when
    // they were entered in IDR. A USD figure is already expressed in the
    // source currency, so converting it above is the whole adjustment;
    // applying the factor again would double-count the same movement.
    if (
      inputCurrency === "IDR" &&
      item.category === "DIRECT" &&
      IMPORTED_SUBCATEGORIES.has(item.subcategory)
    ) {
      amount = amount * fxAdjustmentFactor;
    }

    if (item.category === "DIRECT" && IMPORTED_SUBCATEGORIES.has(item.subcategory)) {
      amount = amount * (1 + materialCostDeltaPct / 100);
    }

    // Step 2b: mineral-linked components follow the published HPM (FR-8.3).
    if (item.is_mineral_linked) {
      amount = amount * effectiveMineralFactor;
    }

    if (item.category === "DIRECT") totalDirectCost += amount;
    if (item.category === "INDIRECT") totalIndirectCost += amount;

    breakdownItems.push({
      cost_item_id: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      unit_type: item.unit_type,
      raw_value: rawValue,
      computed_amount: amount,
    });
  }

  const baseCost = totalDirectCost + totalIndirectCost;

  for (const item of costItems) {
    if (item.category !== "MARGIN_FACTOR") continue;
    const rawValue = costLineValues[item.id] ?? 0;

    if (item.unit_type === "PERCENTAGE") {
      // Percentages are unit-free — no currency conversion applies.
      marginPercentSum += percentageValue(rawValue);
      breakdownItems.push({
        cost_item_id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        unit_type: item.unit_type,
        raw_value: rawValue,
        computed_amount: baseCost * percentageValue(rawValue),
      });
    } else {
      const baseValue = toBaseCurrency(rawValue, inputCurrency, effectiveFxRate);
      const amount =
        item.unit_type === "PER_UNIT" ? baseValue * unitQuantity : baseValue;
      marginFixedAmount += amount;
      breakdownItems.push({
        cost_item_id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        unit_type: item.unit_type,
        raw_value: rawValue,
        computed_amount: amount,
      });
    }
  }

  const totalMarginAmount = baseCost * marginPercentSum + marginFixedAmount;
  const priceBeforeDiscount = baseCost + totalMarginAmount;
  const finalPrice = priceBeforeDiscount * (1 - volumeDiscountPct / 100);

  const gpm = finalPrice > 0 ? (finalPrice - baseCost) / finalPrice : 0;

  // EBITDA contribution: final price less all direct+indirect cost and
  // less sales commission (already inside margin) — simplified single-deal view.
  const ebitdaContribution = finalPrice - baseCost;

  // Break-even point (units): fixed portion of indirect cost divided by
  // per-unit contribution margin. POC heuristic: treat overhead-tagged
  // indirect items as the fixed pool, everything else as variable.
  const fixedCostItem = costItems.find(
    (c) => c.subcategory === "Overhead" && c.category === "INDIRECT"
  );
  // Must be converted like every other figure — a USD-entered overhead
  // compared against an IDR base cost would put BEP out by the rate.
  const fixedCostPerBatch = fixedCostItem
    ? toBaseCurrency(
        costLineValues[fixedCostItem.id] ?? 0,
        inputCurrency,
        effectiveFxRate
      )
    : 0;
  const unitPrice = unitQuantity > 0 ? finalPrice / unitQuantity : 0;
  const unitVariableCost =
    unitQuantity > 0 ? (baseCost - fixedCostPerBatch) / unitQuantity : 0;
  const contributionMargin = unitPrice - unitVariableCost;
  const bepUnits =
    contributionMargin > 0 ? fixedCostPerBatch / contributionMargin : null;

  return {
    totalDirectCost,
    totalIndirectCost,
    totalMarginAmount,
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
