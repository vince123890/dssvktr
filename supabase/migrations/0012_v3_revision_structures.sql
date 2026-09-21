-- =====================================================================
-- v3.0 — Post-Demo Revision (part 2: tables & columns)
--
-- MUST run AFTER 0011 has been committed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COST ITEM — cost_group is the new formula basis (FR-1.1).
--    `category` (DIRECT/INDIRECT) is kept as an independent reporting
--    tag for Finance, no longer read by the pricing engine.
--    `denomination` lets each line item carry its own currency, since
--    the real CBS mixes CNY (FOB Price) and IDR (everything else) in
--    one structure — unlike the old single input_currency toggle.
--    `may_follow_later` marks items like Delivery Service that must
--    not block base-price calculation (FR-2.0) but are still required
--    before QUOTATION_RELEASED (FR-2.2).
-- ---------------------------------------------------------------------

alter table cost_item
  add column if not exists cost_group cost_group not null default 'COGS';
alter table cost_item
  add column if not exists may_follow_later boolean not null default false;
alter table cost_item
  add column if not exists denomination currency_code not null default 'IDR';

create index if not exists idx_cost_item_cost_group on cost_item (cost_group);

-- ---------------------------------------------------------------------
-- 2. WORKFLOW DEFINITION — qualifier_type makes template selection
--    explicit (FR-2.0.1), instead of an implicit business_line match.
-- ---------------------------------------------------------------------

alter table workflow_definition
  add column if not exists qualifier_type text not null default 'GENERIC'
    check (qualifier_type in ('BUSINESS_LINE', 'MARGIN_TIER', 'GENERIC'));

-- ---------------------------------------------------------------------
-- 3. PROJECT IDENTIFIER (FR-2.5) — links quotation revisions for the
--    same customer + project so price history stays intact.
-- ---------------------------------------------------------------------

create table if not exists project_identifier (
  id uuid primary key default gen_random_uuid(),
  identifier_code text not null unique,
  customer_name text not null,
  project_name text not null,
  created_by uuid references profile (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_project_identifier_customer
  on project_identifier (customer_name);

alter table pricing_proposal
  add column if not exists project_identifier_id uuid references project_identifier (id);
alter table pricing_proposal
  add column if not exists supersedes_proposal_id uuid references pricing_proposal (id);

create index if not exists idx_proposal_project_identifier
  on pricing_proposal (project_identifier_id);

-- ---------------------------------------------------------------------
-- 4. PRODUCT MASTER DATA (FR-1.5) — managed by Product Owner, separate
--    from cost structure. Referenced by a proposal version so a
--    quotation's PDF can pull spec/images without re-entry.
-- ---------------------------------------------------------------------

create table if not exists product_master_data (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  chassis_variant text,
  body_variant text,
  spec_sheet jsonb not null default '{}'::jsonb,
  image_urls text[] not null default '{}',
  brochure_url text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'DISCONTINUED')),
  created_by uuid references profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_product_master_data_updated_at
  before update on product_master_data
  for each row execute function set_updated_at();

alter table pricing_proposal_version
  add column if not exists product_master_data_id uuid references product_master_data (id);

-- ---------------------------------------------------------------------
-- 5. QUOTATION DOCUMENT TEMPLATE (FR-1.5.3) — data model only; no PDF
--    generator is built in this iteration.
-- ---------------------------------------------------------------------

create table if not exists quotation_document_template (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  applies_to text,
  layout_schema jsonb not null default '{}'::jsonb,
  version int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. MARGIN TIER AUTHORITY (FR-6.1) — replaces discount_authority.
--    Tier is resolved from the GPM that results *after* a discount,
--    not from the discount percentage itself.
-- ---------------------------------------------------------------------

create table if not exists margin_tier_authority (
  id uuid primary key default gen_random_uuid(),
  tier int not null check (tier in (1, 2, 3)),
  business_line business_line,          -- null = applies to all lines
  gpm_lower_bound_pct numeric(6, 4),     -- null = no lower bound
  gpm_upper_bound_pct numeric(6, 4),     -- null = no upper bound
  required_roles jsonb not null default '[]'::jsonb,  -- user_role[] as text
  allow_bod_delegation boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_margin_tier_lookup
  on margin_tier_authority (is_active, tier);

-- discount_authority is left in place (unused by application code from
-- v3.0 onward) rather than dropped, to avoid breaking any historical
-- reference to it.

-- ---------------------------------------------------------------------
-- 7. RATE SENSITIVITY THRESHOLD (FR-1.4.6) — a rate move only surfaces
--    a notification once it exceeds this percentage; it never triggers
--    an automatic recalculation.
-- ---------------------------------------------------------------------

create table if not exists rate_sensitivity_config (
  id uuid primary key default gen_random_uuid(),
  threshold_pct numeric(6, 4) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table exchange_rate
  add column if not exists pulled_at timestamptz;

alter table pricing_proposal
  add column if not exists last_calculated_rate_id uuid references exchange_rate (id);

-- ---------------------------------------------------------------------
-- 8. NEGOTIATION REQUEST — margin-tier basis, dual-mode discount input
--    (FR-6.1.1). `required_role` (v2.0) is kept nullable for backward
--    read-compatibility but no longer written by application code.
-- ---------------------------------------------------------------------

alter table negotiation_request
  alter column required_role drop not null;

alter table negotiation_request
  add column if not exists discount_input_mode text not null default 'PERCENTAGE'
    check (discount_input_mode in ('AMOUNT', 'PERCENTAGE'));
alter table negotiation_request
  add column if not exists requested_discount_amount numeric(18, 2);
alter table negotiation_request
  add column if not exists required_tier int check (required_tier in (1, 2, 3));
alter table negotiation_request
  add column if not exists required_roles_snapshot jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------
-- 9. NEGOTIATION DECISION — multi-row AND-join per request (Tier 2 = 3
--    parties, Tier 3 = 2 different BOD members). `approver_role`
--    records which role the actor signed as; combined with actor_id it
--    lets Tier 3 require two *different* BOD people, not just "the BOD
--    role approved once".
-- ---------------------------------------------------------------------

alter table negotiation_decision
  add column if not exists approver_role user_role;
alter table negotiation_decision
  add column if not exists counter_discount_amount numeric(18, 2);

-- Backfill is unnecessary (no pre-existing negotiation_decision rows
-- are expected to survive the v3.0 data reset — see 0013), but the
-- column is left nullable for schema safety.

-- ---------------------------------------------------------------------
-- 10. RLS for new tables
-- ---------------------------------------------------------------------

alter table project_identifier enable row level security;
alter table product_master_data enable row level security;
alter table quotation_document_template enable row level security;
alter table margin_tier_authority enable row level security;
alter table rate_sensitivity_config enable row level security;

drop policy if exists "authenticated read project_identifier" on project_identifier;
create policy "authenticated read project_identifier" on project_identifier
  for select using (is_authenticated());

drop policy if exists "authenticated insert project_identifier" on project_identifier;
create policy "authenticated insert project_identifier" on project_identifier
  for insert with check (is_authenticated());

drop policy if exists "authenticated read product_master_data" on product_master_data;
create policy "authenticated read product_master_data" on product_master_data
  for select using (is_authenticated());

drop policy if exists "product owner write product_master_data" on product_master_data;
create policy "product owner write product_master_data" on product_master_data
  for all
  using (current_user_role() in ('PRODUCT_OWNER', 'SYSTEM_ADMIN'))
  with check (current_user_role() in ('PRODUCT_OWNER', 'SYSTEM_ADMIN'));

drop policy if exists "authenticated read quotation_document_template" on quotation_document_template;
create policy "authenticated read quotation_document_template" on quotation_document_template
  for select using (is_authenticated());

drop policy if exists "admin write quotation_document_template" on quotation_document_template;
create policy "admin write quotation_document_template" on quotation_document_template
  for all
  using (current_user_role() = 'SYSTEM_ADMIN')
  with check (current_user_role() = 'SYSTEM_ADMIN');

drop policy if exists "authenticated read margin_tier_authority" on margin_tier_authority;
create policy "authenticated read margin_tier_authority" on margin_tier_authority
  for select using (is_authenticated());

drop policy if exists "admin write margin_tier_authority" on margin_tier_authority;
create policy "admin write margin_tier_authority" on margin_tier_authority
  for all
  using (current_user_role() = 'SYSTEM_ADMIN')
  with check (current_user_role() = 'SYSTEM_ADMIN');

drop policy if exists "authenticated read rate_sensitivity_config" on rate_sensitivity_config;
create policy "authenticated read rate_sensitivity_config" on rate_sensitivity_config
  for select using (is_authenticated());

drop policy if exists "admin write rate_sensitivity_config" on rate_sensitivity_config;
create policy "admin write rate_sensitivity_config" on rate_sensitivity_config
  for all
  using (current_user_role() = 'SYSTEM_ADMIN')
  with check (current_user_role() = 'SYSTEM_ADMIN');
