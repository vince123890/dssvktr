-- =====================================================================
-- VKTR-PriceCore POC — Seed Data
-- Realistic reference data aligned with PRD FR-1.1 examples
-- =====================================================================

-- ---------------------------------------------------------------------
-- DEPARTMENTS
-- ---------------------------------------------------------------------

insert into department (id, code, name, escalation_contact_name) values
  ('11111111-0000-0000-0000-000000000001', 'PROCUREMENT', 'Procurement', 'Head of Procurement'),
  ('11111111-0000-0000-0000-000000000002', 'ENGINEERING', 'Engineering', 'Head of Engineering'),
  ('11111111-0000-0000-0000-000000000003', 'FINANCE', 'Finance', 'CFO'),
  ('11111111-0000-0000-0000-000000000004', 'SALES', 'Sales', 'VP Sales'),
  ('11111111-0000-0000-0000-000000000005', 'C_LEVEL', 'Executive / BOD', 'CEO'),
  ('11111111-0000-0000-0000-000000000006', 'ADMIN', 'IT / Operations', 'IT Manager');

-- ---------------------------------------------------------------------
-- COST ITEMS (FR-1.1 Mappable CBS)
-- ---------------------------------------------------------------------

-- Direct Costs
insert into cost_item (id, code, name, category, subcategory, owner_department_id, unit_type, is_mandatory) values
  ('22222222-0000-0000-0000-000000000001', 'BOM-BATT-001', 'Battery Pack (BOM)', 'DIRECT', 'BOM', '11111111-0000-0000-0000-000000000001', 'PER_UNIT', true),
  ('22222222-0000-0000-0000-000000000002', 'BOM-CHAS-001', 'Chassis (BOM)', 'DIRECT', 'BOM', '11111111-0000-0000-0000-000000000001', 'PER_UNIT', true),
  ('22222222-0000-0000-0000-000000000003', 'BOM-PWTR-001', 'Powertrain / Motor (BOM)', 'DIRECT', 'BOM', '11111111-0000-0000-0000-000000000001', 'PER_UNIT', true),
  ('22222222-0000-0000-0000-000000000004', 'DIR-KAR-001', 'Karoseri / Body Building', 'DIRECT', 'Karoseri', '11111111-0000-0000-0000-000000000001', 'PER_UNIT', true),
  ('22222222-0000-0000-0000-000000000005', 'DIR-BEA-001', 'Bea Masuk / Tarif Impor', 'DIRECT', 'Bea Masuk', '11111111-0000-0000-0000-000000000001', 'PER_UNIT', true),
  ('22222222-0000-0000-0000-000000000006', 'DIR-LOG-001', 'Shipping & Logistics', 'DIRECT', 'Logistics', '11111111-0000-0000-0000-000000000001', 'PER_UNIT', true);

-- Indirect Costs
insert into cost_item (id, code, name, category, subcategory, owner_department_id, unit_type, is_mandatory) values
  ('22222222-0000-0000-0000-000000000007', 'IND-TST-001', 'Testing & Homologasi', 'INDIRECT', 'Testing', '11111111-0000-0000-0000-000000000002', 'PER_UNIT', true),
  ('22222222-0000-0000-0000-000000000008', 'IND-TYP-001', 'Pengujian Tipe', 'INDIRECT', 'Testing', '11111111-0000-0000-0000-000000000002', 'PER_UNIT', true),
  ('22222222-0000-0000-0000-000000000009', 'IND-OVH-001', 'Overheads Proyek', 'INDIRECT', 'Overhead', '11111111-0000-0000-0000-000000000002', 'PER_UNIT', false),
  ('22222222-0000-0000-0000-00000000000a', 'IND-WAR-001', 'Warranty Provision', 'INDIRECT', 'Warranty', '11111111-0000-0000-0000-000000000002', 'PER_UNIT', true),
  ('22222222-0000-0000-0000-00000000000b', 'IND-AMS-001', 'After-Sales Maintenance Support', 'INDIRECT', 'Aftersales', '11111111-0000-0000-0000-000000000002', 'PER_UNIT', false);

-- Margin & Financial Factors
insert into cost_item (id, code, name, category, subcategory, owner_department_id, unit_type, is_mandatory) values
  ('22222222-0000-0000-0000-00000000000c', 'MGN-COF-001', 'Cost of Funds', 'MARGIN_FACTOR', 'Cost of Funds', '11111111-0000-0000-0000-000000000003', 'PERCENTAGE', true),
  ('22222222-0000-0000-0000-00000000000d', 'MGN-LSE-001', 'Financial Leasing Margin', 'MARGIN_FACTOR', 'Leasing Margin', '11111111-0000-0000-0000-000000000003', 'PERCENTAGE', false),
  ('22222222-0000-0000-0000-00000000000e', 'MGN-COM-001', 'Sales Commission', 'MARGIN_FACTOR', 'Commission', '11111111-0000-0000-0000-000000000004', 'PERCENTAGE', true),
  ('22222222-0000-0000-0000-00000000000f', 'MGN-CTG-001', 'Contingency Buffer', 'MARGIN_FACTOR', 'Contingency', '11111111-0000-0000-0000-000000000003', 'PERCENTAGE', true);

-- ---------------------------------------------------------------------
-- CBS TEMPLATES (FR-1.3) — one per business line
-- ---------------------------------------------------------------------

insert into cbs_template (id, name, business_line, status, min_gpm_threshold, escalation_threshold_value) values
  ('33333333-0000-0000-0000-000000000001', 'B2G Tender Bus — Standard CBS', 'B2G_TENDER_BUS', 'active', 0.14, 50000000000),
  ('33333333-0000-0000-0000-000000000002', 'B2B Commercial Fleet — Standard CBS', 'B2B_COMMERCIAL_FLEET', 'active', 0.16, 30000000000),
  ('33333333-0000-0000-0000-000000000003', 'Charging Infra Buildout — Standard CBS', 'CHARGING_INFRA_BUILDOUT', 'active', 0.18, 20000000000);

-- Attach all cost items to every template (POC: same CBS shape across lines)
insert into cbs_template_item (template_id, cost_item_id, sort_order)
select t.id, c.id, row_number() over (order by c.category, c.code)
from cbs_template t
cross join cost_item c;

-- ---------------------------------------------------------------------
-- WORKFLOW DEFINITIONS (FR-2.1) — value-based escalation buckets
-- ---------------------------------------------------------------------

-- B2G Tender Bus: below threshold (no C-Level step)
insert into workflow_definition (id, business_line, name, min_value, max_value, is_active, version) values
  ('44444444-0000-0000-0000-000000000001', 'B2G_TENDER_BUS', 'B2G Standard (< Rp 50M)', 0, 50000000000, true, 1),
  ('44444444-0000-0000-0000-000000000002', 'B2G_TENDER_BUS', 'B2G Large Deal (>= Rp 50M)', 50000000000, null, true, 1),
  ('44444444-0000-0000-0000-000000000003', 'B2B_COMMERCIAL_FLEET', 'B2B Standard (< Rp 30M)', 0, 30000000000, true, 1),
  ('44444444-0000-0000-0000-000000000004', 'B2B_COMMERCIAL_FLEET', 'B2B Large Deal (>= Rp 30M)', 30000000000, null, true, 1),
  ('44444444-0000-0000-0000-000000000005', 'CHARGING_INFRA_BUILDOUT', 'Charging Infra Standard (< Rp 20M)', 0, 20000000000, true, 1),
  ('44444444-0000-0000-0000-000000000006', 'CHARGING_INFRA_BUILDOUT', 'Charging Infra Large Deal (>= Rp 20M)', 20000000000, null, true, 1);

-- Steps: standard 4-step flow, large-deal variants add C-Level sign-off
insert into workflow_step_definition (workflow_definition_id, step_order, department_id, status_label, is_mandatory_gate, sla_hours) values
  -- B2G Standard
  ('44444444-0000-0000-0000-000000000001', 1, '11111111-0000-0000-0000-000000000001', 'PENDING_PROCUREMENT', true, 24),
  ('44444444-0000-0000-0000-000000000001', 2, '11111111-0000-0000-0000-000000000002', 'PENDING_ENGINEERING_REVIEW', true, 24),
  ('44444444-0000-0000-0000-000000000001', 3, '11111111-0000-0000-0000-000000000003', 'PENDING_FINANCE_APPROVAL', true, 24),
  -- B2G Large Deal (adds C-Level)
  ('44444444-0000-0000-0000-000000000002', 1, '11111111-0000-0000-0000-000000000001', 'PENDING_PROCUREMENT', true, 24),
  ('44444444-0000-0000-0000-000000000002', 2, '11111111-0000-0000-0000-000000000002', 'PENDING_ENGINEERING_REVIEW', true, 24),
  ('44444444-0000-0000-0000-000000000002', 3, '11111111-0000-0000-0000-000000000003', 'PENDING_FINANCE_APPROVAL', true, 24),
  ('44444444-0000-0000-0000-000000000002', 4, '11111111-0000-0000-0000-000000000005', 'PENDING_CLEVEL_SIGNOFF', true, 48),
  -- B2B Standard
  ('44444444-0000-0000-0000-000000000003', 1, '11111111-0000-0000-0000-000000000001', 'PENDING_PROCUREMENT', true, 24),
  ('44444444-0000-0000-0000-000000000003', 2, '11111111-0000-0000-0000-000000000002', 'PENDING_ENGINEERING_REVIEW', true, 24),
  ('44444444-0000-0000-0000-000000000003', 3, '11111111-0000-0000-0000-000000000003', 'PENDING_FINANCE_APPROVAL', true, 24),
  -- B2B Large Deal
  ('44444444-0000-0000-0000-000000000004', 1, '11111111-0000-0000-0000-000000000001', 'PENDING_PROCUREMENT', true, 24),
  ('44444444-0000-0000-0000-000000000004', 2, '11111111-0000-0000-0000-000000000002', 'PENDING_ENGINEERING_REVIEW', true, 24),
  ('44444444-0000-0000-0000-000000000004', 3, '11111111-0000-0000-0000-000000000003', 'PENDING_FINANCE_APPROVAL', true, 24),
  ('44444444-0000-0000-0000-000000000004', 4, '11111111-0000-0000-0000-000000000005', 'PENDING_CLEVEL_SIGNOFF', true, 48),
  -- Charging Infra Standard
  ('44444444-0000-0000-0000-000000000005', 1, '11111111-0000-0000-0000-000000000001', 'PENDING_PROCUREMENT', true, 24),
  ('44444444-0000-0000-0000-000000000005', 2, '11111111-0000-0000-0000-000000000002', 'PENDING_ENGINEERING_REVIEW', true, 24),
  ('44444444-0000-0000-0000-000000000005', 3, '11111111-0000-0000-0000-000000000003', 'PENDING_FINANCE_APPROVAL', true, 24),
  -- Charging Infra Large Deal
  ('44444444-0000-0000-0000-000000000006', 1, '11111111-0000-0000-0000-000000000001', 'PENDING_PROCUREMENT', true, 24),
  ('44444444-0000-0000-0000-000000000006', 2, '11111111-0000-0000-0000-000000000002', 'PENDING_ENGINEERING_REVIEW', true, 24),
  ('44444444-0000-0000-0000-000000000006', 3, '11111111-0000-0000-0000-000000000003', 'PENDING_FINANCE_APPROVAL', true, 24),
  ('44444444-0000-0000-0000-000000000006', 4, '11111111-0000-0000-0000-000000000005', 'PENDING_CLEVEL_SIGNOFF', true, 48);

-- ---------------------------------------------------------------------
-- EXTERNAL RATE SNAPSHOTS (FX & commodity) — FR-1.2
-- ---------------------------------------------------------------------

insert into external_rate_snapshot (rate_type, value, source, effective_at) values
  ('FX_USD_IDR', 16350.00, 'seed-baseline', now()),
  ('FX_CNY_IDR', 2260.00, 'seed-baseline', now()),
  ('COMMODITY_LITHIUM', 13500.00, 'seed-baseline', now()); -- USD/ton reference index
