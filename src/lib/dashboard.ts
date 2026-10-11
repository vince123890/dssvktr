import type { PricingProposal } from "@/types/database";
import { DEFAULT_AGE_CONFIG, quotationAgeState, type AgeConfig } from "./lifecycle";
import { paymentSummary } from "./projects";

/**
 * Dashboard aggregates (PRD Module 10, Technical Logic §4.15, v5.0). Pure:
 * the pages load rows, these functions only count. Nothing here touches
 * cost structure, GM or tier — the executive view is deliberately
 * commercial-outcome only.
 */

type KpiProposal = Pick<
  PricingProposal,
  "created_by" | "current_status" | "outcome" | "released_at" | "transaction_value"
>;

export interface SalesKpi {
  /** Quotations that were ever released (signed document attached), incl. later superseded ones. */
  sent: number;
  won: number;
  lost: number;
  expired: number;
  green: number;
  yellow: number;
  red: number;
  /** Yellow + red that still need a decision: the follow-up list (PRD FR-10.1). */
  followUp: number;
  sentValue: number;
  wonValue: number;
}

export function salesKpi(proposals: KpiProposal[], now: Date, cfg: AgeConfig = DEFAULT_AGE_CONFIG): SalesKpi {
  const k: SalesKpi = {
    sent: 0, won: 0, lost: 0, expired: 0, green: 0, yellow: 0, red: 0, followUp: 0, sentValue: 0, wonValue: 0,
  };
  for (const p of proposals) {
    if (!p.released_at) continue;
    const value = Number(p.transaction_value || 0);
    k.sent += 1;
    k.sentValue += value;
    if (p.outcome === "WON") {
      k.won += 1;
      k.wonValue += value;
      continue;
    }
    if (p.outcome === "LOST") {
      k.lost += 1;
      continue;
    }
    const state = quotationAgeState(p, now, cfg);
    if (state === "EXPIRED") k.expired += 1;
    else if (state === "GREEN") k.green += 1;
    else if (state === "YELLOW") k.yellow += 1;
    else if (state === "RED") k.red += 1;
  }
  k.followUp = k.yellow + k.red;
  return k;
}

/** One KPI row per Salesperson (the creator of the quotation). */
export function salesKpiByPerson(
  proposals: KpiProposal[],
  now: Date,
  cfg: AgeConfig = DEFAULT_AGE_CONFIG
): Map<string, SalesKpi> {
  const groups = new Map<string, KpiProposal[]>();
  for (const p of proposals) groups.set(p.created_by, [...(groups.get(p.created_by) ?? []), p]);
  return new Map([...groups].map(([id, rows]) => [id, salesKpi(rows, now, cfg)]));
}

export interface ExecutiveSummary {
  sent: number;
  won: number;
  lost: number;
  expired: number;
  /** won / sent, 0–1 (0 when nothing was sent). */
  winRate: number;
  poCount: number;
  poValue: number;
  termCount: number;
  termsReceived: number;
  plannedAmount: number;
  receivedAmount: number;
  projects: { notStarted: number; running: number; done: number; avgProgressPct: number };
}

interface ProjectLike {
  id: string;
  contract_value_ex_vat: number;
  current_progress_pct: number;
}
interface TermLike {
  project_id: string;
  status: "PENDING" | "RECEIVED";
  planned_pct: number | null;
  planned_amount: number | null;
  received_amount: number | null;
}

export function executiveSummary(
  proposals: KpiProposal[],
  projects: ProjectLike[],
  terms: TermLike[],
  now: Date,
  cfg: AgeConfig = DEFAULT_AGE_CONFIG
): ExecutiveSummary {
  const k = salesKpi(proposals, now, cfg);
  const pay = projects.reduce(
    (acc, p) => {
      const s = paymentSummary(terms.filter((t) => t.project_id === p.id), Number(p.contract_value_ex_vat));
      return {
        termCount: acc.termCount + s.termCount,
        receivedCount: acc.receivedCount + s.receivedCount,
        plannedAmount: acc.plannedAmount + s.plannedAmount,
        receivedAmount: acc.receivedAmount + s.receivedAmount,
      };
    },
    { termCount: 0, receivedCount: 0, plannedAmount: 0, receivedAmount: 0 }
  );
  const progress = projects.map((p) => Number(p.current_progress_pct));
  return {
    sent: k.sent,
    won: k.won,
    lost: k.lost,
    expired: k.expired,
    winRate: k.sent > 0 ? k.won / k.sent : 0,
    poCount: projects.length,
    poValue: projects.reduce((s, p) => s + Number(p.contract_value_ex_vat), 0),
    termCount: pay.termCount,
    termsReceived: pay.receivedCount,
    plannedAmount: pay.plannedAmount,
    receivedAmount: pay.receivedAmount,
    projects: {
      notStarted: progress.filter((x) => x === 0).length,
      running: progress.filter((x) => x > 0 && x < 100).length,
      done: progress.filter((x) => x >= 100).length,
      avgProgressPct: progress.length ? Math.round(progress.reduce((s, x) => s + x, 0) / progress.length) : 0,
    },
  };
}
