-- =====================================================================
-- v2.0 — Commercial Quotation Alignment (part 2: tables & data)
--
-- MUST be run AFTER 0007 has been committed: Postgres forbids using a
-- newly added enum value in the same transaction that adds it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PARALLEL STEP SUPPORT
--    Two COGS owners validate concurrently, so several step rows share a
--    step_order. The old unique(workflow_definition_id, step_order)
--    constraint made that impossible.
-- ---------------------------------------------------------------------

alter table workflow_step_definition
  drop constraint if exists workflow_step_definition_workflow_definition_id_step_order_key;

alter table workflow_step_definition
  add column if not exists parallel_group_id text;

alter table workflow_step_definition
  add constraint workflow_step_definition_unique_step
  unique (workflow_definition_id, step_order, department_id);

-- ---------------------------------------------------------------------
-- 2. DISCOUNT AUTHORITY MATRIX (FR-6.1)
-- ---------------------------------------------------------------------

create table if not exists discount_authority (
  id uuid primary key default gen_random_uuid(),
  role user_role not null,
  business_line business_line,          -- null = applies to all lines
  max_discount_pct numeric(5, 2) not null,
  escalation_order int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_discount_authority_lookup
  on discount_authority (is_active, escalation_order);

-- ---------------------------------------------------------------------
-- 3. NEGOTIATION (FR-6.2 – FR-6.5)
-- ---------------------------------------------------------------------

do $$ begin
  create type negotiation_status as enum (
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'REVISED',
    'SUPERSEDED'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type negotiation_decision_type as enum ('APPROVE', 'REJECT', 'REVISE');
exception when duplicate_object then null;
end $$;

create table if not exists negotiation_request (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references pricing_proposal (id) on delete cascade,
  requested_discount_pct numeric(5, 2) not null,
  customer_note text,
  -- Computed by the server from the discount ladder, never client-supplied.
  required_role user_role not null,
  status negotiation_status not null default 'PENDING_APPROVAL',
  price_before numeric(18, 2) not null,
  price_after numeric(18, 2) not null,
  gpm_after numeric(8, 5) not null,
  is_below_gpm_threshold boolean not null default false,
  parent_request_id uuid references negotiation_request (id),
  requested_by uuid not null references profile (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_negotiation_proposal
  on negotiation_request (proposal_id, created_at desc);
create index if not exists idx_negotiation_status
  on negotiation_request (status);

create table if not exists negotiation_decision (
  id uuid primary key default gen_random_uuid(),
  negotiation_request_id uuid not null references negotiation_request (id) on delete cascade,
  actor_id uuid not null references profile (id),
  decision negotiation_decision_type not null,
  counter_discount_pct numeric(5, 2),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_negotiation_decision_request
  on negotiation_decision (negotiation_request_id, created_at);

-- Track the discount actually applied to a quotation.
alter table pricing_proposal
  add column if not exists applied_discount_pct numeric(5, 2) not null default 0;

-- Records that BOD signed off on a sub-threshold margin, which is the
-- only way canReleaseQuotation() lets such a quotation through.
alter table pricing_proposal
  add column if not exists has_bod_margin_approval boolean not null default false;

-- ---------------------------------------------------------------------
-- 4. RLS FOR NEW TABLES
-- ---------------------------------------------------------------------

alter table discount_authority enable row level security;
alter table negotiation_request enable row level security;
alter table negotiation_decision enable row level security;

drop policy if exists "authenticated read discount_authority" on discount_authority;
create policy "authenticated read discount_authority" on discount_authority
  for select using (is_authenticated());

drop policy if exists "admin write discount_authority" on discount_authority;
create policy "admin write discount_authority" on discount_authority
  for all using (current_user_role() = 'SYSTEM_ADMIN')
  with check (current_user_role() = 'SYSTEM_ADMIN');

drop policy if exists "authenticated read negotiation_request" on negotiation_request;
create policy "authenticated read negotiation_request" on negotiation_request
  for select using (is_authenticated());

drop policy if exists "authenticated write negotiation_request" on negotiation_request;
create policy "authenticated write negotiation_request" on negotiation_request
  for all using (is_authenticated()) with check (is_authenticated());

drop policy if exists "authenticated read negotiation_decision" on negotiation_decision;
create policy "authenticated read negotiation_decision" on negotiation_decision
  for select using (is_authenticated());

-- Decisions are append-only: insert is allowed, no update/delete policy
-- exists so those are denied by RLS default-deny (same pattern as the
-- audit log).
drop policy if exists "authenticated insert negotiation_decision" on negotiation_decision;
create policy "authenticated insert negotiation_decision" on negotiation_decision
  for insert with check (is_authenticated());

-- ---------------------------------------------------------------------
-- 5. DEPARTMENTS — new COGS-owner structure
-- ---------------------------------------------------------------------

insert into department (id, code, name, escalation_contact_name) values
  ('11111111-0000-0000-0000-000000000007', 'CHIEF_SALES', 'Chief Sales', 'Chief Sales Officer'),
  ('11111111-0000-0000-0000-000000000008', 'VP_FINANCE', 'VP Finance', 'CFO'),
  ('11111111-0000-0000-0000-000000000009', 'VP_OPERATIONS', 'VP Operations', 'COO'),
  ('11111111-0000-0000-0000-00000000000a', 'BOD', 'Board of Directors', 'President Director')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 6. REMAP COST ITEM OWNERSHIP TO COGS OWNERS
--    VP Operations owns unit/operational costs; VP Finance owns
--    financial and margin components (PRD v2.0 FR-1.1).
-- ---------------------------------------------------------------------

update cost_item
set owner_department_id = '11111111-0000-0000-0000-000000000009'  -- VP Operations
where category in ('DIRECT', 'INDIRECT');

update cost_item
set owner_department_id = '11111111-0000-0000-0000-000000000008'  -- VP Finance
where category = 'MARGIN_FACTOR';

-- Sales Commission is a commercial cost but its policy is set by Finance;
-- keeping it under VP Finance avoids a step that has no owner in the new flow.

-- New operational cost items called out explicitly in the requirement doc.
insert into cost_item (id, code, name, category, subcategory, owner_department_id, unit_type, is_mandatory) values
  ('22222222-0000-0000-0000-000000000010', 'OPS-STNK-001', 'STNK / Vehicle Registration', 'DIRECT', 'Registration', '11111111-0000-0000-0000-000000000009', 'PER_UNIT', true),
  ('22222222-0000-0000-0000-000000000011', 'OPS-DLV-001', 'Delivery & Handling', 'DIRECT', 'Delivery', '11111111-0000-0000-0000-000000000009', 'PER_UNIT', true),
  ('22222222-0000-0000-0000-000000000012', 'FIN-OPEX-001', 'OPEX / Overhead Allocation', 'INDIRECT', 'OPEX', '11111111-0000-0000-0000-000000000008', 'PER_UNIT', true)
on conflict (code) do nothing;

-- Attach the new items to every CBS template.
insert into cbs_template_item (template_id, cost_item_id, sort_order)
select t.id, c.id, 100
from cbs_template t
cross join cost_item c
where c.code in ('OPS-STNK-001', 'OPS-DLV-001', 'FIN-OPEX-001')
on conflict (template_id, cost_item_id) do nothing;

-- ---------------------------------------------------------------------
-- 7. WORKFLOW DEFINITIONS — parallel COGS validation
--    Step 1 & 2 share step_order 1 (parallel group), then Chief Sales.
-- ---------------------------------------------------------------------

delete from workflow_step_definition;
delete from workflow_definition;

insert into workflow_definition (id, business_line, name, min_value, max_value, is_active, version) values
  ('44444444-0000-0000-0000-00000000000a', 'B2G_TENDER_BUS', 'B2G Quotation Approval', 0, null, true, 2),
  ('44444444-0000-0000-0000-00000000000b', 'B2B_COMMERCIAL_FLEET', 'B2B Quotation Approval', 0, null, true, 2),
  ('44444444-0000-0000-0000-00000000000c', 'CHARGING_INFRA_BUILDOUT', 'Charging Infra Quotation Approval', 0, null, true, 2);

-- Each line: two parallel COGS validators (step_order 1), then Chief Sales (2).
insert into workflow_step_definition
  (workflow_definition_id, step_order, department_id, status_label, is_mandatory_gate, sla_hours, parallel_group_id)
select wd.id, 1, '11111111-0000-0000-0000-000000000008', 'PENDING_COGS_VALIDATION', true, 24, 'COGS'
from workflow_definition wd where wd.version = 2;

insert into workflow_step_definition
  (workflow_definition_id, step_order, department_id, status_label, is_mandatory_gate, sla_hours, parallel_group_id)
select wd.id, 1, '11111111-0000-0000-0000-000000000009', 'PENDING_COGS_VALIDATION', true, 24, 'COGS'
from workflow_definition wd where wd.version = 2;

insert into workflow_step_definition
  (workflow_definition_id, step_order, department_id, status_label, is_mandatory_gate, sla_hours, parallel_group_id)
select wd.id, 2, '11111111-0000-0000-0000-000000000007', 'PENDING_CHIEF_SALES_REVIEW', true, 24, null
from workflow_definition wd where wd.version = 2;

-- ---------------------------------------------------------------------
-- 8. DISCOUNT AUTHORITY LADDER (illustrative — confirm with Chief Sales/BOD)
-- ---------------------------------------------------------------------

delete from discount_authority;

insert into discount_authority (role, business_line, max_discount_pct, escalation_order, is_active) values
  ('SALES_OFFICER', null, 3.00, 1, true),
  ('CHIEF_SALES',   null, 8.00, 2, true),
  ('BOD',           null, 100.00, 3, true);

-- ---------------------------------------------------------------------
-- 9. MIGRATE EXISTING PROPOSAL STATUSES
--    Old in-flight statuses no longer exist in the new flow.
-- ---------------------------------------------------------------------

update pricing_proposal
set current_status = 'QUOTATION_RELEASED'
where current_status = 'FINAL_APPROVED';

update pricing_proposal
set current_status = 'DRAFT', current_step_order = 0, workflow_definition_id = null
where current_status in (
  'PENDING_PROCUREMENT',
  'PENDING_ENGINEERING_REVIEW',
  'PENDING_FINANCE_APPROVAL',
  'PENDING_CLEVEL_SIGNOFF'
);
