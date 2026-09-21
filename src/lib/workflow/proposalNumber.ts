import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared proposal-number generator (`PRC-<year>-<seq>`). Derives the
 * next sequence from the highest existing number rather than a row
 * count: counting breaks after any deletion (e.g. a demo reset), which
 * would re-issue a number that still belongs to a later proposal and
 * collide with the unique constraint.
 */
export async function generateProposalNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<string> {
  const year = new Date().getFullYear();

  const { data: latest } = await supabase
    .from("pricing_proposal")
    .select("proposal_number")
    .like("proposal_number", `PRC-${year}-%`)
    .order("proposal_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastSeq = latest
    ? Number.parseInt(latest.proposal_number.split("-")[2] ?? "0", 10)
    : 0;

  const seq = String((Number.isNaN(lastSeq) ? 0 : lastSeq) + 1).padStart(4, "0");
  return `PRC-${year}-${seq}`;
}
