/**
 * Reset the app back to its pre-demo state so the walkthrough in
 * docs/DEMO-SCENARIO.md can be run again from a clean slate.
 *
 * What it REMOVES:
 *   - every proposal created during a demo (anything beyond the seeded
 *     historical set), together with its versions, cost lines,
 *     calculation results, workflow instance and steps
 *   - workflow progress on the seeded proposals (they go back to
 *     QUOTATION_RELEASED / DRAFT as the seed left them)
 *   - audit log entries produced by demo activity
 *
 * What it KEEPS:
 *   - master data: cost items, CBS templates, workflow definitions,
 *     departments, FX rates
 *   - the six demo user accounts
 *   - the seeded historical proposals that feed Win/Loss Analytics
 *
 * Usage: npm run reset:demo
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * The seed script creates exactly these titles. Anything else in the
 * proposals table was created by hand during a demo and is disposable.
 * Matching on title (not number) keeps this correct even if proposal
 * numbering drifts across reseeds.
 */
const SEEDED_TITLES = new Set([
  "20 Unit EV Bus — Dishub DKI Jakarta",
  "10 Unit EV Bus — Pemkot Surabaya",
  "15 Unit EV Bus — Dishub Bandung",
  "8 Unit EV Bus — Pemprov Bali",
  "25 Unit EV Bus — Kemenhub RI",
  "5 Unit EV Truck — Logistik Cepat",
  "12 Unit EV Truck — Anteraja Fleet",
  "8 Unit EV Truck — Sinar Distribusi",
  "20 Unit EV Truck — J&T Fleet Expansion",
  "Charging Hub — Rest Area KM 57",
  "Charging Hub — Mall Kelapa Gading",
  "Charging Hub — Bandara Kertajati",
  "18 Unit EV Bus — Dishub Kota Medan",
  "6 Unit EV Truck — Paxel Same-Day",
  "Charging Hub — Terminal Pulo Gebang",
]);

/** Titles the seed leaves in DRAFT (the rest are QUOTATION_RELEASED). */
const SEEDED_DRAFT_TITLES = new Set([
  "18 Unit EV Bus — Dishub Kota Medan",
  "6 Unit EV Truck — Paxel Same-Day",
  "Charging Hub — Terminal Pulo Gebang",
]);

async function main() {
  const { data: proposals, error } = await supabase
    .from("pricing_proposal")
    .select("id, proposal_number, title, current_status, current_version_id")
    .order("created_at");

  if (error) throw new Error(error.message);

  const demoProposals = (proposals ?? []).filter((p) => !SEEDED_TITLES.has(p.title));
  const seededProposals = (proposals ?? []).filter((p) => SEEDED_TITLES.has(p.title));

  console.log(
    `Found ${seededProposals.length} seeded proposals (kept) and ${demoProposals.length} demo-created proposals (to remove).\n`
  );

  // --- 1. Delete demo-created proposals ---------------------------------
  if (demoProposals.length > 0) {
    console.log("Removing demo-created proposals...");
    for (const p of demoProposals) {
      await deleteProposalCascade(p.id);
      console.log(`  - ${p.proposal_number} — ${p.title}`);
    }
  } else {
    console.log("No demo-created proposals to remove.");
  }

  // --- 2. Rewind workflow progress on seeded proposals -------------------
  console.log("\nRewinding workflow state on seeded proposals...");
  let rewound = 0;

  for (const p of seededProposals) {
    const versionIds = await versionIdsFor(p.id);
    if (versionIds.length === 0) continue;

    const { data: instances } = await supabase
      .from("workflow_instance")
      .select("id")
      .in("proposal_version_id", versionIds);

    const instanceIds = (instances ?? []).map((i) => i.id);

    if (instanceIds.length > 0) {
      await supabase
        .from("workflow_step_instance")
        .delete()
        .in("workflow_instance_id", instanceIds);
      await supabase.from("workflow_instance").delete().in("id", instanceIds);
      rewound++;
    }

    // Discount negotiations raised during a demo must go too, otherwise
    // the next run starts with a pending request blocking the release.
    await deleteNegotiations(p.id);

    const targetStatus = SEEDED_DRAFT_TITLES.has(p.title) ? "DRAFT" : "QUOTATION_RELEASED";
    const targetOutcome = targetStatus === "DRAFT" ? "PENDING" : undefined;

    await supabase
      .from("pricing_proposal")
      .update({
        current_status: targetStatus,
        current_step_order: 0,
        workflow_definition_id: null,
        applied_discount_pct: 0,
        has_bod_margin_approval: false,
        ...(targetOutcome ? { outcome: targetOutcome } : {}),
      })
      .eq("id", p.id);
  }

  console.log(`  Cleared workflow instances on ${rewound} proposal(s).`);

  // --- 3. Clear audit log ------------------------------------------------
  // The audit table is append-only by policy, so it is only ever cleared
  // here via the service role, deliberately and out-of-band.
  const { count: auditCount } = await supabase
    .from("audit_log_entry")
    .select("id", { count: "exact", head: true });

  await supabase.from("audit_log_entry").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log(`\nCleared ${auditCount ?? 0} audit log entries.`);

  // --- 4. Report ---------------------------------------------------------
  const { count: remaining } = await supabase
    .from("pricing_proposal")
    .select("id", { count: "exact", head: true });

  console.log(`\nDone. ${remaining ?? 0} proposals remain (the seeded set).`);
  console.log("Ready to run docs/DEMO-SCENARIO.md from Langkah 1 again.");
}

async function versionIdsFor(proposalId: string): Promise<string[]> {
  const { data } = await supabase
    .from("pricing_proposal_version")
    .select("id")
    .eq("proposal_id", proposalId);
  return (data ?? []).map((v) => v.id);
}

async function deleteNegotiations(proposalId: string) {
  const { data: requests } = await supabase
    .from("negotiation_request")
    .select("id")
    .eq("proposal_id", proposalId);

  const requestIds = (requests ?? []).map((r) => r.id);
  if (requestIds.length === 0) return;

  await supabase
    .from("negotiation_decision")
    .delete()
    .in("negotiation_request_id", requestIds);

  // Clear the self-reference before deleting so REVISE chains don't
  // trip the parent_request_id foreign key.
  await supabase
    .from("negotiation_request")
    .update({ parent_request_id: null })
    .in("id", requestIds);

  await supabase.from("negotiation_request").delete().in("id", requestIds);
}

async function deleteProposalCascade(proposalId: string) {
  const versionIds = await versionIdsFor(proposalId);

  await deleteNegotiations(proposalId);

  if (versionIds.length > 0) {
    const { data: instances } = await supabase
      .from("workflow_instance")
      .select("id")
      .in("proposal_version_id", versionIds);

    const instanceIds = (instances ?? []).map((i) => i.id);
    if (instanceIds.length > 0) {
      await supabase
        .from("workflow_step_instance")
        .delete()
        .in("workflow_instance_id", instanceIds);
      await supabase.from("workflow_instance").delete().in("id", instanceIds);
    }

    await supabase.from("proposal_calculation_result").delete().in("proposal_version_id", versionIds);
    await supabase.from("proposal_cost_line").delete().in("proposal_version_id", versionIds);
  }

  await supabase.from("audit_log_entry").delete().eq("proposal_id", proposalId);

  // Break the FK from proposal -> version before deleting the versions.
  await supabase
    .from("pricing_proposal")
    .update({ current_version_id: null })
    .eq("id", proposalId);

  await supabase.from("pricing_proposal_version").delete().eq("proposal_id", proposalId);
  await supabase.from("pricing_proposal").delete().eq("id", proposalId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
