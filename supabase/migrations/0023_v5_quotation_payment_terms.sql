-- =====================================================================
-- VKTR PriceCore v5.0 — payment terms (TOP) on the quotation
-- Every quotation starts with the standard 50/50 terms (DP + Pelunasan) so it can
-- be issued without anyone filling anything in. The Salesperson can change them with
-- "Update TOP"; on Won the terms are copied to the project, where they stay editable.
-- =====================================================================

alter table pricing_proposal
  add column if not exists payment_terms jsonb not null
  default '[{"label":"DP","pct":50},{"label":"Pelunasan","pct":50}]'::jsonb;
