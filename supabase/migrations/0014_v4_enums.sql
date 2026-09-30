-- =====================================================================
-- v4.0 — VKTR confirmation (part 1: enums)
--
-- Aligns the schema with docs/PRD-VKTR-PriceCore.md v4.0 and
-- docs/TECHNICAL-LOGIC-VKTR-PriceCore.md v4.0, following
-- docs/BTEL - Cost and Roles and Flow.xlsx (Cost Structure, Actors,
-- Basic Workflow) and the sample Cost Estimate document.
--
-- Postgres forbids using a newly added enum value in the same
-- transaction that adds it, so enum changes are isolated here; the
-- tables/columns that reference them live in 0015.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. proposal_status — the Official Quotation state machine
--    (Technical Logic §4.1): Sales Lead validation, Sales Operations
--    generation, Head of Sales review, then margin-tier routing. The
--    v3.0 values (PENDING_COGS_VALIDATION, ...) stay in the enum
--    because values cannot be dropped in place, but are no longer used.
-- ---------------------------------------------------------------------

alter type proposal_status add value if not exists 'PENDING_SALES_LEAD_VALIDATION';
alter type proposal_status add value if not exists 'PENDING_SALES_OPERATIONS';
alter type proposal_status add value if not exists 'PENDING_HEAD_OF_SALES_REVIEW';
alter type proposal_status add value if not exists 'PENDING_ADDITIONAL_APPROVAL';
alter type proposal_status add value if not exists 'PENDING_OWNER_APPROVAL';
alter type proposal_status add value if not exists 'PENDING_PRICING_COMMITTEE_APPROVAL';
alter type proposal_status add value if not exists 'EXPIRED';

-- ---------------------------------------------------------------------
-- 2. audit_action — Maker/Checker/Releaser, step skipping, tier
--    routing, expiry, document printing, settings changes.
-- ---------------------------------------------------------------------

alter type audit_action add value if not exists 'MAKE';
alter type audit_action add value if not exists 'CHECK';
alter type audit_action add value if not exists 'RETURN';
alter type audit_action add value if not exists 'VALIDATE';
alter type audit_action add value if not exists 'GENERATE';
alter type audit_action add value if not exists 'REVISE';
alter type audit_action add value if not exists 'STEP_SKIPPED';
alter type audit_action add value if not exists 'TIER_ROUTE';
alter type audit_action add value if not exists 'TIER_CC';
alter type audit_action add value if not exists 'EXPIRE';
alter type audit_action add value if not exists 'PRINT';
alter type audit_action add value if not exists 'SETTINGS_CHANGE';
alter type audit_action add value if not exists 'PRICE_ESTIMATE';
