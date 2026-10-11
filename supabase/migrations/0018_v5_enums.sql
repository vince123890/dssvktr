-- =====================================================================
-- v5.0 — meeting "VKTR Req 2" (part 1: enums)
--
-- Technical Logic v5.0 §4.17: after the Head of Sales approves, the
-- quotation waits for the signed document to be attached by the
-- Salesperson before it counts as released.
--
-- Postgres forbids using a newly added enum value in the same
-- transaction that adds it, so the enum change is isolated here; the
-- columns/tables that use it live in 0019.
-- =====================================================================

alter type proposal_status add value if not exists 'PENDING_SIGNED_DOCUMENT';
