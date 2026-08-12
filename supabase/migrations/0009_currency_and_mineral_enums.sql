-- =====================================================================
-- v2.1 — Multi-Currency & Mineral Index (part 1: enums)
--
-- Postgres forbids using a newly added enum value in the same
-- transaction that adds it, so enum changes are isolated here and the
-- tables that reference them live in 0010.
-- =====================================================================

do $$ begin
  create type currency_code as enum ('IDR', 'USD');
exception when duplicate_object then null;
end $$;

alter type audit_action add value if not exists 'RATE_UPDATE';
alter type audit_action add value if not exists 'MINERAL_INDEX_UPDATE';
