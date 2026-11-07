-- Préfet card, sprint 3: recorded crime (SSMSI) and social context (INSEE), shown next to the State's competences.
-- Additive; RLS public read, writes revoked (loader uses the secret key).
create table public.pref_crime_stats (
  id             text primary key,                 -- '<geo>:<year>:<indicator>'
  geo            text not null,                    -- '972' Martinique, '971' Guadeloupe, 'FR' France (sum of regions)
  geo_label      text not null,
  year           smallint not null,
  indicator      text not null,                    -- SSMSI indicator, as published
  unit           text not null,                    -- unit of count: victime, infraction, mis en cause, véhicule...
  count          numeric,
  rate_per_1000  numeric,                          -- per 1,000 inhabitants (per 1,000 dwellings for burglaries)
  denominator    numeric,
  computed       boolean not null default false,   -- true for France: sum of the published regional counts
  source_id      text not null references public.sources(id)
);
create index on public.pref_crime_stats (indicator, geo, year);

create table public.pref_context_figures (
  id           text primary key,                   -- '<indicator>:<geo>:<group>:<period>'
  indicator    text not null,                      -- chomage_bit, pauvrete_menages
  geo          text not null,                      -- '972', 'FM' France métropolitaine, 'FH' France hexagonale
  group_label  text not null,                      -- Ensemble, 15-24 ans, Ménages de travailleurs...
  period       text not null,
  value        numeric not null,
  unit         text not null,
  note         text,                               -- definition, as published
  quote        text,                               -- sentence of the publication (hand-entered figures)
  source_id    text not null references public.sources(id),
  source_url   text not null
);

do $$
declare t text;
begin
  foreach t in array array['pref_crime_stats', 'pref_context_figures'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
