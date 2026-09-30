"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { canManageProductMasterData } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  isNextControlFlowError,
  toActionError,
  type ActionResult,
} from "@/lib/actionResult";

const ProductSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  make: z.string().optional(),
  model: z.string().optional(),
  variant_type: z.string().optional(),
  variant: z.string().optional(),
  wheelbase: z.string().optional(),
  battery_kwh: z.coerce.number().optional(),
  body_application: z.string().optional(),
  build_type: z.string().optional(),
  loco: z.string().optional(),
  document_description: z.string().optional(),
});

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * FR-1.5.1 — Product Master Data, managed by Product Owner. Separate
 * from cost structure: this is spec/image/brochure content that flows
 * into the quotation document (FR-1.5.2/FR-1.5.3), not a cost item.
 */
export async function createProductAction(formData: FormData): Promise<ActionResult> {
  try {
    const profile = await requireProfile();
    if (!canManageProductMasterData(profile)) {
      throw new Error("Hanya Product Owner / System Admin yang dapat mengelola produk.");
    }

    const opt = (k: string) => (formData.get(k) ? String(formData.get(k)) : undefined);
    const parsed = ProductSchema.parse({
      code: formData.get("code"),
      name: formData.get("name"),
      make: opt("make"),
      model: opt("model"),
      variant_type: opt("variant_type"),
      variant: opt("variant"),
      wheelbase: opt("wheelbase"),
      battery_kwh: opt("battery_kwh"),
      body_application: opt("body_application"),
      build_type: opt("build_type"),
      loco: opt("loco"),
      document_description: opt("document_description"),
    });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("product_master_data")
      .insert({
        ...parsed,
        battery_kwh: parsed.battery_kwh ?? null,
        chassis_variant: parsed.wheelbase ?? null,
        body_variant: parsed.body_application ?? null,
        document_description: parsed.document_description ?? parsed.name,
        default_inclusions: lines(formData.get("default_inclusions")),
        default_exclusions: lines(formData.get("default_exclusions")),
        image_urls: lines(formData.get("image_urls")),
        status: "ACTIVE",
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await writeAuditLog(supabase, {
      entityType: "product_master_data",
      entityId: data.id,
      actorId: profile.id,
      action: "CREATE",
      fieldChanges: [
        { field: "code", old: null, new: parsed.code },
        { field: "name", old: null, new: parsed.name },
      ],
    });

    revalidatePath("/master-data/product");
    return { ok: true };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, "Gagal menyimpan produk.");
  }
}

export async function toggleProductStatusAction(id: string, nextStatus: "ACTIVE" | "DISCONTINUED") {
  const profile = await requireProfile();
  if (!canManageProductMasterData(profile)) {
    throw new Error("Hanya Product Owner / System Admin yang dapat mengelola produk.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_master_data")
    .update({ status: nextStatus })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await writeAuditLog(supabase, {
    entityType: "product_master_data",
    entityId: id,
    actorId: profile.id,
    action: "UPDATE",
    fieldChanges: [{ field: "status", old: null, new: nextStatus }],
  });

  revalidatePath("/master-data/product");
}
