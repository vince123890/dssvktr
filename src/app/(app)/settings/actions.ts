"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { FUNCTIONAL_ROLES, canManageSettings, legacyRoleFor } from "@/lib/rbac";
import { SETTING_KEYS, type AppSettings } from "@/lib/settings";
import { MENUS, type MenuKey } from "@/lib/menuAccess";
import { isNextControlFlowError, toActionError, type ActionResult } from "@/lib/actionResult";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type {
  AppRole,
  FunctionalRole,
  ProposalStatus,
  StepActionKind,
  WorkflowDefinition,

} from "@/types/database";

/**
 * Settings (PRD FR-5.6, FR-2.1): everything the attachment's "Actors"
 * and "Basic Workflow" sheets define is edited here as data. Each save
 * is audited as SETTINGS_CHANGE; running quotations keep the workflow
 * version they were submitted with.
 */

async function guarded(fn: (ctx: { supabase: Awaited<ReturnType<typeof createClient>>; actorId: string }) => Promise<string>): Promise<ActionResult> {
  try {
    const me = await requireProfile();
    if (!canManageSettings(me)) throw new Error("Hanya System Admin yang dapat mengubah Settings.");
    const supabase = await createClient();
    const summary = await fn({ supabase, actorId: me.id });
    await writeAuditLog(supabase, {
      entityType: "settings",
      entityId: me.id,
      actorId: me.id,
      action: "SETTINGS_CHANGE",
      reason: summary,
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => i.message).join(" · ") };
    return toActionError(e, "Gagal menyimpan Settings.");
  }
}

const FunctionalRoleEnum = z.enum(FUNCTIONAL_ROLES as [FunctionalRole, ...FunctionalRole[]]);

const RoleSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9_]{2,40}$/, "Kode role: huruf besar/angka/underscore"),
  name: z.string().trim().min(2, "Nama role wajib diisi"),
  functional_roles: z.array(FunctionalRoleEnum),
  is_external: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.number().int().default(0),
});

export async function saveRoleAction(input: z.input<typeof RoleSchema>): Promise<ActionResult> {
  return guarded(async ({ supabase }) => {
    const role = RoleSchema.parse(input);
    const { error } = await supabase.from("app_role").upsert(role, { onConflict: "code" });
    if (error) throw new Error(error.message);
    // Keep legacy enum in sync for users of this role (older RLS policies read it).
    const { data: users } = await supabase.from("profile").select("id").eq("app_role_code", role.code);
    if (users && users.length > 0) {
      await supabase
        .from("profile")
        .update({ role: legacyRoleFor(role.functional_roles) })
        .in("id", users.map((u: { id: string }) => u.id));
    }
    return `Role ${role.code} disimpan (${role.functional_roles.join(", ") || "tanpa fungsi"})`;
  });
}

export async function assignUserRoleAction(userId: string, roleCode: string): Promise<ActionResult> {
  return guarded(async ({ supabase }) => {
    const { data: role } = await supabase.from("app_role").select("*").eq("code", roleCode).single();
    if (!role) throw new Error("Role tidak ditemukan.");
    const { error } = await supabase
      .from("profile")
      .update({ app_role_code: roleCode, role: legacyRoleFor((role as AppRole).functional_roles) })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return `User ${userId.slice(0, 8)} → ${roleCode}`;
  });
}

const AuthorityRowSchema = z.object({
  app_role_code: z.string(),
  scope: z.enum(["COGS", "ADD_ONS", "MARGIN", "SALES"]),
  scenario: z.enum(["REGULAR", "DEVIATION"]),
  can_make: z.boolean(),
  can_check: z.boolean(),
  can_release: z.boolean(),
});

export async function saveScopeAuthorityAction(rows: z.input<typeof AuthorityRowSchema>[]): Promise<ActionResult> {
  return guarded(async ({ supabase }) => {
    const parsed = z.array(AuthorityRowSchema).parse(rows).filter((r) => r.can_make || r.can_check || r.can_release);
    for (const scope of ["COGS", "ADD_ONS", "MARGIN", "SALES"] as const) {
      for (const scenario of ["REGULAR", "DEVIATION"] as const) {
        const covered = parsed.some((r) => r.scope === scope && r.scenario === scenario && r.can_release);
        if (!covered) throw new Error(`Scope ${scope} skenario ${scenario} tidak punya Releaser sama sekali.`);
      }
    }
    await supabase.from("scope_authority").delete().neq("app_role_code", "__none__");
    if (parsed.length > 0) {
      const { error } = await supabase.from("scope_authority").insert(parsed);
      if (error) throw new Error(error.message);
    }
    return `Matriks Scope Authority disimpan (${parsed.length} baris)`;
  });
}

const SegregationSchema = z.object({
  scope: z.enum(["COGS", "ADD_ONS", "MARGIN", "SALES"]),
  maker_ne_checker: z.boolean(),
  checker_ne_releaser: z.boolean(),
  allow_single_actor: z.boolean(),
});

export async function saveSegregationAction(rules: z.input<typeof SegregationSchema>[]): Promise<ActionResult> {
  return guarded(async ({ supabase }) => {
    const parsed = z.array(SegregationSchema).parse(rules);
    const { error } = await supabase.from("scope_segregation_rule").upsert(parsed, { onConflict: "scope" });
    if (error) throw new Error(error.message);
    return "Aturan pemisahan tugas disimpan";
  });
}

const STATUS_FOR_KIND: Record<StepActionKind, ProposalStatus> = {
  VALIDATE: "PENDING_SALES_LEAD_VALIDATION",
  GENERATE_QUOTATION: "PENDING_SALES_OPERATIONS",
  REVIEW_AND_ROUTE: "PENDING_HEAD_OF_SALES_REVIEW",
  APPROVE: "PENDING_ADDITIONAL_APPROVAL",
};

const StepSchema = z.object({
  step_name: z.string().trim().min(2, "Nama langkah wajib diisi"),
  action_kind: z.enum(["VALIDATE", "GENERATE_QUOTATION", "REVIEW_AND_ROUTE", "APPROVE"]),
  performer_function: FunctionalRoleEnum,
  skip_if_initiator_function: FunctionalRoleEnum.nullable(),
  reject_to_step_order: z.number().int().nullable(),
  sla_hours: z.number().int().min(1).max(720),
});

/**
 * Saves the Official Quotation template as a NEW version (the old one is
 * deactivated, not edited) so quotations already in flight keep the
 * steps they started with.
 */
export async function saveWorkflowStepsAction(
  definitionId: string,
  steps: z.input<typeof StepSchema>[]
): Promise<ActionResult> {
  return guarded(async ({ supabase }) => {
    const parsed = z.array(StepSchema).min(2).parse(steps);

    const generate = parsed.filter((s) => s.action_kind === "GENERATE_QUOTATION");
    const review = parsed.filter((s) => s.action_kind === "REVIEW_AND_ROUTE");
    if (generate.length !== 1) throw new Error("Harus ada tepat satu langkah Generate (Sales Operations).");
    if (review.length !== 1) throw new Error("Harus ada tepat satu langkah Review & Rilis (Head of Sales).");
    if (parsed[parsed.length - 1].action_kind !== "REVIEW_AND_ROUTE") {
      throw new Error("Langkah terakhir harus Review & Rilis — routing tier margin selalu setelahnya.");
    }
    const genIndex = parsed.findIndex((s) => s.action_kind === "GENERATE_QUOTATION");
    parsed.forEach((s, i) => {
      if (s.reject_to_step_order !== null && s.reject_to_step_order >= i + 1) {
        throw new Error(`Langkah ${i + 1}: tujuan tolak harus langkah sebelumnya.`);
      }
      if (s.skip_if_initiator_function && s.action_kind !== "VALIDATE" && s.action_kind !== "APPROVE") {
        throw new Error(`Langkah ${i + 1}: kondisi lewati hanya untuk langkah validasi/persetujuan.`);
      }
      if (s.action_kind === "REVIEW_AND_ROUTE" && i < genIndex) {
        throw new Error("Review harus setelah Generate.");
      }
    });

    // Every performer must be held by at least one active user, or the
    // quotation would stall forever on that step.
    const { data: roles } = await supabase.from("app_role").select("code, functional_roles, is_active");
    const { data: users } = await supabase.from("profile").select("app_role_code");
    for (const s of parsed) {
      const holderRoles = ((roles ?? []) as AppRole[])
        .filter((r) => r.is_active && r.functional_roles.includes(s.performer_function))
        .map((r) => r.code);
      const hasUser = (users ?? []).some((u: { app_role_code: string | null }) => u.app_role_code && holderRoles.includes(u.app_role_code));
      if (!hasUser) throw new Error(`Tidak ada user aktif dengan fungsi ${s.performer_function} (langkah "${s.step_name}").`);
    }

    const { data: current } = await supabase.from("workflow_definition").select("*").eq("id", definitionId).single();
    if (!current) throw new Error("Workflow template tidak ditemukan.");
    const def = current as WorkflowDefinition;

    const { data: created, error } = await supabase
      .from("workflow_definition")
      .insert({
        business_line: def.business_line,
        name: def.name,
        qualifier_type: def.qualifier_type,
        workflow_kind: def.workflow_kind,
        allowed_functions: def.allowed_functions,
        min_value: def.min_value,
        max_value: def.max_value,
        is_active: true,
        version: def.version + 1,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: stepError } = await supabase.from("workflow_step_definition").insert(
      parsed.map((s, i) => ({
        workflow_definition_id: created.id,
        step_order: i + 1,
        department_id: null,
        status_label: STATUS_FOR_KIND[s.action_kind],
        is_mandatory_gate: true,
        sla_hours: s.sla_hours,
        step_name: s.step_name,
        action_kind: s.action_kind,
        performer_function: s.performer_function,
        skip_if_initiator_function: s.skip_if_initiator_function,
        reject_to_step_order: s.reject_to_step_order,
        cc_functions: [],
      }))
    );
    if (stepError) {
      await supabase.from("workflow_definition").delete().eq("id", created.id);
      throw new Error(stepError.message);
    }
    await supabase.from("workflow_definition").update({ is_active: false }).eq("id", definitionId);
    return `Workflow "${def.name}" disimpan sebagai v${def.version + 1} (${parsed.length} langkah)`;
  });
}

const MENU_KEYS = MENUS.map((m) => m.key) as [MenuKey, ...MenuKey[]];

/**
 * Menu access matrix (PRD FR-5.7): menu -> functional roles. Settings is
 * locked to System Admin so an admin can never lock themselves out.
 */
export async function saveMenuAccessAction(access: Partial<Record<MenuKey, FunctionalRole[]>>): Promise<ActionResult> {
  return guarded(async ({ supabase, actorId }) => {
    const parsed = z.record(z.enum(MENU_KEYS), z.array(FunctionalRoleEnum)).parse(access);
    const value: Partial<Record<MenuKey, FunctionalRole[]>> = {};
    for (const m of MENUS) {
      if (m.locked) continue;
      value[m.key] = parsed[m.key] ?? m.defaultFunctions;
    }
    const { error } = await supabase
      .from("app_setting")
      .upsert({ key: "menu_access", value, updated_by: actorId, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return `Akses menu disimpan: ${Object.entries(value).map(([k, v]) => `${k}=[${(v ?? []).join(",")}]`).join(" ")}`;
  });
}

const TierSchema = z.object({
  id: z.string(),
  gpm_lower_bound_pct: z.number().nullable(),
  gpm_upper_bound_pct: z.number().nullable(),
  decision_slots: z.array(z.string()).min(1, "Setiap tier butuh minimal satu pemutus"),
  cc_slots: z.array(z.string()),
});

export async function saveTiersAction(tiers: z.input<typeof TierSchema>[]): Promise<ActionResult> {
  return guarded(async ({ supabase }) => {
    const parsed = z.array(TierSchema).parse(tiers);
    for (const t of parsed) {
      const { error } = await supabase
        .from("margin_tier_authority")
        .update({
          gpm_lower_bound_pct: t.gpm_lower_bound_pct,
          gpm_upper_bound_pct: t.gpm_upper_bound_pct,
          decision_slots: t.decision_slots,
          cc_slots: t.cc_slots,
        })
        .eq("id", t.id);
      if (error) throw new Error(error.message);
    }
    return `Tier margin disimpan: ${parsed.map((t) => `${t.gpm_lower_bound_pct ?? "-∞"}–${t.gpm_upper_bound_pct ?? "∞"}%`).join(" | ")}`;
  });
}

const BandSchema = z.object({
  band: z.number().int().min(1),
  min_qty: z.number().int().min(1),
  max_qty: z.number().int().nullable(),
  processing_mode: z.enum(["AUTO", "AUTO_WITH_MANUAL", "MANUAL"]),
  default_discount_pct: z.number().min(0).max(100),
});

export async function saveBandsAction(bands: z.input<typeof BandSchema>[]): Promise<ActionResult> {
  return guarded(async ({ supabase }) => {
    const parsed = z.array(BandSchema).min(1).parse(bands).sort((a, b) => a.min_qty - b.min_qty);
    if (parsed[0].min_qty !== 1) throw new Error("Band pertama harus mulai dari 1 unit.");
    parsed.forEach((b, i) => {
      const next = parsed[i + 1];
      if (next && (b.max_qty === null || b.max_qty + 1 !== next.min_qty)) {
        throw new Error(`Band ${b.band} dan ${next.band} harus bersambung tanpa celah/tumpang tindih.`);
      }
      if (!next && b.max_qty !== null) throw new Error("Band terakhir harus tanpa batas atas.");
    });
    await supabase.from("quantity_band_config").delete().gte("band", 0);
    const { error } = await supabase.from("quantity_band_config").insert(parsed);
    if (error) throw new Error(error.message);
    return `Quantity band disimpan (${parsed.length} band)`;
  });
}

export async function saveGeneralSettingsAction(values: Partial<AppSettings>): Promise<ActionResult> {
  return guarded(async ({ supabase, actorId }) => {
    const rows = Object.entries(values)
      .filter(([k]) => k in SETTING_KEYS)
      .map(([k, v]) => ({
        key: SETTING_KEYS[k as keyof AppSettings],
        value: v as unknown,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      }));
    if (values.vatRatePct !== undefined && (values.vatRatePct < 0 || values.vatRatePct > 50)) throw new Error("Tarif PPN tidak valid.");
    const { error } = await supabase.from("app_setting").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return `Settings umum disimpan (${rows.map((r) => r.key).join(", ")})`;
  });
}

