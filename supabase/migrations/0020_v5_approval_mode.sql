-- =====================================================================
-- v5.0 — approval mode chosen per quotation (dropdown on the create form)
--
--   HEAD_OF_SALES (default): the Head of Sales reviews and approves; the
--                  signed-document attachment is optional before release.
--   NONE:          the Head of Sales review is skipped and the quotation is
--                  released right after submit. The margin-tier approvals
--                  (GM < 15%) still apply, so a deep discount cannot be
--                  released by choosing "no approval".
-- =====================================================================

alter table pricing_proposal
  add column if not exists approval_mode text not null default 'HEAD_OF_SALES'
  check (approval_mode in ('HEAD_OF_SALES', 'NONE'));
