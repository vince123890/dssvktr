-- =====================================================================
-- v4.1 — Workflow Template Catalog (many templates, assigned by qualifier)
--
-- Demo review (docs/transcribe.md, lines 17-23, 91-93, 122-123): VKTR
-- expects ~30 workflow variations to emerge after go-live. The
-- QUALIFIERS are static — customer segment (B2G/B2B/B2C), special
-- relationship, industry (mining, plantation, on-road / express
-- logistics, municipality, ...), price threshold, blacklist — while the
-- number of TEMPLATES keeps growing, each with its own approval steps,
-- rejection routing and discount authority ("kalau persentase berapa
-- negosiasinya siapa yang approve"). Each deal is assigned the most
-- specific matching template.
--
-- Safe to run on the v4.0 database (after 0016); no data is wiped.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Template qualifiers on workflow_definition. Versions of one template
--    share template_code; only one version is active at a time.
--    min_value / max_value (already present) = estimated transaction
--    value range in IDR excl. VAT.
-- ---------------------------------------------------------------------

alter table workflow_definition add column if not exists template_code text;
alter table workflow_definition add column if not exists description text;
alter table workflow_definition add column if not exists priority int not null default 0;
alter table workflow_definition add column if not exists q_segments text[] not null default '{}';
alter table workflow_definition add column if not exists q_industries text[] not null default '{}';
alter table workflow_definition add column if not exists q_relationships text[] not null default '{}';
alter table workflow_definition add column if not exists q_business_lines text[] not null default '{}';
alter table workflow_definition add column if not exists q_min_qty int;
alter table workflow_definition add column if not exists q_max_qty int;
-- null = any customer, true = only blacklisted customers, false = only non-blacklisted
alter table workflow_definition add column if not exists q_blacklist boolean;
alter table workflow_definition add column if not exists is_fallback boolean not null default false;

update workflow_definition
set template_code = 'OQ-STANDARD',
    is_fallback = true,
    description = coalesce(description, 'Template dasar (sheet Basic Workflow B) — dipakai bila tidak ada template yang lebih spesifik.')
where workflow_kind = 'OFFICIAL_QUOTATION' and template_code is null;

update workflow_definition
set template_code = 'PRICE-ESTIMATE',
    description = coalesce(description, 'Sheet Basic Workflow A — tanpa langkah approval.')
where workflow_kind = 'PRICE_ESTIMATE' and template_code is null;

create index if not exists idx_wd_template_code on workflow_definition (template_code, is_active);

-- ---------------------------------------------------------------------
-- 2. Deal attributes captured on the quotation. Segment, industry and
--    relationship live in pricing_proposal.kyc (jsonb); these columns
--    record what the resolver saw at submit time.
-- ---------------------------------------------------------------------

alter table pricing_proposal add column if not exists workflow_template_code text;
alter table pricing_proposal add column if not exists estimated_value numeric(20, 2);
alter table pricing_proposal add column if not exists is_blacklisted boolean not null default false;
alter table pricing_proposal add column if not exists workflow_selection_reason text;

-- ---------------------------------------------------------------------
-- 3. Discount authority per template: a template may carry its own
--    margin-tier ladder; templates without one use the global ladder.
-- ---------------------------------------------------------------------

alter table margin_tier_authority add column if not exists workflow_template_code text;

-- ---------------------------------------------------------------------
-- 4. Static qualifier lists + customer blacklist (Settings → Umum).
-- ---------------------------------------------------------------------

insert into app_setting (key, value) values
  ('qualifier_segments',      '["B2G", "B2B", "B2C"]'::jsonb),
  ('qualifier_industries',    '["Pertambangan", "Perkebunan", "On-road Logistics", "Express Logistics", "Municipality", "Konstruksi", "Lainnya"]'::jsonb),
  ('qualifier_relationships', '["Reguler", "Relasi khusus"]'::jsonb),
  ('customer_blacklist',      '["PT Contoh Blacklist Abadi"]'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 5. Example templates — a starting catalog showing each qualifier axis
--    from the demo review. VKTR adds the rest (towards ~30) in Settings.
-- ---------------------------------------------------------------------

do $$
declare
  v_id uuid;
begin
  -- B2G / Pemerintah: stricter documentation (longer SLA) and approval
  -- up to the Pricing Committee at every tier ("B2G semuanya harus
  -- approval sampai BOD").
  if not exists (select 1 from workflow_definition where template_code = 'OQ-B2G') then
    insert into workflow_definition (business_line, name, qualifier_type, workflow_kind, allowed_functions, min_value, max_value,
      is_active, version, template_code, description, priority, q_segments)
    values ('B2G_TENDER_BUS', 'Official Quotation — B2G Pemerintah', 'GENERIC', 'OFFICIAL_QUOTATION', '{SALESPERSON}', 0, null,
      true, 1, 'OQ-B2G', 'Segmen pemerintah: verifikasi dokumen tender oleh Head of Sales, dan setiap tier margin diputus Pricing Committee.', 10, '{B2G}')
    returning id into v_id;
    insert into workflow_step_definition (workflow_definition_id, step_order, department_id, status_label, is_mandatory_gate, sla_hours,
      step_name, action_kind, performer_function, skip_if_initiator_function, reject_to_step_order, cc_functions) values
      (v_id, 1, null, 'PENDING_SALES_LEAD_VALIDATION', true, 24, 'Validasi Sales Lead', 'VALIDATE', 'SALES_VALIDATOR', 'SALES_VALIDATOR', null, '{}'),
      (v_id, 2, null, 'PENDING_ADDITIONAL_APPROVAL', true, 48, 'Verifikasi dokumen tender (Head of Sales)', 'APPROVE', 'SALES_RELEASER', null, null, '{}'),
      (v_id, 3, null, 'PENDING_SALES_OPERATIONS', true, 48, 'Generate Official Quotation', 'GENERATE_QUOTATION', 'SALES_OPERATIONS', null, null, '{}'),
      (v_id, 4, null, 'PENDING_HEAD_OF_SALES_REVIEW', true, 48, 'Review & Rilis (Head of Sales)', 'REVIEW_AND_ROUTE', 'SALES_RELEASER', null, 3, '{}');
    insert into margin_tier_authority (tier, business_line, gpm_lower_bound_pct, gpm_upper_bound_pct, required_roles, decision_slots, cc_slots, reject_target, allow_bod_delegation, is_active, workflow_template_code) values
      (1, null, 15.00, null,  '[]', '["role:CCO", "role:CFO"]', '["COGS_OWNER", "PROFITABILITY_OWNER"]', 'SALES_OPERATIONS', false, true, 'OQ-B2G'),
      (2, null, 10.00, 15.00, '[]', '["COGS_OWNER", "PROFITABILITY_OWNER", "role:CCO", "role:CFO"]', '[]', 'SALES_OPERATIONS', false, true, 'OQ-B2G'),
      (3, null, null,  10.00, '[]', '["role:CCO", "role:CFO"]', '["COGS_OWNER", "PROFITABILITY_OWNER"]', 'SALES_OPERATIONS', false, true, 'OQ-B2G');
  end if;

  -- Relasi khusus: request goes straight to Sales Operations and any
  -- margin below 15% is decided by the Pricing Committee directly
  -- ("semua di-bypass" — but never without a recorded decision).
  if not exists (select 1 from workflow_definition where template_code = 'OQ-RELASI-KHUSUS') then
    insert into workflow_definition (business_line, name, qualifier_type, workflow_kind, allowed_functions, min_value, max_value,
      is_active, version, template_code, description, priority, q_relationships)
    values ('B2B_COMMERCIAL_FLEET', 'Official Quotation — Relasi Khusus', 'GENERIC', 'OFFICIAL_QUOTATION', '{SALESPERSON}', 0, null,
      true, 1, 'OQ-RELASI-KHUSUS', 'Pelanggan dengan relasi khusus: tanpa validasi Sales Lead; margin < 15% langsung ke CCO & CFO.', 20, '{Relasi khusus}')
    returning id into v_id;
    insert into workflow_step_definition (workflow_definition_id, step_order, department_id, status_label, is_mandatory_gate, sla_hours,
      step_name, action_kind, performer_function, skip_if_initiator_function, reject_to_step_order, cc_functions) values
      (v_id, 1, null, 'PENDING_SALES_OPERATIONS', true, 12, 'Generate Official Quotation', 'GENERATE_QUOTATION', 'SALES_OPERATIONS', null, null, '{}'),
      (v_id, 2, null, 'PENDING_HEAD_OF_SALES_REVIEW', true, 12, 'Review & Rilis (Head of Sales)', 'REVIEW_AND_ROUTE', 'SALES_RELEASER', null, 1, '{}');
    insert into margin_tier_authority (tier, business_line, gpm_lower_bound_pct, gpm_upper_bound_pct, required_roles, decision_slots, cc_slots, reject_target, allow_bod_delegation, is_active, workflow_template_code) values
      (1, null, 15.00, null,  '[]', '["SALES_RELEASER"]', '[]', 'SALES_OPERATIONS', false, true, 'OQ-RELASI-KHUSUS'),
      (2, null, 10.00, 15.00, '[]', '["role:CCO", "role:CFO"]', '["COGS_OWNER", "PROFITABILITY_OWNER"]', 'SALES_OPERATIONS', false, true, 'OQ-RELASI-KHUSUS'),
      (3, null, null,  10.00, '[]', '["role:CCO", "role:CFO"]', '["COGS_OWNER", "PROFITABILITY_OWNER"]', 'SALES_OPERATIONS', false, true, 'OQ-RELASI-KHUSUS');
  end if;

  -- Industri berat (tambang, perkebunan): extra pricing additions on
  -- body/application ("kalau sama industri cenderung ada tambahan-tambahan
  -- di pricing-nya") — COGS Owner reviews before Head of Sales.
  if not exists (select 1 from workflow_definition where template_code = 'OQ-INDUSTRI-BERAT') then
    insert into workflow_definition (business_line, name, qualifier_type, workflow_kind, allowed_functions, min_value, max_value,
      is_active, version, template_code, description, priority, q_industries)
    values ('B2B_COMMERCIAL_FLEET', 'Official Quotation — Industri Tambang & Perkebunan', 'GENERIC', 'OFFICIAL_QUOTATION', '{SALESPERSON}', 0, null,
      true, 1, 'OQ-INDUSTRI-BERAT', 'Aplikasi berat: COGS Owner meninjau karoseri/aplikasi & biaya tambahan sebelum Head of Sales.', 5, '{Pertambangan,Perkebunan}')
    returning id into v_id;
    insert into workflow_step_definition (workflow_definition_id, step_order, department_id, status_label, is_mandatory_gate, sla_hours,
      step_name, action_kind, performer_function, skip_if_initiator_function, reject_to_step_order, cc_functions) values
      (v_id, 1, null, 'PENDING_SALES_LEAD_VALIDATION', true, 24, 'Validasi Sales Lead', 'VALIDATE', 'SALES_VALIDATOR', 'SALES_VALIDATOR', null, '{}'),
      (v_id, 2, null, 'PENDING_SALES_OPERATIONS', true, 24, 'Generate Official Quotation', 'GENERATE_QUOTATION', 'SALES_OPERATIONS', null, null, '{}'),
      (v_id, 3, null, 'PENDING_ADDITIONAL_APPROVAL', true, 24, 'Review aplikasi & karoseri (COGS Owner)', 'APPROVE', 'COGS_OWNER', null, 2, '{}'),
      (v_id, 4, null, 'PENDING_HEAD_OF_SALES_REVIEW', true, 24, 'Review & Rilis (Head of Sales)', 'REVIEW_AND_ROUTE', 'SALES_RELEASER', null, 2, '{}');
  end if;

  -- Nilai besar (≥ Rp 50 M estimasi excl. VAT): Pricing Committee
  -- checks the deal before Sales Operations prices it.
  if not exists (select 1 from workflow_definition where template_code = 'OQ-NILAI-BESAR') then
    insert into workflow_definition (business_line, name, qualifier_type, workflow_kind, allowed_functions, min_value, max_value,
      is_active, version, template_code, description, priority)
    values ('B2B_COMMERCIAL_FLEET', 'Official Quotation — Nilai Besar (≥ Rp 50 M)', 'GENERIC', 'OFFICIAL_QUOTATION', '{SALESPERSON}', 50000000000, null,
      true, 1, 'OQ-NILAI-BESAR', 'Estimasi nilai ≥ Rp 50 miliar: Pricing Committee menyetujui kelayakan deal sebelum harga disusun.', 15)
    returning id into v_id;
    insert into workflow_step_definition (workflow_definition_id, step_order, department_id, status_label, is_mandatory_gate, sla_hours,
      step_name, action_kind, performer_function, skip_if_initiator_function, reject_to_step_order, cc_functions) values
      (v_id, 1, null, 'PENDING_SALES_LEAD_VALIDATION', true, 24, 'Validasi Sales Lead', 'VALIDATE', 'SALES_VALIDATOR', 'SALES_VALIDATOR', null, '{}'),
      (v_id, 2, null, 'PENDING_ADDITIONAL_APPROVAL', true, 24, 'Persetujuan kelayakan deal (Pricing Committee)', 'APPROVE', 'PRICING_COMMITTEE', null, null, '{}'),
      (v_id, 3, null, 'PENDING_SALES_OPERATIONS', true, 24, 'Generate Official Quotation', 'GENERATE_QUOTATION', 'SALES_OPERATIONS', null, null, '{}'),
      (v_id, 4, null, 'PENDING_HEAD_OF_SALES_REVIEW', true, 24, 'Review & Rilis (Head of Sales)', 'REVIEW_AND_ROUTE', 'SALES_RELEASER', null, 3, '{}');
  end if;

  -- Blacklist: always wins (highest priority) — Pricing Committee must
  -- approve doing business at all, and decides every margin tier.
  if not exists (select 1 from workflow_definition where template_code = 'OQ-BLACKLIST') then
    insert into workflow_definition (business_line, name, qualifier_type, workflow_kind, allowed_functions, min_value, max_value,
      is_active, version, template_code, description, priority, q_blacklist)
    values ('B2B_COMMERCIAL_FLEET', 'Official Quotation — Customer Blacklist', 'GENERIC', 'OFFICIAL_QUOTATION', '{SALESPERSON}', 0, null,
      true, 1, 'OQ-BLACKLIST', 'Customer tercantum di blacklist: Pricing Committee wajib menyetujui sebelum quotation disusun.', 100, true)
    returning id into v_id;
    insert into workflow_step_definition (workflow_definition_id, step_order, department_id, status_label, is_mandatory_gate, sla_hours,
      step_name, action_kind, performer_function, skip_if_initiator_function, reject_to_step_order, cc_functions) values
      (v_id, 1, null, 'PENDING_SALES_LEAD_VALIDATION', true, 24, 'Validasi Sales Lead', 'VALIDATE', 'SALES_VALIDATOR', null, null, '{}'),
      (v_id, 2, null, 'PENDING_ADDITIONAL_APPROVAL', true, 24, 'Persetujuan customer blacklist (Pricing Committee)', 'APPROVE', 'PRICING_COMMITTEE', null, null, '{}'),
      (v_id, 3, null, 'PENDING_SALES_OPERATIONS', true, 24, 'Generate Official Quotation', 'GENERATE_QUOTATION', 'SALES_OPERATIONS', null, null, '{}'),
      (v_id, 4, null, 'PENDING_HEAD_OF_SALES_REVIEW', true, 24, 'Review & Rilis (Head of Sales)', 'REVIEW_AND_ROUTE', 'SALES_RELEASER', null, 3, '{}');
    insert into margin_tier_authority (tier, business_line, gpm_lower_bound_pct, gpm_upper_bound_pct, required_roles, decision_slots, cc_slots, reject_target, allow_bod_delegation, is_active, workflow_template_code) values
      (1, null, 15.00, null,  '[]', '["role:CCO", "role:CFO"]', '[]', 'SALES_OPERATIONS', false, true, 'OQ-BLACKLIST'),
      (2, null, 10.00, 15.00, '[]', '["role:CCO", "role:CFO"]', '["COGS_OWNER", "PROFITABILITY_OWNER"]', 'SALES_OPERATIONS', false, true, 'OQ-BLACKLIST'),
      (3, null, null,  10.00, '[]', '["role:CCO", "role:CFO"]', '["COGS_OWNER", "PROFITABILITY_OWNER"]', 'SALES_OPERATIONS', false, true, 'OQ-BLACKLIST');
  end if;
end $$;

-- Existing quotations: record the template they ran under.
update pricing_proposal set workflow_template_code = 'OQ-STANDARD' where workflow_template_code is null;
