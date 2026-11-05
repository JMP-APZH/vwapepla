-- B3 CTM, sprint 2: budget actuals (CTM 2016-2025; Région and Département 2008-2015), metric definitions, electoral
-- lists and sections. Additive only: nothing used by `main` changes. Core rows (institution `ctm`, bodies, seats, terms,
-- persons, mandates, sources) use the existing core tables.
-- Public read, no write for anon/authenticated (loaded with the secret key by scripts/core/load_supabase.py --domain ctm).

create table public.ctm_metric_definitions (
  key             text primary key,
  block           text not null,                               -- recettes, depenses, epargne_dette, fiscalite_ultramarine, contexte
  parent_key      text references public.ctm_metric_definitions(key),
  label_fr        text not null,
  label_kreyol    text,
  source_rule     text not null,                               -- 'ofgl:<agrégat>' | 'dgfip:<accounts>' | 'derived:<formula>'
  unit            text not null check (unit in ('eur', 'years', 'inhabitants')),
  on_card         boolean not null default false,
  description_fr  text,
  display_order   integer not null
);

-- ACTUALS (executed accounts), one row per body, year and metric. The three bodies are never summed.
create table public.ctm_actuals (
  entity_siren  text not null check (entity_siren in ('200055507', '239720014', '229720016')),  -- CTM, Région, Département
  year          smallint not null,
  metric_key    text not null references public.ctm_metric_definitions(key),
  amount        numeric,                                       -- euros (or years / inhabitants); null = not computable
  amount_bp     numeric,                                       -- main budget part
  amount_ba     numeric,                                       -- annex budgets part
  amount_flux   numeric,                                       -- neutralised cross flows
  eur_per_hab   numeric,
  scope         text not null check (scope in ('consolide', 'budget_principal')),  -- 2008-2011: budget principal only
  provisional   boolean not null default false,
  source_id     text not null references public.sources(id),
  primary key (entity_siren, year, metric_key)
);

-- Lists of the CTM elections (Ministère de l'Intérieur results), per round.
create table public.ctm_electoral_lists (
  id             text primary key,                             -- 'ctm-2021-t2-1'
  election_year  smallint not null,
  round          smallint not null check (round in (1, 2)),
  number         smallint not null,                            -- N° de liste / panneau
  label_short    text not null,
  label          text not null,
  nuance         text,                                         -- as published (e.g. LDVG, LREG)
  head           text not null,                                -- tête de liste, as published
  votes          integer not null,
  pct_exprimes   numeric,
  seats          smallint,                                     -- round 2 only
  source_id      text not null references public.sources(id),
  unique (election_year, round, number)
);

-- The list on which each councillor was elected: published (2015 "Elus" sheet) or deduced by name from the round-1
-- lists (2021: no list of the elected is published). 'a_verifier' when the round-1 list merged before round 2.
create table public.ctm_list_members (
  id         text primary key,                                 -- '<person id>:<list id>'
  person_id  text not null references public.persons(id),
  list_id    text not null references public.ctm_electoral_lists(id),
  match      text not null check (match in ('publie', 'deduit', 'a_verifier')),
  note       text,                                             -- shown on the card when set
  source_id  text not null references public.sources(id)
);
create index on public.ctm_list_members (person_id);

-- Electoral section of each member of the Assemblée, per term (RNE for 2021; 2015 "Elus" sheet).
create table public.ctm_section_members (
  person_id  text not null references public.persons(id),
  term_id    text not null references public.terms(id),
  section    text not null,                                    -- 'Section du Centre', 'Section du Nord', 'Section du Sud', 'Section de Fort-de-France'
  source_id  text not null references public.sources(id),
  primary key (person_id, term_id)
);

do $$
declare t text;
begin
  foreach t in array array['ctm_metric_definitions', 'ctm_actuals', 'ctm_electoral_lists', 'ctm_list_members',
                           'ctm_section_members'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
