/**
 * Applies a .sql migration file to the Supabase Postgres instance.
 *
 * Needed because DDL (CREATE TYPE / ALTER TABLE / CREATE POLICY) cannot
 * be issued through the Supabase JS client — it only speaks PostgREST.
 *
 * Usage:
 *   npm run migrate -- supabase/migrations/0007_....sql
 *
 * Requires SUPABASE_DB_URL in .env.local — the connection string from
 * Supabase Dashboard > Project Settings > Database > Connection string
 * (use the "Session pooler" / IPv4-compatible URI).
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { Client } from "pg";

config({ path: ".env.local" });

const file = process.argv[2];

if (!file) {
  console.error("Usage: npm run migrate -- <path-to.sql>");
  process.exit(1);
}

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    "Missing SUPABASE_DB_URL in .env.local.\n" +
      "Get it from Supabase Dashboard > Project Settings > Database >\n" +
      "Connection string > URI (Session pooler), then add:\n" +
      '  SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@...pooler.supabase.com:5432/postgres"'
  );
  process.exit(1);
}

async function main() {
  const sql = readFileSync(file, "utf8");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log(`Applying ${file} ...`);

  try {
    await client.query(sql);
    console.log("Success.");
  } catch (err) {
    console.error("Migration failed:", (err as Error).message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
