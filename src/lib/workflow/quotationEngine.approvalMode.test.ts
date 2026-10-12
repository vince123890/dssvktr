import { describe, expect, it } from "vitest";
import { writableDb, type Tables } from "@/test/writableDb";
import { advanceFrom, attachSignedDocument, releaseQuotation, releaseWithoutSignedDocument } from "./quotationEngine";
import type { Actor, PricingProposal, WorkflowInstance, WorkflowStepInstance } from "@/types/database";

const salesperson = { id: "sp1", app_role_code: "SALES_EXECUTIVE" } as unknown as Actor;
const headOfSales = { id: "hos", app_role_code: "HEAD_OF_SALES" } as unknown as Actor;

const ladder = [
  { tier: 1, business_line: null, workflow_template_code: null, gpm_lower_bound_pct: 15, gpm_upper_bound_pct: null, decision_slots: [], cc_slots: [], is_active: true },
  { tier: 2, business_line: null, workflow_template_code: null, gpm_lower_bound_pct: 10, gpm_upper_bound_pct: 15, decision_slots: ["COGS_OWNER", "PROFITABILITY_OWNER"], cc_slots: [], is_active: true },
  { tier: 3, business_line: null, workflow_template_code: null, gpm_lower_bound_pct: null, gpm_upper_bound_pct: 10, decision_slots: ["role:CCO", "role:CFO"], cc_slots: ["COGS_OWNER"], is_active: true },
];

function proposal(over: Record<string, unknown> = {}): PricingProposal {
  return {
    id: "p1",
    proposal_number: "PRC-2026-0001",
    document_number: "0007/L/VKTR/PUR-EFS/10-2026",
    business_line: "B2B_COMMERCIAL_FLEET",
    workflow_template_code: null,
    current_status: "PENDING_SALES_OPERATIONS",
    current_version_id: "v1",
    approval_mode: "NONE",
    gm: 0.12,
    tier_round: 0,
    outcome: "PENDING",
    valid_until: "2026-11-30",
    supersedes_proposal_id: null,
    signed_document_path: null,
    ...over,
  } as unknown as PricingProposal;
}

function reviewStep(): WorkflowStepInstance {
  return {
    id: "s2",
    workflow_instance_id: "wi1",
    step_order: 2,
    action_kind: "REVIEW_AND_ROUTE",
    status: "PENDING",
    sla_hours: 24,
    status_label: "PENDING_HEAD_OF_SALES_REVIEW",
  } as unknown as WorkflowStepInstance;
}

function world(p: PricingProposal, extra: Tables = {}) {
  return writableDb({
    pricing_proposal: [{ ...p }, { id: "old", current_status: "QUOTATION_RELEASED" }],
    workflow_step_instance: [{ ...reviewStep() }],
    workflow_instance: [{ id: "wi1", proposal_version_id: "v1", status: "RUNNING", created_at: "2026-10-01" }],
    margin_tier_authority: ladder.map((l) => ({ ...l })),
    tier_approval: [],
    audit_log_entry: [],
    ...extra,
  });
}

const row = (db: ReturnType<typeof world>, table: string, id: string) =>
  (db.tables[table] as Record<string, unknown>[]).find((r) => r.id === id)!;

async function advance(db: ReturnType<typeof world>, p: PricingProposal) {
  const step = reviewStep();
  await advanceFrom(
    db,
    {
      proposal: p,
      instance: { id: "wi1" } as unknown as WorkflowInstance,
      steps: [step],
      actor: salesperson,
      initiatorFunctions: ["SALESPERSON"],
    },
    1
  );
}

describe("approval_mode = NONE (tanpa approval Head of Sales)", () => {
  it("melewati review Head of Sales dan tetap meminta approval tier bila GM < 15%", async () => {
    const p = proposal({ gm: 0.12 }); // Tier 2
    const db = world(p);
    await advance(db, p);
    expect(row(db, "workflow_step_instance", "s2").status).toBe("SKIPPED_NOT_APPLICABLE");
    expect(row(db, "pricing_proposal", "p1").current_status).toBe("PENDING_OWNER_APPROVAL");
    const slots = (db.tables.tier_approval as { slot: string; kind: string }[]).filter((t) => t.kind === "DECISION").map((t) => t.slot);
    expect(slots.sort()).toEqual(["COGS_OWNER", "PROFITABILITY_OWNER"]);
  });

  it("Tier 3 melewati Pricing Committee, bukan Head of Sales", async () => {
    const p = proposal({ gm: 0.08 });
    const db = world(p);
    await advance(db, p);
    expect(row(db, "pricing_proposal", "p1").current_status).toBe("PENDING_PRICING_COMMITTEE_APPROVAL");
  });

  it("mencatat langkah dilewati di audit trail", async () => {
    const p = proposal({ gm: 0.12 });
    const db = world(p);
    await advance(db, p);
    const actions = (db.tables.audit_log_entry as { action: string }[]).map((a) => a.action);
    expect(actions).toContain("STEP_SKIPPED");
    expect(actions).toContain("TIER_ROUTE");
  });

  it("bila rilis otomatis tidak bisa jalan, diteruskan ke Head of Sales (tidak tersangkut)", async () => {
    const p = proposal({ gm: 0.2 });
    const db = world(p, { margin_tier_authority: [] }); // tangga tier belum dikonfigurasi → routing gagal
    await advance(db, p);
    expect(row(db, "workflow_step_instance", "s2").status).toBe("IN_PROGRESS");
    expect(row(db, "pricing_proposal", "p1").current_status).toBe("PENDING_HEAD_OF_SALES_REVIEW");
    const reasons = (db.tables.audit_log_entry as { reason: string }[]).map((a) => a.reason).join(" | ");
    expect(reasons).toMatch(/Rilis otomatis .* gagal/);
  });
});

describe("rilis: lampiran tanda tangan bersifat opsional", () => {
  const approved = () => proposal({ current_status: "PENDING_SIGNED_DOCUMENT", approval_mode: "HEAD_OF_SALES" });

  it("rilis tanpa lampiran: Released, released_at terisi, tanpa jejak lampiran", async () => {
    const p = approved();
    const db = world(p);
    await releaseWithoutSignedDocument(db, p, salesperson);
    const r = row(db, "pricing_proposal", "p1");
    expect(r.current_status).toBe("QUOTATION_RELEASED");
    expect(typeof r.released_at).toBe("string");
    expect(r.signed_document_path ?? null).toBeNull();
    expect((db.tables.audit_log_entry as { reason: string }[])[0].reason).toMatch(/tanpa lampiran/);
  });

  it("rilis tanpa lampiran hanya dari status disetujui/menunggu rilis", async () => {
    const p = proposal({ current_status: "QUOTATION_RELEASED" });
    await expect(releaseWithoutSignedDocument(world(p), p, salesperson)).rejects.toThrow(/menunggu rilis/);
  });

  it("revisi yang dirilis tanpa lampiran tetap menggantikan pendahulunya", async () => {
    const p = proposal({ current_status: "PENDING_SIGNED_DOCUMENT", supersedes_proposal_id: "old" });
    const db = world(p);
    await releaseWithoutSignedDocument(db, p, salesperson);
    expect(row(db, "pricing_proposal", "old").current_status).toBe("SUPERSEDED");
  });

  it("lampiran setelah rilis hanya menyimpan berkas (tanggal rilis tidak berubah), lalu dapat diganti", async () => {
    const p = proposal({ current_status: "QUOTATION_RELEASED", released_at: "2026-10-01T00:00:00.000Z" });
    const db = world(p);
    await attachSignedDocument(db, p, salesperson, "signed/p1/a.pdf");
    let r = row(db, "pricing_proposal", "p1");
    expect(r.current_status).toBe("QUOTATION_RELEASED");
    expect(r.signed_document_path).toBe("signed/p1/a.pdf");
    expect(r.released_at).toBe("2026-10-01T00:00:00.000Z");

    await attachSignedDocument(db, { ...p, signed_document_path: "signed/p1/a.pdf" } as PricingProposal, salesperson, "signed/p1/b.pdf");
    r = row(db, "pricing_proposal", "p1");
    expect(r.signed_document_path).toBe("signed/p1/b.pdf");
    expect((db.tables.audit_log_entry as { reason: string }[]).map((a) => a.reason).join("|")).toMatch(/diganti/);
  });

  it("lampiran pada status lain ditolak", async () => {
    const p = proposal({ current_status: "DRAFT" });
    await expect(attachSignedDocument(world(p), p, salesperson, "x")).rejects.toThrow(/disetujui .* atau sudah dirilis/);
  });

  it("releaseQuotation memberi catatan audit yang dikirim pemanggil", async () => {
    const p = approved();
    const db = world(p);
    await releaseQuotation(db, p, headOfSales, { note: "Catatan uji" });
    expect((db.tables.audit_log_entry as { reason: string; action: string }[])[0]).toMatchObject({ action: "RELEASE", reason: "Catatan uji" });
  });
});
