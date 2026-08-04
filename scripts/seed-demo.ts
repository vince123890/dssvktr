/**
 * Demo data seed script — provisions one Supabase Auth account per
 * persona (mirrors PRD §2 Target Pengguna) and a batch of historical
 * pricing proposals (with cost lines + calculation results + outcomes)
 * so the DSS Win/Loss Analytics view and dashboards have something
 * meaningful to show on first run.
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

// v2.0 — actors follow the VKTR Commercial Quotation SOP.
const DEMO_USERS = [
  {
    email: "sales@vktr.demo",
    full_name: "Maria Kusuma",
    role: "SALES_OFFICER",
    department_code: "SALES",
  },
  {
    email: "chiefsales@vktr.demo",
    full_name: "Andi Wijaya",
    role: "CHIEF_SALES",
    department_code: "CHIEF_SALES",
  },
  {
    email: "vpfinance@vktr.demo",
    full_name: "Siti Rahayu",
    role: "VP_FINANCE",
    department_code: "VP_FINANCE",
  },
  {
    email: "vpops@vktr.demo",
    full_name: "Budi Santoso",
    role: "VP_OPERATIONS",
    department_code: "VP_OPERATIONS",
  },
  {
    email: "bod@vktr.demo",
    full_name: "Robert Halim",
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

  for (const u of DEMO_USERS) {
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing.users.find((x) => x.email === u.email);

    if (found) {
      userIds[u.email] = found.id;
      console.log(`  - ${u.email} already exists, skipping`);
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

  return userIds;
}

const HISTORICAL_PROPOSALS: {
  title: string;
  businessLine: BusinessLine;
  customer: string;
  unitQuantity: number;
  outcome: "WON" | "LOST";
  markupTargetPct: number; // controls margin factor % to hit a realistic won/lost band
}[] = [
  { title: "20 Unit EV Bus — Dishub DKI Jakarta", businessLine: "B2G_TENDER_BUS", customer: "Dishub DKI Jakarta", unitQuantity: 20, outcome: "WON", markupTargetPct: 15 },
  { title: "10 Unit EV Bus — Pemkot Surabaya", businessLine: "B2G_TENDER_BUS", customer: "Pemkot Surabaya", unitQuantity: 10, outcome: "WON", markupTargetPct: 14 },
  { title: "15 Unit EV Bus — Dishub Bandung", businessLine: "B2G_TENDER_BUS", customer: "Dishub Kota Bandung", unitQuantity: 15, outcome: "LOST", markupTargetPct: 22 },
  { title: "8 Unit EV Bus — Pemprov Bali", businessLine: "B2G_TENDER_BUS", customer: "Pemprov Bali", unitQuantity: 8, outcome: "WON", markupTargetPct: 13 },
  { title: "25 Unit EV Bus — Kemenhub RI", businessLine: "B2G_TENDER_BUS", customer: "Kementerian Perhubungan", unitQuantity: 25, outcome: "LOST", markupTargetPct: 24 },
  { title: "5 Unit EV Truck — Logistik Cepat", businessLine: "B2B_COMMERCIAL_FLEET", customer: "PT Logistik Cepat Nusantara", unitQuantity: 5, outcome: "WON", markupTargetPct: 17 },
  { title: "12 Unit EV Truck — Anteraja Fleet", businessLine: "B2B_COMMERCIAL_FLEET", customer: "PT Anteraja Logistik", unitQuantity: 12, outcome: "WON", markupTargetPct: 16 },
  { title: "8 Unit EV Truck — Sinar Distribusi", businessLine: "B2B_COMMERCIAL_FLEET", customer: "PT Sinar Distribusi Utama", unitQuantity: 8, outcome: "LOST", markupTargetPct: 26 },
  { title: "20 Unit EV Truck — J&T Fleet Expansion", businessLine: "B2B_COMMERCIAL_FLEET", customer: "PT J&T Ekspres", unitQuantity: 20, outcome: "WON", markupTargetPct: 18 },
  { title: "Charging Hub — Rest Area KM 57", businessLine: "CHARGING_INFRA_BUILDOUT", customer: "PT Jasa Marga", unitQuantity: 1, outcome: "WON", markupTargetPct: 19 },
  { title: "Charging Hub — Mall Kelapa Gading", businessLine: "CHARGING_INFRA_BUILDOUT", customer: "PT Summarecon Agung", unitQuantity: 1, outcome: "WON", markupTargetPct: 20 },
  { title: "Charging Hub — Bandara Kertajati", businessLine: "CHARGING_INFRA_BUILDOUT", customer: "PT Angkasa Pura", unitQuantity: 1, outcome: "LOST", markupTargetPct: 28 },
];

// A handful of "in-flight" proposals left as DRAFT / mid-workflow so the
// Kanban board and dashboard show live movement, not just closed history.
const LIVE_PROPOSALS: {
  title: string;
  businessLine: BusinessLine;
  customer: string;
  unitQuantity: number;
}[] = [
  { title: "18 Unit EV Bus — Dishub Kota Medan", businessLine: "B2G_TENDER_BUS", customer: "Dishub Kota Medan", unitQuantity: 18 },
  { title: "6 Unit EV Truck — Paxel Same-Day", businessLine: "B2B_COMMERCIAL_FLEET", customer: "PT Paxel Algorita Ecommerce", unitQuantity: 6 },
  { title: "Charging Hub — Terminal Pulo Gebang", businessLine: "CHARGING_INFRA_BUILDOUT", customer: "Dishub DKI Jakarta", unitQuantity: 1 },
];

async function seedProposalNumber(index: number) {
  const year = new Date().getFullYear();
  return `PRC-${year}-${String(index).padStart(4, "0")}`;
}

async function main() {
  const userIds = await ensureDemoUsers();
  const adminId = userIds["admin@vktr.demo"];
  const salesId = userIds["sales@vktr.demo"];

  if (!adminId) {
    console.error("Admin user not provisioned, aborting proposal seed.");
    return;
  }

  console.log("\nLoading reference data...");
  const { data: templates } = await supabase.from("cbs_template").select("*");
  const { data: fxSnapshot } = await supabase
    .from("external_rate_snapshot")
    .select("*")
    .eq("rate_type", "FX_USD_IDR")
    .order("effective_at", { ascending: false })
    .limit(1)
    .single();

  const fxRate = fxSnapshot ? Number(fxSnapshot.value) : 16350;
  const templateByBusinessLine = Object.fromEntries(
    (templates ?? []).map((t) => [t.business_line, t])
  );

  let seq = 1;
  const allProposals = [
    ...HISTORICAL_PROPOSALS.map((p) => ({ ...p, isLive: false as const })),
    ...LIVE_PROPOSALS.map((p) => ({
      ...p,
      outcome: "PENDING" as const,
      markupTargetPct: 15,
      isLive: true as const,
    })),
  ];

  console.log(`\nSeeding ${allProposals.length} proposals...`);

  for (const p of allProposals) {
    const template = templateByBusinessLine[p.businessLine];
    if (!template) continue;

    const { data: templateItems } = await supabase
      .from("cbs_template_item")
      .select("cost_item_id, cost_item(*)")
      .eq("template_id", template.id);

    const costItems: CostItem[] = (templateItems ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any) => row.cost_item)
      .filter(Boolean);

    // Generate plausible per-unit cost values with light randomness so
    // outlier detection has real variance to work against.
    const jitter = () => 0.92 + Math.random() * 0.16; // +/-8%
    const BASE_VALUES: Record<string, number> = {
      "BOM-BATT-001": 850_000_000,
      "BOM-CHAS-001": 420_000_000,
      "BOM-PWTR-001": 310_000_000,
      "DIR-KAR-001": 260_000_000,
      "DIR-BEA-001": 180_000_000,
      "DIR-LOG-001": 45_000_000,
      "IND-TST-001": 35_000_000,
      "IND-TYP-001": 18_000_000,
      "IND-OVH-001": 25_000_000,
      "IND-WAR-001": 40_000_000,
      "IND-AMS-001": 20_000_000,
      "MGN-COF-001": 3,
      "MGN-LSE-001": 1.5,
      "MGN-COM-001": 2,
      "MGN-CTG-001": 2,
    };

    // Charging infra is a project (fixed), not per-unit vehicle BOM — scale down.
    const scaleFactor = p.businessLine === "CHARGING_INFRA_BUILDOUT" ? 0.35 : 1;

    const costLineValues: Record<string, number> = {};
    for (const item of costItems) {
      const base = BASE_VALUES[item.code] ?? (item.unit_type === "PERCENTAGE" ? 2 : 10_000_000);
      if (item.category === "MARGIN_FACTOR") {
        // Distribute the target markup across the margin-factor percentage items
        costLineValues[item.id] = item.code === "MGN-COF-001" ? p.markupTargetPct * 0.4 : base;
      } else {
        costLineValues[item.id] = Math.round(base * scaleFactor * jitter());
      }
    }

    const result = calculatePricing({
      businessLine: p.businessLine,
      costItems,
      costLineValues,
      unitQuantity: p.unitQuantity,
      fxUsdIdrRate: fxRate,
      fxBaselineRate: fxRate,
      minGpmThreshold: Number(template.min_gpm_threshold),
    });

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
        unit_quantity: p.unitQuantity,
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
      .update({ current_version_id: version.id })
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
  const { data: costItems } = await supabase.from("cost_item").select("id, category");
  const { data: proposals } = await supabase
    .from("pricing_proposal")
    .select("id, business_line, current_version_id");

  if (!lines || !costItems) return;

  const versionToBusinessLine = new Map<string, BusinessLine>();
  for (const p of proposals ?? []) {
    if (p.current_version_id) versionToBusinessLine.set(p.current_version_id, p.business_line);
  }

  const byItem = new Map<string, number[]>();
  for (const line of lines) {
    const arr = byItem.get(line.cost_item_id) ?? [];
    arr.push(Number(line.value));
    byItem.set(line.cost_item_id, arr);
  }

  const businessLineByItemCategory = "B2G_TENDER_BUS"; // POC: stats aggregated across lines for simplicity

  for (const [costItemId, values] of byItem.entries()) {
    if (values.length === 0) continue;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(values.length - 1, 1);
    const stddev = Math.sqrt(variance);

    await supabase.from("cost_item_stat").upsert(
      {
        cost_item_id: costItemId,
        business_line: businessLineByItemCategory,
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
