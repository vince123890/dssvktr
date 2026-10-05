import { createClient } from "@/lib/supabase/server";
import type { Actor } from "@/types/database";
import { redirect } from "next/navigation";
import { cache } from "react";

/**
 * The signed-in user joined with their app role (v4.0 — roles are data,
 * PRD FR-5.6). Everything that authorizes an action reads the
 * functional roles on `app_role`, never the legacy `profile.role` enum.
 */
export const getCurrentProfile = cache(async (): Promise<Actor | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profile")
    .select("*, app_role:app_role_code(*)")
    .eq("id", userId)
    .single();

  return profile as Actor | null;
});

export async function requireProfile(): Promise<Actor> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * Internal pages only. An Authorized Agency account (external) reaches
 * Price Estimate and nothing else — sheet Basic Workflow B: "Only
 * internal sales".
 */
export async function requireInternal(): Promise<Actor> {
  const profile = await requireProfile();
  const fns = profile.app_role?.functional_roles ?? [];
  if (profile.app_role?.is_external || fns.includes("EXTERNAL_AGENCY")) redirect("/price-estimate");
  return profile;
}
