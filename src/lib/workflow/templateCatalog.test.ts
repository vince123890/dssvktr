import { describe, expect, it } from "vitest";
import { isBlacklisted, resolveTemplate, type DealAttributes } from "./templateCatalog";
import type { WorkflowDefinition } from "@/types/database";

const tpl = (name: string, over: Partial<WorkflowDefinition> = {}): WorkflowDefinition =>
  ({
    id: name,
    name,
    workflow_kind: "OFFICIAL_QUOTATION",
    template_code: name,
    priority: 0,
    version: 1,
    is_active: true,
    is_fallback: false,
    q_segments: [],
    q_industries: [],
    q_relationships: [],
    q_business_lines: [],
    q_min_qty: null,
    q_max_qty: null,
    q_blacklist: null,
    min_value: 0,
    max_value: null,
    ...over,
  }) as WorkflowDefinition;

const deal = (over: Partial<DealAttributes> = {}): DealAttributes => ({
  segment: "B2G",
  industry: "Pertambangan",
  relationship: "Reguler",
  businessLine: "B2B_COMMERCIAL_FLEET",
  quantity: 50,
  estimatedValue: 5_000_000_000,
  isBlacklisted: false,
  ...over,
});

const base = tpl("BASE", { is_fallback: true });

describe("resolveTemplate", () => {
  it("template spesifik terpilih dengan alasan yang menyebut qualifier", () => {
    const t = tpl("B2G-MINING", { q_segments: ["B2G"], q_industries: ["Pertambangan"], priority: 10 });
    const r = resolveTemplate([base, t], deal());
    expect(r.template?.name).toBe("B2G-MINING");
    expect(r.reason).toBe("Cocok: segmen B2G, industri Pertambangan (prioritas 10)");
  });

  it("prioritas mengalahkan kespesifikan", () => {
    const a = tpl("A", { q_segments: ["B2G"], priority: 100 });
    const b = tpl("B", { q_segments: ["B2G"], q_industries: ["Pertambangan"], q_relationships: ["Reguler"], priority: 50 });
    expect(resolveTemplate([a, b], deal()).template?.name).toBe("A");
  });

  it("prioritas sama: kespesifikan lebih tinggi menang, lalu versi lebih baru", () => {
    const a = tpl("A", { q_segments: ["B2G"] });
    const b = tpl("B", { q_segments: ["B2G"], q_industries: ["Pertambangan"] });
    expect(resolveTemplate([a, b], deal()).template?.name).toBe("B");
    const v1 = tpl("V1", { q_segments: ["B2G"], version: 1 });
    const v2 = tpl("V2", { q_segments: ["B2G"], version: 2 });
    expect(resolveTemplate([v1, v2], deal()).template?.name).toBe("V2");
  });

  it("tidak ada yang cocok memakai fallback", () => {
    const t = tpl("B2C-ONLY", { q_segments: ["B2C"] });
    const r = resolveTemplate([base, t], deal());
    expect(r.template?.name).toBe("BASE");
    expect(r.reason).toBe("Tidak ada template spesifik yang cocok — memakai template dasar");
  });

  it("tanpa fallback dan tanpa kecocokan: null dengan CONFIG_ERROR", () => {
    const r = resolveTemplate([tpl("B2C-ONLY", { q_segments: ["B2C"] })], deal());
    expect(r.template).toBeNull();
    expect(r.reason).toContain("CONFIG_ERROR");
  });

  it("qualifier aktif tapi atribut deal null -> tidak cocok", () => {
    const t = tpl("SEG", { q_segments: ["B2G"] });
    expect(resolveTemplate([base, t], deal({ segment: null })).template?.name).toBe("BASE");
  });

  it("kuantitas: batas min dan max inklusif", () => {
    const t = tpl("QTY", { q_min_qty: 10, q_max_qty: 50 });
    expect(resolveTemplate([base, t], deal({ quantity: 10 })).template?.name).toBe("QTY");
    expect(resolveTemplate([base, t], deal({ quantity: 50 })).template?.name).toBe("QTY");
    expect(resolveTemplate([base, t], deal({ quantity: 9 })).template?.name).toBe("BASE");
    expect(resolveTemplate([base, t], deal({ quantity: 51 })).template?.name).toBe("BASE");
  });

  it("estimasi nilai: rentang inklusif, max null tak terbatas", () => {
    const t = tpl("VAL", { min_value: 1_000_000_000, max_value: null });
    expect(resolveTemplate([base, t], deal({ estimatedValue: 1_000_000_000 })).template?.name).toBe("VAL");
    expect(resolveTemplate([base, t], deal({ estimatedValue: 999_999_999 })).template?.name).toBe("BASE");
  });

  it("blacklist: template q_blacklist=true hanya untuk deal blacklist", () => {
    const t = tpl("BL", { q_blacklist: true, priority: 5 });
    expect(resolveTemplate([base, t], deal({ isBlacklisted: true })).template?.name).toBe("BL");
    expect(resolveTemplate([base, t], deal({ isBlacklisted: false })).template?.name).toBe("BASE");
  });

  it("template nonaktif atau bukan OFFICIAL_QUOTATION diabaikan", () => {
    const off = tpl("OFF", { q_segments: ["B2G"], is_active: false });
    const pe = tpl("PE", { q_segments: ["B2G"], workflow_kind: "PRICE_ESTIMATE" });
    expect(resolveTemplate([base, off, pe], deal()).template?.name).toBe("BASE");
  });

  it("evaluated memuat qualifier yang gagal untuk penguji", () => {
    const t = tpl("B2C-ONLY", { q_segments: ["B2C"] });
    const row = resolveTemplate([base, t], deal()).evaluated.find((e) => e.template.name === "B2C-ONLY");
    expect(row?.matched).toBe(false);
    expect(row?.failed).toEqual(["segmen B2C"]);
  });
});

describe("isBlacklisted", () => {
  it("tidak peka huruf besar/kecil dan spasi ganda", () => {
    expect(isBlacklisted("  PT  Maju   Jaya ", ["pt maju jaya"])).toBe(true);
  });
  it("nama berbeda atau kosong -> false", () => {
    expect(isBlacklisted("PT Lain", ["PT Maju Jaya"])).toBe(false);
    expect(isBlacklisted(undefined, ["PT Maju Jaya"])).toBe(false);
    expect(isBlacklisted("PT Maju Jaya", [])).toBe(false);
  });
});
