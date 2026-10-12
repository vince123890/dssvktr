import { describe, expect, it } from "vitest";
import { writableDb, type Tables } from "@/test/writableDb";
import { attachSignedDocument, cancelFinalApproval, overrideExpired } from "./quotationEngine";
import type { Actor, PricingProposal } from "@/types/database";

const actor = { id: "hos", app_role_code: "HEAD_OF_SALES" } as unknown as Actor;
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

function proposal(over: Record<string, unknown> = {}): PricingProposal {
  return {
    id: "p1",
    proposal_number: "PRC-2026-0001",
    document_number: "0007/L/VKTR/PUR-EFS/10-2026",
    current_status: "PENDING_SIGNED_DOCUMENT",
    current_version_id: "v1",
    outcome: "PENDING",
    valid_until: "2026-11-30",
    supersedes_proposal_id: null,
    ...over,
  } as unknown as PricingProposal;
}

function world(p: PricingProposal, extra: Tables = {}) {
  return writableDb({
    pricing_proposal: [{ ...p }, { id: "old", current_status: "QUOTATION_RELEASED" }],
    workflow_instance: [{ id: "wi1", proposal_version_id: "v1", status: "COMPLETED", created_at: "2026-10-01" }],
    workflow_step_instance: [
      { id: "s1", workflow_instance_id: "wi1", step_order: 1, action_kind: "GENERATE_QUOTATION", status: "APPROVED", sla_hours: 24 },
      {
        id: "s2",
        workflow_instance_id: "wi1",
        step_order: 2,
        action_kind: "REVIEW_AND_ROUTE",
        status: "APPROVED",
        sla_hours: 24,
        status_label: "PENDING_HEAD_OF_SALES_REVIEW",
      },
    ],
    tier_approval: [
      { id: "t1", proposal_id: "p1", round: 1, is_void: false, decision: "APPROVE" },
      { id: "t2", proposal_id: "p1", round: 1, is_void: false, decision: "APPROVE" },
    ],
    audit_log_entry: [],
    ...extra,
  });
}

const row = (db: ReturnType<typeof world>, table: string, id: string) =>
  (db.tables[table] as Record<string, unknown>[]).find((r) => r.id === id)!;

describe("attachSignedDocument (lampiran → Released)", () => {
  it("merilis quotation, mengisi released_at dan lampiran, dan mencatat audit", async () => {
    const p = proposal();
    const db = world(p);
    await attachSignedDocument(db, p, actor, "signed/p1/ttd.pdf");
    const r = row(db, "pricing_proposal", "p1");
    expect(r.current_status).toBe("QUOTATION_RELEASED");
    expect(r.signed_document_path).toBe("signed/p1/ttd.pdf");
    expect(r.signed_document_uploaded_by).toBe("hos");
    expect(typeof r.released_at).toBe("string");
    expect((db.tables.audit_log_entry as { action: string }[]).map((a) => a.action)).toContain("RELEASE");
  });
  it("revisi: quotation pendahulu menjadi SUPERSEDED saat dirilis", async () => {
    const p = proposal({ supersedes_proposal_id: "old" });
    const db = world(p);
    await attachSignedDocument(db, p, actor, "signed/p1/ttd.pdf");
    expect(row(db, "pricing_proposal", "old").current_status).toBe("SUPERSEDED");
  });
  it("menolak bila status bukan menunggu dokumen bertanda tangan", async () => {
    const p = proposal({ current_status: "DRAFT" });
    await expect(attachSignedDocument(world(p), p, actor, "x")).rejects.toThrow(/disetujui .* atau sudah dirilis/);
  });
});

describe("cancelFinalApproval (batalkan approve final)", () => {
  it("mengembalikan ke review Head of Sales dan membersihkan nomor dokumen", async () => {
    const p = proposal();
    const db = world(p);
    await cancelFinalApproval(db, p, actor, "Harga salah");
    const r = row(db, "pricing_proposal", "p1");
    expect(r.current_status).toBe("PENDING_HEAD_OF_SALES_REVIEW");
    expect(r.document_number).toBeNull();
    expect(r.document_date).toBeNull();
    expect(r.valid_until).toBeNull();
    expect(r.current_step_order).toBe(2);
    expect(row(db, "workflow_step_instance", "s2").status).toBe("IN_PROGRESS");
    expect(row(db, "workflow_step_instance", "s1").status).toBe("APPROVED");
    expect(row(db, "workflow_instance", "wi1").status).toBe("RUNNING");
  });
  it("membatalkan putaran tier yang sudah disetujui", async () => {
    const p = proposal();
    const db = world(p);
    await cancelFinalApproval(db, p, actor, "Harga salah");
    expect((db.tables.tier_approval as { is_void: boolean }[]).every((t) => t.is_void)).toBe(true);
  });
  it("audit memuat nomor dokumen lama dan alasan", async () => {
    const p = proposal();
    const db = world(p);
    await cancelFinalApproval(db, p, actor, "Harga salah");
    const log = (db.tables.audit_log_entry as { reason: string }[])[0];
    expect(log.reason).toContain("0007/L/VKTR/PUR-EFS/10-2026");
    expect(log.reason).toContain("Harga salah");
  });
  it("wajib alasan dan hanya sebelum lampiran diunggah", async () => {
    const p = proposal();
    await expect(cancelFinalApproval(world(p), p, actor, "  ")).rejects.toThrow(/alasan/);
    const released = proposal({ current_status: "QUOTATION_RELEASED" });
    await expect(cancelFinalApproval(world(released), released, actor, "x")).rejects.toThrow(/sebelum dokumen/);
  });
});

describe("overrideExpired (Admin)", () => {
  const released = () => proposal({ current_status: "QUOTATION_RELEASED" });
  it("EXPIRE: menyatakan Expired lebih awal dan mencatat jejak override", async () => {
    const p = released();
    const db = world(p);
    await overrideExpired(db, p, actor, "EXPIRE", "Pelanggan membatalkan");
    const r = row(db, "pricing_proposal", "p1");
    expect(r.current_status).toBe("EXPIRED");
    expect(r.expired_override_by).toBe("hos");
    expect(r.expired_override_reason).toBe("Pelanggan membatalkan");
  });
  it("CLEAR: membatalkan Expired dengan tanggal berlaku baru", async () => {
    const p = proposal({ current_status: "EXPIRED" });
    const db = world(p);
    await overrideExpired(db, p, actor, "CLEAR", "Salah tanggal", tomorrow());
    const r = row(db, "pricing_proposal", "p1");
    expect(r.current_status).toBe("QUOTATION_RELEASED");
    expect(r.valid_until).toBe(tomorrow());
  });
  it("CLEAR tanpa tanggal baru yang melewati hari ini ditolak", async () => {
    const p = proposal({ current_status: "EXPIRED" });
    await expect(overrideExpired(world(p), p, actor, "CLEAR", "x")).rejects.toThrow(/tanggal berlaku/);
    await expect(overrideExpired(world(p), p, actor, "CLEAR", "x", "2020-01-01")).rejects.toThrow(/tanggal berlaku/);
  });
  it("quotation Won tidak dapat di-Expired; alasan wajib; status harus sesuai", async () => {
    const won = proposal({ current_status: "QUOTATION_RELEASED", outcome: "WON" });
    await expect(overrideExpired(world(won), won, actor, "EXPIRE", "x")).rejects.toThrow(/Won/);
    const p = released();
    await expect(overrideExpired(world(p), p, actor, "EXPIRE", " ")).rejects.toThrow(/alasan/);
    const draft = proposal({ current_status: "DRAFT" });
    await expect(overrideExpired(world(draft), draft, actor, "EXPIRE", "x")).rejects.toThrow(/Released/);
  });
});
