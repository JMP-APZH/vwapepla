-- Préfet card: act counts per year of the BULLETIN (publication), not of the act's signature. Bulletins are imported
-- year by year, and acts signed late in a year are often published early the next: counted by signature date, a
-- year whose bulletins are not imported yet showed a misleading partial count (e.g. 68 acts « in 2024 » from the 2025
-- bulletins). The bulletin id starts with its year ('2025-0001'). Same columns and types: main keeps working.
create or replace view public.pref_acts_by_year with (security_invoker = true) as
  select left(bulletin, 4)::smallint as year, theme, count(*) as acts
  from public.pref_acts group by 1, 2;
grant select on public.pref_acts_by_year to anon, authenticated;

notify pgrst, 'reload schema';
