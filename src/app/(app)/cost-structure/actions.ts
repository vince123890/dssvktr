"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { loadSettings } from "@/lib/settings";
import { resolveExchangeRate } from "@/lib/pricing/currency";
import {
  canPerformScopeAction,
  evaluateVersion,
  loadCostItems,
  loadReleasedVersion,
  loadVersionLines,
  versionScenario,
  type ScopeAction,
} from "@/lib/costStructure";
import { GROUP_OF_SCOPE, SCOPE_ORDER } from "@/lib/pricing/quotation";
import { hasAnyFunction } from "@/lib/rbac";
import { isNextControlFlowError, toActionError, type ActionResult } from "@/lib/actionResult";
import { revalidatePath } from "next/cache";
import type {
  CostScope,
  CostStructureScopeState,
  CostStructureVersion,
} from "@/types/database";

/**
 * Cost Structure per variant — Maker → Checker → Releaser per scope
 * (PRD FR-1.1.2, sheet Actors). A version prices nothing until all four
 * scopes are RELEASED; then it becomes the product's active price book
 * and the previous released version is retired.
 */

export interface CreateVersionResult extends ActionResult {
  versionId?: string;
}

export async function createCostStructureVersionAction(
  productId: string,
  reason: string
): Promise<CreateVersionResult> {
  try {
    const actor = await requireProfile();
    if (!hasAnyFunction(actor, ["COGS_OWNER", "PROFITABILITY_OWNER", "SALES_PRICING_OWNER", "PRICING_COMMITTEE", "SYSTEM_ADMIN"])) {
      throw new Error("Hanya pemilik scope yang dapat membuat versi cost structure.");
    }
    const supabase = await createClient();

    const { data: openDraft } = await supabase
      .from("cost_structure_version")
      .select("id")
      .eq("product_id", productId)
      .eq("status", "DRAFT")
      .maybeSingle();
    if (openDraft) {
      return { ok: true, versionId: openDraft.id };
    }

    const [parent, rate, { data: last }] = await Promise.all([
      loadReleasedVersion(supabase, productId),
      resolveExchangeRate(supabase),
      supabase
        .from("cost_structure_version")
        .select("version_no")
        .eq("product_id", productId)
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (!rate) throw new Error("Kurs CNY/IDR belum tersedia di Master Data.");

    const { data: version, error } = await supabase
      .from("cost_structure_version")
      .insert({
        product_id: productId,
        version_no: (last?.version_no ?? 0) + 1,
        status: "DRAFT",
        locked_fx_rate_id: rate.id,
        locked_fx_rate: rate.rate,
        parent_version_id: parent?.id ?? null,
        change_reason: reason || null,
        created_by: actor.id,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const rateChanged = parent ? Number(parent.locked_fx_rate) !== Number(rate.rate) : true;

    if (parent) {
      const parentLines = await loadVersionLines(supabase, parent.id);
      if (parentLines.length > 0) {
        await supabase.from("cost_structure_line").insert(
          parentLines.map((l) => ({
            version_id: version.id,
            cost_item_id: l.cost_item_id,
            value: l.value,
            is_excluded_at_cost: l.is_excluded_at_cost,
          }))
        );
      }
    }

    // Unchanged scopes are carried over as RELEASED (Technical Logic
    // §4.8); a new CNY rate reopens COGS because FOB Price in IDR moves.
    await supabase.from("cost_structure_scope_state").insert(
      SCOPE_ORDER.map((scope) => {
        const carry = Boolean(parent) && !(scope === "COGS" && rateChanged);
        return {
          version_id: version.id,
          scope,
          status: carry ? "RELEASED" : "DRAFT",
          carried_over: carry,
          note: carry ? `Disalin dari v${parent!.version_no}` : null,
        };
      })
    );

    await writeAuditLog(supabase, {
      entityType: "cost_structure_version",
      entityId: version.id,
      actorId: actor.id,
      action: "CREATE",
      reason: `v${version.version_no} dibuat${reason ? `: ${reason}` : ""} — kurs terkunci ${Number(rate.rate).toLocaleString("id-ID")}`,
    });

    revalidatePath("/cost-structure");
    return { ok: true, versionId: version.id };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, "Gagal membuat versi cost structure.");
  }
}

async function loadContext(versionId: string, scope: CostScope) {
  const actor = await requireProfile();
  const supabase = await createClient();
  const { data: version } = await supabase
    .from("cost_structure_version")
    .select("*")
    .eq("id", versionId)
    .single();
  if (!version) throw new Error("Versi tidak ditemukan.");
  const { data: state } = await supabase
    .from("cost_structure_scope_state")
    .select("*")
    .eq("version_id", versionId)
    .eq("scope", scope)
    .single();
  if (!state) throw new Error("Status scope tidak ditemukan.");
  return {
    actor,
    supabase,
    version: version as CostStructureVersion,
    state: state as CostStructureScopeState,
  };
}

async function currentScenario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  version: CostStructureVersion
) {
  const [items, lines, settings] = await Promise.all([
    loadCostItems(supabase),
    loadVersionLines(supabase, version.id),
    loadSettings(supabase),
  ]);
  const result = evaluateVersion(items, lines, Number(version.locked_fx_rate));
  return { scenario: versionScenario(result, settings.deviationGmThresholdPct), result, items };
}

export async function saveScopeValuesAction(
  versionId: string,
  scope: CostScope,
  values: Record<string, number>,
  excluded: string[]
): Promise<ActionResult> {
  try {
    const { actor, supabase, version, state } = await loadContext(versionId, scope);
    if (version.status !== "DRAFT") throw new Error("Versi ini sudah dirilis — buat versi baru untuk mengubah nilai.");
    if (state.status !== "DRAFT" && state.status !== "RETURNED") {
      throw new Error("Scope ini sedang diperiksa/dirilis — kembalikan (Return) dulu untuk mengubah nilai.");
    }

    const { scenario, items } = await currentScenario(supabase, version);
    const perm = await canPerformScopeAction(supabase, { actor, scope, scenario, action: "make", state });
    if (!perm.allowed) throw new Error(perm.reason);

    const group = GROUP_OF_SCOPE[scope];
    const scopeItems = items.filter((i) => i.cost_group === group && !i.is_derived);
    const allowedIds = new Set(scopeItems.map((i) => i.id));
    const excludedSet = new Set(excluded);

    const rows = scopeItems.map((item) => {
      const raw = values[item.id];
      if (raw !== undefined && (Number.isNaN(raw) || raw < 0)) throw new Error(`Nilai ${item.name} tidak valid.`);
      return {
        version_id: versionId,
        cost_item_id: item.id,
        value: raw ?? 0,
        is_excluded_at_cost: item.may_follow_later && excludedSet.has(item.id),
      };
    });
    for (const id of Object.keys(values)) {
      if (!allowedIds.has(id)) throw new Error("Nilai di luar scope ini tidak dapat diubah dari sini.");
    }

    const { error } = await supabase
      .from("cost_structure_line")
      .upsert(rows, { onConflict: "version_id,cost_item_id" });
    if (error) throw new Error(error.message);

    await supabase
      .from("cost_structure_scope_state")
      .update({ status: "DRAFT", scenario })
      .eq("id", state.id);

    await writeAuditLog(supabase, {
      entityType: "cost_structure_version",
      entityId: versionId,
      actorId: actor.id,
      action: "UPDATE",
      reason: `Nilai scope ${scope} disimpan (draft)`,
      fieldChanges: rows.slice(0, 20).map((r) => ({ field: r.cost_item_id, old: null, new: r.value })),
    });

    revalidatePath(`/cost-structure/${versionId}`);
    return { ok: true };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, "Gagal menyimpan nilai scope.");
  }
}

export type ScopeTransition = "MAKE" | "CHECK" | "RELEASE" | "RETURN" | "REOPEN";

export async function scopeTransitionAction(
  versionId: string,
  scope: CostScope,
  transition: ScopeTransition,
  note: string
): Promise<ActionResult> {
  try {
    const { actor, supabase, version, state } = await loadContext(versionId, scope);
    if (version.status !== "DRAFT") throw new Error("Versi ini sudah dirilis/pensiun.");

    const { scenario, result } = await currentScenario(supabase, version);
    const now = new Date().toISOString();

    const expected: Record<ScopeTransition, string[]> = {
      MAKE: ["DRAFT", "RETURNED"],
      CHECK: ["MADE"],
      RELEASE: ["CHECKED"],
      RETURN: ["MADE", "CHECKED"],
      REOPEN: ["RELEASED"],
    };
    if (!expected[transition].includes(state.status)) {
      throw new Error(`Aksi ${transition} tidak berlaku untuk status ${state.status}.`);
    }

    const permAction: ScopeAction =
      transition === "MAKE" || transition === "REOPEN" ? "make" : transition === "RELEASE" ? "release" : "check";
    const perm = await canPerformScopeAction(supabase, { actor, scope, scenario, action: permAction, state });
    if (!perm.allowed) throw new Error(perm.reason);

    if (transition === "RETURN" && !note.trim()) throw new Error("Catatan wajib diisi saat mengembalikan ke Maker.");

    const patch: Partial<CostStructureScopeState> = { scenario };
    if (transition === "MAKE") Object.assign(patch, { status: "MADE", maker_id: actor.id, made_at: now, note: note || null, carried_over: false });
    if (transition === "CHECK") Object.assign(patch, { status: "CHECKED", checker_id: actor.id, checked_at: now, single_actor_flag: Boolean(perm.singleActor) || state.single_actor_flag });
    if (transition === "RELEASE") Object.assign(patch, { status: "RELEASED", releaser_id: actor.id, released_at: now, single_actor_flag: Boolean(perm.singleActor) || state.single_actor_flag });
    if (transition === "RETURN") Object.assign(patch, { status: "RETURNED", note, checker_id: null, checked_at: null });
    if (transition === "REOPEN") Object.assign(patch, { status: "DRAFT", carried_over: false, maker_id: null, checker_id: null, releaser_id: null, made_at: null, checked_at: null, released_at: null, single_actor_flag: false, note: null });

    await supabase.from("cost_structure_scope_state").update(patch).eq("id", state.id);

    await writeAuditLog(supabase, {
      entityType: "cost_structure_version",
      entityId: versionId,
      actorId: actor.id,
      action: transition === "MAKE" ? "MAKE" : transition === "CHECK" ? "CHECK" : transition === "RELEASE" ? "RELEASE" : transition === "RETURN" ? "RETURN" : "UPDATE",
      reason: `${scope} (${scenario})${perm.singleActor ? " — single-actor release" : ""}${note ? `: ${note}` : ""}`,
    });

    if (transition === "RELEASE") {
      const { data: states } = await supabase
        .from("cost_structure_scope_state")
        .select("status")
        .eq("version_id", versionId);
      const allReleased = (states ?? []).length === 4 && (states ?? []).every((s: { status: string }) => s.status === "RELEASED");
      if (allReleased) {
        await supabase
          .from("cost_structure_version")
          .update({ status: "RETIRED" })
          .eq("product_id", version.product_id)
          .eq("status", "RELEASED");
        await supabase
          .from("cost_structure_version")
          .update({ status: "RELEASED", released_at: now })
          .eq("id", versionId);
        await writeAuditLog(supabase, {
          entityType: "cost_structure_version",
          entityId: versionId,
          actorId: actor.id,
          action: "RELEASE",
          reason: `v${version.version_no} RELEASED — harga dasar excl. VAT Rp ${Math.round(result.listPriceExVat).toLocaleString("id-ID")}, GM standar ${(result.standardGm * 100).toFixed(2)}%`,
        });
      }
    }

    revalidatePath(`/cost-structure/${versionId}`);
    revalidatePath("/cost-structure");
    revalidatePath("/price-estimate");
    return { ok: true };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, "Gagal menjalankan aksi.");
  }
}
