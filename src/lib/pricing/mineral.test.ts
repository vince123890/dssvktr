import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeHpm, indexAgeDays, isIndexStale, mineralAdjustmentFactor } from "./mineral";
import type { HpmParameter } from "@/types/database";

// Angka bulat agar hitungan tangan mudah dicek.
const param = {
  anchor_cf_pct: 0.2,
  anchor_content_pct: 1.6,
  ni_content_pct: 1.5,
  cf_slope: 0.1,
  co_content_pct: 0.1,
  co_cf_pct: 0.5,
  moisture_content_pct: 0.3,
} as unknown as HpmParameter;

describe("computeHpm", () => {
  it("CF Ni bergeser linear dari anchor; HPM basah memotong kadar air", () => {
    const r = computeHpm(param, 10_000, 40_000);
    expect(r.cfNi).toBeCloseTo(0.2 + (1.5 - 1.6) * 0.1); // 0.19
    expect(r.valueNi).toBeCloseTo(1.5 * 0.19 * 10_000); // 2850
    expect(r.bonusCo).toBeCloseTo(0.1 * 0.5 * 40_000); // 2000
    expect(r.totalDry).toBeCloseTo(4850);
    expect(r.hpmWet).toBeCloseTo(4850 * 0.7);
  });
  it("HMA Co 0 (tanpa mineral pendamping) hanya menghitung Ni", () => {
    const r = computeHpm(param, 10_000, 0);
    expect(r.bonusCo).toBe(0);
    expect(r.totalDry).toBeCloseTo(2850);
  });
});

describe("mineralAdjustmentFactor", () => {
  it("selalu 1 (nonaktif sejak v3.0)", () => {
    expect(mineralAdjustmentFactor(100, 150)).toBe(1);
    expect(mineralAdjustmentFactor(null, undefined)).toBe(1);
  });
});

describe("indeks kedaluwarsa", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T00:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  const ended = (daysAgo: number) => ({ period_end: new Date(Date.UTC(2026, 9, 9 - daysAgo)).toISOString() });

  it("tanpa snapshot -> kedaluwarsa dan umur null", () => {
    expect(isIndexStale(null)).toBe(true);
    expect(indexAgeDays(undefined)).toBeNull();
  });
  it("14 hari belum kedaluwarsa, 15 hari sudah", () => {
    expect(isIndexStale(ended(14))).toBe(false);
    expect(isIndexStale(ended(15))).toBe(true);
  });
  it("umur dalam hari dibulatkan ke bawah", () => {
    expect(indexAgeDays(ended(20))).toBe(20);
  });
});
