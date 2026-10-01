import type { SupabaseClient } from "@supabase/supabase-js";
import type { Actor } from "@/types/database";
import { canAccessMenu, loadMenuAccess } from "@/lib/menuAccess";

/**
 * Who may use Price Estimate follows the menu access matrix (Settings →
 * Akses Menu, PRD FR-5.7) — one policy for the sidebar, the page and the
 * server action.
 */
export async function canUsePriceEstimate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  actor: Actor
): Promise<boolean> {
  return canAccessMenu(actor, "price_estimate", await loadMenuAccess(supabase));
}
