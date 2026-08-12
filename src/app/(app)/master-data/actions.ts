"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  isNextControlFlowError,
  toActionError,
  type ActionResult,
} from "@/lib/actionResult";

const CostItemSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  category: z.enum(["DIRECT", "INDIRECT", "MARGIN_FACTOR"]),
  subcategory: z.string().min(1),
  owner_department_id: z.string().uuid(),
  unit_type: z.enum(["FIXED", "PER_UNIT", "PERCENTAGE"]),
  is_mandatory: z.coerce.boolean(),
  description: z.string().optional(),
});

export async function createCostItemAction(formData: FormData) {
  const profile = await requireProfile();
  if (profile.role !== "SYSTEM_ADMIN") {
    throw new Error("Hanya System Admin yang dapat mengelola master data (FR-2.1).");
  }

  const parsed = CostItemSchema.parse({
    code: formData.get("code"),
    name: formData.get("name"),
    category: formData.get("category"),
    subcategory: formData.get("subcategory"),
    owner_department_id: formData.get("owner_department_id"),
    unit_type: formData.get("unit_type"),
    is_mandatory: formData.get("is_mandatory") === "on",
    description: formData.get("description") || undefined,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cost_item")
    .insert(parsed)
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await writeAuditLog(supabase, {
    entityType: "cost_item",
    entityId: data.id,
    actorId: profile.id,
    action: "CREATE",
    fieldChanges: Object.entries(parsed).map(([field, value]) => ({
      field,
      old: null,
      new: value,
    })),
  });

  revalidatePath("/master-data");
}

export async function toggleCostItemActiveAction(id: string, nextActive: boolean) {
  const profile = await requireProfile();
  if (profile.role !== "SYSTEM_ADMIN") {
    throw new Error("Hanya System Admin yang dapat mengelola master data.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cost_item")
    .update({ active: nextActive })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await writeAuditLog(supabase, {
    entityType: "cost_item",
    entityId: id,
    actorId: profile.id,
    action: "UPDATE",
    fieldChanges: [{ field: "active", old: !nextActive, new: nextActive }],
  });

  revalidatePath("/master-data");
}

const ExchangeRateSchema = z.object({
  rate: z.coerce.number().positive(),
  source: z.string().min(1).default("manual"),
});

/**
 * FR-1.4.2 — record a new USD→IDR rate. Rates are append-only: a change
 * inserts a row rather than editing the old one, so a quotation priced
 * yesterday can still be explained with yesterday's rate.
 */
export async function createExchangeRateAction(formData: FormData): Promise<ActionResult> {
  try {
    const profile = await requireProfile();
    if (profile.role !== "SYSTEM_ADMIN") {
      throw new Error("Hanya System Admin yang dapat memperbarui kurs.");
    }

    const parsed = ExchangeRateSchema.parse({
      rate: formData.get("rate"),
      source: formData.get("source") || "manual",
    });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("exchange_rate")
      .insert({
        base_currency: "USD",
        quote_currency: "IDR",
        rate: parsed.rate,
        source: parsed.source,
        effective_from: new Date().toISOString(),
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await writeAuditLog(supabase, {
      entityType: "exchange_rate",
      entityId: data.id,
      actorId: profile.id,
      action: "RATE_UPDATE",
      fieldChanges: [{ field: "rate", old: null, new: parsed.rate }],
    });

    revalidatePath("/master-data");
    return { ok: true };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, "Gagal menyimpan kurs.");
  }
}

const MineralIndexSchema = z.object({
  mineral_code: z.string().min(1),
  hma_value: z.coerce.number().nonnegative(),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  regulation_ref: z.string().optional(),
});

/**
 * FR-8.1 — record the periodic HMA published by ESDM. Also append-only,
 * so an old quotation's mineral basis stays reconstructable.
 */
export async function createMineralIndexAction(formData: FormData): Promise<ActionResult> {
  try {
    const profile = await requireProfile();
    if (profile.role !== "SYSTEM_ADMIN") {
      throw new Error("Hanya System Admin yang dapat memperbarui HMA.");
    }

    const parsed = MineralIndexSchema.parse({
      mineral_code: formData.get("mineral_code"),
      hma_value: formData.get("hma_value"),
      period_start: formData.get("period_start"),
      period_end: formData.get("period_end"),
      regulation_ref: formData.get("regulation_ref") || undefined,
    });

    if (new Date(parsed.period_end) < new Date(parsed.period_start)) {
      throw new Error("Periode akhir tidak boleh lebih awal dari periode mulai.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mineral_index_snapshot")
      .insert({
        mineral_code: parsed.mineral_code.toUpperCase(),
        hma_value: parsed.hma_value,
        period_start: parsed.period_start,
        period_end: parsed.period_end,
        regulation_ref: parsed.regulation_ref ?? null,
        source: "manual",
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await writeAuditLog(supabase, {
      entityType: "mineral_index_snapshot",
      entityId: data.id,
      actorId: profile.id,
      action: "MINERAL_INDEX_UPDATE",
      fieldChanges: [
        { field: "mineral_code", old: null, new: parsed.mineral_code },
        { field: "hma_value", old: null, new: parsed.hma_value },
      ],
    });

    revalidatePath("/master-data");
    return { ok: true };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, "Gagal menyimpan HMA.");
  }
}
