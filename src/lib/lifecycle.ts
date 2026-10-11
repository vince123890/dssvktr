import type { PricingProposal } from "@/types/database";

/**
 * Quotation age state for the Salesperson (PRD FR-3.4, Technical Logic
 * §4.13, v5.0). Pure and DB-free so it can be unit tested:
 *
 *   Released, no result, age counted from the RELEASE date (the day the
 *   signed document was attached):
 *     < yellowDays          → GREEN   (active)
 *     >= yellowDays         → YELLOW  (follow up)
 *     >= redDays            → RED     (make a new quotation / revision)
 *   Won stops the clock; Lost and Expired show red.
 *
 * Expired itself is the existing automatic status (valid_until passed),
 * which an Admin may also set or clear by hand — see quotationEngine.ts.
 */

export type AgeState = "GREEN" | "YELLOW" | "RED" | "WON" | "LOST" | "EXPIRED" | "NONE";

export interface AgeConfig {
  yellowDays: number;
  redDays: number;
}

export const DEFAULT_AGE_CONFIG: AgeConfig = { yellowDays: 14, redDays: 30 };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days (UTC) from `from` to `to`; never negative. */
export function daysBetween(from: string | Date, to: Date): number {
  const a = new Date(from);
  const startA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const startB = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.max(0, Math.round((startB - startA) / DAY_MS));
}

export type AgeInput = Pick<PricingProposal, "outcome" | "current_status" | "released_at">;

export function quotationAgeState(
  p: AgeInput,
  now: Date,
  cfg: AgeConfig = DEFAULT_AGE_CONFIG
): AgeState {
  if (p.outcome === "WON") return "WON";
  if (p.outcome === "LOST") return "LOST";
  if (p.current_status === "EXPIRED") return "EXPIRED";
  if (p.current_status !== "QUOTATION_RELEASED" || !p.released_at) return "NONE";
  const age = daysBetween(p.released_at, now);
  if (age >= cfg.redDays) return "RED";
  if (age >= cfg.yellowDays) return "YELLOW";
  return "GREEN";
}

export const AGE_STATE_LABEL: Record<AgeState, string> = {
  GREEN: "Aktif",
  YELLOW: "Follow up",
  RED: "Perlu quotation baru",
  WON: "Won",
  LOST: "Lost",
  EXPIRED: "Expired",
  NONE: "—",
};

export const AGE_STATE_TONE: Record<AgeState, "default" | "success" | "warning" | "danger" | "info"> = {
  GREEN: "success",
  YELLOW: "warning",
  RED: "danger",
  WON: "info",
  LOST: "danger",
  EXPIRED: "danger",
  NONE: "default",
};

export function ageConfigFrom(settings: { quotationYellowDays: number; quotationRedDays: number }): AgeConfig {
  const yellow = Number.isFinite(settings.quotationYellowDays) && settings.quotationYellowDays > 0
    ? settings.quotationYellowDays
    : DEFAULT_AGE_CONFIG.yellowDays;
  const red = Number.isFinite(settings.quotationRedDays) && settings.quotationRedDays > yellow
    ? settings.quotationRedDays
    : Math.max(DEFAULT_AGE_CONFIG.redDays, yellow + 1);
  return { yellowDays: yellow, redDays: red };
}

export interface AgeCounts {
  released: number;
  green: number;
  yellow: number;
  red: number;
  won: number;
  lost: number;
  expired: number;
}

/** Counts for the Sales dashboard. `released` = everything that ever reached Released. */
export function countAgeStates(
  proposals: (AgeInput & { signed_document_uploaded_at?: string | null })[],
  now: Date,
  cfg: AgeConfig = DEFAULT_AGE_CONFIG
): AgeCounts {
  const out: AgeCounts = { released: 0, green: 0, yellow: 0, red: 0, won: 0, lost: 0, expired: 0 };
  for (const p of proposals) {
    const s = quotationAgeState(p, now, cfg);
    if (s === "NONE") continue;
    out.released += 1;
    if (s === "GREEN") out.green += 1;
    else if (s === "YELLOW") out.yellow += 1;
    else if (s === "RED") out.red += 1;
    else if (s === "WON") out.won += 1;
    else if (s === "LOST") out.lost += 1;
    else if (s === "EXPIRED") out.expired += 1;
  }
  return out;
}
