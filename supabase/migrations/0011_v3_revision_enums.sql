-- =====================================================================
-- v3.0 — Post-Demo Revision (part 1: enums)
--
-- Aligns the schema with docs/PRD-VKTR-PriceCore.md v3.0 and
-- docs/TECHNICAL-LOGIC-VKTR-PriceCore.md v3.0, following the POC demo
-- review (transcribe.md) and the real cost structure in
-- docs/BTEL-CostStructure.xlsx.
--
-- Headline changes: single CBS (cost_group replaces category as the
-- formula basis), Workflow Template resolution, margin-tier discount
-- authority (replacing percentage-based discount_authority), Project
-- Identifier versioning, Product Owner actor, CNY (not USD) as the FX
-- basis for imported COGS.
--
-- Postgres forbids using a newly added enum value in the same
-- transaction that adds it, so enum changes are isolated here; the
-- tables/columns that reference them live in 0012.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. NEW ENUM: cost_group — the four real BTEL cost groups
-- ---------------------------------------------------------------------

do $$ begin
  create type cost_group as enum ('COGS', 'PROFITABILITY', 'SALES', 'ADD_ONS');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 2. currency_code — add CNY as the real FOB Price denomination.
--    USD is kept (unused by the calculation basis going forward) so a
--    future display-currency toggle can reuse it without another enum
--    migration.
-- ---------------------------------------------------------------------

alter type currency_code add value if not exists 'CNY';

-- ---------------------------------------------------------------------
-- 3. proposal_status — SUPERSEDED for Project Identifier revisioning
--    (FR-2.5): an old quotation on the same project is marked
--    SUPERSEDED once its replacement is released, rather than edited
--    in place.
-- ---------------------------------------------------------------------

alter type proposal_status add value if not exists 'SUPERSEDED';

-- ---------------------------------------------------------------------
-- 4. audit_action — new actions for supersession and the duplicate/
--    fraud guard (FR-2.5, FR-2.6).
-- ---------------------------------------------------------------------

alter type audit_action add value if not exists 'SUPERSEDE';
alter type audit_action add value if not exists 'BLOCKED_DUPLICATE_ATTEMPT';

-- ---------------------------------------------------------------------
-- 5. user_role / department_code — Product Owner (FR-1.5), the fourth
--    actor called out in the demo review for product master data.
-- ---------------------------------------------------------------------

alter type user_role add value if not exists 'PRODUCT_OWNER';
alter type department_code add value if not exists 'PRODUCT';
