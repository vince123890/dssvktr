import type { SupabaseClient } from "@supabase/supabase-js";
import type { Actor, FunctionalRole } from "@/types/database";
import { canSeeCostStructure, hasAnyFunction } from "@/lib/rbac";

/**
 * Who may use Price Estimate is configured in Settings → Workflow (the
 * PRICE_ESTIMATE template's allowed functions). Internal roles that can
 * already see the cost structure always may.
 */
export async function canUsePriceEstimate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  actor: Actor
): Promise<boolean> {
  if (canSeeCostStructure(actor)) return true;
  const { data } = await supabase
    .from("workflow_definition")
    .select("allowed_functions")
    .eq("workflow_kind", "PRICE_ESTIMATE")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  const allowed = (data?.allowed_functions ?? ["SALESPERSON", "EXTERNAL_AGENCY"]) as FunctionalRole[];
  return hasAnyFunction(actor, allowed);
}
