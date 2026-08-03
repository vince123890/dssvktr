-- =====================================================================
-- VKTR-PriceCore POC — Row Level Security
-- Mirrors docs/TECHNICAL-LOGIC-VKTR-PriceCore.md §8 RBAC/ABAC
--
-- POC simplification: full field-level masking (raw margin hidden from
-- Sales) is enforced in the application/query layer (see src/lib/rbac.ts),
-- not via column-level RLS, since Postgres RLS is row-level not
-- column-level. RLS here focuses on row-level tenant/role isolation and
-- append-only guarantees which the database CAN enforce natively.
-- =====================================================================

alter table department enable row level security;
alter table profile enable row level security;
alter table cost_item enable row level security;
alter table cbs_template enable row level security;
alter table cbs_template_item enable row level security;
alter table workflow_definition enable row level security;
alter table workflow_step_definition enable row level security;
alter table pricing_proposal enable row level security;
alter table pricing_proposal_version enable row level security;
alter table proposal_cost_line enable row level security;
alter table proposal_calculation_result enable row level security;
alter table workflow_instance enable row level security;
alter table workflow_step_instance enable row level security;
alter table audit_log_entry enable row level security;
alter table external_rate_snapshot enable row level security;
alter table cost_item_stat enable row level security;

-- ---------------------------------------------------------------------
-- Helper: current user's role/department (reads from profile via auth uid)
-- ---------------------------------------------------------------------

create or replace function current_user_role()
returns user_role as $$
  select role from profile where id = auth.uid();
$$ language sql stable security definer;

create or replace function is_authenticated()
returns boolean as $$
  select auth.uid() is not null;
$$ language sql stable security definer;

-- ---------------------------------------------------------------------
-- Read policies: any authenticated user can read reference/master data
-- and all proposal data (POC: single-tenant company-wide visibility,
-- consistent with "Sales can see final_price but not raw margin" being
-- an app-layer field mask rather than a row-visibility rule).
-- ---------------------------------------------------------------------

create policy "authenticated read department" on department
  for select using (is_authenticated());

create policy "authenticated read profile" on profile
  for select using (is_authenticated());

create policy "authenticated read cost_item" on cost_item
  for select using (is_authenticated());

create policy "authenticated read cbs_template" on cbs_template
  for select using (is_authenticated());

create policy "authenticated read cbs_template_item" on cbs_template_item
  for select using (is_authenticated());

create policy "authenticated read workflow_definition" on workflow_definition
  for select using (is_authenticated());

create policy "authenticated read workflow_step_definition" on workflow_step_definition
  for select using (is_authenticated());

create policy "authenticated read pricing_proposal" on pricing_proposal
  for select using (is_authenticated());

create policy "authenticated read pricing_proposal_version" on pricing_proposal_version
  for select using (is_authenticated());

create policy "authenticated read proposal_cost_line" on proposal_cost_line
  for select using (is_authenticated());

create policy "authenticated read proposal_calculation_result" on proposal_calculation_result
  for select using (is_authenticated());

create policy "authenticated read workflow_instance" on workflow_instance
  for select using (is_authenticated());

create policy "authenticated read workflow_step_instance" on workflow_step_instance
  for select using (is_authenticated());

create policy "authenticated read audit_log_entry" on audit_log_entry
  for select using (is_authenticated());

create policy "authenticated read external_rate_snapshot" on external_rate_snapshot
  for select using (is_authenticated());

create policy "authenticated read cost_item_stat" on cost_item_stat
  for select using (is_authenticated());

-- ---------------------------------------------------------------------
-- Write policies
-- ---------------------------------------------------------------------

-- Master data: only SYSTEM_ADMIN can create/edit cost items, templates,
-- workflow definitions (FR-2.1 admin-configurable).
create policy "admin write cost_item" on cost_item
  for all using (current_user_role() = 'SYSTEM_ADMIN')
  with check (current_user_role() = 'SYSTEM_ADMIN');

create policy "admin write cbs_template" on cbs_template
  for all using (current_user_role() = 'SYSTEM_ADMIN')
  with check (current_user_role() = 'SYSTEM_ADMIN');

create policy "admin write cbs_template_item" on cbs_template_item
  for all using (current_user_role() = 'SYSTEM_ADMIN')
  with check (current_user_role() = 'SYSTEM_ADMIN');

create policy "admin write workflow_definition" on workflow_definition
  for all using (current_user_role() = 'SYSTEM_ADMIN')
  with check (current_user_role() = 'SYSTEM_ADMIN');

create policy "admin write workflow_step_definition" on workflow_step_definition
  for all using (current_user_role() = 'SYSTEM_ADMIN')
  with check (current_user_role() = 'SYSTEM_ADMIN');

create policy "admin manage profile" on profile
  for update using (current_user_role() = 'SYSTEM_ADMIN' or id = auth.uid())
  with check (current_user_role() = 'SYSTEM_ADMIN' or id = auth.uid());

create policy "admin insert profile" on profile
  for insert with check (true); -- profile row created at signup via trigger/app

-- Proposals: any authenticated business user can create; updates happen
-- via server-side service-role actions to keep state-machine invariants
-- centralized (mirrors "service layer enforces canAdvanceToStep, not RLS
-- alone" principle in the technical logic doc §10).
create policy "authenticated insert proposal" on pricing_proposal
  for insert with check (is_authenticated());

create policy "authenticated update proposal" on pricing_proposal
  for update using (is_authenticated());

create policy "authenticated insert proposal_version" on pricing_proposal_version
  for insert with check (is_authenticated());

create policy "authenticated write cost_line" on proposal_cost_line
  for all using (is_authenticated()) with check (is_authenticated());

create policy "authenticated insert calc_result" on proposal_calculation_result
  for insert with check (is_authenticated());

create policy "authenticated write workflow_instance" on workflow_instance
  for all using (is_authenticated()) with check (is_authenticated());

create policy "authenticated write workflow_step_instance" on workflow_step_instance
  for all using (is_authenticated()) with check (is_authenticated());

-- Audit log: append-only. INSERT allowed for authenticated actions;
-- explicitly NO update/delete policy is created, so those operations
-- are rejected by RLS default-deny — enforcing FR-3.3 immutability at
-- the database level exactly as specified in the technical logic doc §6.
create policy "authenticated insert audit_log" on audit_log_entry
  for insert with check (is_authenticated());

create policy "admin write external_rate_snapshot" on external_rate_snapshot
  for insert with check (current_user_role() = 'SYSTEM_ADMIN');

create policy "system write cost_item_stat" on cost_item_stat
  for all using (is_authenticated()) with check (is_authenticated());
