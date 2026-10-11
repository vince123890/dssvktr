"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { actorCanUseMenu, canViewProject } from "@/lib/menuAccess";
import { canRecordProjectProgress, canSetPaymentTerms, canUpdatePaymentStatus } from "@/lib/rbac";
import { buildStoragePath, removeFile, uploadFile, validateUpload } from "@/lib/files";
import { isNextControlFlowError, toActionError, type ActionResult } from "@/lib/actionResult";
import { validateTermInput } from "@/lib/projects";
import type { Actor, PricingProposal, Project, ProjectPaymentTerm } from "@/types/database";

type Db = Awaited<ReturnType<typeof createClient>>;

interface Ctx {
  supabase: Db;
  actor: Actor;
  project: Project;
  proposal: PricingProposal;
}

/** Loads the project and enforces menu + row visibility (a hidden project "does not exist"). */
async function run(projectId: string, fallback: string, fn: (ctx: Ctx) => Promise<void>): Promise<ActionResult> {
  try {
    const [actor, supabase] = await Promise.all([requireProfile(), createClient()]);
    if (!(await actorCanUseMenu(actor, "projects"))) throw new Error("Project tidak ditemukan.");
    const { data: project } = await supabase.from("project").select("*").eq("id", projectId).maybeSingle();
    if (!project) throw new Error("Project tidak ditemukan.");
    const { data: proposal } = await supabase
      .from("pricing_proposal")
      .select("*")
      .eq("id", (project as Project).proposal_id)
      .single();
    if (!proposal || !canViewProject(actor, proposal as PricingProposal)) throw new Error("Project tidak ditemukan.");
    await fn({ supabase, actor, project: project as Project, proposal: proposal as PricingProposal });
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    return toActionError(e, fallback);
  }
}

async function loadTerms(supabase: Db, projectId: string): Promise<ProjectPaymentTerm[]> {
  const { data } = await supabase.from("project_payment_term").select("*").eq("project_id", projectId).order("term_no");
  return (data ?? []) as ProjectPaymentTerm[];
}

// ---------------------------------------------------------------------
// Payment terms — set by the owning Salesperson (PRD FR-9.3)
// ---------------------------------------------------------------------

export interface TermInput {
  label: string;
  /** Exactly one of pct / amount. */
  plannedPct: number | null;
  plannedAmount: number | null;
  dueDate: string | null;
}

export async function addPaymentTermAction(projectId: string, input: TermInput): Promise<ActionResult> {
  return run(projectId, "Gagal menambah termin.", async ({ supabase, actor, project, proposal }) => {
    if (!canSetPaymentTerms(actor, proposal)) throw new Error("Hanya Salesperson pemilik project yang menetapkan termin.");
    const terms = await loadTerms(supabase, project.id);
    if (terms.some((t) => t.status === "RECEIVED")) {
      throw new Error("Termin tidak dapat diubah setelah ada termin yang diterima Finance.");
    }
    const invalid = validateTermInput(input, terms.map((t) => ({ plannedPct: t.planned_pct })));
    if (invalid) throw new Error(invalid);

    const termNo = terms.reduce((m, t) => Math.max(m, t.term_no), 0) + 1;
    const { error } = await supabase.from("project_payment_term").insert({
      project_id: project.id,
      term_no: termNo,
      label: input.label.trim(),
      planned_pct: input.plannedPct,
      planned_amount: input.plannedAmount,
      due_date: input.dueDate || null,
      created_by: actor.id,
      updated_by: actor.id,
    });
    if (error) throw new Error(error.message);
    await writeAuditLog(supabase, {
      entityType: "project",
      entityId: project.id,
      proposalId: project.proposal_id,
      actorId: actor.id,
      action: "CREATE",
      reason: `Termin ${termNo} (${input.label.trim()}) ditetapkan.`,
    });
  });
}

export async function deletePaymentTermAction(projectId: string, termId: string): Promise<ActionResult> {
  return run(projectId, "Gagal menghapus termin.", async ({ supabase, actor, project, proposal }) => {
    if (!canSetPaymentTerms(actor, proposal)) throw new Error("Hanya Salesperson pemilik project yang menetapkan termin.");
    const terms = await loadTerms(supabase, project.id);
    if (terms.some((t) => t.status === "RECEIVED")) {
      throw new Error("Termin tidak dapat diubah setelah ada termin yang diterima Finance.");
    }
    const term = terms.find((t) => t.id === termId);
    if (!term) throw new Error("Termin tidak ditemukan.");
    const { error } = await supabase.from("project_payment_term").delete().eq("id", termId);
    if (error) throw new Error(error.message);
    await writeAuditLog(supabase, {
      entityType: "project",
      entityId: project.id,
      proposalId: project.proposal_id,
      actorId: actor.id,
      action: "UPDATE",
      reason: `Termin ${term.term_no} (${term.label}) dihapus.`,
    });
  });
}

// ---------------------------------------------------------------------
// Payment status — Finance marks a term received with the transfer proof
// ---------------------------------------------------------------------

export async function markTermReceivedAction(projectId: string, termId: string, formData: FormData): Promise<ActionResult> {
  return run(projectId, "Gagal menandai termin diterima.", async ({ supabase, actor, project }) => {
    if (!canUpdatePaymentStatus(actor)) throw new Error("Hanya Finance yang mengisi status payment.");
    const terms = await loadTerms(supabase, project.id);
    const term = terms.find((t) => t.id === termId);
    if (!term) throw new Error("Termin tidak ditemukan.");
    if (term.status === "RECEIVED") throw new Error("Termin ini sudah ditandai diterima.");

    const amount = Number(String(formData.get("received_amount") ?? "").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Isi jumlah yang diterima (lebih dari 0).");
    const receivedRaw = String(formData.get("received_at") ?? "").trim();
    const receivedAt = /^\d{4}-\d{2}-\d{2}$/.test(receivedRaw) ? receivedRaw : new Date().toISOString().slice(0, 10);
    const file = formData.get("proof_file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Bukti transfer wajib diunggah.");
    const invalid = validateUpload(file);
    if (invalid) throw new Error(invalid);

    const path = buildStoragePath("payment", `${project.id}/${term.term_no}`, file.name);
    await uploadFile(supabase, path, file);
    const { error } = await supabase
      .from("project_payment_term")
      .update({ status: "RECEIVED", received_amount: amount, received_at: receivedAt, proof_path: path, updated_by: actor.id })
      .eq("id", termId)
      .eq("status", "PENDING");
    if (error) {
      await removeFile(supabase, path);
      throw new Error(error.message);
    }
    await writeAuditLog(supabase, {
      entityType: "project",
      entityId: project.id,
      proposalId: project.proposal_id,
      actorId: actor.id,
      action: "UPDATE",
      reason: `Termin ${term.term_no} (${term.label}) diterima: ${amount.toLocaleString("id-ID")} pada ${receivedAt}.`,
      fieldChanges: [{ field: `term_${term.term_no}_status`, old: "PENDING", new: "RECEIVED" }],
    });
  });
}

// ---------------------------------------------------------------------
// Progress — recorded by the Project Team (PRD FR-9.4)
// ---------------------------------------------------------------------

export interface ProgressInput {
  entryDate: string;
  statusLabel: string;
  progressPct: number;
  note: string;
}

export async function addProgressEntryAction(projectId: string, input: ProgressInput): Promise<ActionResult> {
  return run(projectId, "Gagal menyimpan progres.", async ({ supabase, actor, project }) => {
    if (!canRecordProjectProgress(actor)) throw new Error("Hanya Tim Project yang mengisi progres.");
    if (!input.statusLabel.trim()) throw new Error("Isi status project.");
    if (!Number.isInteger(input.progressPct) || input.progressPct < 0 || input.progressPct > 100) {
      throw new Error("Progres harus bilangan bulat 0–100.");
    }
    const entryDate = /^\d{4}-\d{2}-\d{2}$/.test(input.entryDate) ? input.entryDate : new Date().toISOString().slice(0, 10);

    const { error } = await supabase.from("project_progress_entry").insert({
      project_id: project.id,
      entry_date: entryDate,
      status_label: input.statusLabel.trim(),
      progress_pct: input.progressPct,
      note: input.note.trim() || null,
      created_by: actor.id,
    });
    if (error) throw new Error(error.message);
    const { error: updateError } = await supabase
      .from("project")
      .update({ current_status: input.statusLabel.trim(), current_progress_pct: input.progressPct })
      .eq("id", project.id);
    if (updateError) throw new Error(updateError.message);
    await writeAuditLog(supabase, {
      entityType: "project",
      entityId: project.id,
      proposalId: project.proposal_id,
      actorId: actor.id,
      action: "UPDATE",
      reason: `Progres: ${input.statusLabel.trim()} (${input.progressPct}%).`,
      fieldChanges: [{ field: "current_progress_pct", old: String(project.current_progress_pct), new: String(input.progressPct) }],
    });
  });
}
