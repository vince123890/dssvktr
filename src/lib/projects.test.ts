import { describe, expect, it } from "vitest";
import { paymentLabel, paymentSummary, plannedAmountOf, validateProgressInput, validateTermInput, validateTermsTemplate, DEFAULT_PAYMENT_TERMS } from "./projects";

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

describe("validateProgressInput: bukti foto/dokumen wajib", () => {
  const jpg = { name: "foto.jpg", size: 1000, type: "image/jpeg" };
  const ok = { statusLabel: "Produksi", progressPct: 20, file: jpg };

  it("menerima entri lengkap dengan JPG, PNG, atau PDF", () => {
    expect(validateProgressInput(ok)).toBeNull();
    expect(validateProgressInput({ ...ok, file: { ...jpg, type: "image/png" } })).toBeNull();
    expect(validateProgressInput({ ...ok, file: { ...jpg, type: "application/pdf" } })).toBeNull();
  });

  it("menolak entri tanpa lampiran", () => {
    expect(validateProgressInput({ ...ok, file: null })).toMatch(/wajib dilampirkan/);
    expect(validateProgressInput({ ...ok, file: undefined })).toMatch(/wajib dilampirkan/);
    expect(validateProgressInput({ ...ok, file: { ...jpg, size: 0 } })).toMatch(/wajib dilampirkan/);
  });

  it("menolak format atau ukuran yang tidak sesuai", () => {
    expect(validateProgressInput({ ...ok, file: { ...jpg, type: "image/gif" } })).toMatch(/PDF, PNG, atau JPG/);
    expect(validateProgressInput({ ...ok, file: { ...jpg, size: 11 * 1024 * 1024 } })).toMatch(/10 MB/);
  });

  it("menolak status kosong dan progres di luar 0–100", () => {
    expect(validateProgressInput({ ...ok, statusLabel: "  " })).toMatch(/status/i);
    expect(validateProgressInput({ ...ok, progressPct: 101 })).toMatch(/0–100/);
    expect(validateProgressInput({ ...ok, progressPct: 2.5 })).toMatch(/0–100/);
    expect(validateProgressInput({ ...ok, progressPct: NaN })).toMatch(/0–100/);
  });
});

describe("validateTermsTemplate: TOP pada quotation", () => {
  it("standar awal 50-50 (DP + Pelunasan) valid", () => {
    expect(DEFAULT_PAYMENT_TERMS).toEqual([
      { label: "DP", pct: 50 },
      { label: "Pelunasan", pct: 50 },
    ]);
    expect(validateTermsTemplate(DEFAULT_PAYMENT_TERMS)).toBeNull();
  });

  it("menerima tiga termin 40-30-30", () => {
    expect(validateTermsTemplate([{ label: "DP", pct: 40 }, { label: "Progres", pct: 30 }, { label: "Pelunasan", pct: 30 }])).toBeNull();
  });

  it("menolak total selain 100%", () => {
    expect(validateTermsTemplate([{ label: "DP", pct: 40 }, { label: "Pelunasan", pct: 40 }])).toMatch(/harus 100%.*80%/);
    expect(validateTermsTemplate([{ label: "DP", pct: 60 }, { label: "Pelunasan", pct: 60 }])).toMatch(/harus 100%/);
  });

  it("menolak daftar kosong, nama kosong, persen tidak valid, dan terlalu banyak termin", () => {
    expect(validateTermsTemplate([])).toMatch(/Minimal satu/);
    expect(validateTermsTemplate([{ label: " ", pct: 100 }])).toMatch(/nama/);
    expect(validateTermsTemplate([{ label: "DP", pct: 0 }, { label: "Pelunasan", pct: 100 }])).toMatch(/lebih dari 0/);
    expect(validateTermsTemplate([{ label: "DP", pct: NaN }])).toMatch(/lebih dari 0/);
    expect(validateTermsTemplate(Array.from({ length: 11 }, (_, i) => ({ label: `T${i}`, pct: 100 / 11 })))).toMatch(/Maksimal/);
  });
});
