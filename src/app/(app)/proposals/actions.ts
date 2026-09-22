"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { recalculateAndPersist } from "@/lib/pricing/calculate";
import { assertCanEditCostLines } from "@/lib/workflow/editGate";
import { canCreateNewQuotation } from "@/lib/workflow/duplicateGuard";
import { createProjectIdentifier } from "@/lib/workflow/projectIdentifier";
import { generateProposalNumber } from "@/lib/workflow/proposalNumber";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateProposalSchema = z.object({
  title: z.string().min(3),
  business_line: z.enum([
    "B2G_TENDER_BUS",
    "B2B_COMMERCIAL_FLEET",
    "CHARGING_INFRA_BUILDOUT",
  ]),
  customer_name: z.string().min(1, "Nama customer wajib diisi"),
  project_name: z.string().min(1, "Nama proyek/lokasi wajib diisi"),
  // Not .uuid(): seed product_master_data ids (e.g. "55555555-...-0001")
  // aren't RFC 4122-valid, which strict uuid() rejects. The FK
  // constraint on insert is the real authority here.
  product_master_data_id: z.string().min(1).optional(),
  unit_quantity: z.coerce.number().int().min(1),
  input_currency: z.enum(["IDR", "CNY"]).default("CNY"),
});

export async function createProposalAction(formData: FormData) {
  const profile = await requireProfile();
  const parsed = CreateProposalSchema.parse({
    title: formData.get("title"),
    business_line: formData.get("business_line"),
    customer_name: formData.get("customer_name"),
    project_name: formData.get("project_name"),
    product_master_data_id: formData.get("product_master_data_id") || undefined,
    unit_quantity: formData.get("unit_quantity"),
    input_currency: formData.get("input_currency") || "CNY",
  });

  const supabase = await createClient();

  // FR-2.6 Duplicate/Fraud Guard — checked before anything else is
  // created, so a blocked attempt never leaves a half-created project
  // identifier or proposal behind.
  const guard = await canCreateNewQuotation(supabase, {
    salesOfficerId: profile.id,
    customerName: parsed.customer_name,
    productMasterDataId: parsed.product_master_data_id ?? null,
  });
  if (!guard.allowed) {
    throw new Error(guard.reason ?? "Quotation baru tidak dapat dibuat saat ini.");
  }

  // CBS is single (FR-1.1, v3.0) — there is exactly one active
  // template shared by every business line, so it is no longer
  // selected by matching business_line.
  const { data: template } = await supabase
    .from("cbs_template")
    .select("id")
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (!template) throw new Error("Tidak ada CBS master data aktif.");

  const proposalNumber = await generateProposalNumber(supabase);

  const projectIdentifier = await createProjectIdentifier(supabase, {
    customerName: parsed.customer_name,
    projectName: parsed.project_name,
    createdBy: profile.id,
  });

  const { data: proposal, error } = await supabase
    .from("pricing_proposal")
    .insert({
      proposal_number: proposalNumber,
      title: parsed.title,
      business_line: parsed.business_line,
      customer_name: parsed.customer_name,
      cbs_template_id: template.id,
      project_identifier_id: projectIdentifier.id,
      unit_quantity: parsed.unit_quantity,
      input_currency: parsed.input_currency,
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
      product_master_data_id: parsed.product_master_data_id ?? null,
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
    fieldChanges: [
      { field: "proposal_number", old: null, new: proposalNumber },
      { field: "project_identifier_code", old: null, new: projectIdentifier.identifier_code },
      { field: "input_currency", old: null, new: parsed.input_currency },
    ],
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

  const { data: proposal } = await supabase
    .from("pricing_proposal")
    .select("*")
    .eq("id", proposalId)
    .single();

  if (!proposal) throw new Error("Proposal not found");

  // Server-side write gate. The UI disables the inputs, but that is only a
  // client-side hint — without this check a direct action call could edit
  // an approved proposal or a step belonging to another department.
  await assertCanEditCostLines(supabase, proposal, profile);

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

  await recalculateAndPersist(supabase, {
    proposalId,
    proposalVersionId: versionId,
    cbsTemplateId: proposal.cbs_template_id,
    unitQuantity: proposal.unit_quantity,
    volumeDiscountPct: proposal.applied_discount_pct || undefined,
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
