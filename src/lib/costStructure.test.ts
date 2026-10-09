import { describe, expect, it } from "vitest";
import { fakeDb } from "@/test/fakeDb";
import { canPerformScopeAction, evaluateVersion, scenarioFor, versionScenario } from "./costStructure";
import type { Actor, CostItem, CostStructureLine } from "@/types/database";

const actor = (id: string, role: string | null): Actor => ({ id, app_role_code: role }) as Actor;
const auth = (role: string, over: Record<string, unknown> = {}) => ({
  app_role_code: role,
  scope: "COGS",
  scenario: "REGULAR",
  can_make: false,
  can_check: false,
  can_release: false,
  ...over,
});
const none = { maker_id: null, checker_id: null };

describe("scenarioFor / versionScenario", () => {
  it("GM di bawah ambang -> DEVIATION, sama dengan ambang -> REGULAR", () => {
    expect(scenarioFor(0.12, 15)).toBe("DEVIATION");
    expect(scenarioFor(0.15, 15)).toBe("REGULAR");
  });
  it("margin belum diisi -> REGULAR walau GM 0; margin terisi dan GM rendah -> DEVIATION", () => {
    expect(versionScenario({ marginAmount: 0, standardGm: 0 } as never, 10)).toBe("REGULAR");
    expect(versionScenario({ marginAmount: 5, standardGm: 0.05 } as never, 10)).toBe("DEVIATION");
  });
});

describe("evaluateVersion", () => {
  it("memetakan baris versi ke nilai dan excluded", () => {
    const items = [
      { id: "a", code: "a", cost_group: "COGS", unit_type: "FIXED", denomination: "IDR", is_derived: false, active: true },
      { id: "b", code: "b", cost_group: "ADD_ONS", unit_type: "FIXED", denomination: "IDR", is_derived: false, active: true },
    ] as unknown as CostItem[];
    const lines = [
      { cost_item_id: "a", value: "100", is_excluded_at_cost: false },
      { cost_item_id: "b", value: "50", is_excluded_at_cost: true },
    ] as unknown as CostStructureLine[];
    expect(evaluateVersion(items, lines, 1).baseCost).toBe(100);
  });
});

describe("canPerformScopeAction", () => {
  it("akun tanpa role ditolak", async () => {
    const r = await canPerformScopeAction(fakeDb({}), {
      actor: actor("u1", null), scope: "COGS", scenario: "REGULAR", action: "make", state: none,
    });
    expect(r).toEqual({ allowed: false, reason: "Akun Anda belum memiliki role." });
  });

  it("role tanpa wewenang pada scope ditolak dengan pesan", async () => {
    const db = fakeDb({ scope_authority: [auth("MAKER", { can_make: true })] });
    const r = await canPerformScopeAction(db, {
      actor: actor("u1", "OTHER"), scope: "COGS", scenario: "REGULAR", action: "make", state: none,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("wewenang MAKE pada scope COGS (skenario REGULAR)");
  });

  it("skenario menentukan baris wewenang yang dibaca", async () => {
    const db = fakeDb({ scope_authority: [auth("MAKER", { can_make: true, scenario: "DEVIATION" })] });
    const r = await canPerformScopeAction(db, {
      actor: actor("u1", "MAKER"), scope: "COGS", scenario: "REGULAR", action: "make", state: none,
    });
    expect(r.allowed).toBe(false);
  });

  const twoPeople = () =>
    fakeDb({
      scope_authority: [auth("CHK", { can_check: true })],
      profile: [{ id: "u1", app_role_code: "CHK" }, { id: "u2", app_role_code: "CHK" }],
    });

  it("maker tidak boleh menjadi checker bila ada pemegang wewenang lain", async () => {
    const r = await canPerformScopeAction(twoPeople(), {
      actor: actor("u1", "CHK"), scope: "COGS", scenario: "REGULAR", action: "check",
      state: { maker_id: "u1", checker_id: null },
    });
    expect(r).toEqual({ allowed: false, reason: "Checker harus orang yang berbeda dari Maker (pemisahan tugas)." });
  });

  it("checker berbeda dari maker diizinkan", async () => {
    const r = await canPerformScopeAction(twoPeople(), {
      actor: actor("u2", "CHK"), scope: "COGS", scenario: "REGULAR", action: "check",
      state: { maker_id: "u1", checker_id: null },
    });
    expect(r).toEqual({ allowed: true });
  });

  it("pemegang tunggal diizinkan dan ditandai single actor", async () => {
    const db = fakeDb({
      scope_authority: [auth("CHK", { can_check: true })],
      profile: [{ id: "u1", app_role_code: "CHK" }],
    });
    const r = await canPerformScopeAction(db, {
      actor: actor("u1", "CHK"), scope: "COGS", scenario: "REGULAR", action: "check",
      state: { maker_id: "u1", checker_id: null },
    });
    expect(r).toEqual({ allowed: true, singleActor: true });
  });

  it("tanpa aturan terdefinisi checker boleh sama dengan releaser", async () => {
    const db = fakeDb({
      scope_authority: [auth("R", { can_release: true })],
      profile: [{ id: "u1", app_role_code: "R" }, { id: "u2", app_role_code: "R" }],
    });
    const r = await canPerformScopeAction(db, {
      actor: actor("u1", "R"), scope: "COGS", scenario: "REGULAR", action: "release",
      state: { maker_id: null, checker_id: "u1" },
    });
    expect(r).toEqual({ allowed: true });
  });

  it("checker_ne_releaser aktif menolak releaser yang sama", async () => {
    const db = fakeDb({
      scope_authority: [auth("R", { can_release: true })],
      scope_segregation_rule: [{ scope: "COGS", maker_ne_checker: true, checker_ne_releaser: true, allow_single_actor: false }],
      profile: [{ id: "u1", app_role_code: "R" }, { id: "u2", app_role_code: "R" }],
    });
    const r = await canPerformScopeAction(db, {
      actor: actor("u1", "R"), scope: "COGS", scenario: "REGULAR", action: "release",
      state: { maker_id: null, checker_id: "u1" },
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("Releaser harus orang yang berbeda dari Checker");
  });
});
