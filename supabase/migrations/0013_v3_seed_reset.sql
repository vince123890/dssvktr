-- =====================================================================
-- v3.0 — Post-Demo Revision (part 3: reset & reseed master data)
--
-- MUST run AFTER 0012 has been committed.
--
-- Replaces the illustrative v1/v2 cost structure (Battery/Chassis/
-- Powertrain as separate line items, one CBS per business line) with
-- the real VKTR/BTEL structure from docs/BTEL-CostStructure.xlsx: a
-- SINGLE CBS shared by every business line, made of 4 cost groups.
--
-- Historical transactional data (proposals, versions, cost lines,
-- calculation results, workflow instances, negotiations, audit log)
-- is truncated: its cost_item_id foreign keys no longer resolve
-- against the new structure, and this is a POC with no production
-- data to preserve. Departments, profiles and demo user accounts are
-- left untouched.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. NEW DEPARTMENT — Product Owner (FR-1.5)
-- ---------------------------------------------------------------------

insert into department (id, code, name, escalation_contact_name) values
  ('11111111-0000-0000-0000-00000000000b', 'PRODUCT', 'Product', 'Head of Product')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 2. WIPE TRANSACTIONAL DATA
--    Order matters: children before parents. Master/reference tables
--    (department, profile, cost_item, cbs_template, workflow_*
--    definitions) are handled separately below.
-- ---------------------------------------------------------------------

truncate table
  negotiation_decision,
  negotiation_request,
  workflow_step_instance,
  workflow_instance,
  proposal_calculation_result,
  proposal_cost_line,
  pricing_proposal_version,
  audit_log_entry
  restart identity cascade;

-- pricing_proposal has self-referencing FKs (supersedes_proposal_id) —
-- clear those first so the row itself can be deleted without violating
-- the constraint, then delete the proposals.
update pricing_proposal set supersedes_proposal_id = null, current_version_id = null;
delete from pricing_proposal;

delete from project_identifier;
delete from cost_item_stat;

-- ---------------------------------------------------------------------
-- 3. COST ITEM — replace illustrative items with the real BTEL
--    structure (34 items, 4 groups). Ownership mapping below is an
--    ASSUMPTION pending VKTR confirmation (see PRD FR-1.1 note and
--    Technical Logic §14 no. 12): COGS/ADD_ONS -> VP_OPERATIONS,
--    PROFITABILITY -> VP_FINANCE, SALES -> SALES (Sales Officer).
-- ---------------------------------------------------------------------

delete from cbs_template_item;
delete from cost_item;

-- COGS (14 items) — owner: VP Operations. FOB Price in CNY is the only
-- mineral-linked item: the unit is bought as a finished good from BTEL
-- (not assembled from sub-components inside PriceCore), so battery
-- value lives entirely inside this one line.
insert into cost_item (id, code, name, category, subcategory, owner_department_id, unit_type, denomination, cost_group, is_mineral_linked, mineral_code, is_mandatory) values
  ('22222222-0001-0000-0000-000000000001', 'COGS-FOB-CNY', 'FOB Price in CNY',                                     'DIRECT', 'FOB',          '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'CNY', 'COGS', true,  'NI', true),
  ('22222222-0001-0000-0000-000000000002', 'COGS-FOB-IDR', 'FOB Price in IDR',                                     'DIRECT', 'FOB',          '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'COGS', false, null, false),
  ('22222222-0001-0000-0000-000000000003', 'COGS-FRT-001', 'Freight and Insurance',                                'DIRECT', 'Logistics',    '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'COGS', false, null, true),
  ('22222222-0001-0000-0000-000000000004', 'COGS-DUT-001', 'Custom Duties',                                        'DIRECT', 'Bea Masuk',    '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'COGS', false, null, true),
  ('22222222-0001-0000-0000-000000000005', 'COGS-PHC-001', 'Port Handling, Clearance, and Pre-Delivery Inspection', 'DIRECT', 'Logistics',    '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'COGS', false, null, true),
  ('22222222-0001-0000-0000-000000000006', 'COGS-CAR-001', 'Carrosserie Allocation',                               'DIRECT', 'Karoseri',     '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'COGS', false, null, true),
  ('22222222-0001-0000-0000-000000000007', 'COGS-ASM-001', 'Assembly Cost',                                        'DIRECT', 'Assembly',     '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'COGS', false, null, true),
  ('22222222-0001-0000-0000-000000000008', 'COGS-LOC-001', 'Local Parts',                                          'DIRECT', 'Parts',        '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'COGS', false, null, false),
  ('22222222-0001-0000-0000-000000000009', 'COGS-ACC-001', 'Accessories',                                          'DIRECT', 'Accessories',  '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'COGS', false, null, false),
  ('22222222-0001-0000-0000-00000000000a', 'COGS-TEL-001', 'Telematics',                                           'DIRECT', 'Telematics',   '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'COGS', false, null, false),
  ('22222222-0001-0000-0000-00000000000b', 'COGS-WHS-001', 'Warehousing and Storage',                              'INDIRECT', 'Warehousing','11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'COGS', false, null, false),
  ('22222222-0001-0000-0000-00000000000c', 'COGS-WAR-001', 'Warranty Cost',                                        'INDIRECT', 'Warranty',   '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'COGS', false, null, true),
  ('22222222-0001-0000-0000-00000000000d', 'COGS-NRG-001', 'Initial Energy Injection',                             'DIRECT', 'Energy',       '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'COGS', false, null, false),
  ('22222222-0001-0000-0000-00000000000e', 'COGS-ADM-001', 'Administrative Cost',                                  'INDIRECT', 'Admin',      '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'COGS', false, null, false);

-- PROFITABILITY (5 items) — owner: VP Finance.
insert into cost_item (id, code, name, category, subcategory, owner_department_id, unit_type, denomination, cost_group, is_mandatory) values
  ('22222222-0002-0000-0000-000000000001', 'PROFIT-VKTS-PBT', 'VKTS Profit Before Tax',              'MARGIN_FACTOR', 'Profitability', '11111111-0000-0000-0000-000000000008', 'PER_UNIT',   'IDR', 'PROFITABILITY', false),
  ('22222222-0002-0000-0000-000000000002', 'PROFIT-VKTS-MGN', 'VKTS Margin',                          'MARGIN_FACTOR', 'Profitability', '11111111-0000-0000-0000-000000000008', 'PERCENTAGE', 'IDR', 'PROFITABILITY', true),
  ('22222222-0002-0000-0000-000000000003', 'PROFIT-VKTR-PBF', 'VKTR Profit Before Financing Cost',    'MARGIN_FACTOR', 'Profitability', '11111111-0000-0000-0000-000000000008', 'PER_UNIT',   'IDR', 'PROFITABILITY', false),
  ('22222222-0002-0000-0000-000000000004', 'PROFIT-FIN-COST', 'Financing Cost',                       'MARGIN_FACTOR', 'Financing',     '11111111-0000-0000-0000-000000000008', 'PERCENTAGE', 'IDR', 'PROFITABILITY', true),
  ('22222222-0002-0000-0000-000000000005', 'PROFIT-VKTR-MAF', 'VKTR Margin After Financing Cost',     'MARGIN_FACTOR', 'Profitability', '11111111-0000-0000-0000-000000000008', 'PERCENTAGE', 'IDR', 'PROFITABILITY', true);

-- SALES (6 items) — owner: Sales Officer. Consistent with FR-1.1.1:
-- costs attached to the acquisition/commercial process for a specific
-- deal, not production COGS or margin policy.
insert into cost_item (id, code, name, category, subcategory, owner_department_id, unit_type, denomination, cost_group, is_mandatory) values
  ('22222222-0003-0000-0000-000000000001', 'SALES-STNK-001', 'STNK',                    'INDIRECT', 'Registration', '11111111-0000-0000-0000-000000000004', 'PER_UNIT', 'IDR', 'SALES', true),
  ('22222222-0003-0000-0000-000000000002', 'SALES-INS-001',  'Insurance',               'INDIRECT', 'Insurance',    '11111111-0000-0000-0000-000000000004', 'PER_UNIT', 'IDR', 'SALES', false),
  ('22222222-0003-0000-0000-000000000003', 'SALES-INC-INT',  'Incentive Internal',      'INDIRECT', 'Incentive',    '11111111-0000-0000-0000-000000000004', 'PER_UNIT', 'IDR', 'SALES', false),
  ('22222222-0003-0000-0000-000000000004', 'SALES-INC-EXT',  'Incentive External',      'INDIRECT', 'Incentive',    '11111111-0000-0000-0000-000000000004', 'PER_UNIT', 'IDR', 'SALES', false),
  ('22222222-0003-0000-0000-000000000005', 'SALES-PROC-001', 'Sales Processing Cost',   'INDIRECT', 'Processing',   '11111111-0000-0000-0000-000000000004', 'PER_UNIT', 'IDR', 'SALES', false),
  ('22222222-0003-0000-0000-000000000006', 'SALES-AGENCY',   'Agency Fee',              'INDIRECT', 'Agency',       '11111111-0000-0000-0000-000000000004', 'PER_UNIT', 'IDR', 'SALES', false);

-- ADD-ONS (4 items) — owner: VP Operations. Delivery Service may
-- follow later without blocking base-price calculation (FR-2.0).
insert into cost_item (id, code, name, category, subcategory, owner_department_id, unit_type, denomination, cost_group, may_follow_later, is_mandatory) values
  ('22222222-0004-0000-0000-000000000001', 'ADDON-PROC-001', 'Processing Service', 'INDIRECT', 'Add-On', '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'ADD_ONS', false, false),
  ('22222222-0004-0000-0000-000000000002', 'ADDON-DLV-001',  'Delivery Service',   'INDIRECT', 'Add-On', '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'ADD_ONS', true,  true),
  ('22222222-0004-0000-0000-000000000003', 'ADDON-KEUR-001', 'KEUR',               'INDIRECT', 'Add-On', '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'ADD_ONS', false, false),
  ('22222222-0004-0000-0000-000000000004', 'ADDON-EXTRA-001','Additional',         'INDIRECT', 'Add-On', '11111111-0000-0000-0000-000000000009', 'PER_UNIT', 'IDR', 'ADD_ONS', false, false);

-- ---------------------------------------------------------------------
-- 4. CBS TEMPLATE — single, business-line-agnostic (FR-1.1, FR-1.3).
--    business_line is kept populated only because the column is
--    NOT NULL; it no longer drives which CBS a proposal uses.
-- ---------------------------------------------------------------------

update cbs_template set status = 'archived';

insert into cbs_template (id, name, business_line, status, min_gpm_threshold, escalation_threshold_value, version) values
  ('33333333-0000-0000-0000-00000000000a', 'VKTR/BTEL — Single Master CBS', 'B2G_TENDER_BUS', 'active', 0.15, 50000000000, 3);

insert into cbs_template_item (template_id, cost_item_id, sort_order)
select '33333333-0000-0000-0000-00000000000a', c.id,
       row_number() over (order by c.cost_group, c.code)
from cost_item c;

-- ---------------------------------------------------------------------
-- 5. WORKFLOW DEFINITION — sequential VP Operations -> VP Finance ->
--    Chief Sales (FR-2.0, urutan aktor dikoreksi). A single GENERIC
--    template today; a second BUSINESS_LINE-qualified template is the
--    intended slot for the "segmen customer" Basic Workflow variant
--    (FR-2.0.2) once VKTR confirms its extra steps.
-- ---------------------------------------------------------------------

delete from workflow_step_definition;
delete from workflow_definition;

insert into workflow_definition (id, business_line, name, qualifier_type, min_value, max_value, is_active, version) values
  ('44444444-0000-0000-0000-00000000000a', 'B2G_TENDER_BUS', 'Standard COGS Approval', 'GENERIC', 0, null, true, 3);

insert into workflow_step_definition
  (workflow_definition_id, step_order, department_id, status_label, is_mandatory_gate, sla_hours, parallel_group_id)
values
  ('44444444-0000-0000-0000-00000000000a', 1, '11111111-0000-0000-0000-000000000009', 'PENDING_COGS_VALIDATION',      true, 24, null), -- VP Operations
  ('44444444-0000-0000-0000-00000000000a', 2, '11111111-0000-0000-0000-000000000008', 'PENDING_COGS_VALIDATION',      true, 24, null), -- VP Finance
  ('44444444-0000-0000-0000-00000000000a', 3, '11111111-0000-0000-0000-000000000007', 'PENDING_CHIEF_SALES_REVIEW',   true, 24, null); -- Chief Sales

-- ---------------------------------------------------------------------
-- 6. MARGIN TIER AUTHORITY (FR-6.1) — replaces the percentage-based
--    discount_authority ladder. Figures are illustrative (from the
--    demo review) and must be confirmed with Chief Sales/BOD before
--    go-live (Technical Logic §14 no. 5).
-- ---------------------------------------------------------------------

delete from margin_tier_authority;

insert into margin_tier_authority (tier, business_line, gpm_lower_bound_pct, gpm_upper_bound_pct, required_roles, allow_bod_delegation, is_active) values
  (1, null, 15.00, null, '[]'::jsonb,                                             false, true),
  (2, null, 12.00, 15.00, '["SALES_OFFICER", "VP_FINANCE", "CHIEF_SALES"]'::jsonb, false, true),
  (3, null, null,  12.00, '["BOD", "BOD"]'::jsonb,                                false, true);

-- ---------------------------------------------------------------------
-- 7. EXCHANGE RATE — basis corrected from USD to CNY (RMB), per the
--    demo review's rate-sensitivity discussion (illustrative Rp
--    2,500-2,700/RMB).
-- ---------------------------------------------------------------------

delete from exchange_rate;

insert into exchange_rate (base_currency, quote_currency, rate, source, effective_from) values
  ('CNY', 'IDR', 2600.00, 'seed-baseline', now() - interval '7 days');

insert into rate_sensitivity_config (threshold_pct, is_active) values
  (2.00, true);

-- ---------------------------------------------------------------------
-- 8. PRODUCT MASTER DATA (FR-1.5) — a couple of demo products.
-- ---------------------------------------------------------------------

delete from product_master_data;

insert into product_master_data (id, code, name, chassis_variant, body_variant, spec_sheet, status) values
  ('55555555-0000-0000-0000-000000000001', 'EVBUS-12M-STD', 'EV Bus 12M Standard', 'Standard Chassis', 'Standard Body',
   '{"length_m": 12, "seating_capacity": 40, "battery_kwh": 324}'::jsonb, 'ACTIVE'),
  ('55555555-0000-0000-0000-000000000002', 'EVTRUCK-STD', 'EV Truck Standard', 'Standard Chassis', 'Box Body',
   '{"payload_ton": 5, "battery_kwh": 210}'::jsonb, 'ACTIVE');

-- ---------------------------------------------------------------------
-- 9. QUOTATION DOCUMENT TEMPLATE (FR-1.5.3) — placeholder layout; the
--    real field structure awaits a sample document from VKTR Sales.
-- ---------------------------------------------------------------------

delete from quotation_document_template;

insert into quotation_document_template (name, applies_to, layout_schema, version, is_active) values
  ('Standard Quotation PDF', null,
   '{"sections": ["header", "customer", "project_identifier", "unit_and_price", "product_spec", "payment_terms", "approval_metadata"]}'::jsonb,
   1, true);

-- ---------------------------------------------------------------------
-- 10. cost_item_stat — recomputed lazily by the app; nothing to seed.
-- ---------------------------------------------------------------------
