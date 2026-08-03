import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve a proposal's active version id.
 *
 * `pricing_proposal.current_version_id` is the authoritative pointer, but
 * it can be null for rows created before that column existed (see
 * supabase/migrations/0005 + 0006). Falling back to the newest version
 * row keeps those proposals viewable instead of throwing on a null
 * lookup.
 */
export async function resolveCurrentVersionId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  proposal: { id: string; current_version_id: string | null }
): Promise<string | null> {
  if (proposal.current_version_id) return proposal.current_version_id;

  const { data } = await supabase
    .from("pricing_proposal_version")
    .select("id")
    .eq("proposal_id", proposal.id)
    .order("is_current", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.id) return null;

  // Heal the pointer so subsequent reads take the fast path.
  await supabase
    .from("pricing_proposal")
    .update({ current_version_id: data.id })
    .eq("id", proposal.id);

  return data.id;
}
