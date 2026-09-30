-- =====================================================================
-- v4.0 — VKTR confirmation (part 3: reset & reseed configuration)
--
-- MUST run AFTER 0015 has been committed.
--
-- Seeds everything that sheet "Actors" and "Basic Workflow" of
-- docs/BTEL - Cost and Roles and Flow.xlsx define as CONFIGURATION —
-- app roles, the scope authority matrix, margin tiers, quantity bands,
-- the two basic workflows — plus the corrected cost structure (STNK and
-- Insurance belong to Add-Ons) and the product variants from the
-- sample Cost Estimate document.
--
-- Transactional data is wiped: the v3.0 quotations follow a state
-- machine that no longer exists. Demo users, historical quotations and
-- released cost structures are provisioned by `npm run seed:demo`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. WIPE TRANSACTIONAL DATA
-- ---------------------------------------------------------------------

truncate table
  tier_approval,
  quotation_line_item,
  price_estimate_log,
  negotiation_decision,
  negotiation_request,
  workflow_step_instance,
  workflow_instance,
  proposal_calculation_result,
  proposal_cost_line,
  pricing_proposal_version,
  audit_log_entry,
  cost_structure_scope_state,
  cost_structure_line
  restart identity cascade;

update pricing_proposal set supersedes_proposal_id = null, current_version_id = null;
delete from pricing_proposal;
delete from project_identifier;
delete from cost_item_stat;
update cost_structure_version set parent_version_id = null;
delete from cost_structure_version;

-- ---------------------------------------------------------------------
-- 2. APP ROLES (sheet Actors + Basic Workflow initiators)
-- ---------------------------------------------------------------------

insert into app_role (code, name, functional_roles, is_external, sort_order) values
  ('AUTHORIZED_AGENCY',  'Authorized Agency',                          '{EXTERNAL_AGENCY}',                          true,  10),
  ('SALES_EXECUTIVE',    'Sales Executive',                            '{SALESPERSON}',                              false, 20),
  ('SALES_LEAD',         'Sales Lead',                                 '{SALESPERSON,SALES_VALIDATOR}',              false, 30),
  ('SALES_OPS_MANAGER',  'Sales Operations Manager',                   '{SALES_OPERATIONS,SALES_PRICING_OWNER}',     false, 40),
  ('HEAD_OF_SALES',      'Head of Sales',                              '{SALES_RELEASER,SALES_PRICING_OWNER}',       false, 50),
  ('PROCUREMENT_MANAGER','Procurement Manager',                        '{COGS_OWNER}',                               false, 60),
  ('HEAD_OF_PROC_OPS',   'Head of Procurement and Operations Control', '{COGS_OWNER}',                               false, 70),
  ('HEAD_OF_CORP_FIN',   'Head of Corporate Finance',                  '{PROFITABILITY_OWNER}',                      false, 80),
  ('CCO',                'Chief Commercial Officer',                   '{PRICING_COMMITTEE}',                        false, 90),
  ('CFO',                'Chief Finance Officer',                      '{PRICING_COMMITTEE}',                        false, 100),
  ('PRODUCT_OWNER',      'Product Owner',                              '{PRODUCT_OWNER}',                            false, 110),
  ('SYSTEM_ADMIN',       'System Admin',                               '{SYSTEM_ADMIN}',                             false, 120)
on conflict (code) do update set
  name = excluded.name,
  functional_roles = excluded.functional_roles,
  is_external = excluded.is_external,
  is_active = true,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- 3. SCOPE AUTHORITY (sheet Actors) — every listed actor holds Maker,
--    Checker and Releaser on its scope, in both scenarios; the Pricing
--    Committee (CCO, CFO) only in the Deviation scenario, on all scopes.
-- ---------------------------------------------------------------------

delete from scope_authority;

insert into scope_authority (app_role_code, scope, scenario, can_make, can_check, can_release)
select r.code, s.scope, sc.scenario, true, true, true
from (values
  ('HEAD_OF_PROC_OPS',   'COGS'), ('HEAD_OF_PROC_OPS',   'ADD_ONS'),
  ('PROCUREMENT_MANAGER','COGS'), ('PROCUREMENT_MANAGER','ADD_ONS'),
  ('HEAD_OF_CORP_FIN',   'MARGIN'),
  ('HEAD_OF_SALES',      'SALES'),
  ('SALES_OPS_MANAGER',  'SALES')
) as r(code, scope)
cross join (values ('REGULAR'), ('DEVIATION')) as sc(scenario)
join (select unnest(array['COGS','ADD_ONS','MARGIN','SALES']) as scope) s on s.scope = r.scope;

insert into scope_authority (app_role_code, scope, scenario, can_make, can_check, can_release)
select r.code, s.scope, 'DEVIATION', true, true, true
from (values ('CCO'), ('CFO')) as r(code)
cross join (select unnest(array['COGS','ADD_ONS','MARGIN','SALES']) as scope) s;

insert into scope_segregation_rule (scope, maker_ne_checker, checker_ne_releaser, allow_single_actor) values
  ('COGS',    true, false, true),
  ('ADD_ONS', true, false, true),
  ('MARGIN',  true, false, true),
  ('SALES',   true, false, true)
on conflict (scope) do update set
  maker_ne_checker = excluded.maker_ne_checker,
  checker_ne_releaser = excluded.checker_ne_releaser,
  allow_single_actor = excluded.allow_single_actor;

-- ---------------------------------------------------------------------
-- 4. APP SETTINGS (illustrative values pending VKTR confirmation where
--    noted in Technical Logic §14)
-- ---------------------------------------------------------------------

insert into app_setting (key, value) values
  ('vat_rate_pct',               '11'::jsonb),
  ('deviation_gm_threshold_pct', '10'::jsonb),
  ('quotation_validity_days',    '30'::jsonb),
  ('fraud_guard_max_per_day',    '1'::jsonb),
  ('document_title',             '"COST ESTIMATE"'::jsonb),
  ('document_number_pattern',    '"{seq}/L/VKTR/{scheme}-{unit}/{MM}-{YYYY}"'::jsonb),
  ('document_unit_code',         '"EFS"'::jsonb),
  ('issuer_name',                '"PT VKTR Teknologi Mobilitas Tbk."'::jsonb),
  ('issuer_address',             '["Bakrie Tower 35th Floor, Rasuna Epicentrum,", "Jl. Epicentrum Utama Raya No. 2,", "Karet Kuningan, Kecamatan Setiabudi,", "Jakarta Selatan, DKI Jakarta 12940"]'::jsonb),
  ('document_disclaimer',        '"This document is strictly confidential for the use of the recipient and may not be circulated to other parties without PT VKTR Teknologi Mobilitas Tbk. prior written consent."'::jsonb),
  ('default_special_notes',      '["Delivery time and maintenance service contract details will be discussed", "Cost Estimate is not binding, the actual pricing to be confirmed post assessment"]'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- ---------------------------------------------------------------------
-- 5. QUANTITY BAND (sheet Basic Workflow step 5). Default discount
--    levels are demo figures — VKTR has not supplied them yet.
-- ---------------------------------------------------------------------

delete from quantity_band_config;
insert into quantity_band_config (band, min_qty, max_qty, processing_mode, default_discount_pct) values
  (1, 1,  1,    'AUTO',             0),
  (2, 2,  5,    'AUTO_WITH_MANUAL', 2),
  (3, 6,  9,    'AUTO_WITH_MANUAL', 3),
  (4, 10, null, 'MANUAL',           0);

-- ---------------------------------------------------------------------
-- 6. MARGIN TIER (sheet Basic Workflow step 7): >=15% Head of Sales
--    releases; 10-15% COGS Owner + Profitability Owner; <10% CCO + CFO
--    with cc to COGS & Profitability Owner. Rejection returns to Sales
--    Operations.
-- ---------------------------------------------------------------------

delete from margin_tier_authority;
insert into margin_tier_authority
  (tier, business_line, gpm_lower_bound_pct, gpm_upper_bound_pct, required_roles, decision_slots, cc_slots, reject_target, allow_bod_delegation, is_active)
values
  (1, null, 15.00, null,  '[]'::jsonb, '["SALES_RELEASER"]'::jsonb,                  '[]'::jsonb,                                   'SALES_OPERATIONS', false, true),
  (2, null, 10.00, 15.00, '[]'::jsonb, '["COGS_OWNER", "PROFITABILITY_OWNER"]'::jsonb, '[]'::jsonb,                                   'SALES_OPERATIONS', false, true),
  (3, null, null,  10.00, '[]'::jsonb, '["role:CCO", "role:CFO"]'::jsonb,             '["COGS_OWNER", "PROFITABILITY_OWNER"]'::jsonb, 'SALES_OPERATIONS', false, true);

-- ---------------------------------------------------------------------
-- 7. COST ITEMS — ownership confirmed by sheet Actors, and the v3.0
--    mapping error corrected: STNK and Insurance are Add-Ons (owned by
--    the COGS Owner), not Sales.
-- ---------------------------------------------------------------------

update cost_item
set cost_group = 'ADD_ONS',
    code = 'ADDON-STNK-001',
    subcategory = 'Add-On',
    owner_department_id = '11111111-0000-0000-0000-000000000009'
where id = '22222222-0003-0000-0000-000000000001';

update cost_item
set cost_group = 'ADD_ONS',
    code = 'ADDON-INS-001',
    subcategory = 'Add-On',
    owner_department_id = '11111111-0000-0000-0000-000000000009'
where id = '22222222-0003-0000-0000-000000000002';

-- FOB Price in IDR is FOB Price in CNY x the locked rate — never typed.
update cost_item set is_derived = true, is_mandatory = false
where code = 'COGS-FOB-IDR';

-- Delivery Service may be valued later or released as "At cost".
update cost_item
set may_follow_later = true, is_mandatory = true, exclusion_label = 'Delivery To Site'
where code = 'ADDON-DLV-001';

-- ---------------------------------------------------------------------
-- 8. PRODUCT VARIANTS (sample Cost Estimate — VKTR Light Duty Truck)
-- ---------------------------------------------------------------------

delete from product_master_data;

insert into product_master_data
  (id, code, name, chassis_variant, body_variant, make, model, variant_type, variant, wheelbase, battery_kwh,
   body_application, build_type, loco, document_description, spec_sheet, image_urls,
   default_inclusions, default_exclusions, status)
values
  ('55555555-0000-0000-0000-000000000011', 'LDT-4X2-SWB-DMP-90-CKD-MGL',
   'VKTR Light Duty Truck 4x2 SWB Dumper 90 kWh', 'Short Wheelbase', 'Dumper',
   'VKTR', 'Light Duty Truck', '4x2 Short Wheelbase', 'Dumper, Battery 90 kWh', 'Short Wheelbase', 90,
   'Dumper', 'CKD', 'Magelang',
   'VKTR Light Duty Truck 4x2, Short Wheelbase, with Dumper, Battery 90 kWh, CKD, loco Magelang',
   '{
     "Dimension": {"Length x Width x Height": "5660 x 2090 x 2420 mm", "Cab to End": "3750 mm", "Wheelbase": "3380 mm", "Front / Rear Overhang": "1221 / 1065 mm", "Front / Rear Track": "1745 / 1625 mm", "Ground Clearance Axle": "195 mm", "Ground Clearance Non-Axle": "357 mm", "Approach / Departure / Ramp Angle": "24° / 34° / 21°", "Turning Radius": "6.85 m"},
     "Battery": {"Type": "CATL LFP", "Capacity": "90 kWh", "Cooling": "Air Cooling"},
     "Performance": {"Range": "up to 120 km", "Max Speed": "85 km/h", "Max Gradeability": "25%"},
     "Weight": {"Curb Weight": "3.4 T", "GVW Regulated": "8.25 T", "Axle Capacity": "4.5 + 8 T"},
     "Charging": {"Type": "DC", "Connector": "CCS2", "Charge Time": "50 minutes"},
     "Motor": {"Peak power & torque": "150 kW, 2250 Nm", "Rated power & torque": "85 kW, 1100 Nm", "Type": "AC PMSM, Liquid Cooling"},
     "PTO": {"Power": "20 kW e-PTO (Motor only)"},
     "Axles & Suspension": {"Configuration": "4 x 2", "Final Drive Ratio": "5.571", "Steering": "EHPS Recirculating Ball Screw", "Suspension": "Multi-layer Leaf Spring Trapezoidal (front), with helper (rear)"},
     "Braking & Wheels": {"Type": "Air Brake, Drum + Regenerative Braking", "Safety System": "ABS + HSA", "Rim / Tire": "6.00G x 16 / 7.50-16 16 PR"},
     "Cabin": {"Steering Wheel": "Right-Hand Drive", "Tilting": "Manual", "Suspension": "Solid Mount"}
   }'::jsonb,
   '{/products/ldt-spec-1-features.jpg,/products/ldt-spec-2-body-chassis.jpg,/products/ldt-spec-3-table.jpg}',
   '{"Onsite training during initial deployment, 2 week","Online training refreshment 1x (first year)","On-call technical support"}',
   '{"Maintenance","Other Requests"}',
   'ACTIVE'),
  ('55555555-0000-0000-0000-000000000012', 'LDT-4X2-MWB-BOX-132-CKD-MGL',
   'VKTR Light Duty Truck 4x2 MWB Aluminium Box 132 kWh', 'Medium Wheelbase', 'Aluminium & Steel Box',
   'VKTR', 'Light Duty Truck', '4x2 Medium Wheelbase', 'Aluminium Box, Battery 132 kWh', 'Medium Wheelbase', 132,
   'Aluminium & Steel Box', 'CKD', 'Magelang',
   'VKTR Light Duty Truck 4x2, Medium Wheelbase, with Aluminium Box, Battery 132 kWh, CKD, loco Magelang',
   '{
     "Dimension": {"Length x Width x Height": "6210 x 2090 x 2420 mm", "Cab to End": "4350 mm", "Wheelbase": "4000 mm", "Front / Rear Overhang": "1221 / 1010 mm", "Front / Rear Track": "1745 / 1625 mm", "Ground Clearance Axle": "195 mm", "Ground Clearance Non-Axle": "357 mm", "Approach / Departure / Ramp Angle": "24° / 17° / 18°", "Turning Radius": "7.94 m"},
     "Battery": {"Type": "CATL LFP", "Capacity": "132 kWh", "Cooling": "Air Cooling"},
     "Performance": {"Range": "up to 220 km", "Max Speed": "85 km/h", "Max Gradeability": "25%"},
     "Weight": {"Curb Weight": "4.0 T", "GVW Regulated": "9.0 T", "Axle Capacity": "4.5 + 8 T"},
     "Charging": {"Type": "DC", "Connector": "CCS2", "Power": "120 kW", "Charge Time": "75 minutes"},
     "Motor": {"Peak power & torque": "150 kW, 2250 Nm", "Rated power & torque": "85 kW, 1100 Nm", "Type": "AC PMSM, Liquid Cooling"},
     "PTO": {"Power": "20 kW e-PTO (Motor only)"},
     "Axles & Suspension": {"Configuration": "4 x 2", "Final Drive Ratio": "5.571", "Steering": "EHPS Recirculating Ball Screw", "Suspension": "Multi-layer Leaf Spring Trapezoid (front), with helper (rear)"},
     "Braking & Wheels": {"Type": "Air Brake, Drum + Regenerative Braking", "Safety System": "ABS + HSA", "Rim / Tire": "6.00G x 16 / 7.50-16 16 PR"},
     "Cabin": {"Steering Wheel": "Right-Hand Drive", "Tilting": "Manual", "Suspension": "Solid Mount"}
   }'::jsonb,
   '{/products/ldt-spec-1-features.jpg,/products/ldt-spec-2-body-chassis.jpg,/products/ldt-spec-3-table.jpg}',
   '{"Onsite training during initial deployment, 2 week","Online training refreshment 1x (first year)","On-call technical support"}',
   '{"Maintenance","Other Requests"}',
   'ACTIVE');

-- ---------------------------------------------------------------------
-- 9. WORKFLOW TEMPLATES (sheet Basic Workflow)
--    A: Sales To Obtain Price Estimate — no approval steps.
--    B: Sales To Obtain Official Quotation — validation (skipped for a
--       Sales Lead initiator) -> Sales Operations generate -> Head of
--       Sales review & route. Margin-tier approval is appended by the
--       engine from margin_tier_authority, never from the template.
-- ---------------------------------------------------------------------

delete from workflow_step_definition;
delete from workflow_definition;

insert into workflow_definition
  (id, business_line, name, qualifier_type, workflow_kind, allowed_functions, min_value, max_value, is_active, version)
values
  ('44444444-0000-0000-0000-00000000000b', 'B2B_COMMERCIAL_FLEET', 'Official Quotation — Standard', 'GENERIC',
   'OFFICIAL_QUOTATION', '{SALESPERSON}', 0, null, true, 1),
  ('44444444-0000-0000-0000-00000000000c', 'B2B_COMMERCIAL_FLEET', 'Price Estimate (per Unit)', 'GENERIC',
   'PRICE_ESTIMATE', '{SALESPERSON,EXTERNAL_AGENCY}', 0, null, true, 1);

insert into workflow_step_definition
  (workflow_definition_id, step_order, department_id, status_label, is_mandatory_gate, sla_hours, parallel_group_id,
   step_name, action_kind, performer_function, skip_if_initiator_function, reject_to_step_order, cc_functions)
values
  ('44444444-0000-0000-0000-00000000000b', 1, null, 'PENDING_SALES_LEAD_VALIDATION', true, 24, null,
   'Validasi Sales Lead', 'VALIDATE', 'SALES_VALIDATOR', 'SALES_VALIDATOR', null, '{}'),
  ('44444444-0000-0000-0000-00000000000b', 2, null, 'PENDING_SALES_OPERATIONS', true, 24, null,
   'Generate Official Quotation', 'GENERATE_QUOTATION', 'SALES_OPERATIONS', null, null, '{}'),
  ('44444444-0000-0000-0000-00000000000b', 3, null, 'PENDING_HEAD_OF_SALES_REVIEW', true, 24, null,
   'Review & Rilis (Head of Sales)', 'REVIEW_AND_ROUTE', 'SALES_RELEASER', null, 2, '{}');

-- ---------------------------------------------------------------------
-- 10. EXCHANGE RATE — make sure a CNY baseline exists (Rp 2.600/CNY).
-- ---------------------------------------------------------------------

insert into exchange_rate (base_currency, quote_currency, rate, source, effective_from)
select 'CNY', 'IDR', 2600.00, 'seed-baseline', now() - interval '7 days'
where not exists (
  select 1 from exchange_rate where base_currency = 'CNY' and quote_currency = 'IDR'
);

update rate_sensitivity_config set is_active = false;
insert into rate_sensitivity_config (threshold_pct, is_active) values (2.00, true);
