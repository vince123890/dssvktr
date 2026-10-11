import { describe, expect, it } from "vitest";
import {
  actorFillsSlot,
  canAttachSignedDocument,
  canEditRevisionDiscount,
  canManageProductMasterData,
  canOverrideExpired,
  canRecordProjectProgress,
  canSeeCostStructure,
  canSetPaymentTerms,
  canUpdatePaymentStatus,
  hasAnyFunction,
  hasFunction,
  isExternal,
  legacyRoleFor,
} from "./rbac";
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
    expect(allowedMenus(a, DEFAULT_MENU_ACCESS)).toEqual(["overview", "dashboard", "price_estimate", "quotations", "projects"]);
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

describe("v5.0 — role dan menu baru", () => {
  const me = (fns: FunctionalRole[]) => actor(fns);
  it("Finance, Tim Project, Chief/Direksi hanya mendapat menu yang dipakainya", () => {
    expect(allowedMenus(me(["FINANCE"]), DEFAULT_MENU_ACCESS)).toEqual(["projects"]);
    expect(allowedMenus(me(["PROJECT_TEAM"]), DEFAULT_MENU_ACCESS)).toEqual(["projects"]);
    expect(allowedMenus(me(["EXECUTIVE"]), DEFAULT_MENU_ACCESS)).toEqual(["dashboard", "projects"]);
  });
  it("halaman awal Chief/Direksi adalah Dashboard, Finance adalah Projects", () => {
    expect(landingHref(me(["EXECUTIVE"]), DEFAULT_MENU_ACCESS)).toBe("/dashboard");
    expect(landingHref(me(["FINANCE"]), DEFAULT_MENU_ACCESS)).toBe("/projects");
  });
  it("Chief/Direksi dan Finance tidak melihat cost structure atau daftar quotation", () => {
    expect(canSeeCostStructure(me(["EXECUTIVE"]))).toBe(false);
    expect(canSeeCostStructure(me(["FINANCE"]))).toBe(false);
    expect(canAccessMenu(me(["EXECUTIVE"]), "quotations", DEFAULT_MENU_ACCESS)).toBe(false);
    expect(canAccessMenu(me(["FINANCE"]), "cost_structure", DEFAULT_MENU_ACCESS)).toBe(false);
  });
  it("Salesperson mendapat Dashboard dan Projects (miliknya)", () => {
    const menus = allowedMenus(me(["SALESPERSON"]), DEFAULT_MENU_ACCESS);
    expect(menus).toContain("dashboard");
    expect(menus).toContain("projects");
  });
});

describe("v5.0 — wewenang aksi baru", () => {
  const owner = { created_by: "me", account_person_ids: [] as string[] };
  const other = { created_by: "someone", account_person_ids: [] as string[] };
  it("lampiran dokumen bertanda tangan: hanya Salesperson pemilik atau Admin", () => {
    expect(canAttachSignedDocument(actor(["SALESPERSON"]), owner)).toBe(true);
    expect(canAttachSignedDocument(actor(["SALESPERSON"]), { ...other, account_person_ids: ["me"] })).toBe(true);
    expect(canAttachSignedDocument(actor(["SALESPERSON"]), other)).toBe(false);
    expect(canAttachSignedDocument(actor(["SALES_RELEASER"]), owner)).toBe(false);
    expect(canAttachSignedDocument(actor(["SYSTEM_ADMIN"]), other)).toBe(true);
  });
  it("termin ditetapkan Salesperson pemilik; status payment oleh Finance; progres oleh Tim Project", () => {
    expect(canSetPaymentTerms(actor(["SALESPERSON"]), owner)).toBe(true);
    expect(canSetPaymentTerms(actor(["FINANCE"]), owner)).toBe(false);
    expect(canUpdatePaymentStatus(actor(["FINANCE"]))).toBe(true);
    expect(canUpdatePaymentStatus(actor(["SALESPERSON"]))).toBe(false);
    expect(canRecordProjectProgress(actor(["PROJECT_TEAM"]))).toBe(true);
    expect(canRecordProjectProgress(actor(["FINANCE"]))).toBe(false);
    expect(canRecordProjectProgress(actor(["SALESPERSON"]))).toBe(false);
  });
  it("override Expired hanya Admin", () => {
    expect(canOverrideExpired(actor(["SYSTEM_ADMIN"]))).toBe(true);
    expect(canOverrideExpired(actor(["SALESPERSON"]))).toBe(false);
    expect(canOverrideExpired(actor(["SALES_RELEASER"]))).toBe(false);
  });
  it("diskon Salesperson hanya pada draft revisi miliknya", () => {
    const revDraft = { current_status: "DRAFT" as const, supersedes_proposal_id: "p0", created_by: "me" };
    expect(canEditRevisionDiscount(actor(["SALESPERSON"]), revDraft)).toBe(true);
    expect(canEditRevisionDiscount(actor(["SALESPERSON"]), { ...revDraft, supersedes_proposal_id: null })).toBe(false);
    expect(canEditRevisionDiscount(actor(["SALESPERSON"]), { ...revDraft, created_by: "x" })).toBe(false);
    expect(canEditRevisionDiscount(actor(["SALESPERSON"]), { ...revDraft, current_status: "PENDING_SALES_OPERATIONS" })).toBe(false);
    expect(canEditRevisionDiscount(actor(["SALES_OPERATIONS"]), revDraft)).toBe(false);
  });
});
