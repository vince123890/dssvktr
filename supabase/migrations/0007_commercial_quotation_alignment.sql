-- =====================================================================
-- v2.0 — Commercial Quotation Alignment
--
-- Aligns the schema with "Commercial Quotation Approval System
-- Requirement for VKTR": COGS-owner based approval (VP Finance in
-- parallel with VP Operations), a release gate, and the delegated
-- discount-authority negotiation process.
--
-- Replaces the v1.1 assumption of Procurement -> Engineering -> Finance
-- -> C-Level. Existing demo rows are migrated, not dropped.
-- Idempotent where practical so it can be re-run safely.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ENUM EXTENSIONS
--    Postgres cannot remove enum values in-place, so the v1 values stay
--    present but unused; new values are appended.
-- ---------------------------------------------------------------------

alter type department_code add value if not exists 'CHIEF_SALES';
alter type department_code add value if not exists 'VP_FINANCE';
alter type department_code add value if not exists 'VP_OPERATIONS';
alter type department_code add value if not exists 'BOD';

alter type user_role add value if not exists 'SALES_OFFICER';
alter type user_role add value if not exists 'CHIEF_SALES';
alter type user_role add value if not exists 'VP_FINANCE';
alter type user_role add value if not exists 'VP_OPERATIONS';
alter type user_role add value if not exists 'BOD';

alter type proposal_status add value if not exists 'PENDING_COGS_VALIDATION';
alter type proposal_status add value if not exists 'PENDING_CHIEF_SALES_REVIEW';
alter type proposal_status add value if not exists 'PENDING_BOD_APPROVAL';
alter type proposal_status add value if not exists 'QUOTATION_RELEASED';

alter type audit_action add value if not exists 'NEGOTIATION_REQUEST';
alter type audit_action add value if not exists 'NEGOTIATION_DECISION';
alter type audit_action add value if not exists 'RELEASE';
