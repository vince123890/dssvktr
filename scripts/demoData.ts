/**
 * Shared demo data for `npm run seed:demo` and `npm run reset:demo`
 * (v4.0). Provisions the 12 accounts from sheet "Actors" + "Basic
 * Workflow", RELEASED cost structures for the two VKTR Light Duty Truck
 * variants (Maker/Checker/Releaser recorded per scope), and a set of
 * historical quotations for Win/Loss Analytics.
 *
 * Numbers match docs/DEMO-FLOW-*.md exactly (list price SWB
 * Rp 829.550.000 excl. VAT, GM 17,79%).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCostStructure, computeLine, aggregateGm, resolveTier } from "../src/lib/pricing/quotation";
import type { CostItem, MarginTierAuthority, QuantityBand } from "../src/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;

export const DEMO_PASSWORD = "PriceCore123!";

export const DEMO_USERS = [
  { email: "agency@vktr.demo", full_name: "Yusuf Hamdani (Mitra Armada)", app_role_code: "AUTHORIZED_AGENCY", role: "SALES_OFFICER", department_code: "SALES" },
  { email: "sales.exec@vktr.demo", full_name: "Maria Kusuma", app_role_code: "SALES_EXECUTIVE", role: "SALES_OFFICER", department_code: "SALES" },
  { email: "sales.lead@vktr.demo", full_name: "Andi Wijaya", app_role_code: "SALES_LEAD", role: "SALES_OFFICER", department_code: "SALES" },
  { email: "salesops@vktr.demo", full_name: "Rina Oktaviani", app_role_code: "SALES_OPS_MANAGER", role: "CHIEF_SALES", department_code: "CHIEF_SALES" },
  { email: "headsales@vktr.demo", full_name: "Hendra Gunawan", app_role_code: "HEAD_OF_SALES", role: "CHIEF_SALES", department_code: "CHIEF_SALES" },
  { email: "procurement@vktr.demo", full_name: "Budi Santoso", app_role_code: "PROCUREMENT_MANAGER", role: "VP_OPERATIONS", department_code: "VP_OPERATIONS" },
  { email: "headproc@vktr.demo", full_name: "Agus Setiawan", app_role_code: "HEAD_OF_PROC_OPS", role: "VP_OPERATIONS", department_code: "VP_OPERATIONS" },
  { email: "headfinance@vktr.demo", full_name: "Siti Rahayu", app_role_code: "HEAD_OF_CORP_FIN", role: "VP_FINANCE", department_code: "VP_FINANCE" },
  { email: "cco@vktr.demo", full_name: "Robert Halim", app_role_code: "CCO", role: "BOD", department_code: "BOD" },
  { email: "cfo@vktr.demo", full_name: "Linda Wijaya", app_role_code: "CFO", role: "BOD", department_code: "BOD" },
  { email: "product@vktr.demo", full_name: "Rangga Prasetya", app_role_code: "PRODUCT_OWNER", role: "PRODUCT_OWNER", department_code: "PRODUCT" },
  { email: "admin@vktr.demo", full_name: "Dewi Anggraini", app_role_code: "SYSTEM_ADMIN", role: "SYSTEM_ADMIN", department_code: "ADMIN" },
] as const;

/** v1–v3 demo accounts whose roles no longer exist in the Actors sheet. */
export const RETIRED_DEMO_EMAILS = [
  "sales@vktr.demo",
  "vpops@vktr.demo",
  "vpfinance@vktr.demo",
  "chiefsales@vktr.demo",
  "bod1@vktr.demo",
  "bod2@vktr.demo",
  "bod@vktr.demo",
  "engineering@vktr.demo",
  "finance@vktr.demo",
  "clevel@vktr.demo",
];

export const SWB_PRODUCT_ID = "55555555-0000-0000-0000-000000000011";
export const MWB_PRODUCT_ID = "55555555-0000-0000-0000-000000000012";

const COMMON_MARGIN = {
  "PROFIT-VKTS-PBT": 20_000_000,
  "PROFIT-VKTS-MGN": 6,
  "PROFIT-VKTR-PBF": 25_000_000,
  "PROFIT-FIN-COST": 4,
  "PROFIT-VKTR-MAF": 5,
};
const COMMON_SALES = {
  "SALES-INC-INT": 4_000_000,
  "SALES-INC-EXT": 0,
  "SALES-PROC-001": 2_000_000,
  "SALES-AGENCY": 0,
};

/** Per-unit values by cost item code (FOB in CNY, the rest in IDR / %). */
export const COST_VALUES: Record<string, Record<string, number>> = {
  [SWB_PRODUCT_ID]: {
    "COGS-FOB-CNY": 185_000,
    "COGS-FRT-001": 18_000_000,
    "COGS-DUT-001": 24_000_000,
    "COGS-PHC-001": 7_500_000,
    "COGS-CAR-001": 65_000_000,
    "COGS-ASM-001": 22_000_000,
    "COGS-LOC-001": 12_000_000,
    "COGS-ACC-001": 4_000_000,
    "COGS-TEL-001": 3_500_000,
    "COGS-WHS-001": 2_000_000,
    "COGS-WAR-001": 15_000_000,
    "COGS-NRG-001": 1_000_000,
    "COGS-ADM-001": 3_000_000,
    "ADDON-STNK-001": 6_000_000,
    "ADDON-KEUR-001": 1_500_000,
    "ADDON-INS-001": 9_000_000,
    "ADDON-PROC-001": 2_500_000,
    "ADDON-EXTRA-001": 0,
    ...COMMON_MARGIN,
    ...COMMON_SALES,
  },
  [MWB_PRODUCT_ID]: {
    "COGS-FOB-CNY": 205_000,
    "COGS-FRT-001": 20_000_000,
    "COGS-DUT-001": 27_000_000,
    "COGS-PHC-001": 8_000_000,
    "COGS-CAR-001": 78_000_000,
    "COGS-ASM-001": 23_000_000,
    "COGS-LOC-001": 13_000_000,
    "COGS-ACC-001": 4_500_000,
    "COGS-TEL-001": 3_500_000,
    "COGS-WHS-001": 2_000_000,
    "COGS-WAR-001": 18_000_000,
    "COGS-NRG-001": 1_500_000,
    "COGS-ADM-001": 3_000_000,
    "ADDON-STNK-001": 6_000_000,
    "ADDON-KEUR-001": 1_500_000,
    "ADDON-INS-001": 10_000_000,
    "ADDON-PROC-001": 2_500_000,
    "ADDON-EXTRA-001": 0,
    ...COMMON_MARGIN,
    ...COMMON_SALES,
  },
};
/** Delivery Service is released as "Exclusion — At cost" (harga loco Magelang). */
export const EXCLUDED_CODES = ["ADDON-DLV-001"];

export async function loadUserIds(supabase: Db): Promise<Record<string, string>> {
  const { data } = await supabase.from("profile").select("id, email");
  return Object.fromEntries((data ?? []).map((p: { id: string; email: string }) => [p.email, p.id]));
}

export async function loadItems(supabase: Db): Promise<CostItem[]> {
  const { data } = await supabase.from("cost_item").select("*").eq("active", true);
  return (data ?? []) as CostItem[];
}

async function cnyRate(supabase: Db): Promise<{ id: string; rate: number }> {
  const { data } = await supabase
    .from("exchange_rate")
    .select("id, rate")
    .eq("base_currency", "CNY")
    .eq("quote_currency", "IDR")
    .lte("effective_from", new Date().toISOString())
    .order("effective_from", { ascending: false })
    .limit(1)
    .single();
  if (!data) throw new Error("Tidak ada kurs CNY/IDR — jalankan migrasi 0016 dulu.");
  return { id: data.id, rate: Number(data.rate) };
}

/**
 * Seeds (or restores) the RELEASED v1 cost structure of each demo
 * variant, recording Maker/Checker/Releaser per scope exactly as the
 * Actors sheet assigns them. Non-seed versions are removed.
 */
export async function seedCostStructures(supabase: Db, users: Record<string, string>): Promise<void> {
  const items = await loadItems(supabase);
  const byCode = new Map(items.map((i) => [i.code, i]));
  const fx = await cnyRate(supabase);

  // Remove versions created during a demo; keep nothing else pointing at them.
  const { data: extra } = await supabase.from("cost_structure_version").select("id").eq("is_seed", false);
  const extraIds = (extra ?? []).map((v: { id: string }) => v.id);
  if (extraIds.length) {
    await supabase.from("quotation_line_item").update({ cost_structure_version_id: null }).in("cost_structure_version_id", extraIds);
    await supabase.from("price_estimate_log").update({ cost_structure_version_id: null }).in("cost_structure_version_id", extraIds);
    await supabase.from("cost_structure_version").update({ parent_version_id: null }).in("parent_version_id", extraIds);
    await supabase.from("cost_structure_version").delete().in("id", extraIds);
  }

  const people = {
    cogsMaker: users["procurement@vktr.demo"],
    cogsChecker: users["headproc@vktr.demo"],
    margin: users["headfinance@vktr.demo"],
    salesMaker: users["salesops@vktr.demo"],
    salesChecker: users["headsales@vktr.demo"],
  };
  const releasedAt = new Date(Date.now() - 20 * 86400_000).toISOString();

  for (const [productId, values] of Object.entries(COST_VALUES)) {
    const { data: existing } = await supabase
      .from("cost_structure_version")
      .select("id")
      .eq("product_id", productId)
      .eq("is_seed", true)
      .maybeSingle();

    let versionId = existing?.id as string | undefined;
    if (versionId) {
      await supabase.from("cost_structure_version").update({ status: "RELEASED", locked_fx_rate_id: fx.id, locked_fx_rate: fx.rate }).eq("id", versionId);
      await supabase.from("cost_structure_line").delete().eq("version_id", versionId);
      await supabase.from("cost_structure_scope_state").delete().eq("version_id", versionId);
    } else {
      const { data, error } = await supabase
        .from("cost_structure_version")
        .insert({
          product_id: productId,
          version_no: 1,
          status: "RELEASED",
          locked_fx_rate_id: fx.id,
          locked_fx_rate: fx.rate,
          change_reason: "Seed — cost structure awal",
          is_seed: true,
          released_at: releasedAt,
          created_by: people.cogsMaker,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      versionId = data.id;
    }

    const lineRows = items
      .filter((i) => !i.is_derived)
      .map((i) => ({
        version_id: versionId,
        cost_item_id: i.id,
        value: values[i.code] ?? 0,
        is_excluded_at_cost: EXCLUDED_CODES.includes(i.code),
      }));
    const { error: lineError } = await supabase.from("cost_structure_line").insert(lineRows);
    if (lineError) throw new Error(lineError.message);

    const scope = (s: string, maker: string, checker: string, releaser: string, single = false) => ({
      version_id: versionId,
      scope: s,
      status: "RELEASED",
      scenario: "REGULAR",
      maker_id: maker,
      made_at: releasedAt,
      checker_id: checker,
      checked_at: releasedAt,
      releaser_id: releaser,
      released_at: releasedAt,
      single_actor_flag: single,
      note: "Seed",
    });
    await supabase.from("cost_structure_scope_state").insert([
      scope("COGS", people.cogsMaker, people.cogsChecker, people.cogsChecker),
      scope("ADD_ONS", people.cogsMaker, people.cogsChecker, people.cogsChecker),
      scope("MARGIN", people.margin, people.margin, people.margin, true),
      scope("SALES", people.salesMaker, people.salesChecker, people.salesChecker),
    ]);

    const values2: Record<string, number> = {};
    for (const [code, v] of Object.entries(values)) {
      const item = byCode.get(code);
      if (item) values2[item.id] = v;
    }
    const cs = computeCostStructure({
      items,
      values: values2,
      excluded: new Set(EXCLUDED_CODES.map((c) => byCode.get(c)?.id).filter(Boolean) as string[]),
      fxRate: fx.rate,
    });
    console.log(
      `  + Cost structure v1 RELEASED — ${productId === SWB_PRODUCT_ID ? "SWB Dumper 90" : "MWB Box 132"}: list excl. VAT Rp ${Math.round(cs.listPriceExVat).toLocaleString("id-ID")}, GM ${(cs.standardGm * 100).toFixed(2)}%`
    );
  }
}

interface HistoricalQuotation {
  title: string;
  company: string;
  address: string;
  project: string;
  businessLine: "B2G_TENDER_BUS" | "B2B_COMMERCIAL_FLEET";
  productId: string;
  qty: number;
  discountPct: number;
  daysAgo: number;
  outcome: "WON" | "LOST" | "PENDING";
  application: string;
  likelihood: number;
}

export const HISTORICAL: HistoricalQuotation[] = [
  { title: "12 Unit — PT Logistik Cepat Nusantara", company: "PT Logistik Cepat Nusantara", address: "Jl. Raya Bekasi KM 21, Cakung, Jakarta Timur 13910", project: "Armada Box Jabodetabek", businessLine: "B2B_COMMERCIAL_FLEET", productId: MWB_PRODUCT_ID, qty: 12, discountPct: 2, daysAgo: 170, outcome: "WON", application: "Box / paket e-commerce", likelihood: 4 },
  { title: "20 Unit — PT Tambang Batu Andesit", company: "PT Tambang Batu Andesit", address: "Jl. Raya Rumpin No. 8, Bogor 16350", project: "Dumper Quarry Rumpin", businessLine: "B2B_COMMERCIAL_FLEET", productId: SWB_PRODUCT_ID, qty: 20, discountPct: 3, daysAgo: 150, outcome: "WON", application: "Dumper / batu split", likelihood: 4 },
  { title: "8 Unit — PT Sinar Distribusi Utama", company: "PT Sinar Distribusi Utama", address: "Jl. Soekarno-Hatta No. 590, Bandung 40286", project: "Distribusi Jawa Barat", businessLine: "B2B_COMMERCIAL_FLEET", productId: MWB_PRODUCT_ID, qty: 8, discountPct: 0, daysAgo: 140, outcome: "LOST", application: "Box / FMCG", likelihood: 2 },
  { title: "15 Unit — Dinas Lingkungan Hidup Kota Bekasi", company: "Dinas Lingkungan Hidup Kota Bekasi", address: "Jl. Ir. H. Juanda No. 100, Bekasi 17112", project: "Armada Sampah Bekasi", businessLine: "B2G_TENDER_BUS", productId: SWB_PRODUCT_ID, qty: 15, discountPct: 4, daysAgo: 120, outcome: "WON", application: "Dumper / sampah", likelihood: 3 },
  { title: "25 Unit — PT Karya Beton Mandiri", company: "PT Karya Beton Mandiri", address: "Kawasan Industri MM2100 Blok C, Cikarang Barat 17530", project: "Material Proyek Cikarang", businessLine: "B2B_COMMERCIAL_FLEET", productId: SWB_PRODUCT_ID, qty: 25, discountPct: 0.5, daysAgo: 110, outcome: "LOST", application: "Dumper / pasir", likelihood: 3 },
  { title: "6 Unit — PT Paxel Logistik", company: "PT Paxel Logistik", address: "Jl. TB Simatupang Kav. 18, Jakarta Selatan 12430", project: "Same-day Box Jakarta", businessLine: "B2B_COMMERCIAL_FLEET", productId: MWB_PRODUCT_ID, qty: 6, discountPct: 3, daysAgo: 95, outcome: "WON", application: "Box / paket", likelihood: 5 },
  { title: "10 Unit — Pemkot Surabaya", company: "Pemerintah Kota Surabaya", address: "Jl. Taman Surya No. 1, Surabaya 60272", project: "Kebersihan Kota Surabaya", businessLine: "B2G_TENDER_BUS", productId: SWB_PRODUCT_ID, qty: 10, discountPct: 1, daysAgo: 80, outcome: "LOST", application: "Dumper / sampah", likelihood: 2 },
  { title: "30 Unit — PT Agro Sawit Lestari", company: "PT Agro Sawit Lestari", address: "Jl. Imam Bonjol No. 17, Medan 20152", project: "Angkut TBS Kebun Asahan", businessLine: "B2B_COMMERCIAL_FLEET", productId: SWB_PRODUCT_ID, qty: 30, discountPct: 4.5, daysAgo: 60, outcome: "WON", application: "Dumper / TBS sawit", likelihood: 4 },
  // Released 40 days ago with no answer: becomes EXPIRED on first view (FR-2.9 demo).
  { title: "4 Unit — CV Maju Jaya Konstruksi", company: "CV Maju Jaya Konstruksi", address: "Jl. Magelang KM 7, Sleman 55284", project: "Proyek Jalan Sleman", businessLine: "B2B_COMMERCIAL_FLEET", productId: SWB_PRODUCT_ID, qty: 4, discountPct: 2, daysAgo: 40, outcome: "PENDING", application: "Dumper / aspal", likelihood: 3 },
];

export async function seedHistoricalQuotations(supabase: Db, users: Record<string, string>): Promise<void> {
  const items = await loadItems(supabase);
  const [{ data: template }, { data: tiers }, { data: bands }, { data: versions }, { data: vat }] = await Promise.all([
    supabase.from("cbs_template").select("id").eq("status", "active").order("version", { ascending: false }).limit(1).single(),
    supabase.from("margin_tier_authority").select("*").eq("is_active", true).is("business_line", null),
    supabase.from("quantity_band_config").select("*"),
    supabase.from("cost_structure_version").select("*").eq("is_seed", true),
    supabase.from("app_setting").select("value").eq("key", "vat_rate_pct").maybeSingle(),
  ]);
  if (!template) throw new Error("Tidak ada CBS template aktif.");
  const vatPct = vat ? Number(vat.value) : 11;
  const ladder = (tiers ?? []) as MarginTierAuthority[];

  const salesExec = users["sales.exec@vktr.demo"];
  const salesOps = users["salesops@vktr.demo"];
  let seq = 1;
  const docSeqByMonth = new Map<string, number>();

  for (const h of HISTORICAL) {
    const version = (versions ?? []).find((v: { product_id: string }) => v.product_id === h.productId);
    if (!version) throw new Error("Seed cost structure belum ada.");
    const { data: vLines } = await supabase.from("cost_structure_line").select("*").eq("version_id", version.id);
    const values: Record<string, number> = {};
    const excluded = new Set<string>();
    for (const l of vLines ?? []) {
      values[l.cost_item_id] = Number(l.value);
      if (l.is_excluded_at_cost) excluded.add(l.cost_item_id);
    }
    const cs = computeCostStructure({ items, values, excluded, fxRate: Number(version.locked_fx_rate) });
    const line = computeLine({
      quantity: h.qty,
      listPriceExVat: cs.listPriceExVat,
      baseCost: cs.baseCost,
      salesCost: cs.salesCost,
      discountMode: "PERCENTAGE",
      discountPct: h.discountPct,
      vatRatePct: vatPct,
    });
    const gm = aggregateGm([{ quantity: h.qty, netPriceExVat: line.netPriceExVat, baseCost: cs.baseCost, salesCost: cs.salesCost }]);
    const tier = resolveTier(gm * 100, ladder);
    const band = ((bands ?? []) as QuantityBand[]).find((b) => h.qty >= b.min_qty && (b.max_qty == null || h.qty <= b.max_qty));

    const created = new Date(Date.now() - h.daysAgo * 86400_000);
    const releasedAt = new Date(created.getTime() + 2 * 86400_000);
    const validUntil = new Date(releasedAt.getTime() + 30 * 86400_000);
    const mm = String(releasedAt.getMonth() + 1).padStart(2, "0");
    const yyyy = String(releasedAt.getFullYear());
    const monthKey = `${mm}-${yyyy}`;
    const docSeq = (docSeqByMonth.get(monthKey) ?? 0) + 1;
    docSeqByMonth.set(monthKey, docSeq);

    const { data: project } = await supabase
      .from("project_identifier")
      .insert({
        identifier_code: `PRJ-${h.company.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase().slice(0, 12)}-${yyyy}-${String(seq).padStart(3, "0")}`,
        customer_name: h.company,
        project_name: h.project,
        created_by: salesExec,
      })
      .select("id")
      .single();

    const { data: proposal, error } = await supabase
      .from("pricing_proposal")
      .insert({
        proposal_number: `PRC-${yyyy}-${String(900 + seq).padStart(4, "0")}`,
        title: h.title,
        business_line: h.businessLine,
        customer_name: h.company,
        cbs_template_id: template.id,
        project_identifier_id: project?.id,
        unit_quantity: h.qty,
        input_currency: "CNY",
        current_status: "QUOTATION_RELEASED",
        outcome: h.outcome,
        kyc: {
          company_name: h.company,
          official_address: h.address,
          project_name: h.project,
          project_type: "NEW_PROJECT",
          application_body: h.application.split(" / ")[0],
          utilization_content: h.application.split(" / ")[1] ?? "",
          route_description: "Rute operasional pelanggan",
          origin: "Depo pelanggan",
          destination: "Lokasi proyek",
          production_value: 6,
          production_unit: "trip",
          production_period: "DAY",
          likelihood: h.likelihood,
          gap_identified: "Target elektrifikasi armada & biaya operasional",
          requested_scheme: "PURCHASE",
        },
        initiator_role_code: "SALES_EXECUTIVE",
        account_person_ids: [salesExec],
        prepared_by: salesOps,
        quantity_band: band?.band ?? null,
        processing_mode: band?.processing_mode ?? null,
        scenario: gm < 0.1 ? "DEVIATION" : "REGULAR",
        margin_tier: tier?.tier ?? null,
        gm,
        total_ex_vat: line.lineTotalExVat,
        total_incl_vat: line.lineTotalInclVat,
        transaction_value: line.lineTotalExVat,
        vat_rate_pct: vatPct,
        document_number: `${String(docSeq).padStart(4, "0")}/L/VKTR/PUR-EFS/${monthKey}`,
        released_at: releasedAt.toISOString(),
        valid_until: validUntil.toISOString().slice(0, 10),
        inclusions: ["Onsite training during initial deployment, 2 week", "Online training refreshment 1x (first year)", "On-call technical support"],
        exclusions: ["Delivery To Site", "Maintenance", "Other Requests"],
        special_notes: ["Delivery time and maintenance service contract details will be discussed", "Cost Estimate is not binding, the actual pricing to be confirmed post assessment"],
        last_calculated_rate_id: version.locked_fx_rate_id,
        is_seed: true,
        created_by: salesExec,
        created_at: created.toISOString(),
      })
      .select("id")
      .single();
    if (error || !proposal) {
      console.error(`  ! ${h.title}: ${error?.message}`);
      continue;
    }

    const { data: pv } = await supabase
      .from("pricing_proposal_version")
      .insert({ proposal_id: proposal.id, version_label: "v1.0", is_current: true, created_by: salesExec })
      .select("id")
      .single();
    await supabase.from("pricing_proposal").update({ current_version_id: pv?.id }).eq("id", proposal.id);

    await supabase.from("quotation_line_item").insert({
      proposal_id: proposal.id,
      product_id: h.productId,
      quantity: h.qty,
      cost_structure_version_id: version.id,
      locked_fx_rate: version.locked_fx_rate,
      scheme: "PURCHASE",
      list_price_ex_vat: cs.listPriceExVat,
      base_cost: cs.baseCost,
      margin_amount: cs.marginAmount,
      sales_cost: cs.salesCost,
      discount_input_mode: "PERCENTAGE",
      discount_amount: line.discountAmount,
      discount_pct: line.discountPct,
      discount_source: h.discountPct > 0 ? "SALES_OPS_MANUAL" : null,
      net_price_ex_vat: line.netPriceExVat,
      net_price_incl_vat: line.netPriceInclVat,
      line_total_ex_vat: line.lineTotalExVat,
      line_total_incl_vat: line.lineTotalInclVat,
      gm: line.gm,
    });

    console.log(`  + ${h.title} — ${h.outcome}, GM ${(gm * 100).toFixed(2)}% (Tier ${tier?.tier})`);
    seq++;
  }
}

/** Deletes every quotation (seeded or not) and its dependants, oldest links first. */
export async function wipeQuotations(supabase: Db): Promise<void> {
  const { data: proposals } = await supabase.from("pricing_proposal").select("id");
  const ids = (proposals ?? []).map((p: { id: string }) => p.id);
  if (ids.length) {
    await supabase.from("audit_log_entry").delete().in("proposal_id", ids);
    await supabase.from("pricing_proposal").update({ supersedes_proposal_id: null, current_version_id: null }).in("id", ids);
    await supabase.from("pricing_proposal").delete().in("id", ids);
  }
  await supabase.from("project_identifier").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}
