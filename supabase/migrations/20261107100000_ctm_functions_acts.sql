-- B3 CTM, sprint 3: spending by area of responsibility (M57 functional presentation) and the index of the acts of the
-- Assemblée and the Conseil exécutif. Additive only: nothing used by `main` changes.
-- Public read, no write for anon/authenticated (loaded with the secret key by scripts/core/load_supabase.py --domain ctm).

-- CTM main budget, definitive DGFiP balances, 2018 onwards (scripts/ctm/pipeline/functions.py; B3-MAPPING.md §E).
create table public.ctm_functional_actuals (
  year         smallint not null,
  section      text not null check (section in ('fonctionnement', 'investissement')),
  fonction     text not null check (fonction ~ '^[0-8]$' or fonction = 'nv'),   -- M57 area 0-8; 'nv' = not broken down
  label        text not null,                                                   -- official label (OFGL, M57 nomenclature)
  amount       numeric not null,
  eur_per_hab  numeric,
  provisional  boolean not null default false,
  source_id    text not null references public.sources(id),
  primary key (year, section, fonction)
);

-- Acts as listed on collectivitedemartinique.mq: no session date, no vote, no topic (not in the index). Names of
-- private individuals are masked in the title (data minimisation); the full act is on the CTM's page (page_url).
create table public.ctm_acts (
  id         text primary key,                                   -- '<body>:<number>' or '<body>:wpdm-<id>'
  body       text not null check (body in ('assemblee', 'conseil_executif')),
  number     text,                                               -- 'YY-NNN-K' as published; null when not given
  year       smallint,                                           -- from the number
  title      text not null,
  page_url   text not null,
  source_id  text not null references public.sources(id)
);
create index on public.ctm_acts (body, year);

do $$
declare t text;
begin
  foreach t in array array['ctm_functional_actuals', 'ctm_acts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
