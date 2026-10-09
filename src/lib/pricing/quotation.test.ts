import { describe, expect, it } from "vitest";
import {
  aggregateGm,
  computeCostStructure,
  computeLine,
  gmAfterDiscount,
  normalizeDiscount,
  resolveBand,
  resolveTier,
  strictestMode,
} from "./quotation";
import type { MarginTierAuthority, QuantityBand } from "@/types/database";

type Item = Parameters<typeof computeCostStructure>[0]["items"][number];

const item = (over: Partial<Item> & Pick<Item, "id" | "cost_group">): Item => ({
  code: over.id,
  unit_type: "FIXED",
  denomination: "IDR",
  is_derived: false,
  active: true,
  ...over,
});

describe("computeCostStructure", () => {
  const items = [
    item({ id: "cogs", cost_group: "COGS" }),
    item({ id: "pct", cost_group: "PROFITABILITY", unit_type: "PERCENTAGE" }),
    item({ id: "sales", cost_group: "SALES" }),
  ];

  it("contoh hitung: base 100, margin 10%, sales 5", () => {
    const r = computeCostStructure({ items, values: { cogs: 100, pct: 10, sales: 5 }, fxRate: 1 });
    expect(r.baseCost).toBe(100);
    expect(r.marginAmount).toBeCloseTo(10);
    expect(r.salesCost).toBe(5);
    expect(r.listPriceExVat).toBeCloseTo(115);
    expect(r.standardGm).toBeCloseTo(10 / 110);
  });

  it("item CNY dikonversi dengan kurs, item IDR tidak", () => {
    const r = computeCostStructure({
      items: [
        item({ id: "fob", cost_group: "COGS", denomination: "CNY" }),
        item({ id: "idr", cost_group: "COGS" }),
      ],
      values: { fob: 1000, idr: 500 },
      fxRate: 2600,
    });
    expect(r.itemAmounts.fob).toBe(2_600_000);
    expect(r.itemAmounts.idr).toBe(500);
    expect(r.baseCost).toBe(2_600_500);
  });

  it("item nonaktif tidak dihitung", () => {
    const r = computeCostStructure({
      items: [item({ id: "a", cost_group: "COGS" }), item({ id: "b", cost_group: "COGS", active: false })],
      values: { a: 100, b: 999 },
      fxRate: 1,
    });
    expect(r.baseCost).toBe(100);
  });

  it("item turunan hanya ditampilkan senilai total FOB CNY dan tidak menambah total", () => {
    const r = computeCostStructure({
      items: [
        item({ id: "fob", cost_group: "COGS", denomination: "CNY" }),
        item({ id: "fobIdr", cost_group: "COGS", is_derived: true }),
      ],
      values: { fob: 10 },
      fxRate: 2500,
    });
    expect(r.itemAmounts.fobIdr).toBe(25_000);
    expect(r.baseCost).toBe(25_000);
  });

  it("item excluded dihitung 0 dan item tanpa nilai dihitung 0", () => {
    const r = computeCostStructure({
      items: [item({ id: "a", cost_group: "COGS" }), item({ id: "b", cost_group: "ADD_ONS" })],
      values: { a: 100 },
      excluded: new Set(["a"]),
      fxRate: 1,
    });
    expect(r.baseCost).toBe(0);
  });

  it("profitability nominal dalam CNY menjadi margin tetap", () => {
    const r = computeCostStructure({
      items: [
        item({ id: "a", cost_group: "COGS" }),
        item({ id: "m", cost_group: "PROFITABILITY", denomination: "CNY" }),
      ],
      values: { a: 1000, m: 2 },
      fxRate: 2500,
    });
    expect(r.marginAmount).toBe(5000);
    expect(r.listPriceExVat).toBe(6000);
    expect(r.standardGm).toBeCloseTo(5000 / 6000);
  });

  it("penyebut nol memberi standardGm 0", () => {
    const r = computeCostStructure({ items, values: {}, fxRate: 1 });
    expect(r.standardGm).toBe(0);
    expect(r.listPriceExVat).toBe(0);
  });
});

describe("normalizeDiscount", () => {
  it("mode nominal -> persen", () => {
    expect(normalizeDiscount({ mode: "AMOUNT", amount: 50_000, listPriceExVat: 1_000_000 })).toEqual({
      amount: 50_000,
      pct: 5,
    });
  });
  it("mode persen -> nominal", () => {
    expect(normalizeDiscount({ mode: "PERCENTAGE", pct: 5, listPriceExVat: 1_000_000 })).toEqual({
      amount: 50_000,
      pct: 5,
    });
  });
  it("list nol pada mode nominal memberi persen 0", () => {
    expect(normalizeDiscount({ mode: "AMOUNT", amount: 100, listPriceExVat: 0 }).pct).toBe(0);
  });
  it("diskon negatif diperlakukan 0", () => {
    expect(normalizeDiscount({ mode: "AMOUNT", amount: -100, listPriceExVat: 1000 })).toEqual({ amount: 0, pct: 0 });
    expect(normalizeDiscount({ mode: "PERCENTAGE", pct: -3, listPriceExVat: 1000 })).toEqual({ amount: 0, pct: 0 });
  });
});

describe("computeLine / gmAfterDiscount", () => {
  it("contoh dengan diskon 5%, PPN 11%, qty 40", () => {
    const r = computeLine({
      quantity: 40,
      listPriceExVat: 115,
      baseCost: 100,
      salesCost: 5,
      discountMode: "PERCENTAGE",
      discountPct: 5,
      vatRatePct: 11,
    });
    expect(r.netPriceExVat).toBeCloseTo(109.25);
    expect(r.netPriceInclVat).toBeCloseTo(121.2675);
    expect(r.lineTotalExVat).toBeCloseTo(4370);
    expect(r.gm).toBeCloseTo(4.25 / 104.25);
  });

  it("total dihitung dari harga satuan tak dibulatkan", () => {
    const r = computeLine({
      quantity: 40,
      listPriceExVat: 31_810_000.4,
      baseCost: 0,
      salesCost: 0,
      discountMode: "AMOUNT",
      discountAmount: 0,
      vatRatePct: 11,
    });
    expect(r.lineTotalInclVat).toBeCloseTo(31_810_000.4 * 1.11 * 40, 2);
  });

  it("harga di bawah sales cost memberi gm -1", () => {
    expect(gmAfterDiscount(5, 100, 5)).toBe(-1);
    expect(gmAfterDiscount(3, 100, 5)).toBe(-1);
  });
});

describe("aggregateGm", () => {
  it("dua varian: (100 + 400) / 3000", () => {
    const gm = aggregateGm([
      { quantity: 10, netPriceExVat: 100, baseCost: 90, salesCost: 0 },
      { quantity: 10, netPriceExVat: 200, baseCost: 160, salesCost: 0 },
    ]);
    expect(gm).toBeCloseTo(500 / 3000);
  });
  it("penyebut tidak positif memberi -1", () => {
    expect(aggregateGm([])).toBe(-1);
  });
});

describe("resolveTier", () => {
  const tier = (n: 1 | 2 | 3, lo: number | null, hi: number | null) =>
    ({ tier: n, gpm_lower_bound_pct: lo, gpm_upper_bound_pct: hi }) as MarginTierAuthority;
  const ladder = [tier(3, null, 10), tier(1, 15, null), tier(2, 10, 15)];

  it("batas bawah inklusif: 15,00 -> tier 1", () => {
    expect(resolveTier(15, ladder)?.tier).toBe(1);
  });
  it("batas atas eksklusif: 14,99 -> tier 2, 10,00 -> tier 2, 9,99 -> tier 3", () => {
    expect(resolveTier(14.99, ladder)?.tier).toBe(2);
    expect(resolveTier(10, ladder)?.tier).toBe(2);
    expect(resolveTier(9.99, ladder)?.tier).toBe(3);
  });
  it("GM -100% (tak terbatas bawah) -> tier 3", () => {
    expect(resolveTier(-100, ladder)?.tier).toBe(3);
  });
  it("tidak ada yang cocok jatuh ke tier terakhir", () => {
    expect(resolveTier(5, [tier(1, 15, null), tier(2, 10, 15)])?.tier).toBe(2);
  });
  it("tangga kosong memberi null", () => {
    expect(resolveTier(12, [])).toBeNull();
  });
});

describe("resolveBand / strictestMode", () => {
  const band = (b: number, min: number, max: number | null, mode: QuantityBand["processing_mode"]): QuantityBand => ({
    band: b,
    min_qty: min,
    max_qty: max,
    processing_mode: mode,
    default_discount_pct: 0,
  });
  const bands = [band(3, 6, 9, "AUTO_WITH_MANUAL"), band(1, 1, 1, "AUTO"), band(4, 10, null, "MANUAL"), band(2, 2, 5, "AUTO_WITH_MANUAL")];

  it("memilih band menurut kuantitas, batas inklusif", () => {
    expect(resolveBand(1, bands)?.band).toBe(1);
    expect(resolveBand(5, bands)?.band).toBe(2);
    expect(resolveBand(6, bands)?.band).toBe(3);
    expect(resolveBand(10, bands)?.band).toBe(4);
    expect(resolveBand(1000, bands)?.band).toBe(4);
  });
  it("di luar semua band memberi null", () => {
    expect(resolveBand(0, bands)).toBeNull();
  });
  it("mode quotation = paling manual", () => {
    expect(strictestMode(["AUTO", "MANUAL"])).toBe("MANUAL");
    expect(strictestMode(["AUTO", "AUTO_WITH_MANUAL"])).toBe("AUTO_WITH_MANUAL");
    expect(strictestMode([])).toBe("AUTO");
  });
});
