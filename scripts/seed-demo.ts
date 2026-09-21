/**
 * Demo data seed script — provisions one Supabase Auth account per
 * persona (mirrors PRD §2 Target Pengguna, v3.0) and a batch of
 * historical pricing proposals (with cost lines + calculation results
 * + outcomes) so the DSS Win/Loss Analytics view and dashboards have
 * something meaningful to show on first run.
 *
 * Usage: npm run seed:demo
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (never expose this
 * key client-side — this script only ever runs on your machine / CI).
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { calculatePricing } from "../src/lib/pricing/engine";
import type { BusinessLine, CostItem } from "../src/types/database";

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

// v3.0 — actors follow the corrected VKTR Commercial Quotation SOP:
// Sales Officer -> VP Operations -> VP Finance -> Chief Sales, plus
// Product Owner and a second BOD (Tier 3 needs two different members).
const DEMO_USERS = [
  {
    email: "sales@vktr.demo",
    full_name: "Maria Kusuma",
    role: "SALES_OFFICER",
    department_code: "SALES",
  },
  {
    email: "vpops@vktr.demo",
    full_name: "Budi Santoso",
    role: "VP_OPERATIONS",
    department_code: "VP_OPERATIONS",
  },
  {
    email: "vpfinance@vktr.demo",
    full_name: "Siti Rahayu",
    role: "VP_FINANCE",
    department_code: "VP_FINANCE",
  },
  {
    email: "chiefsales@vktr.demo",
    full_name: "Andi Wijaya",
    role: "CHIEF_SALES",
    department_code: "CHIEF_SALES",
  },
  {
    email: "product@vktr.demo",
    full_name: "Rangga Prasetya",
    role: "PRODUCT_OWNER",
    department_code: "PRODUCT",
  },
  {
    email: "bod1@vktr.demo",
    full_name: "Robert Halim",
    role: "BOD",
    department_code: "BOD",
  },
  {
    email: "bod2@vktr.demo",
    full_name: "Linda Wijaya",
    role: "BOD",
    department_code: "BOD",
  },
  {
    email: "admin@vktr.demo",
    full_name: "Dewi Anggraini",
    role: "SYSTEM_ADMIN",
    department_code: "ADMIN",
  },
] as const;

const DEMO_PASSWORD = "PriceCore123!";

async function ensureDemoUsers() {
  console.log("Provisioning demo users...");
  const userIds: Record<string, string> = {};

  const { data: departments } = await supabase.from("department").select("id, code");
  const deptIdByCode = Object.fromEntries(
    (departments ?? []).map((d) => [d.code, d.id])
  );

  for (const u of DEMO_USERS) {
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing.users.find((x) => x.email === u.email);

    if (found) {
      userIds[u.email] = found.id;

      // Reconcile rather than skip: an account seeded under an older
      // role model would otherwise keep a role that no longer exists,
      // leaving it unable to act anywhere in the workflow.
      const { data: profile } = await supabase
        .from("profile")
        .select("role, department_id")
        .eq("id", found.id)
        .maybeSingle();

      const targetDeptId = deptIdByCode[u.department_code];
      const needsUpdate =
        profile?.role !== u.role || profile?.department_id !== targetDeptId;

      if (needsUpdate) {
        await supabase
          .from("profile")
          .update({
            full_name: u.full_name,
            role: u.role,
            department_id: targetDeptId,
          })
          .eq("id", found.id);
        console.log(`  ~ ${u.email} updated (${profile?.role ?? "?"} -> ${u.role})`);
      } else {
        console.log(`  - ${u.email} already correct, skipping`);
      }
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: u.full_name,
        role: u.role,
        department_code: u.department_code,
      },
    });

    if (error) {
      console.error(`  ! Failed to create ${u.email}:`, error.message);
      continue;
    }

    userIds[u.email] = data.user.id;
    console.log(`  + Created ${u.email} (${u.role})`);
  }

  await removeRetiredUsers();

  return userIds;
}

/**
 * Accounts from earlier role models (v1's Procurement/Engineering/...
 * and v2.0's single bod@vktr.demo, now split into bod1/bod2). Their
 * roles/addresses no longer match the current demo script, so logging
 * in as one leaves the user unable to act anywhere — cleaner to remove
 * them than to leave dead credentials in a demo environment.
 */
const RETIRED_DEMO_EMAILS = [
  "procurement@vktr.demo",
  "engineering@vktr.demo",
  "finance@vktr.demo",
  "clevel@vktr.demo",
  "bod@vktr.demo",
];

async function removeRetiredUsers() {
  const { data: existing } = await supabase.auth.admin.listUsers();

  for (const email of RETIRED_DEMO_EMAILS) {
    const found = existing.users.find((x) => x.email === email);
    if (!found) continue;

    // Anything this account created is reassigned to admin first, so the
    // delete cannot fail on a foreign key or orphan a proposal.
    const { data: admin } = await supabase
      .from("profile")
      .select("id")
      .eq("email", "admin@vktr.demo")
      .maybeSingle();

    if (admin) {
      await supabase
        .from("pricing_proposal")
        .update({ created_by: admin.id })
        .eq("created_by", found.id);
      await supabase
        .from("pricing_proposal_version")
        .update({ created_by: admin.id })
        .eq("created_by", found.id);
    }

    const { error } = await supabase.auth.admin.deleteUser(found.id);
    if (error) {
      console.log(`  ! Could not remove retired account ${email}: ${error.message}`);
    } else {
      console.log(`  - Removed retired account ${email}`);
    }
  }
}

const HISTORICAL_PROPOSALS: {
  title: string;
  businessLine: BusinessLine;
  customer: string;
  project: string;
  unitQuantity: number;
  outcome: "WON" | "LOST";
  markupTargetPct: number; // controls margin factor % to hit a realistic won/lost band
}[] = [
  { title: "20 Unit EV Bus — Dishub DKI Jakarta", businessLine: "B2G_TENDER_BUS", customer: "Dishub DKI Jakarta", project: "Trans Jakarta Elektrifikasi", unitQuantity: 20, outcome: "WON", markupTargetPct: 15 },
  { title: "10 Unit EV Bus — Pemkot Surabaya", businessLine: "B2G_TENDER_BUS", customer: "Pemkot Surabaya", project: "Suroboyo Bus Listrik", unitQuantity: 10, outcome: "WON", markupTargetPct: 14 },
  { title: "15 Unit EV Bus — Dishub Bandung", businessLine: "B2G_TENDER_BUS", customer: "Dishub Kota Bandung", project: "Bandung Smart Transit", unitQuantity: 15, outcome: "LOST", markupTargetPct: 22 },
  { title: "8 Unit EV Bus — Pemprov Bali", businessLine: "B2G_TENDER_BUS", customer: "Pemprov Bali", project: "Bali Green Transport", unitQuantity: 8, outcome: "WON", markupTargetPct: 13 },
  { title: "25 Unit EV Bus — Kemenhub RI", businessLine: "B2G_TENDER_BUS", customer: "Kementerian Perhubungan", project: "Nasional Bus Listrik Fase 1", unitQuantity: 25, outcome: "LOST", markupTargetPct: 24 },
  { title: "5 Unit EV Truck — Logistik Cepat", businessLine: "B2B_COMMERCIAL_FLEET", customer: "PT Logistik Cepat Nusantara", project: "Armada EV Jabodetabek", unitQuantity: 5, outcome: "WON", markupTargetPct: 17 },
  { title: "12 Unit EV Truck — Anteraja Fleet", businessLine: "B2B_COMMERCIAL_FLEET", customer: "PT Anteraja Logistik", project: "Armada EV Truck Jabodetabek", unitQuantity: 12, outcome: "WON", markupTargetPct: 16 },
  { title: "8 Unit EV Truck — Sinar Distribusi", businessLine: "B2B_COMMERCIAL_FLEET", customer: "PT Sinar Distribusi Utama", project: "Distribusi EV Jawa Barat", unitQuantity: 8, outcome: "LOST", markupTargetPct: 26 },
  { title: "20 Unit EV Truck — J&T Fleet Expansion", businessLine: "B2B_COMMERCIAL_FLEET", customer: "PT J&T Ekspres", project: "J&T Fleet Elektrifikasi", unitQuantity: 20, outcome: "WON", markupTargetPct: 18 },
  { title: "Charging Hub — Rest Area KM 57", businessLine: "CHARGING_INFRA_BUILDOUT", customer: "PT Jasa Marga", project: "Charging Hub Tol Trans Jawa", unitQuantity: 1, outcome: "WON", markupTargetPct: 19 },
  { title: "Charging Hub — Mall Kelapa Gading", businessLine: "CHARGING_INFRA_BUILDOUT", customer: "PT Summarecon Agung", project: "Charging Hub Mal Jakarta", unitQuantity: 1, outcome: "WON", markupTargetPct: 20 },
  { title: "Charging Hub — Bandara Kertajati", businessLine: "CHARGING_INFRA_BUILDOUT", customer: "PT Angkasa Pura", project: "Charging Hub Bandara Jabar", unitQuantity: 1, outcome: "LOST", markupTargetPct: 28 },
];

// A handful of "in-flight" proposals left as DRAFT / mid-workflow so the
// Kanban board and dashboard show live movement, not just closed history.
const LIVE_PROPOSALS: {
  title: string;
  businessLine: BusinessLine;
  customer: string;
  project: string;
  unitQuantity: number;
}[] = [
  { title: "18 Unit EV Bus — Dishub Kota Medan", businessLine: "B2G_TENDER_BUS", customer: "Dishub Kota Medan", project: "Medan Bus Listrik", unitQuantity: 18 },
  { title: "6 Unit EV Truck — Paxel Same-Day", businessLine: "B2B_COMMERCIAL_FLEET", customer: "PT Paxel Algorita Ecommerce", project: "Paxel Armada EV", unitQuantity: 6 },
  { title: "Charging Hub — Terminal Pulo Gebang", businessLine: "CHARGING_INFRA_BUILDOUT", customer: "Dishub DKI Jakarta", project: "Charging Hub Terminal Jakarta", unitQuantity: 1 },
];

async function seedProposalNumber(index: number) {
  const year = new Date().getFullYear();
  return `PRC-${year}-${String(index).padStart(4, "0")}`;
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

async function createProjectIdentifier(
  customerName: string,
  projectName: string,
  createdBy: string,
  sequence: number
): Promise<string | null> {
  const code = `PRJ-${slugify(customerName).slice(0, 12) || "CUST"}-${slugify(projectName).slice(0, 12) || "PROJ"}-${new Date().getFullYear()}-${String(sequence).padStart(3, "0")}`;

  const { data, error } = await supabase
    .from("project_identifier")
    .insert({ identifier_code: code, customer_name: customerName, project_name: projectName, created_by: createdBy })
    .select("id")
    .single();

  if (error) {
    console.error(`  ! Failed to create project identifier for ${customerName}:`, error.message);
    return null;
  }
  return data.id;
}

// Realistic per-unit values for the real VKTR/BTEL cost structure
// (34 items, docs/BTEL-CostStructure.xlsx). FOB Price is denominated
// in CNY; everything else is IDR (cost_item.denomination drives the
// actual conversion at calculation time).
const BASE_VALUES: Record<string, number> = {
  // COGS (CNY except FOB Price in IDR, which stays 0/unused)
  "COGS-FOB-CNY": 283_000,
  "COGS-FRT-001": 13_600_000,
  "COGS-DUT-001": 20_800_000,
  "COGS-PHC-001": 6_200_000,
  "COGS-CAR-001": 76_700_000,
  "COGS-ASM-001": 16_900_000,
  "COGS-LOC-001": 9_700_000,
  "COGS-ACC-001": 3_100_000,
  "COGS-TEL-001": 2_100_000,
  "COGS-WHS-001": 1_550_000,
  "COGS-WAR-001": 12_000_000,
  "COGS-NRG-001": 1_050_000,
  "COGS-ADM-001": 1_950_000,
  // PROFITABILITY
  "PROFIT-VKTS-PBT": 5_800_000,
  "PROFIT-VKTS-MGN": 8,
  "PROFIT-VKTR-PBF": 3_200_000,
  "PROFIT-FIN-COST": 6,
  "PROFIT-VKTR-MAF": 5,
  // SALES
  "SALES-STNK-001": 3_500_000,
  "SALES-INS-001": 2_200_000,
  "SALES-INC-INT": 1_500_000,
  "SALES-INC-EXT": 1_000_000,
  "SALES-PROC-001": 800_000,
  "SALES-AGENCY": 0,
  // ADD_ONS
  "ADDON-PROC-001": 1_350_000,
  "ADDON-DLV-001": 2_500_000,
  "ADDON-KEUR-001": 900_000,
  "ADDON-EXTRA-001": 0,
};

async function main() {
  const userIds = await ensureDemoUsers();
  const adminId = userIds["admin@vktr.demo"];
  const salesId = userIds["sales@vktr.demo"];

  if (!adminId) {
    console.error("Admin user not provisioned, aborting proposal seed.");
    return;
  }

  console.log("\nLoading reference data...");
  const { data: template } = await supabase
    .from("cbs_template")
    .select("*")
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const { data: exchangeRate } = await supabase
    .from("exchange_rate")
    .select("*")
    .eq("base_currency", "CNY")
    .eq("quote_currency", "IDR")
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fxRate = exchangeRate ? Number(exchangeRate.rate) : 2600;

  if (!template) {
    console.error("No active CBS template found — run migrations 0011-0013 first.");
    return;
  }

  const { data: templateItems } = await supabase
    .from("cbs_template_item")
    .select("cost_item_id, cost_item(*)")
    .eq("template_id", template.id);

  const costItems: CostItem[] = (templateItems ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => row.cost_item)
    .filter(Boolean);

  const allProposals = [
    ...HISTORICAL_PROPOSALS.map((p) => ({ ...p, isLive: false as const })),
    ...LIVE_PROPOSALS.map((p) => ({
      ...p,
      outcome: "PENDING" as const,
      markupTargetPct: 15,
      isLive: true as const,
    })),
  ];

  // Re-running the seed must not collide with proposals already present.
  // Skip titles that exist, and continue numbering after the highest
  // number in use rather than restarting at 1.
  const { data: existingProposals } = await supabase
    .from("pricing_proposal")
    .select("proposal_number, title");

  const existingTitles = new Set((existingProposals ?? []).map((p) => p.title));
  const highest = (existingProposals ?? [])
    .map((p) => Number.parseInt(p.proposal_number.split("-")[2] ?? "0", 10))
    .filter((n) => !Number.isNaN(n))
    .reduce((max, n) => Math.max(max, n), 0);

  let seq = highest + 1;
  let projectSeq = 1;

  const toSeed = allProposals.filter((p) => !existingTitles.has(p.title));
  const skipped = allProposals.length - toSeed.length;

  if (skipped > 0) {
    console.log(`\n${skipped} proposal sudah ada — dilewati.`);
  }
  console.log(`\nSeeding ${toSeed.length} proposals...`);

  // Generate plausible per-unit cost values with light randomness so
  // outlier detection has real variance to work against.
  const jitter = () => 0.92 + Math.random() * 0.16; // +/-8%

  for (const p of toSeed) {
    // Charging infra is a project (fixed), not per-unit vehicle BOM — scale down.
    const scaleFactor = p.businessLine === "CHARGING_INFRA_BUILDOUT" ? 0.35 : 1;

    const costLineValues: Record<string, number> = {};
    for (const item of costItems) {
      const base = BASE_VALUES[item.code] ?? (item.unit_type === "PERCENTAGE" ? 2 : 5_000_000);
      if (item.cost_group === "PROFITABILITY" && item.unit_type === "PERCENTAGE") {
        // Distribute the target markup across the margin percentage items.
        costLineValues[item.id] = item.code === "PROFIT-VKTS-MGN" ? p.markupTargetPct * 0.5 : base;
      } else {
        costLineValues[item.id] = Math.round(base * scaleFactor * jitter());
      }
    }

    const result = calculatePricing({
      costItems,
      costLineValues,
      unitQuantity: p.unitQuantity,
      fxRate,
      fxBaselineRate: fxRate,
      minGpmThreshold: Number(template.min_gpm_threshold),
    });

    const projectIdentifierId = await createProjectIdentifier(
      p.customer,
      p.project,
      adminId,
      projectSeq++
    );
    if (!projectIdentifierId) continue;

    const proposalNumber = await seedProposalNumber(seq++);
    const isFinal = !p.isLive;

    const { data: proposal, error: proposalError } = await supabase
      .from("pricing_proposal")
      .insert({
        proposal_number: proposalNumber,
        title: p.title,
        business_line: p.businessLine,
        customer_name: p.customer,
        cbs_template_id: template.id,
        project_identifier_id: projectIdentifierId,
        unit_quantity: p.unitQuantity,
        input_currency: "CNY",
        current_status: isFinal ? "QUOTATION_RELEASED" : "DRAFT",
        transaction_value: isFinal ? result.finalPrice : 0,
        outcome: p.outcome,
        created_by: salesId ?? adminId,
      })
      .select("id")
      .single();

    if (proposalError || !proposal) {
      console.error(`  ! Failed to create proposal ${p.title}:`, proposalError?.message);
      continue;
    }

    const { data: version, error: versionError } = await supabase
      .from("pricing_proposal_version")
      .insert({
        proposal_id: proposal.id,
        version_label: "v1.0",
        is_current: true,
        created_by: salesId ?? adminId,
      })
      .select("id")
      .single();

    if (versionError || !version) {
      console.error(`  ! Failed to create version for ${p.title}:`, versionError?.message);
      continue;
    }

    await supabase
      .from("pricing_proposal")
      .update({ current_version_id: version.id, last_calculated_rate_id: exchangeRate?.id ?? null })
      .eq("id", proposal.id);

    const costLineRows = Object.entries(costLineValues).map(([cost_item_id, value]) => ({
      proposal_version_id: version.id,
      cost_item_id,
      value,
      filled_by: adminId,
    }));

    await supabase.from("proposal_cost_line").insert(costLineRows);

    await supabase.from("proposal_calculation_result").insert({
      proposal_version_id: version.id,
      total_direct_cost: result.totalDirectCost,
      total_indirect_cost: result.totalIndirectCost,
      total_margin_amount: result.totalMarginAmount,
      final_price: result.finalPrice,
      gpm: result.gpm,
      ebitda_contribution: result.ebitdaContribution,
      bep_units: result.bepUnits,
      fx_usd_idr_rate: result.effectiveFxRate,
      breakdown: result.breakdown,
      is_below_gpm_threshold: result.isBelowGpmThreshold,
      exchange_rate_used: result.effectiveFxRate,
      exchange_rate_id: exchangeRate?.id ?? null,
      mineral_adjustment_factor: result.effectiveMineralFactor,
      input_currency: "CNY",
    });

    console.log(
      `  + ${proposalNumber} — ${p.title} (${p.outcome}, GPM ${(result.gpm * 100).toFixed(1)}%)`
    );
  }

  console.log("\nRecomputing cost_item_stat aggregates for outlier detection...");
  await recomputeCostItemStats();

  console.log("\nDone. Demo login credentials (password: " + DEMO_PASSWORD + "):");
  for (const u of DEMO_USERS) {
    console.log(`  ${u.email.padEnd(24)} -> ${u.role}`);
  }
}

async function recomputeCostItemStats() {
  const { data: lines } = await supabase.from("proposal_cost_line").select("cost_item_id, value");
  const { data: costItems } = await supabase.from("cost_item").select("id, cost_group");
  if (!lines || !costItems) return;

  const byItem = new Map<string, number[]>();
  for (const line of lines) {
    const arr = byItem.get(line.cost_item_id) ?? [];
    arr.push(Number(line.value));
    byItem.set(line.cost_item_id, arr);
  }

  // POC: stats aggregated across business lines for simplicity (the CBS
  // is single/shared now, so the business_line column here is nominal).
  const nominalBusinessLine = "B2G_TENDER_BUS";

  for (const [costItemId, values] of byItem.entries()) {
    if (values.length === 0) continue;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(values.length - 1, 1);
    const stddev = Math.sqrt(variance);

    await supabase.from("cost_item_stat").upsert(
      {
        cost_item_id: costItemId,
        business_line: nominalBusinessLine,
        sample_count: values.length,
        mean_value: mean,
        stddev_value: stddev,
      },
      { onConflict: "cost_item_id" }
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
