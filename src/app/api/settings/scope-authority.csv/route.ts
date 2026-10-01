import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { canManageSettings } from "@/lib/rbac";
import type { AppRole, ScopeAuthority } from "@/types/database";

/**
 * Export of the Scope Authority matrix in the shape of sheet "Actors"
 * (Actor, Scope, Regular M/C/R, Deviation M/C/R), so VKTR can review it
 * in a spreadsheet (PRD FR-5.6).
 */
export async function GET() {
  const me = await getCurrentProfile();
  if (!me || !canManageSettings(me)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const [{ data: roles }, { data: rows }] = await Promise.all([
    supabase.from("app_role").select("*").order("sort_order"),
    supabase.from("scope_authority").select("*"),
  ]);
  const flags = (r?: ScopeAuthority) =>
    r ? [r.can_make ? "Maker" : "", r.can_check ? "Checker" : "", r.can_release ? "Releaser" : ""] : ["", "", ""];
  const lines = [["Actor", "Functional Roles", "Scope", "Regular Maker", "Regular Checker", "Regular Releaser", "Deviation Maker", "Deviation Checker", "Deviation Releaser"]];
  for (const role of (roles ?? []) as AppRole[]) {
    for (const scope of ["COGS", "ADD_ONS", "MARGIN", "SALES"]) {
      const reg = (rows ?? []).find((r: ScopeAuthority) => r.app_role_code === role.code && r.scope === scope && r.scenario === "REGULAR");
      const dev = (rows ?? []).find((r: ScopeAuthority) => r.app_role_code === role.code && r.scope === scope && r.scenario === "DEVIATION");
      if (!reg && !dev) continue;
      lines.push([role.name, role.functional_roles.join(" "), scope, ...flags(reg), ...flags(dev)]);
    }
  }
  const csv = lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="scope-authority.csv"',
    },
  });
}
