-- =====================================================================
-- Backfill pricing_proposal.current_version_id for rows that predate the
-- column (added in 0005). Each proposal is pointed at its current
-- version, falling back to the most recently created one.
--
-- Without this, proposal detail pages 500 on a null version lookup.
-- Idempotent: only touches rows that are still null.
-- =====================================================================

update pricing_proposal p
set current_version_id = v.id
from (
  select distinct on (proposal_id)
    proposal_id,
    id
  from pricing_proposal_version
  order by proposal_id, is_current desc, created_at desc
) v
where v.proposal_id = p.id
  and p.current_version_id is null;
