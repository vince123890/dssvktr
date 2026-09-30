-- =====================================================================
-- v4.0 — VKTR confirmation (part 2: tables & columns)
--
-- MUST run AFTER 0014 has been committed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ROLES AS DATA (PRD FR-5.6, Technical Logic §2.1)
--    The Actors sheet is configuration, not code: app roles can be
--    added/renamed from Settings. Application logic only ever checks
--    the fixed *functional* roles a role carries (SALESPERSON,
--    COGS_OWNER, ...), never an app role's name.
--    profile.role (enum user_role) is kept as a legacy column: the v1-v3
--    RLS policies still read it through current_user_role(), so it is
--    maintained alongside app_role_code (SYSTEM_ADMIN / PRODUCT_OWNER
--    keep their meaning there).
-- ---------------------------------------------------------------------

create table if not exists app_role (
  code text primary key,
  name text not null,
  functional_roles text[] not null default '{}',
  is_external boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_app_role_updated_at on app_role;
create trigger trg_app_role_updated_at
  before update on app_role
  for each row execute function set_updated_at();

alter table profile
  add column if not exists app_role_code text references app_role (code) on update cascade;

create or replace function current_app_role()
returns text as $$
  select app_role_code from profile where id = auth.uid();
$$ language sql stable security definer set search_path = public;

create or replace function current_user_has_function(fn text)
returns boolean as $$
  select exists (
    select 1
    from profile p
    join app_role r on r.code = p.app_role_code
    where p.id = auth.uid() and r.is_active and fn = any (r.functional_roles)
  );
$$ language sql stable security definer set search_path = public;

-- New auth users pick up their app role from signup metadata (used by
-- the seed script), mirroring how `role` was already provisioned.
create or replace function handle_new_user()
returns trigger as $$
declare
  v_role user_role;
  v_dept_id uuid;
  v_app_role text;
begin
  v_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::user_role,
    'SALES_OFFICER'
  );

  select id into v_dept_id
  from department
  where code = coalesce(
    (new.raw_user_meta_data ->> 'department_code')::department_code,
    'SALES'
  );

  select code into v_app_role
  from app_role
  where code = new.raw_user_meta_data ->> 'app_role_code';

  insert into profile (id, full_name, email, role, department_id, app_role_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    v_role,
    v_dept_id,
    v_app_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------
-- 2. SCOPE AUTHORITY — role x scope x scenario x Maker/Checker/Releaser
--    (sheet Actors). Scenario REGULAR = GM >= deviation threshold,
--    DEVIATION = GM below it (default 10%).
-- ---------------------------------------------------------------------

create table if not exists scope_authority (
  id uuid primary key default gen_random_uuid(),
  app_role_code text not null references app_role (code) on update cascade on delete cascade,
  scope text not null check (scope in ('COGS', 'ADD_ONS', 'MARGIN', 'SALES')),
  scenario text not null check (scenario in ('REGULAR', 'DEVIATION')),
  can_make boolean not null default false,
  can_check boolean not null default false,
  can_release boolean not null default false,
  unique (app_role_code, scope, scenario)
);

create table if not exists scope_segregation_rule (
  scope text primary key check (scope in ('COGS', 'ADD_ONS', 'MARGIN', 'SALES')),
  maker_ne_checker boolean not null default true,
  checker_ne_releaser boolean not null default false,
  allow_single_actor boolean not null default true
);

-- ---------------------------------------------------------------------
-- 3. APP SETTINGS — small key/value master config (VAT, validity,
--    document template text, deviation threshold, fraud guard limit).
-- ---------------------------------------------------------------------

create table if not exists app_setting (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profile (id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. QUANTITY BAND (FR-2.8)
-- ---------------------------------------------------------------------

create table if not exists quantity_band_config (
  band int primary key,
  min_qty int not null check (min_qty >= 1),
  max_qty int,
  processing_mode text not null check (processing_mode in ('AUTO', 'AUTO_WITH_MANUAL', 'MANUAL')),
  default_discount_pct numeric(6, 3) not null default 0
);

-- ---------------------------------------------------------------------
-- 5. MARGIN TIER AUTHORITY — decision/cc slots (v4.0). A slot is a
--    functional role ("COGS_OWNER") or a specific app role
--    ("role:CCO"). required_roles/allow_bod_delegation (v3.0) remain
--    as unused columns.
-- ---------------------------------------------------------------------

alter table margin_tier_authority
  add column if not exists decision_slots jsonb not null default '[]'::jsonb;
alter table margin_tier_authority
  add column if not exists cc_slots jsonb not null default '[]'::jsonb;
alter table margin_tier_authority
  add column if not exists reject_target text not null default 'SALES_OPERATIONS';

-- ---------------------------------------------------------------------
-- 6. PRODUCT VARIANT ATTRIBUTES (FR-1.5.1)
-- ---------------------------------------------------------------------

alter table product_master_data add column if not exists make text;
alter table product_master_data add column if not exists model text;
alter table product_master_data add column if not exists variant_type text;
alter table product_master_data add column if not exists variant text;
alter table product_master_data add column if not exists wheelbase text;
alter table product_master_data add column if not exists battery_kwh numeric(8, 2);
alter table product_master_data add column if not exists body_application text;
alter table product_master_data add column if not exists build_type text;
alter table product_master_data add column if not exists loco text;
alter table product_master_data add column if not exists document_description text;
alter table product_master_data add column if not exists default_inclusions text[] not null default '{}';
alter table product_master_data add column if not exists default_exclusions text[] not null default '{}';

-- ---------------------------------------------------------------------
-- 7. COST ITEM — derived items (FOB Price in IDR) and the label an
--    excluded may_follow_later item prints under "Exclusions".
-- ---------------------------------------------------------------------

alter table cost_item add column if not exists is_derived boolean not null default false;
alter table cost_item add column if not exists exclusion_label text;

-- ---------------------------------------------------------------------
-- 8. COST STRUCTURE PER VARIANT (FR-1.1.2) — a versioned price book;
--    each of the four scopes is released through Maker -> Checker ->
--    Releaser before a version can price anything.
-- ---------------------------------------------------------------------

create table if not exists cost_structure_version (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references product_master_data (id),
  version_no int not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'RELEASED', 'RETIRED')),
  locked_fx_rate_id uuid references exchange_rate (id),
  locked_fx_rate numeric(18, 4) not null,
  parent_version_id uuid references cost_structure_version (id),
  change_reason text,
  is_seed boolean not null default false,
  released_at timestamptz,
  created_by uuid references profile (id),
  created_at timestamptz not null default now(),
  unique (product_id, version_no)
);

create index if not exists idx_csv_product on cost_structure_version (product_id, status);

create table if not exists cost_structure_line (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references cost_structure_version (id) on delete cascade,
  cost_item_id uuid not null references cost_item (id),
  value numeric(18, 4) not null default 0,
  is_excluded_at_cost boolean not null default false,
  unique (version_id, cost_item_id)
);

create table if not exists cost_structure_scope_state (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references cost_structure_version (id) on delete cascade,
  scope text not null check (scope in ('COGS', 'ADD_ONS', 'MARGIN', 'SALES')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'MADE', 'CHECKED', 'RELEASED', 'RETURNED')),
  scenario text not null default 'REGULAR' check (scenario in ('REGULAR', 'DEVIATION')),
  carried_over boolean not null default false,
  maker_id uuid references profile (id),
  made_at timestamptz,
  checker_id uuid references profile (id),
  checked_at timestamptz,
  releaser_id uuid references profile (id),
  released_at timestamptz,
  note text,
  single_actor_flag boolean not null default false,
  unique (version_id, scope)
);

-- ---------------------------------------------------------------------
-- 9. OFFICIAL QUOTATION — KYC, generation, tier, document fields
-- ---------------------------------------------------------------------

alter table pricing_proposal add column if not exists kyc jsonb not null default '{}'::jsonb;
alter table pricing_proposal add column if not exists initiator_role_code text;
alter table pricing_proposal add column if not exists account_person_ids uuid[] not null default '{}';
alter table pricing_proposal add column if not exists prepared_by uuid references profile (id);
alter table pricing_proposal add column if not exists quantity_band int;
alter table pricing_proposal add column if not exists processing_mode text;
alter table pricing_proposal add column if not exists scenario text;
alter table pricing_proposal add column if not exists margin_tier int;
alter table pricing_proposal add column if not exists gm numeric(10, 6);
alter table pricing_proposal add column if not exists total_ex_vat numeric(20, 2) not null default 0;
alter table pricing_proposal add column if not exists total_incl_vat numeric(20, 2) not null default 0;
alter table pricing_proposal add column if not exists vat_rate_pct numeric(6, 3);
alter table pricing_proposal add column if not exists document_number text unique;
alter table pricing_proposal add column if not exists released_at timestamptz;
alter table pricing_proposal add column if not exists valid_until date;
alter table pricing_proposal add column if not exists inclusions text[] not null default '{}';
alter table pricing_proposal add column if not exists exclusions text[] not null default '{}';
alter table pricing_proposal add column if not exists special_notes text[] not null default '{}';
alter table pricing_proposal add column if not exists tier_round int not null default 0;
alter table pricing_proposal add column if not exists accepted_document_url text;
alter table pricing_proposal add column if not exists is_seed boolean not null default false;

create table if not exists quotation_line_item (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references pricing_proposal (id) on delete cascade,
  product_id uuid not null references product_master_data (id),
  quantity int not null check (quantity >= 1),
  sort_order int not null default 0,
  cost_structure_version_id uuid references cost_structure_version (id),
  locked_fx_rate numeric(18, 4),
  scheme text not null default 'PURCHASE' check (scheme in ('PURCHASE', 'RENTAL')),
  rental_tenor_months int,
  rental_monthly_incl_vat numeric(20, 2),
  list_price_ex_vat numeric(20, 2) not null default 0,
  base_cost numeric(20, 2) not null default 0,
  margin_amount numeric(20, 2) not null default 0,
  sales_cost numeric(20, 2) not null default 0,
  discount_input_mode text not null default 'PERCENTAGE' check (discount_input_mode in ('AMOUNT', 'PERCENTAGE')),
  discount_amount numeric(20, 2) not null default 0,
  discount_pct numeric(10, 6) not null default 0,
  discount_source text,
  net_price_ex_vat numeric(20, 2) not null default 0,
  net_price_incl_vat numeric(20, 2) not null default 0,
  line_total_ex_vat numeric(20, 2) not null default 0,
  line_total_incl_vat numeric(20, 2) not null default 0,
  gm numeric(10, 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_qli_proposal on quotation_line_item (proposal_id);

drop trigger if exists trg_qli_updated_at on quotation_line_item;
create trigger trg_qli_updated_at
  before update on quotation_line_item
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 10. WORKFLOW — configurable steps (FR-2.1): performer is a functional
--     role, steps can be skipped by initiator role, and each step knows
--     where a rejection goes. Department is no longer required.
-- ---------------------------------------------------------------------

alter table workflow_definition
  add column if not exists workflow_kind text not null default 'OFFICIAL_QUOTATION';
alter table workflow_definition
  add column if not exists allowed_functions text[] not null default '{}';

alter table workflow_step_definition alter column department_id drop not null;
alter table workflow_step_definition add column if not exists step_name text;
alter table workflow_step_definition add column if not exists action_kind text;
alter table workflow_step_definition add column if not exists performer_function text;
alter table workflow_step_definition add column if not exists skip_if_initiator_function text;
alter table workflow_step_definition add column if not exists reject_to_step_order int;
alter table workflow_step_definition add column if not exists cc_functions text[] not null default '{}';

alter table workflow_step_instance alter column department_id drop not null;
alter table workflow_step_instance alter column step_definition_id drop not null;
alter table workflow_step_instance add column if not exists step_name text;
alter table workflow_step_instance add column if not exists action_kind text;
alter table workflow_step_instance add column if not exists performer_function text;
alter table workflow_step_instance add column if not exists skip_if_initiator_function text;
alter table workflow_step_instance add column if not exists reject_to_step_order int;
alter table workflow_step_instance add column if not exists status_label proposal_status;

-- ---------------------------------------------------------------------
-- 11. TIER APPROVAL (FR-6.1) — one row per decision slot or cc per
--     routing round; a new round voids the previous one.
-- ---------------------------------------------------------------------

create table if not exists tier_approval (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references pricing_proposal (id) on delete cascade,
  round int not null,
  tier int not null,
  slot text not null,
  kind text not null check (kind in ('DECISION', 'CC')),
  actor_id uuid references profile (id),
  decision text check (decision in ('APPROVE', 'REJECT')),
  note text,
  is_void boolean not null default false,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists idx_tier_approval_proposal on tier_approval (proposal_id, round);

-- ---------------------------------------------------------------------
-- 12. PRICE ESTIMATE LOG (FR-2.7)
-- ---------------------------------------------------------------------

create table if not exists price_estimate_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profile (id),
  product_id uuid not null references product_master_data (id),
  cost_structure_version_id uuid references cost_structure_version (id),
  price_ex_vat numeric(20, 2) not null,
  price_incl_vat numeric(20, 2) not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 13. RLS
--     Config tables: read for any authenticated user, write for the
--     SYSTEM_ADMIN functional role. Transactional tables follow the
--     existing pattern — authenticated writes, with the state machine
--     and Maker/Checker/Releaser rules enforced in the service layer.
-- ---------------------------------------------------------------------

alter table app_role enable row level security;
alter table scope_authority enable row level security;
alter table scope_segregation_rule enable row level security;
alter table app_setting enable row level security;
alter table quantity_band_config enable row level security;
alter table cost_structure_version enable row level security;
alter table cost_structure_line enable row level security;
alter table cost_structure_scope_state enable row level security;
alter table quotation_line_item enable row level security;
alter table tier_approval enable row level security;
alter table price_estimate_log enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'app_role', 'scope_authority', 'scope_segregation_rule', 'app_setting',
    'quantity_band_config', 'cost_structure_version', 'cost_structure_line',
    'cost_structure_scope_state', 'quotation_line_item', 'tier_approval',
    'price_estimate_log'
  ] loop
    execute format('drop policy if exists "authenticated read %1$s" on %1$I', t);
    execute format(
      'create policy "authenticated read %1$s" on %1$I for select using (is_authenticated())', t);
  end loop;

  foreach t in array array[
    'app_role', 'scope_authority', 'scope_segregation_rule', 'app_setting',
    'quantity_band_config'
  ] loop
    execute format('drop policy if exists "admin write %1$s" on %1$I', t);
    execute format(
      'create policy "admin write %1$s" on %1$I for all using (current_user_has_function(''SYSTEM_ADMIN'')) with check (current_user_has_function(''SYSTEM_ADMIN''))', t);
  end loop;

  foreach t in array array[
    'cost_structure_version', 'cost_structure_line', 'cost_structure_scope_state',
    'quotation_line_item', 'tier_approval', 'price_estimate_log'
  ] loop
    execute format('drop policy if exists "authenticated write %1$s" on %1$I', t);
    execute format(
      'create policy "authenticated write %1$s" on %1$I for all using (is_authenticated()) with check (is_authenticated())', t);
  end loop;
end $$;

-- Settings edits margin tiers and workflow templates through the
-- SYSTEM_ADMIN functional role as well (legacy policies check the old
-- enum; this keeps both paths open for an admin).
drop policy if exists "settings write margin_tier_authority" on margin_tier_authority;
create policy "settings write margin_tier_authority" on margin_tier_authority
  for all using (current_user_has_function('SYSTEM_ADMIN'))
  with check (current_user_has_function('SYSTEM_ADMIN'));

drop policy if exists "settings write workflow_definition" on workflow_definition;
create policy "settings write workflow_definition" on workflow_definition
  for all using (current_user_has_function('SYSTEM_ADMIN'))
  with check (current_user_has_function('SYSTEM_ADMIN'));

drop policy if exists "settings write workflow_step_definition" on workflow_step_definition;
create policy "settings write workflow_step_definition" on workflow_step_definition
  for all using (current_user_has_function('SYSTEM_ADMIN'))
  with check (current_user_has_function('SYSTEM_ADMIN'));

-- Project identifiers are looked up (not only inserted) by Salespeople
-- choosing "tambahan/penggantian proyek berjalan".
drop policy if exists "authenticated update project_identifier" on project_identifier;
create policy "authenticated update project_identifier" on project_identifier
  for update using (is_authenticated());

-- Exchange rates may be recorded by an admin via the functional role.
drop policy if exists "settings write exchange_rate" on exchange_rate;
create policy "settings write exchange_rate" on exchange_rate
  for insert with check (current_user_has_function('SYSTEM_ADMIN'));

-- Product master data: Product Owner functional role.
drop policy if exists "product function write product_master_data" on product_master_data;
create policy "product function write product_master_data" on product_master_data
  for all
  using (current_user_has_function('PRODUCT_OWNER') or current_user_has_function('SYSTEM_ADMIN'))
  with check (current_user_has_function('PRODUCT_OWNER') or current_user_has_function('SYSTEM_ADMIN'));

-- Settings → Roles & Users assigns app roles to existing profiles.
drop policy if exists "settings manage profile" on profile;
create policy "settings manage profile" on profile
  for update using (current_user_has_function('SYSTEM_ADMIN'))
  with check (current_user_has_function('SYSTEM_ADMIN'));
