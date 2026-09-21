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
  chassis_variant: z.string().optional(),
  body_variant: z.string().optional(),
  image_url: z.string().optional(),
  brochure_url: z.string().optional(),
});

/**
 * FR-1.5.1 — Product Master Data, managed by Product Owner. Separate
 * from cost structure: this is spec/image/brochure content that flows
 * into the quotation document (FR-1.5.2/FR-1.5.3), not a cost item.
 */
export async function createProductAction(formData: FormData): Promise<ActionResult> {
  try {
    const profile = await requireProfile();
    if (!canManageProductMasterData(profile.role)) {
      throw new Error("Hanya Product Owner / System Admin yang dapat mengelola produk.");
    }

    const parsed = ProductSchema.parse({
      code: formData.get("code"),
      name: formData.get("name"),
      chassis_variant: formData.get("chassis_variant") || undefined,
      body_variant: formData.get("body_variant") || undefined,
      image_url: formData.get("image_url") || undefined,
      brochure_url: formData.get("brochure_url") || undefined,
    });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("product_master_data")
      .insert({
        code: parsed.code,
        name: parsed.name,
        chassis_variant: parsed.chassis_variant ?? null,
        body_variant: parsed.body_variant ?? null,
        image_urls: parsed.image_url ? [parsed.image_url] : [],
        brochure_url: parsed.brochure_url ?? null,
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
  if (!canManageProductMasterData(profile.role)) {
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
