"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { recalculateAndPersist } from "@/lib/pricing/calculate";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { BusinessLine } from "@/types/database";

const CreateProposalSchema = z.object({
  title: z.string().min(3),
  business_line: z.enum([
    "B2G_TENDER_BUS",
    "B2B_COMMERCIAL_FLEET",
    "CHARGING_INFRA_BUILDOUT",
  ]),
  customer_name: z.string().optional(),
  unit_quantity: z.coerce.number().int().min(1),
});

async function generateProposalNumber(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("pricing_proposal")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${year}-01-01`);
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `PRC-${year}-${seq}`;
}

export async function createProposalAction(formData: FormData) {
  const profile = await requireProfile();
  const parsed = CreateProposalSchema.parse({
    title: formData.get("title"),
    business_line: formData.get("business_line"),
    customer_name: formData.get("customer_name") || undefined,
    unit_quantity: formData.get("unit_quantity"),
  });

  const supabase = await createClient();

  const { data: template } = await supabase
    .from("cbs_template")
    .select("id")
    .eq("business_line", parsed.business_line)
    .eq("status", "active")
    .single();

  if (!template) throw new Error("Tidak ada CBS template aktif untuk lini bisnis ini.");

  const proposalNumber = await generateProposalNumber(supabase);

  const { data: proposal, error } = await supabase
    .from("pricing_proposal")
    .insert({
      proposal_number: proposalNumber,
      title: parsed.title,
      business_line: parsed.business_line,
      customer_name: parsed.customer_name,
      cbs_template_id: template.id,
      unit_quantity: parsed.unit_quantity,
      current_status: "DRAFT",
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { data: version, error: versionError } = await supabase
    .from("pricing_proposal_version")
    .insert({
      proposal_id: proposal.id,
      version_label: "v1.0",
      is_current: true,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (versionError) throw new Error(versionError.message);

  await supabase
    .from("pricing_proposal")
    .update({ current_version_id: version.id } as never)
    .eq("id", proposal.id);

  await writeAuditLog(supabase, {
    entityType: "pricing_proposal",
    entityId: proposal.id,
    proposalId: proposal.id,
    actorId: profile.id,
    action: "CREATE",
    fieldChanges: [{ field: "proposal_number", old: null, new: proposalNumber }],
  });

  redirect(`/proposals/${proposal.id}`);
}

const SaveCostLinesSchema = z.record(z.string(), z.coerce.number());

export async function saveCostLinesAction(
  proposalId: string,
  versionId: string,
  formData: FormData
) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const raw: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("cost_")) raw[key.replace("cost_", "")] = String(value || 0);
  }
  const values = SaveCostLinesSchema.parse(raw);

  const rows = Object.entries(values).map(([cost_item_id, value]) => ({
    proposal_version_id: versionId,
    cost_item_id,
    value,
    filled_by: profile.id,
    filled_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("proposal_cost_line")
      .upsert(rows, { onConflict: "proposal_version_id,cost_item_id" });
    if (error) throw new Error(error.message);
  }

  const { data: proposal } = await supabase
    .from("pricing_proposal")
    .select("*")
    .eq("id", proposalId)
    .single();

  if (!proposal) throw new Error("Proposal not found");

  await recalculateAndPersist(supabase, {
    proposalVersionId: versionId,
    cbsTemplateId: proposal.cbs_template_id,
    unitQuantity: proposal.unit_quantity,
    businessLine: proposal.business_line as BusinessLine,
  });

  await writeAuditLog(supabase, {
    entityType: "pricing_proposal_version",
    entityId: versionId,
    proposalId,
    actorId: profile.id,
    action: "RECALCULATE",
    fieldChanges: rows.map((r) => ({
      field: r.cost_item_id,
      old: null,
      new: r.value,
    })),
  });

  revalidatePath(`/proposals/${proposalId}`);
}
