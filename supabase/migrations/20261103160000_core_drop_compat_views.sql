-- Remove the temporary compatibility layer of 20261103120000_core_people_and_com_prefix.sql.
-- Apply ONLY once the production build (main) no longer uses the old names: release of PR "drop compat views"
-- (votes call com_cast_site_vote; photos are linked by institution_id/person_id, no longer by commune_code).
-- No CASCADE: if anything still depends on these objects, the migration fails and changes nothing.

-- Old table names (views over the com_* tables) and the old council view.
drop view public.officeholders;
drop view public.communes;
drop view public.commune_years;
drop view public.metric_definitions;
drop view public.actuals;
drop view public.entities;
drop view public.entity_actuals;
drop view public.forecast_documents;
drop view public.forecast_figures;
drop view public.audit_criteria;
drop view public.site_audits;
drop view public.site_audit_items;
drop view public.v_stratum_median;
drop view public.v_martinique_totals;

-- Old vote function names (thin wrappers over com_cast_site_vote / com_site_vote_summary).
drop function public.cast_site_vote(text, text, int, text);
drop function public.site_vote_summary(text);

-- Photos are linked to the institution and the person (core model); the commune code column is redundant.
do $$
begin
  if exists (select 1 from public.media where institution_id is null) then
    raise exception 'media rows without institution_id: fill them before dropping commune_code';
  end if;
end $$;
alter table public.media drop column commune_code;
alter table public.media alter column institution_id set not null;

notify pgrst, 'reload schema';
