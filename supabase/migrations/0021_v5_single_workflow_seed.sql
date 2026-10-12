-- =====================================================================
-- v5.0 — one workflow in the seed catalog
--
-- Meeting "VKTR Req 2": only one workflow (OQ-STANDARD) is needed now; the
-- blacklist / special-relation / large-value / B2G / heavy-industry example
-- templates from migration 0017 are not wanted. 0019 had only deactivated
-- them; this removes them so Settings -> Workflow lists a single workflow.
--
-- Safe by construction: a template is deleted only when no quotation and no
-- workflow instance refers to it (an in-flight quotation keeps its own copy
-- of the steps, and history must stay readable). A referenced template is
-- left inactive. The catalog feature itself is untouched — more workflows
-- are added later with "Tambah workflow" / "Duplikat" in Settings.
-- Older migrations (0016, 0017) are not edited; they have already been run.
-- =====================================================================

do $$
declare
  r record;
begin
  for r in
    select id, template_code
      from workflow_definition
     where workflow_kind = 'OFFICIAL_QUOTATION'
       and template_code in ('OQ-BLACKLIST', 'OQ-RELASI-KHUSUS', 'OQ-NILAI-BESAR', 'OQ-B2G', 'OQ-INDUSTRI-BERAT')
  loop
    if not exists (select 1 from pricing_proposal p where p.workflow_definition_id = r.id)
       and not exists (select 1 from workflow_instance i where i.workflow_definition_id = r.id)
    then
      delete from workflow_step_definition where workflow_definition_id = r.id;
      delete from workflow_definition where id = r.id;
    else
      update workflow_definition set is_active = false where id = r.id;
    end if;
  end loop;

  -- Template-specific margin ladders of the deleted templates.
  delete from margin_tier_authority m
   where m.workflow_template_code in ('OQ-BLACKLIST', 'OQ-RELASI-KHUSUS', 'OQ-NILAI-BESAR', 'OQ-B2G', 'OQ-INDUSTRI-BERAT')
     and not exists (
       select 1 from workflow_definition d where d.template_code = m.workflow_template_code
     );
end $$;
