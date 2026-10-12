import { describe, expect, it } from "vitest";
import { isAutomaticOrSkipped, visibleSteps } from "./timeline";

const step = (status: string, decision_note: string | null = null) =>
  ({ status, decision_note }) as Parameters<typeof isAutomaticOrSkipped>[0];

describe("langkah yang ditampilkan di kartu Alur Official Quotation", () => {
  it("menyembunyikan langkah Generate yang selesai otomatis", () => {
    expect(isAutomaticOrSkipped(step("APPROVED", "Auto-generated — band 1 unit, harga dasar."))).toBe(true);
  });
  it("menyembunyikan langkah yang dilewati", () => {
    expect(isAutomaticOrSkipped(step("SKIPPED_NOT_APPLICABLE", "Dilewati — quotation dibuat tanpa approval Head of Sales."))).toBe(true);
  });
  it("tetap menampilkan langkah yang dikerjakan orang", () => {
    expect(isAutomaticOrSkipped(step("IN_PROGRESS"))).toBe(false);
    expect(isAutomaticOrSkipped(step("APPROVED", "Head of Sales accept"))).toBe(false);
    expect(isAutomaticOrSkipped(step("REJECTED", "Kembalikan"))).toBe(false);
    expect(isAutomaticOrSkipped(step("APPROVED"))).toBe(false);
  });
  it("Generate yang dibuka manual (setelah tier ditolak) tetap tampil", () => {
    expect(isAutomaticOrSkipped(step("IN_PROGRESS", "Ditolak pada Tier 3: diskon terlalu dalam"))).toBe(false);
  });
  it("visibleSteps menyaring daftar tanpa mengubah urutan", () => {
    const list = [step("APPROVED", "Auto-generated — x"), step("IN_PROGRESS"), step("SKIPPED_NOT_APPLICABLE")];
    expect(visibleSteps(list)).toEqual([list[1]]);
  });
});
