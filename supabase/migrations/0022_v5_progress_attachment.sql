-- =====================================================================
-- v5.0 — every project progress entry carries a photo or document as proof
-- (PDF / PNG / JPG, stored in the private quotation-files bucket).
--
-- The column stays nullable only because progress rows that already exist
-- (and the demo seed) have none; the application requires an attachment for
-- every new entry (src/app/(app)/projects/actions.ts).
-- =====================================================================

alter table project_progress_entry
  add column if not exists attachment_path text;
