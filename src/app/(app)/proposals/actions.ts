"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { canInitiateQuotation } from "@/lib/rbac";
import { loadSettings } from "@/lib/settings";
import { canCreateNewQuotation } from "@/lib/workflow/duplicateGuard";
import { createProjectIdentifier } from "@/lib/workflow/projectIdentifier";
import { generateProposalNumber } from "@/lib/workflow/proposalNumber";
import { isNextControlFlowError, toActionError } from "@/lib/actionResult";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Sheet "Basic Workflow" B, steps 1–3: the Salesperson fills the KYC
 * form (8 fields, 6 mandatory) and the vehicles to quote, reviews it on
 * screen, and saves a draft. Submitting (step 4 onward) lives in
 * [id]/quotation-actions.ts.
 */

const LineSchema = z.object({
  // Not .uuid(): seed ids (e.g. "55555555-...-0011") aren't RFC 4122
  // valid; the FK constraint on insert is the real authority.
  product_id: z.string().min(1),
  quantity: z.coerce.number().int().min(1, "Kuantitas minimal 1"),
});

const KycSchema = z.object({
  company_name: z.string().trim().min(2, "a. Nama perusahaan wajib diisi"),
  official_address: z.string().trim().min(5, "a. Alamat resmi lengkap wajib diisi"),
  project_name: z.string().trim().min(2, "Nama proyek/lokasi wajib diisi"),
  project_type: z.enum(["NEW_PROJECT", "ADDITIONAL_RUNNING_PROJECT", "REPLACEMENT"]),
  existing_project_identifier_id: z.string().optional(),
  application_body: z.string().trim().min(2, "d. Aplikasi (bodi) wajib diisi"),
  utilization_content: z.string().trim().min(2, "d. Utilisasi (muatan) wajib diisi"),
  route_description: z.string().trim().min(2, "e. Rute wajib diisi"),
  origin: z.string().trim().min(2, "e. Asal wajib diisi"),
  destination: z.string().trim().min(2, "e. Tujuan wajib diisi"),
  production_value: z.coerce.number().positive("e. Nilai produksi wajib diisi"),
  production_unit: z.string().trim().min(1, "e. Satuan produksi wajib diisi"),
  production_period: z.enum(["TRIP", "CYCLE", "DAY", "MONTH", "OTHER"]),
  likelihood: z.coerce.number().int().min(1).max(5),
  gap_identified: z.string().trim().min(3, "g. Gap identified wajib diisi"),
  other_information: z.string().optional(),
  requested_scheme: z.enum(["PURCHASE", "RENTAL"]).default("PURCHASE"),
});

const QuotationInputSchema = z.object({
  business_line: z.enum(["B2G_TENDER_BUS", "B2B_COMMERCIAL_FLEET", "CHARGING_INFRA_BUILDOUT"]),
  kyc: KycSchema,
  lines: z.array(LineSchema).min(1, "b. Minimal satu varian kendaraan & kuantitas"),
});

export type QuotationInput = z.input<typeof QuotationInputSchema>;

export interface SaveQuotationResult {
  ok: boolean;
  error?: string;
  proposalId?: string;
}

function titleFor(kyc: { company_name: string }, lines: { quantity: number }[]): string {
  const units = lines.reduce((s, l) => s + l.quantity, 0);
  return `${units} Unit — ${kyc.company_name}`;
}

function kycSnapshot(kyc: z.infer<typeof KycSchema>) {
  // The project identifier id is routing information, not KYC content.
  const { existing_project_identifier_id: _unused, ...rest } = kyc;
  void _unused;
  return rest;
}

export async function createQuotationAction(input: QuotationInput): Promise<SaveQuotationResult> {
  try {
    const profile = await requireProfile();
    if (!canInitiateQuotation(profile)) {
      throw new Error(
        "Official Quotation hanya dapat diajukan oleh sales internal (Sales Executive / Sales Lead)."
      );
    }
    const parsed = QuotationInputSchema.parse(input);
    const supabase = await createClient();
    const settings = await loadSettings(supabase);

    const guard = await canCreateNewQuotation(supabase, {
      salespersonId: profile.id,
      companyName: parsed.kyc.company_name,
      productIds: parsed.lines.map((l) => l.product_id),
      maxPerDay: settings.fraudGuardMaxPerDay,
    });
    if (!guard.allowed) throw new Error(guard.reason);

    // KYC c: a new project gets a new identifier; an addition to (or a
    // replacement for) a running project reuses the existing one.
    let projectIdentifierId: string;
    if (parsed.kyc.project_type === "NEW_PROJECT") {
      const project = await createProjectIdentifier(supabase, {
        customerName: parsed.kyc.company_name,
        projectName: parsed.kyc.project_name,
        createdBy: profile.id,
      });
      projectIdentifierId = project.id;
    } else {
      if (!parsed.kyc.existing_project_identifier_id) {
        throw new Error("c. Pilih Project Identifier proyek berjalan yang ditambah/diganti.");
      }
      projectIdentifierId = parsed.kyc.existing_project_identifier_id;
    }

    const { data: template } = await supabase
      .from("cbs_template")
      .select("id")
      .eq("status", "active")
      .order("version", { ascending: false })
      .limit(1)
      .single();
    if (!template) throw new Error("Tidak ada CBS master data aktif.");

    const proposalNumber = await generateProposalNumber(supabase);

    const { data: proposal, error } = await supabase
      .from("pricing_proposal")
      .insert({
        proposal_number: proposalNumber,
        title: titleFor(parsed.kyc, parsed.lines),
        business_line: parsed.business_line,
        customer_name: parsed.kyc.company_name,
        cbs_template_id: template.id,
        project_identifier_id: projectIdentifierId,
        unit_quantity: parsed.lines.reduce((s, l) => s + l.quantity, 0),
        input_currency: "CNY",
        current_status: "DRAFT",
        kyc: kycSnapshot(parsed.kyc),
        initiator_role_code: profile.app_role_code,
        account_person_ids: [profile.id],
        created_by: profile.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { data: version, error: versionError } = await supabase
      .from("pricing_proposal_version")
      .insert({ proposal_id: proposal.id, version_label: "v1.0", is_current: true, created_by: profile.id })
      .select("id")
      .single();
    if (versionError) throw new Error(versionError.message);

    await supabase.from("pricing_proposal").update({ current_version_id: version.id }).eq("id", proposal.id);

    const { error: lineError } = await supabase.from("quotation_line_item").insert(
      parsed.lines.map((l, i) => ({
        proposal_id: proposal.id,
        product_id: l.product_id,
        quantity: l.quantity,
        sort_order: i,
        scheme: parsed.kyc.requested_scheme,
      }))
    );
    if (lineError) throw new Error(lineError.message);

    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: proposal.id,
      proposalId: proposal.id,
      actorId: profile.id,
      action: "CREATE",
      fieldChanges: [
        { field: "proposal_number", old: null, new: proposalNumber },
        { field: "company_name", old: null, new: parsed.kyc.company_name },
        { field: "lines", old: null, new: parsed.lines.length },
      ],
    });

    revalidatePath("/proposals");
    return { ok: true, proposalId: proposal.id };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.issues.map((i) => i.message).join(" · ") };
    }
    return toActionError(e, "Gagal menyimpan quotation.");
  }
}

/** Edits a DRAFT (e.g. after a Sales Lead sent it back). */
export async function updateQuotationDraftAction(
  proposalId: string,
  input: QuotationInput
): Promise<SaveQuotationResult> {
  try {
    const profile = await requireProfile();
    const parsed = QuotationInputSchema.parse(input);
    const supabase = await createClient();

    const { data: proposal } = await supabase
      .from("pricing_proposal")
      .select("id, current_status, created_by, kyc")
      .eq("id", proposalId)
      .single();
    if (!proposal) throw new Error("Quotation tidak ditemukan.");
    if (proposal.current_status !== "DRAFT") throw new Error("Hanya quotation DRAFT yang dapat diubah.");
    if (proposal.created_by !== profile.id) throw new Error("Hanya pengaju yang dapat mengubah draft ini.");

    await supabase
      .from("pricing_proposal")
      .update({
        title: titleFor(parsed.kyc, parsed.lines),
        business_line: parsed.business_line,
        customer_name: parsed.kyc.company_name,
        unit_quantity: parsed.lines.reduce((s, l) => s + l.quantity, 0),
        kyc: kycSnapshot(parsed.kyc),
      })
      .eq("id", proposalId);

    await supabase.from("quotation_line_item").delete().eq("proposal_id", proposalId);
    const { error: lineError } = await supabase.from("quotation_line_item").insert(
      parsed.lines.map((l, i) => ({
        proposal_id: proposalId,
        product_id: l.product_id,
        quantity: l.quantity,
        sort_order: i,
        scheme: parsed.kyc.requested_scheme,
      }))
    );
    if (lineError) throw new Error(lineError.message);

    await writeAuditLog(supabase, {
      entityType: "pricing_proposal",
      entityId: proposalId,
      proposalId,
      actorId: profile.id,
      action: "UPDATE",
      reason: "Draft KYC/varian diperbarui",
    });

    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, proposalId };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.issues.map((i) => i.message).join(" · ") };
    }
    return toActionError(e, "Gagal menyimpan draft.");
  }
}
