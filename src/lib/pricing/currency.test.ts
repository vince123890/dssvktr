import { describe, expect, it } from "vitest";
import { fakeDb } from "@/test/fakeDb";
import { fromBaseCurrency, resolveExchangeRate, toBaseCurrency } from "./currency";

describe("konversi mata uang", () => {
  it("IDR tidak dikonversi, CNY dikali kurs", () => {
    expect(toBaseCurrency(500, "IDR", 2600)).toBe(500);
    expect(toBaseCurrency(1000, "CNY", 2600)).toBe(2_600_000);
  });
  it("fromBaseCurrency membagi dengan kurs dan aman terhadap kurs 0", () => {
    expect(fromBaseCurrency(2_600_000, "CNY", 2600)).toBe(1000);
    expect(fromBaseCurrency(100, "IDR", 2600)).toBe(100);
    expect(fromBaseCurrency(100, "CNY", 0)).toBe(0);
  });
});

describe("resolveExchangeRate", () => {
  const rate = (id: string, r: number, from: string) => ({
    id,
    base_currency: "CNY",
    quote_currency: "IDR",
    rate: r,
    effective_from: from,
  });
  const now = new Date("2026-10-09T00:00:00.000Z");

  it("memakai kurs terbaru yang sudah berlaku", async () => {
    const db = fakeDb({
      exchange_rate: [rate("a", 2500, "2026-10-08T00:00:00.000Z"), rate("b", 2600, "2026-10-09T00:00:00.000Z")],
    });
    expect((await resolveExchangeRate(db, now))?.rate).toBe(2600);
  });
  it("kurs yang baru berlaku besok diabaikan", async () => {
    const db = fakeDb({ exchange_rate: [rate("a", 2600, "2026-10-10T00:00:00.000Z")] });
    expect(await resolveExchangeRate(db, now)).toBeNull();
  });
});
