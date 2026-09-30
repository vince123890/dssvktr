/**
 * Reset the app to its pre-demo state (v4.0) so docs/DEMO-FLOW-*.md can
 * be run again from a clean slate.
 *
 * REMOVES: every quotation created during a demo (with workflow, tier
 * approvals, line items, audit entries), cost structure versions created
 * during a demo, Price Estimate logs, and demo audit entries.
 * RESTORES: the seeded RELEASED v1 cost structures and the historical
 * quotations (including the one that expires on first view).
 * KEEPS: Settings (roles, authority matrix, workflow, tiers, bands),
 * master data, exchange rates and demo accounts.
 *
 * Usage: npm run reset:demo
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { loadUserIds, seedCostStructures, seedHistoricalQuotations, wipeQuotations } from "./demoData";

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

async function main() {
  const users = await loadUserIds(supabase);

  console.log("Removing quotations...");
  await wipeQuotations(supabase);

  console.log("Clearing Price Estimate log & audit trail...");
  await supabase.from("price_estimate_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("audit_log_entry").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // The CNY demo moves the rate; append (never overwrite) a 2.600 row so
  // the seeded numbers repeat exactly. Rate history stays intact.
  const { data: rate } = await supabase
    .from("exchange_rate")
    .select("rate")
    .eq("base_currency", "CNY")
    .eq("quote_currency", "IDR")
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!rate || Number(rate.rate) !== 2600) {
    await supabase.from("exchange_rate").insert({
      base_currency: "CNY",
      quote_currency: "IDR",
      rate: 2600,
      source: "manual",
      effective_from: new Date().toISOString(),
    });
    console.log("Kurs CNY/IDR dikembalikan ke 2.600 (baris baru).");
  }

  console.log("Restoring seeded cost structures...");
  await seedCostStructures(supabase, users);

  console.log("Restoring historical quotations...");
  await seedHistoricalQuotations(supabase, users);

  console.log("\nDone — ready to run docs/DEMO-FLOW-PRICE-ESTIMATE.md and docs/DEMO-FLOW-OFFICIAL-QUOTATION.md again.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
