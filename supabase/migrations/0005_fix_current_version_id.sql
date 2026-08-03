-- =====================================================================
-- Fix: pricing_proposal.current_version_id was referenced throughout the
-- application (create/submit/detail page) but was never declared in the
-- original 0001_init_schema.sql CREATE TABLE statement. This caused
-- every submit/select touching that column to fail on already-deployed
-- databases. Safe to run multiple times (idempotent).
-- =====================================================================

alter table pricing_proposal
  add column if not exists current_version_id uuid references pricing_proposal_version (id);
