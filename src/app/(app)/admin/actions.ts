"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function toggleWorkflowDefinitionActiveAction(id: string, nextActive: boolean) {
  const profile = await requireProfile();
  if (profile.role !== "SYSTEM_ADMIN") {
    throw new Error("Hanya System Admin yang dapat mengubah konfigurasi workflow (FR-2.1).");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("workflow_definition")
    .update({ is_active: nextActive })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await writeAuditLog(supabase, {
    entityType: "workflow_definition",
    entityId: id,
    actorId: profile.id,
    action: "UPDATE",
    fieldChanges: [{ field: "is_active", old: !nextActive, new: nextActive }],
  });

  revalidatePath("/admin");
}
