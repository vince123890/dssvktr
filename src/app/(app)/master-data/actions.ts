"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
