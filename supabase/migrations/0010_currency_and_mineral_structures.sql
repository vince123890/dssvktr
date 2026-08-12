-- =====================================================================
-- v2.1 — Multi-Currency & Mineral Index (part 2: tables, columns, seed)
--
-- MUST run AFTER 0009 is committed.
--
-- Implements PRD v2.1 FR-1.4 (multi-currency input + exchange rate
-- master data) and Module 8 (HMA → HPM mineral index adjustment),
-- per Technical Logic §12–13.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXCHANGE RATE MASTER DATA (FR-1.4.2)
--    Never updated in place: a change inserts a row with a newer
--    effective_from, so an old quotation can still be reconstructed
--    with the rate that applied at the time (FR-1.4.3).
-- ---------------------------------------------------------------------

create table if not exists exchange_rate (
  id uuid primary key default gen_random_uuid(),
  base_currency currency_code not null default 'USD',
  quote_currency currency_code not null default 'IDR',
  rate numeric(18, 4) not null check (rate > 0),
  source text not null default 'manual',
  effective_from timestamptz not null default now(),
  created_by uuid references profile (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_exchange_rate_lookup
  on exchange_rate (base_currency, quote_currency, effective_from desc);

-- ---------------------------------------------------------------------
-- 2. MINERAL INDEX — HMA snapshots (FR-8.1)
-- ---------------------------------------------------------------------

create table if not exists mineral_index_snapshot (
  id uuid primary key default gen_random_uuid(),
  mineral_code text not null,                 -- 'NI', 'CO', 'LI', …
  hma_value numeric(18, 4) not null check (hma_value >= 0),  -- US$ / dmt
  period_start date not null,
  period_end date not null,
  regulation_ref text,
  source text not null default 'manual',
  created_by uuid references profile (id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists idx_mineral_index_lookup
  on mineral_index_snapshot (mineral_code, period_end desc);

-- ---------------------------------------------------------------------
-- 3. HPM FORMULA PARAMETERS (FR-8.2)
--    Every constant in the Kepmen formula lives here rather than in
--    code, so a regulation change is a data change.
-- ---------------------------------------------------------------------

create table if not exists hpm_parameter (
  id uuid primary key default gen_random_uuid(),
  mineral_code text not null,
  ni_content_pct numeric(8, 6) not null default 0.016,      -- 1.6%
  anchor_content_pct numeric(8, 6) not null default 0.016,
  anchor_cf_pct numeric(8, 6) not null default 0.30,
  cf_slope numeric(10, 4) not null default 10,
  co_content_pct numeric(8, 6) not null default 0.001,      -- 0.10%
  co_cf_pct numeric(8, 6) not null default 0.20,            -- 20%
  moisture_content_pct numeric(8, 6) not null default 0.35, -- 35%
  companion_mineral_code text,                              -- 'CO' for nickel
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_hpm_parameter_active
  on hpm_parameter (mineral_code, is_active);

-- ---------------------------------------------------------------------
-- 4. COLUMN ADDITIONS ON EXISTING TABLES
-- ---------------------------------------------------------------------

-- Which cost components move with mineral prices (FR-8.3).
alter table cost_item
  add column if not exists is_mineral_linked boolean not null default false;
alter table cost_item
  add column if not exists mineral_code text;

-- Input currency is chosen per quotation (FR-1.4.1); mineral baseline is
-- captured when the quotation is created so later HPM movement can be
-- measured against it.
alter table pricing_proposal
  add column if not exists input_currency currency_code not null default 'IDR';
alter table pricing_proposal
  add column if not exists baseline_hpm_value numeric(18, 4);
alter table pricing_proposal
  add column if not exists baseline_hpm_snapshot_id uuid references mineral_index_snapshot (id);

-- Reproducibility: what rate and index produced this number (FR-1.4.3, FR-8.4).
alter table proposal_calculation_result
  add column if not exists exchange_rate_used numeric(18, 4) not null default 1;
alter table proposal_calculation_result
  add column if not exists exchange_rate_id uuid references exchange_rate (id);
alter table proposal_calculation_result
  add column if not exists hpm_value_used numeric(18, 4);
alter table proposal_calculation_result
  add column if not exists mineral_adjustment_factor numeric(12, 6) not null default 1;
alter table proposal_calculation_result
  add column if not exists input_currency currency_code not null default 'IDR';

-- ---------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------

alter table exchange_rate enable row level security;
alter table mineral_index_snapshot enable row level security;
alter table hpm_parameter enable row level security;

drop policy if exists "authenticated read exchange_rate" on exchange_rate;
create policy "authenticated read exchange_rate" on exchange_rate
  for select using (is_authenticated());

-- Rates are append-only by design: no update/delete policy exists, so
-- those are denied by RLS default-deny (same pattern as the audit log).
drop policy if exists "admin insert exchange_rate" on exchange_rate;
create policy "admin insert exchange_rate" on exchange_rate
  for insert with check (current_user_role() = 'SYSTEM_ADMIN');

drop policy if exists "authenticated read mineral_index" on mineral_index_snapshot;
create policy "authenticated read mineral_index" on mineral_index_snapshot
  for select using (is_authenticated());

drop policy if exists "admin insert mineral_index" on mineral_index_snapshot;
create policy "admin insert mineral_index" on mineral_index_snapshot
  for insert with check (current_user_role() = 'SYSTEM_ADMIN');

drop policy if exists "authenticated read hpm_parameter" on hpm_parameter;
create policy "authenticated read hpm_parameter" on hpm_parameter
  for select using (is_authenticated());

drop policy if exists "admin write hpm_parameter" on hpm_parameter;
create policy "admin write hpm_parameter" on hpm_parameter
  for all using (current_user_role() = 'SYSTEM_ADMIN')
  with check (current_user_role() = 'SYSTEM_ADMIN');

-- ---------------------------------------------------------------------
-- 6. SEED
-- ---------------------------------------------------------------------

-- Baseline rate matching the FX figure the engine already used.
insert into exchange_rate (base_currency, quote_currency, rate, source, effective_from)
select 'USD', 'IDR', 16350.00, 'seed-baseline', now() - interval '30 days'
where not exists (select 1 from exchange_rate);

-- HMA values from Simulasi_HPM_Nikel_Kepmen_2026.xlsx.
insert into mineral_index_snapshot
  (mineral_code, hma_value, period_start, period_end, regulation_ref, source)
select 'NI', 16646.00, current_date - 7, current_date, 'Kepmen ESDM No. 144.K/2026', 'seed-baseline'
where not exists (select 1 from mineral_index_snapshot where mineral_code = 'NI');

insert into mineral_index_snapshot
  (mineral_code, hma_value, period_start, period_end, regulation_ref, source)
select 'CO', 28500.00, current_date - 7, current_date, 'Kepmen ESDM No. 144.K/2026', 'seed-baseline'
where not exists (select 1 from mineral_index_snapshot where mineral_code = 'CO');

-- Nickel parameters at the 1.6% anchor grade.
insert into hpm_parameter
  (mineral_code, ni_content_pct, anchor_content_pct, anchor_cf_pct, cf_slope,
   co_content_pct, co_cf_pct, moisture_content_pct, companion_mineral_code, is_active)
select 'NI', 0.016, 0.016, 0.30, 10, 0.001, 0.20, 0.35, 'CO', true
where not exists (select 1 from hpm_parameter where mineral_code = 'NI');

-- Battery pack is the mineral-linked component in the demo CBS.
update cost_item
set is_mineral_linked = true, mineral_code = 'NI'
where code = 'BOM-BATT-001';
