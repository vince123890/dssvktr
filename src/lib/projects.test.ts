import { describe, expect, it } from "vitest";
import { paymentLabel, paymentSummary, plannedAmountOf, validateTermInput } from "./projects";

const term = (over: Partial<Parameters<typeof validateTermInput>[0]> = {}) => ({
  label: "DP",
  plannedPct: 30 as number | null,
  plannedAmount: null as number | null,
  dueDate: null as string | null,
  ...over,
});

describe("validateTermInput", () => {
  it("menerima persentase atau jumlah (salah satu)", () => {
    expect(validateTermInput(term(), [])).toBeNull();
    expect(validateTermInput(term({ plannedPct: null, plannedAmount: 5_000_000 }), [])).toBeNull();
  });
  it("menolak keduanya terisi atau keduanya kosong", () => {
    expect(validateTermInput(term({ plannedAmount: 1 }), [])).toMatch(/salah satu/);
    expect(validateTermInput(term({ plannedPct: null }), [])).toMatch(/salah satu/);
  });
  it("menolak nama kosong, persen di luar 0–100, jumlah <= 0", () => {
    expect(validateTermInput(term({ label: " " }), [])).toMatch(/nama termin/);
    expect(validateTermInput(term({ plannedPct: 0 }), [])).toMatch(/Persentase/);
    expect(validateTermInput(term({ plannedPct: 101 }), [])).toMatch(/Persentase/);
    expect(validateTermInput(term({ plannedPct: null, plannedAmount: 0 }), [])).toMatch(/Jumlah/);
  });
  it("total persentase tidak boleh melebihi 100%", () => {
    expect(validateTermInput(term({ plannedPct: 70 }), [{ plannedPct: 30 }])).toBeNull();
    expect(validateTermInput(term({ plannedPct: 71 }), [{ plannedPct: 30 }])).toMatch(/100%/);
  });
  it("jatuh tempo harus YYYY-MM-DD bila diisi", () => {
    expect(validateTermInput(term({ dueDate: "2026-12-01" }), [])).toBeNull();
    expect(validateTermInput(term({ dueDate: "01/12/2026" }), [])).toMatch(/jatuh tempo/);
  });
});

describe("ringkasan payment", () => {
  it("persen dihitung dari nilai kontrak excl. VAT", () => {
    expect(plannedAmountOf({ planned_pct: 30, planned_amount: null }, 1_000_000)).toBe(300_000);
    expect(plannedAmountOf({ planned_pct: null, planned_amount: 250_000 }, 1_000_000)).toBe(250_000);
  });
  it("menghitung termin diterima dan jumlahnya", () => {
    const s = paymentSummary(
      [
        { status: "RECEIVED", planned_pct: 30, planned_amount: null, received_amount: 310_000 },
        { status: "PENDING", planned_pct: 70, planned_amount: null, received_amount: null },
      ],
      1_000_000
    );
    expect(s).toEqual({ termCount: 2, receivedCount: 1, plannedAmount: 1_000_000, receivedAmount: 310_000 });
    expect(paymentLabel(s)).toBe("1/2 termin diterima");
    expect(paymentLabel(paymentSummary([], 0))).toBe("Termin belum diatur");
  });
});
