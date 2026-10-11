import { describe, expect, it } from "vitest";
import { executiveSummary, salesKpi, salesKpiByPerson } from "./dashboard";

const NOW = new Date("2026-10-30T09:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

const q = (over: Record<string, unknown> = {}) => ({
  created_by: "s1",
  current_status: "QUOTATION_RELEASED" as const,
  outcome: "PENDING" as const,
  released_at: daysAgo(1),
  transaction_value: 100,
  ...over,
});

describe("salesKpi", () => {
  it("menghitung terkirim, won, lost, expired, dan kondisi warna", () => {
    const k = salesKpi(
      [
        q(), // hijau
        q({ released_at: daysAgo(15) }), // kuning
        q({ released_at: daysAgo(40) }), // merah
        q({ outcome: "WON", transaction_value: 500 }),
        q({ outcome: "LOST" }),
        q({ current_status: "EXPIRED", released_at: daysAgo(45) }),
        q({ current_status: "SUPERSEDED", released_at: daysAgo(50) }), // terkirim tapi tidak berwarna
      ],
      NOW
    );
    expect(k).toMatchObject({ sent: 7, won: 1, lost: 1, expired: 1, green: 1, yellow: 1, red: 1, followUp: 2 });
    expect(k.wonValue).toBe(500);
    expect(k.sentValue).toBe(1100); // 6 × 100 + 500 (won)
  });
  it("quotation yang belum rilis tidak dihitung terkirim", () => {
    const k = salesKpi(
      [q({ released_at: null, current_status: "DRAFT" }), q({ released_at: null, current_status: "PENDING_SIGNED_DOCUMENT" })],
      NOW
    );
    expect(k.sent).toBe(0);
  });
});

describe("salesKpiByPerson", () => {
  it("mengelompokkan per Salesperson", () => {
    const map = salesKpiByPerson([q({ created_by: "a" }), q({ created_by: "a", outcome: "WON" }), q({ created_by: "b" })], NOW);
    expect(map.get("a")?.sent).toBe(2);
    expect(map.get("a")?.won).toBe(1);
    expect(map.get("b")?.sent).toBe(1);
  });
});

describe("executiveSummary", () => {
  it("menggabungkan quotation, PO, payment, dan progres project", () => {
    const s = executiveSummary(
      [q({ outcome: "WON", transaction_value: 1000 }), q(), q({ outcome: "LOST" }), q()],
      [
        { id: "p1", contract_value_ex_vat: 1000, current_progress_pct: 20 },
        { id: "p2", contract_value_ex_vat: 500, current_progress_pct: 100 },
        { id: "p3", contract_value_ex_vat: 300, current_progress_pct: 0 },
      ],
      [
        { project_id: "p1", status: "RECEIVED", planned_pct: 30, planned_amount: null, received_amount: 300 },
        { project_id: "p1", status: "PENDING", planned_pct: 70, planned_amount: null, received_amount: null },
        { project_id: "p2", status: "RECEIVED", planned_pct: null, planned_amount: 500, received_amount: 500 },
      ],
      NOW
    );
    expect(s.sent).toBe(4);
    expect(s.won).toBe(1);
    expect(s.winRate).toBeCloseTo(0.25);
    expect(s.poCount).toBe(3);
    expect(s.poValue).toBe(1800);
    expect(s.termCount).toBe(3);
    expect(s.termsReceived).toBe(2);
    expect(s.plannedAmount).toBe(1500);
    expect(s.receivedAmount).toBe(800);
    expect(s.projects).toEqual({ notStarted: 1, running: 1, done: 1, avgProgressPct: 40 });
  });
  it("tanpa data tidak membagi dengan nol", () => {
    const s = executiveSummary([], [], [], NOW);
    expect(s.winRate).toBe(0);
    expect(s.projects.avgProgressPct).toBe(0);
  });
});
