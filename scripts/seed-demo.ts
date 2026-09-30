/**
 * Demo data seed (v4.0) — provisions one Supabase Auth account per role
 * of sheet "Actors" / "Basic Workflow" (docs/BTEL - Cost and Roles and
 * Flow.xlsx), RELEASED cost structures for the two demo variants and a
 * batch of historical quotations for Win/Loss Analytics.
 *
 * Usage: npm run seed:demo   (after migrations 0014–0016)
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — never expose it
 * client-side; this script only ever runs on your machine / CI.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  DEMO_PASSWORD,
  DEMO_USERS,
  RETIRED_DEMO_EMAILS,
  loadUserIds,
  seedCostStructures,
  seedHistoricalQuotations,
  wipeQuotations,
} from "./demoData";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAllUsers() {
  const all: { id: string; email?: string }[] = [];
  for (let page = 1; page < 20; page++) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    all.push(...(data?.users ?? []));
    if (!data || data.users.length < 200) break;
  }
  return all;
}

async function ensureDemoUsers() {
  console.log("Provisioning demo users (sheet Actors)...");
  const { data: departments } = await supabase.from("department").select("id, code");
  const deptIdByCode = Object.fromEntries((departments ?? []).map((d) => [d.code, d.id]));
  const existing = await listAllUsers();

  for (const u of DEMO_USERS) {
    const found = existing.find((x) => x.email === u.email);
    if (found) {
      // Reconcile rather than skip: an account from an older role model
      // must pick up its v4.0 app role.
      await supabase
        .from("profile")
        .update({
          full_name: u.full_name,
          role: u.role,
          department_id: deptIdByCode[u.department_code],
          app_role_code: u.app_role_code,
        })
        .eq("id", found.id);
      console.log(`  ~ ${u.email} → ${u.app_role_code}`);
      continue;
    }
    const { error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: u.full_name,
        role: u.role,
        department_code: u.department_code,
        app_role_code: u.app_role_code,
      },
    });
    if (error) console.error(`  ! Failed to create ${u.email}: ${error.message}`);
    else console.log(`  + ${u.email} (${u.app_role_code})`);
  }

  // The trigger may run before app_role rows exist on a fresh DB; make sure.
  const ids = await loadUserIds(supabase);
  for (const u of DEMO_USERS) {
    if (ids[u.email]) await supabase.from("profile").update({ app_role_code: u.app_role_code, role: u.role }).eq("id", ids[u.email]);
  }
}

/** Every column that can point at a retired profile, reassigned to admin before deletion. */
const PROFILE_REFS: [string, string][] = [
  ["pricing_proposal", "created_by"],
  ["pricing_proposal", "prepared_by"],
  ["pricing_proposal_version", "created_by"],
  ["project_identifier", "created_by"],
  ["cost_structure_version", "created_by"],
  ["cost_structure_scope_state", "maker_id"],
  ["cost_structure_scope_state", "checker_id"],
  ["cost_structure_scope_state", "releaser_id"],
  ["workflow_step_instance", "actor_id"],
  ["tier_approval", "actor_id"],
  ["price_estimate_log", "user_id"],
  ["audit_log_entry", "actor_id"],
  ["exchange_rate", "created_by"],
  ["mineral_index_snapshot", "created_by"],
  ["product_master_data", "created_by"],
  ["proposal_cost_line", "filled_by"],
  ["negotiation_request", "requested_by"],
  ["negotiation_decision", "actor_id"],
];

async function removeRetiredUsers() {
  const users = await listAllUsers();
  const ids = await loadUserIds(supabase);
  const adminId = ids["admin@vktr.demo"];
  for (const email of RETIRED_DEMO_EMAILS) {
    const found = users.find((x) => x.email === email);
    if (!found) continue;
    for (const [table, column] of PROFILE_REFS) {
      await supabase.from(table).update({ [column]: adminId }).eq(column, found.id);
    }
    const { error } = await supabase.auth.admin.deleteUser(found.id);
    console.log(error ? `  ! Could not remove ${email}: ${error.message}` : `  - Removed retired account ${email}`);
  }
}

async function main() {
  await ensureDemoUsers();
  await removeRetiredUsers();
  const users = await loadUserIds(supabase);

  console.log("\nSeeding RELEASED cost structures (Maker/Checker/Releaser recorded)...");
  await seedCostStructures(supabase, users);

  console.log("\nSeeding historical quotations...");
  await wipeQuotations(supabase);
  await seedHistoricalQuotations(supabase, users);

  console.log(`\nDone. Demo login (password ${DEMO_PASSWORD}):`);
  for (const u of DEMO_USERS) console.log(`  ${u.email.padEnd(26)} → ${u.app_role_code}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
