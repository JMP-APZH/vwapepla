-- Vwapepla MVP2 — initial schema.
-- Facts only (no user data). Public can read everything; writes only via the import scripts (secret key, bypasses RLS).

-- Every figure points to a source row (dataset, url, licence, retrieval date, checksum).
create table public.sources (
  id            text primary key,              -- dataset id, e.g. 'ofgl-base-communes-consolidee'
  title         text,
  url           text not null,                 -- exact download url
  dataset_page  text,
  licence       text not null,
  credit        text not null,                 -- text to display, e.g. 'Source : OFGL, d''après DGFiP'
  retrieved     date not null,
  sha256        text,
  rows          integer,
  purpose       text
);

create table public.communes (
  code          text primary key check (code ~ '^972[0-9]{2}$'),
  slug          text not null unique,
  name          text not null,
  siren         text not null unique
);

-- Per-year context: population, stratum, intercommunality, accounting standard.
create table public.commune_years (
  commune_code  text not null references public.communes(code),
  year          smallint not null,
  population    integer not null,             -- OFGL "population totale" (INSEE)
  stratum       text,                          -- OFGL tranche_population
  epci_siren    text,
  epci_name     text,
  nomenclature  text,                          -- M14 / M57
  primary key (commune_code, year)
);

create table public.officeholders (
  id              bigint generated always as identity primary key,
  commune_code    text not null references public.communes(code),
  role            text not null default 'maire' check (role in ('maire')),
  last_name       text not null,
  first_name      text not null,
  mandate_start   date not null,
  function_start  date,
  mandate_end     date,                        -- null = current
  source_id       text not null references public.sources(id),
  unique (commune_code, role, mandate_start)
);

-- The validated mapping table, as data (see scripts/pipeline/metrics.py).
create table public.metric_definitions (
  key           text primary key,
  block         text not null,
  parent_key    text references public.metric_definitions(key),
  label_fr      text not null,
  label_kreyol  text,
  source_rule   text not null,                 -- 'ofgl:<aggregate>' | 'dgfip:<accounts>' | 'derived:<formula>'
  unit          text not null default 'eur' check (unit in ('eur', 'years', 'ratio')),
  on_card       boolean not null default false,
  description_fr text,
  display_order integer not null
);

-- ACTUALS (executed accounts). Never contains forecast figures.
create table public.actuals (
  commune_code  text not null references public.communes(code),
  year          smallint not null,
  metric_key    text not null references public.metric_definitions(key),
  amount        numeric,                       -- euros (or years / ratio, see unit); null = not computable
  amount_bp     numeric,                       -- main budget part (consolidated datasets)
  amount_ba     numeric,                       -- annex budgets part
  amount_flux   numeric,                       -- neutralised cross flows
  eur_per_hab   numeric,
  provisional   boolean not null default false,
  source_id     text not null references public.sources(id),
  primary key (commune_code, year, metric_key)
);

-- Other public bodies spending for the communes' population: EPCI, syndicats, CCAS, EPL.
create table public.entities (
  siren         text primary key,
  kind          text not null check (kind in ('epci', 'syndicat', 'ccas', 'epl')),
  name          text not null,
  commune_code  text references public.communes(code),   -- CCAS -> its commune
  category      text
);

create table public.entity_actuals (
  siren         text not null references public.entities(siren),
  year          smallint not null,
  agregat       text not null,                 -- OFGL label as published
  metric_key    text references public.metric_definitions(key),
  amount        numeric,
  population    integer,
  provisional   boolean not null default false,
  source_id     text not null references public.sources(id),
  primary key (siren, year, agregat)
);

-- FORECAST layer (budgets primitifs, DOB/ROB…), entered from the communes' own documents. Kept separate from actuals.
create table public.forecast_documents (
  id            text primary key,              -- '<insee>-<year>-<type>', e.g. '97209-2026-BP'
  commune_code  text not null references public.communes(code),
  fiscal_year   smallint not null,
  doc_type      text not null check (doc_type in ('BP', 'BS', 'DM', 'DOB', 'ROB', 'CA', 'CFU')),
  title         text not null,
  adopted_on    date,
  source_url    text not null,
  archive_path  text,                          -- path in Storage bucket 'forecast-docs'
  sha256        text,
  captured_by   text not null,
  captured_at   date not null,
  reviewed_by   text,
  notes         text
);

create table public.forecast_figures (
  document_id   text not null references public.forecast_documents(id) on delete cascade,
  metric_key    text not null references public.metric_definitions(key),
  amount        numeric not null,
  page          integer,
  note          text,
  primary key (document_id, metric_key)
);

create index on public.actuals (year, metric_key);
create index on public.entity_actuals (year, metric_key);
create index on public.forecast_documents (commune_code, fiscal_year);

-- Read-only public access.
do $$
declare t text;
begin
  foreach t in array array['sources','communes','commune_years','officeholders','metric_definitions','actuals',
                           'entities','entity_actuals','forecast_documents','forecast_figures'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Median per inhabitant within the same population stratum (fair comparison, no ranking).
create view public.v_stratum_median with (security_invoker = true) as
select cy.year, cy.stratum, a.metric_key,
       count(*)                                                    as communes,
       percentile_cont(0.5) within group (order by a.eur_per_hab)  as median_eur_per_hab
from public.actuals a
join public.commune_years cy on cy.commune_code = a.commune_code and cy.year = a.year
where a.eur_per_hab is not null
group by cy.year, cy.stratum, a.metric_key;

-- Martinique-wide totals per year (used for the reconciliation check and the home page).
create view public.v_martinique_totals with (security_invoker = true) as
select a.year, a.metric_key, count(*) as communes, sum(a.amount) as amount, bool_or(a.provisional) as provisional
from public.actuals a
join public.metric_definitions m on m.key = a.metric_key and m.unit = 'eur'
group by a.year, a.metric_key;

-- Archived source documents for the forecast layer (public read; uploads only with the secret key).
insert into storage.buckets (id, name, public) values ('forecast-docs', 'forecast-docs', true)
on conflict (id) do nothing;
