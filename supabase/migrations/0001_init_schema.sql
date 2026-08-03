-- =====================================================================
-- VKTR-PriceCore POC — Initial Schema
-- Mirrors docs/TECHNICAL-LOGIC-VKTR-PriceCore.md §2 Core Data Model
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------

create type department_code as enum (
  'PROCUREMENT',
  'ENGINEERING',
  'FINANCE',
  'SALES',
  'C_LEVEL',
  'ADMIN'
);

create type user_role as enum (
  'PROCUREMENT_ANALYST',
  'COST_ENGINEER',
  'FINANCE_CONTROLLER',
  'SALES_MANAGER',
  'C_LEVEL',
  'SYSTEM_ADMIN'
);

create type cost_category as enum (
  'DIRECT',
  'INDIRECT',
  'MARGIN_FACTOR'
);

create type unit_type as enum (
  'FIXED',
  'PER_UNIT',
  'PERCENTAGE'
);

create type business_line as enum (
  'B2G_TENDER_BUS',
  'B2B_COMMERCIAL_FLEET',
  'CHARGING_INFRA_BUILDOUT'
);

create type proposal_status as enum (
  'DRAFT',
  'PENDING_PROCUREMENT',
  'PENDING_ENGINEERING_REVIEW',
  'PENDING_FINANCE_APPROVAL',
  'PENDING_CLEVEL_SIGNOFF',
  'FINAL_APPROVED',
  'REJECTED',
  'CONFIG_ERROR'
);

create type step_status as enum (
  'PENDING',
  'IN_PROGRESS',
  'APPROVED',
  'APPROVED_WITH_CONDITIONS',
  'REJECTED',
  'SKIPPED_NOT_APPLICABLE'
);

create type proposal_outcome as enum (
  'PENDING',
  'WON',
  'LOST',
  'CANCELLED'
);

create type audit_action as enum (
  'CREATE',
  'UPDATE',
  'SUBMIT',
  'APPROVE',
  'APPROVE_WITH_CONDITIONS',
  'REJECT',
  'TARGETED_REJECT',
  'ESCALATE',
  'RECALCULATE',
  'ADD_COST_ITEM'
);

-- ---------------------------------------------------------------------
-- ORG STRUCTURE
-- ---------------------------------------------------------------------

create table department (
  id uuid primary key default gen_random_uuid(),
  code department_code not null unique,
  name text not null,
  escalation_contact_name text,
  created_at timestamptz not null default now()
);

create table profile (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role user_role not null,
  department_id uuid references department (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- MASTER DATA: COST ITEMS, MARGIN FACTORS
-- ---------------------------------------------------------------------

create table cost_item (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category cost_category not null,
  subcategory text not null,
  owner_department_id uuid not null references department (id),
  unit_type unit_type not null default 'FIXED',
  is_mandatory boolean not null default true,
  active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cost_item_category on cost_item (category);
create index idx_cost_item_owner_dept on cost_item (owner_department_id);

-- ---------------------------------------------------------------------
-- CBS TEMPLATE (per business line) — pricing template management FR-1.3
-- ---------------------------------------------------------------------

create table cbs_template (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_line business_line not null,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  min_gpm_threshold numeric(6, 4) not null default 0.12, -- FR-4.2 guardrail
  escalation_threshold_value numeric(18, 2) not null default 50000000000, -- Rp 50 Miliar default
  version int not null default 1,
  created_at timestamptz not null default now()
);

create table cbs_template_item (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references cbs_template (id) on delete cascade,
  cost_item_id uuid not null references cost_item (id),
  sort_order int not null default 0,
  unique (template_id, cost_item_id)
);

create index idx_cbs_template_item_template on cbs_template_item (template_id);

-- ---------------------------------------------------------------------
-- WORKFLOW DEFINITION (FR-2.1) — configurable per business line + value bucket
-- ---------------------------------------------------------------------

create table workflow_definition (
  id uuid primary key default gen_random_uuid(),
  business_line business_line not null,
  name text not null,
  min_value numeric(18, 2) not null default 0,
  max_value numeric(18, 2), -- null = no upper bound
  is_active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now()
);

create table workflow_step_definition (
  id uuid primary key default gen_random_uuid(),
  workflow_definition_id uuid not null references workflow_definition (id) on delete cascade,
  step_order int not null,
  department_id uuid not null references department (id),
  status_label proposal_status not null,
  is_mandatory_gate boolean not null default true,
  sla_hours int not null default 24,
  unique (workflow_definition_id, step_order)
);

create index idx_wf_step_def_workflow on workflow_step_definition (workflow_definition_id);

-- ---------------------------------------------------------------------
-- PRICING PROPOSAL (root transaction) + VERSIONING
-- ---------------------------------------------------------------------

create table pricing_proposal (
  id uuid primary key default gen_random_uuid(),
  proposal_number text not null unique,
  title text not null,
  business_line business_line not null,
  customer_name text,
  cbs_template_id uuid not null references cbs_template (id),
  workflow_definition_id uuid references workflow_definition (id),
  current_status proposal_status not null default 'DRAFT',
  current_step_order int not null default 0,
  transaction_value numeric(18, 2) not null default 0,
  outcome proposal_outcome not null default 'PENDING',
  unit_quantity int not null default 1,
  created_by uuid not null references profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_proposal_status on pricing_proposal (current_status);
create index idx_proposal_business_line on pricing_proposal (business_line);
create index idx_proposal_created_at on pricing_proposal (created_at);

create table pricing_proposal_version (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references pricing_proposal (id) on delete cascade,
  version_label text not null, -- 'v1.0', 'v1.1'
  parent_version_id uuid references pricing_proposal_version (id),
  change_reason text,
  is_current boolean not null default true,
  created_by uuid not null references profile (id),
  created_at timestamptz not null default now()
);

create index idx_ppv_proposal on pricing_proposal_version (proposal_id);

-- snapshot of every cost line's input value for a given version
create table proposal_cost_line (
  id uuid primary key default gen_random_uuid(),
  proposal_version_id uuid not null references pricing_proposal_version (id) on delete cascade,
  cost_item_id uuid not null references cost_item (id),
  value numeric(18, 4) not null default 0,
  notes text,
  filled_by uuid references profile (id),
  filled_at timestamptz default now(),
  unique (proposal_version_id, cost_item_id)
);

create index idx_pcl_version on proposal_cost_line (proposal_version_id);

-- calculation result snapshot (GPM, EBITDA, BEP, price breakdown) — immutable
create table proposal_calculation_result (
  id uuid primary key default gen_random_uuid(),
  proposal_version_id uuid not null references pricing_proposal_version (id) on delete cascade,
  total_direct_cost numeric(18, 2) not null,
  total_indirect_cost numeric(18, 2) not null,
  total_margin_amount numeric(18, 2) not null,
  final_price numeric(18, 2) not null,
  gpm numeric(8, 5) not null, -- gross profit margin ratio
  ebitda_contribution numeric(18, 2) not null,
  bep_units numeric(10, 2),
  fx_usd_idr_rate numeric(10, 2) not null,
  breakdown jsonb not null default '{}'::jsonb, -- full per-item computed breakdown for reproducibility
  is_below_gpm_threshold boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_pcr_version on proposal_calculation_result (proposal_version_id);

-- ---------------------------------------------------------------------
-- WORKFLOW INSTANCE (runtime state machine per proposal version)
-- ---------------------------------------------------------------------

create table workflow_instance (
  id uuid primary key default gen_random_uuid(),
  proposal_version_id uuid not null references pricing_proposal_version (id) on delete cascade,
  workflow_definition_id uuid not null references workflow_definition (id),
  status text not null default 'RUNNING' check (status in ('RUNNING', 'COMPLETED', 'REJECTED')),
  created_at timestamptz not null default now()
);

create table workflow_step_instance (
  id uuid primary key default gen_random_uuid(),
  workflow_instance_id uuid not null references workflow_instance (id) on delete cascade,
  step_definition_id uuid not null references workflow_step_definition (id),
  step_order int not null,
  department_id uuid not null references department (id),
  status step_status not null default 'PENDING',
  sla_hours int not null default 24,
  started_at timestamptz,
  sla_due_at timestamptz,
  completed_at timestamptz,
  actor_id uuid references profile (id),
  decision_note text,
  escalation_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_wsi_instance on workflow_step_instance (workflow_instance_id);
create index idx_wsi_status on workflow_step_instance (status);
create index idx_wsi_sla_due on workflow_step_instance (sla_due_at);

-- ---------------------------------------------------------------------
-- IMMUTABLE AUDIT TRAIL (FR-3.3) — append-only
-- ---------------------------------------------------------------------

create table audit_log_entry (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  proposal_id uuid references pricing_proposal (id),
  actor_id uuid references profile (id),
  action audit_action not null,
  field_changes jsonb not null default '[]'::jsonb,
  reason text,
  supporting_doc_url text,
  created_at timestamptz not null default now()
);

create index idx_audit_entity on audit_log_entry (entity_type, entity_id, created_at);
create index idx_audit_actor on audit_log_entry (actor_id, created_at);
create index idx_audit_proposal on audit_log_entry (proposal_id, created_at);

-- ---------------------------------------------------------------------
-- EXTERNAL RATE SNAPSHOT (FX & commodity) — FR-1.2, FR-4.1
-- ---------------------------------------------------------------------

create table external_rate_snapshot (
  id uuid primary key default gen_random_uuid(),
  rate_type text not null, -- 'FX_USD_IDR', 'FX_CNY_IDR', 'COMMODITY_LITHIUM'
  value numeric(18, 4) not null,
  source text not null default 'manual-seed',
  effective_at timestamptz not null default now()
);

create index idx_rate_type_effective on external_rate_snapshot (rate_type, effective_at desc);

-- ---------------------------------------------------------------------
-- COST OUTLIER STATS CACHE (FR-4.2) — simple materialized aggregate
-- ---------------------------------------------------------------------

create table cost_item_stat (
  cost_item_id uuid primary key references cost_item (id),
  business_line business_line not null,
  sample_count int not null default 0,
  mean_value numeric(18, 4) not null default 0,
  stddev_value numeric(18, 4) not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_cost_item_updated_at
  before update on cost_item
  for each row execute function set_updated_at();

create trigger trg_proposal_updated_at
  before update on pricing_proposal
  for each row execute function set_updated_at();
