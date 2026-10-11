-- =====================================================================
-- v5.0 — meeting "VKTR Req 2" (part 2: tables, columns, configuration)
--
-- MUST run AFTER 0018 has been committed.
--
--   1. pricing_proposal: document date, signed-document attachment,
--      outcome audit, PO proof, admin-expiry override.
--   2. project / project_payment_term / project_progress_entry
--      (PRD Module 9) + private storage bucket for PO / transfer /
--      signed documents.
--   3. New app roles: Finance, Project Team, Chief / Direksi.
--   4. Settings: yellow / red thresholds for the quotation age badge.
--   5. Single active workflow (OQ-STANDARD, Generate + Review only),
--      every quantity band AUTO with 0% default discount.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. pricing_proposal
-- ---------------------------------------------------------------------

alter table pricing_proposal
  add column if not exists document_date date,
  add column if not exists signed_document_path text,
  add column if not exists signed_document_uploaded_by uuid references profile (id),
  add column if not exists signed_document_uploaded_at timestamptz,
  add column if not exists outcome_at timestamptz,
  add column if not exists outcome_by uuid references profile (id),
  add column if not exists outcome_reason text,
  add column if not exists po_number text,
  add column if not exists po_document_path text,
  add column if not exists po_received_at date,
  add column if not exists expired_override_by uuid references profile (id),
  add column if not exists expired_override_at timestamptz,
  add column if not exists expired_override_reason text;

-- ---------------------------------------------------------------------
-- 2. Project, payment terms, progress
-- ---------------------------------------------------------------------

create table if not exists project (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null unique references pricing_proposal (id),
  project_identifier_id uuid references project_identifier (id),
  customer_name text,
  po_number text,
  po_received_at date,
  po_document_path text,
  contract_value_ex_vat numeric(20, 2) not null default 0,
  current_status text,
  current_progress_pct smallint not null default 0 check (current_progress_pct between 0 and 100),
  created_by uuid references profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_identifier on project (project_identifier_id);

drop trigger if exists trg_project_updated_at on project;
create trigger trg_project_updated_at
  before update on project
  for each row execute function set_updated_at();

create table if not exists project_payment_term (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project (id) on delete cascade,
  term_no smallint not null check (term_no >= 1),
  label text not null,
  planned_pct numeric(7, 3) check (planned_pct is null or (planned_pct > 0 and planned_pct <= 100)),
  planned_amount numeric(20, 2) check (planned_amount is null or planned_amount > 0),
  due_date date,
  status text not null default 'PENDING' check (status in ('PENDING', 'RECEIVED')),
  received_amount numeric(20, 2),
  received_at date,
  proof_path text,
  created_by uuid references profile (id),
  updated_by uuid references profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, term_no),
  check (planned_pct is not null or planned_amount is not null)
);

drop trigger if exists trg_project_payment_term_updated_at on project_payment_term;
create trigger trg_project_payment_term_updated_at
  before update on project_payment_term
  for each row execute function set_updated_at();

create table if not exists project_progress_entry (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project (id) on delete cascade,
  entry_date date not null default current_date,
  status_label text not null,
  progress_pct smallint not null check (progress_pct between 0 and 100),
  note text,
  created_by uuid references profile (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_project_progress_project on project_progress_entry (project_id, entry_date desc, created_at desc);

alter table project enable row level security;
alter table project_payment_term enable row level security;
alter table project_progress_entry enable row level security;

-- Same convention as the other v4.x business tables: the database only
-- requires a signed-in user; who may do what (Salesperson sets terms,
-- Finance marks them received, Project Team adds progress) is enforced
-- in the server actions (src/app/(app)/projects/actions.ts).
do $$
declare
  t text;
begin
  foreach t in array array['project', 'project_payment_term', 'project_progress_entry'] loop
    execute format('drop policy if exists "authenticated read %1$s" on %1$I', t);
    execute format('create policy "authenticated read %1$s" on %1$I for select using (is_authenticated())', t);
    execute format('drop policy if exists "authenticated write %1$s" on %1$I', t);
    execute format('create policy "authenticated write %1$s" on %1$I for all using (is_authenticated()) with check (is_authenticated())', t);
  end loop;
end $$;

-- Private bucket for signed quotations, PO and transfer proofs. Files are
-- served through short-lived signed URLs (never public).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quotation-files', 'quotation-files', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "quotation-files read" on storage.objects;
create policy "quotation-files read" on storage.objects
  for select to authenticated using (bucket_id = 'quotation-files');
drop policy if exists "quotation-files insert" on storage.objects;
create policy "quotation-files insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'quotation-files');
drop policy if exists "quotation-files update" on storage.objects;
create policy "quotation-files update" on storage.objects
  for update to authenticated using (bucket_id = 'quotation-files');

-- ---------------------------------------------------------------------
-- 3. New app roles (names are data — rename freely in Settings)
-- ---------------------------------------------------------------------

insert into app_role (code, name, functional_roles, is_external, sort_order) values
  ('FINANCE',      'Finance',          '{FINANCE}',      false, 130),
  ('PROJECT_TEAM', 'Tim Project',      '{PROJECT_TEAM}', false, 140),
  ('EXECUTIVE',    'Chief / Direksi',  '{EXECUTIVE}',    false, 150)
on conflict (code) do update set
  functional_roles = excluded.functional_roles,
  is_active = true;

-- ---------------------------------------------------------------------
-- 4. Settings
-- ---------------------------------------------------------------------

insert into app_setting (key, value) values
  ('quotation_yellow_days', '14'::jsonb),
  ('quotation_red_days',    '30'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 5. One active workflow (PRD FR-2.0.2 v5.0). Configuration only — the
--    engine and the template validation rules are untouched:
--      * every template except OQ-STANDARD is deactivated (kept, so it
--        can be switched on again later);
--      * OQ-STANDARD gets a NEW VERSION without "Validasi Sales Lead" (old version deactivated) and keeps
--        Generate -> Review & Rilis (two steps still satisfy the
--        template validation);
--      * every quantity band is AUTO with a 0% default discount, so the
--        first release is the standard price and a discount only
--        arrives through a Revision.
--    In-flight quotations keep their own copy of the steps.
-- ---------------------------------------------------------------------

update workflow_definition
   set is_active = false
 where workflow_kind = 'OFFICIAL_QUOTATION'
   and coalesce(template_code, '') <> 'OQ-STANDARD';

do $$
declare
  v_old uuid;
  v_new uuid;
begin
  -- Same rule as Settings -> Workflow ("simpan = versi baru"): step definitions are
  -- referenced by quotations already in flight (workflow_step_instance), so the old
  -- version is deactivated, never edited or deleted. Idempotent: only runs while the
  -- active OQ-STANDARD still has a VALIDATE step.
  select d.id into v_old
    from workflow_definition d
   where d.workflow_kind = 'OFFICIAL_QUOTATION'
     and d.template_code = 'OQ-STANDARD'
     and d.is_active
     and exists (
       select 1 from workflow_step_definition s
        where s.workflow_definition_id = d.id and s.action_kind = 'VALIDATE'
     )
   order by d.version desc
   limit 1;

  if v_old is not null then
    create temporary table _oq_standard_copy on commit drop as
      select * from workflow_definition where id = v_old;
    v_new := gen_random_uuid();
    update _oq_standard_copy
       set id = v_new,
           version = version + 1,
           is_active = true;
    update workflow_definition set is_active = false where id = v_old;
    insert into workflow_definition select * from _oq_standard_copy;

    insert into workflow_step_definition
      (workflow_definition_id, step_order, department_id, status_label, is_mandatory_gate, sla_hours,
       parallel_group_id, step_name, action_kind, performer_function, skip_if_initiator_function,
       reject_to_step_order, cc_functions)
    select v_new, row_number() over (order by step_order), department_id, status_label, is_mandatory_gate, sla_hours,
           parallel_group_id, step_name, action_kind, performer_function, skip_if_initiator_function,
           null, cc_functions
      from workflow_step_definition
     where workflow_definition_id = v_old and action_kind <> 'VALIDATE';

    -- The review step returns to the Generate step.
    update workflow_step_definition r
       set reject_to_step_order = (
         select g.step_order from workflow_step_definition g
          where g.workflow_definition_id = v_new and g.action_kind = 'GENERATE_QUOTATION'
       )
     where r.workflow_definition_id = v_new and r.action_kind = 'REVIEW_AND_ROUTE';
  end if;
end $$;

update quantity_band_config set processing_mode = 'AUTO', default_discount_pct = 0;
