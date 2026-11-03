-- B4 Préfet, sprint 2: postings (events and career steps from JORF decrees), State investment grants (DGCL),
-- State credits in Martinique (DPT Outre-mer). Additive only: nothing used by `main` changes.
-- Public read, no write for anon/authenticated (loaded with the secret key by scripts/core/load_supabase.py).

-- Events of a posting, each with its own source (appointment and end decrees, taking office, interim periods).
create table public.pref_posting_events (
  id          text primary key,                                -- '<person id>:<seat>:<kind>:<date>'
  mandate_id  bigint references public.mandates(id),           -- null for an interim between two postings
  seat_id     text not null references public.seats(id),
  kind        text not null check (kind in ('appointment', 'taking_office', 'end', 'interim_start', 'interim_end')),
  event_date  date not null,
  detail      text,                                            -- e.g. previous post, as written in Article 1
  source_id   text not null references public.sources(id),
  source_url  text not null
);
create index on public.pref_posting_events (mandate_id);

-- Career path of the people posted in Martinique, from their appointment decrees (any post, anywhere).
create table public.pref_career_steps (
  id              text primary key,                            -- 'jorf-<JORFTEXT id>:<person id>'
  person_id       text not null references public.persons(id),
  signature_date  date not null,
  post            text not null,                               -- new post, as written in the decree
  previous_post   text,                                        -- as written in the decree, if stated
  effective_date  date,                                        -- « à compter du … », if stated
  source_id       text not null references public.sources(id),
  source_url      text not null
);
create index on public.pref_career_steps (person_id, signature_date);

-- DETR, DSIL, DSID, DPV... granted in Martinique (DGCL open data), one row per project as published.
create table public.pref_investment_grants (
  id                 text primary key,                         -- '<year>-<hash of published content>'
  year               smallint not null,
  scheme             text not null,                            -- dispositif as published
  budget_programme   text,                                     -- '119'
  beneficiary_type   text,                                     -- as published: commune, epci, departement (= CTM)
  beneficiary_siren  text,
  beneficiary_name   text not null,                            -- as published
  beneficiary_insee  text,                                     -- as published
  beneficiary_key    text not null,                            -- normalised: commune-972xx, epci-cacem/-caesm/-capnord, ctm, inconnu
  mapping_note       text,                                     -- how the key was deduced when it was not published (shown)
  project            text not null,
  cost_ht            numeric,
  grant_amount       numeric not null,
  rate               numeric,
  source_id          text not null references public.sources(id)
);
create index on public.pref_investment_grants (beneficiary_key, year);

-- State credits in Martinique by mission / programme, DPT Outre-mer territorial table, per budget-bill edition.
create table public.pref_dpt_credits (
  id          text primary key,                                -- '<edition>:<mission slug>:<programme code>:<stage>'
  edition     smallint not null,                               -- PLF year of the DPT
  page        int not null,                                    -- page of the PDF
  level       text not null check (level in ('mission', 'programme', 'total')),
  mission     text,
  code        text,                                            -- programme number (3 digits; 4 for prélèvements sur recettes)
  label       text not null,
  stage       text not null check (stage in ('execution', 'lfi', 'plf')),
  year        smallint not null,
  ae          numeric not null,
  cp          numeric not null,
  source_id   text not null references public.sources(id)
);
create index on public.pref_dpt_credits (level, stage, year);

do $$
declare t text;
begin
  foreach t in array array['pref_posting_events', 'pref_career_steps', 'pref_investment_grants', 'pref_dpt_credits'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
