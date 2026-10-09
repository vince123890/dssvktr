import { describe, expect, it } from "vitest";
import { actorFillsSlot, canManageProductMasterData, canSeeCostStructure, hasAnyFunction, hasFunction, isExternal, legacyRoleFor } from "./rbac";
import {
  DEFAULT_MENU_ACCESS,
  allowedMenus,
  canAccessMenu,
  canViewQuotation,
  landingHref,
} from "./menuAccess";
import type { Actor, FunctionalRole } from "@/types/database";

const actor = (fns: FunctionalRole[], over: Record<string, unknown> = {}): Actor =>
  ({
    id: "me",
    app_role_code: "R",
    app_role: { code: "R", name: "R", functional_roles: fns, is_active: true, is_external: false },
    ...over,
  }) as unknown as Actor;

describe("fungsi role", () => {
  it("hasFunction / hasAnyFunction membaca fungsi role aktif", () => {
    const a = actor(["SALESPERSON"]);
    expect(hasFunction(a, "SALESPERSON")).toBe(true);
    expect(hasAnyFunction(a, ["COGS_OWNER", "SALESPERSON"])).toBe(true);
    expect(hasFunction(a, "SYSTEM_ADMIN")).toBe(false);
  });
  it("role nonaktif atau tidak ada tidak memberi fungsi", () => {
    const off = actor(["SYSTEM_ADMIN"], {
      app_role: { functional_roles: ["SYSTEM_ADMIN"], is_active: false },
    });
    expect(hasFunction(off, "SYSTEM_ADMIN")).toBe(false);
    expect(hasFunction(actor([], { app_role: null }), "SYSTEM_ADMIN")).toBe(false);
  });
  it("hak operasional", () => {
    expect(canManageProductMasterData(actor(["PRODUCT_OWNER"]))).toBe(true);
    expect(canManageProductMasterData(actor(["SALESPERSON"]))).toBe(false);
    expect(canSeeCostStructure(actor(["SALESPERSON"]))).toBe(false);
    expect(canSeeCostStructure(actor(["COGS_OWNER"]))).toBe(true);
  });
  it("akun eksternal dikenali dari flag atau fungsi", () => {
    expect(isExternal(actor(["EXTERNAL_AGENCY"]))).toBe(true);
    expect(isExternal(actor(["SALESPERSON"], { app_role: { functional_roles: ["SALESPERSON"], is_active: true, is_external: true } }))).toBe(true);
    expect(isExternal(actor(["SALESPERSON"]))).toBe(false);
  });
  it("legacyRoleFor mengikuti urutan prioritas", () => {
    expect(legacyRoleFor(["SALESPERSON", "SYSTEM_ADMIN"])).toBe("SYSTEM_ADMIN");
    expect(legacyRoleFor(["PRICING_COMMITTEE"])).toBe("BOD");
    expect(legacyRoleFor(["PROFITABILITY_OWNER"])).toBe("VP_FINANCE");
    expect(legacyRoleFor(["COGS_OWNER"])).toBe("VP_OPERATIONS");
    expect(legacyRoleFor(["SALES_OPERATIONS"])).toBe("CHIEF_SALES");
    expect(legacyRoleFor(["SALESPERSON"])).toBe("SALES_OFFICER");
  });
});

describe("actorFillsSlot", () => {
  it("slot fungsi cocok dengan fungsi yang dibawa", () => {
    expect(actorFillsSlot(actor(["COGS_OWNER"]), "COGS_OWNER")).toBe(true);
    expect(actorFillsSlot(actor(["COGS_OWNER"]), "PROFITABILITY_OWNER")).toBe(false);
  });
  it("slot role:KODE hanya cocok dengan role spesifik itu", () => {
    const cfo = actor(["PRICING_COMMITTEE"], { app_role_code: "CFO" });
    expect(actorFillsSlot(cfo, "role:CFO")).toBe(true);
    expect(actorFillsSlot(cfo, "role:CCO")).toBe(false);
  });
});

describe("akses menu", () => {
  it("Sales Executive tidak punya cost_structure, dss, master_data, audit, settings", () => {
    const a = actor(["SALESPERSON"]);
    for (const k of ["cost_structure", "dss", "master_data", "audit", "settings", "product"] as const) {
      expect(canAccessMenu(a, k, DEFAULT_MENU_ACCESS)).toBe(false);
    }
    expect(allowedMenus(a, DEFAULT_MENU_ACCESS)).toEqual(["overview", "price_estimate", "quotations"]);
  });
  it("agency eksternal hanya price_estimate", () => {
    expect(allowedMenus(actor(["EXTERNAL_AGENCY"]), DEFAULT_MENU_ACCESS)).toEqual(["price_estimate"]);
  });
  it("settings hanya SYSTEM_ADMIN", () => {
    expect(canAccessMenu(actor(["PRICING_COMMITTEE"]), "settings", DEFAULT_MENU_ACCESS)).toBe(false);
    expect(canAccessMenu(actor(["SYSTEM_ADMIN"]), "settings", DEFAULT_MENU_ACCESS)).toBe(true);
  });
  it("landing: menu pertama yang diizinkan, atau /no-access", () => {
    expect(landingHref(actor(["EXTERNAL_AGENCY"]), DEFAULT_MENU_ACCESS)).toBe("/price-estimate");
    expect(landingHref(actor(["PRODUCT_OWNER"]), DEFAULT_MENU_ACCESS)).toBe("/master-data/product");
    expect(landingHref(actor([]), DEFAULT_MENU_ACCESS)).toBe("/no-access");
  });
});

describe("canViewQuotation", () => {
  const p = (over: Record<string, unknown> = {}) =>
    ({ created_by: "other", account_person_ids: [], initiator_role_code: "SALES_EXEC", ...over }) as never;

  it("peran harga/approver melihat semua", () => {
    expect(canViewQuotation(actor(["SALES_OPERATIONS"]), p(), [])).toBe(true);
  });
  it("salesperson hanya milik sendiri atau sebagai account person", () => {
    const me = actor(["SALESPERSON"]);
    expect(canViewQuotation(me, p(), [])).toBe(false);
    expect(canViewQuotation(me, p({ created_by: "me" }), [])).toBe(true);
    expect(canViewQuotation(me, p({ account_person_ids: ["me"] }), [])).toBe(true);
  });
  it("validator juga melihat permintaan dari role salesperson non-validator", () => {
    const lead = actor(["SALESPERSON", "SALES_VALIDATOR"]);
    expect(canViewQuotation(lead, p(), ["SALES_EXEC"])).toBe(true);
    expect(canViewQuotation(lead, p({ initiator_role_code: "OTHER" }), ["SALES_EXEC"])).toBe(false);
  });
});
