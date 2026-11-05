-- Parlement domain (B2): deputies and senators of Martinique, current terms (docs/branches/B2-DISCOVERY.md §2).
-- Additive only (keeps `main` working). Core rows (institutions, bodies, seats, persons, mandates, sources) are loaded by
-- scripts/parlement/build.py into the existing core tables; this migration adds the parl_* tables.
-- Every row carries source_id. Facts only: no score, no ranking, no derived rate is stored (neutrality charter §3).
-- RLS: public read; writes revoked from anon/authenticated (the loader uses the secret key).

create table public.parl_mandate_details (
  id                    text primary key,                          -- '<person id>:<seat id>'
  person_id             text not null references public.persons(id),
  seat_id               text not null references public.seats(id),
  election_cause        text,                                      -- 'élections générales', 'Election'
  suppleant_last_name   text,                                      -- deputies: from the 2024 candidacies (name only)
  suppleant_first_name  text,
  suppleant_sex         text check (suppleant_sex in ('F', 'M')),
  suppleant_source_id   text references public.sources(id),
  official_url          text not null,                             -- AN / Sénat page of the member
  hatvp_url             text,
  source_id             text not null references public.sources(id),
  unique (person_id, seat_id)
);

create table public.parl_organes (
  id          text primary key,                                    -- AN 'PO…' / Sénat 'sen-grp:SER', 'sen-com:…'
  chamber     text not null check (chamber in ('AN', 'SEN')),
  kind        text not null,                                       -- GP, COMPER, DELEG, CNPE, MISINFO, GA, GE, COM…
  label_fr    text not null,                                       -- official name, as published
  short       text,
  start_date  date,
  end_date    date,
  source_id   text not null references public.sources(id)
);

create table public.parl_memberships (
  id          text primary key,
  person_id   text not null references public.persons(id),
  organe_id   text not null references public.parl_organes(id),
  function    text,                                                -- 'Membre', 'Membre apparenté', 'Secrétaire'…
  start_date  date,
  end_date    date,
  source_id   text not null references public.sources(id)
);
create index on public.parl_memberships (person_id);

create table public.parl_texts (
  id         text primary key,                                     -- AN dossier législatif 'DLR…'
  chamber    text not null check (chamber in ('AN', 'SEN')),
  title      text not null,
  procedure  text,
  url        text,
  source_id  text not null references public.sources(id)
);

-- Every public vote of the legislature (the full list is offered as a download); selected_by = parts of the published
-- rule that select it for the card (e.g. {'V1:a','V1:b'}), empty when not selected.
create table public.parl_scrutins (
  id           text primary key,                                   -- 'VTANR5L17V…'
  number       integer not null,
  date         date not null,
  type_code    text not null,                                      -- SPO, SPS, MOC
  type_label   text not null,
  title        text not null,
  object       text,
  text_id      text references public.parl_texts(id),
  result_code  text,
  result_label text,
  voters       integer not null,
  pour         integer not null,
  contre       integer not null,
  abstentions  integer not null,
  non_votants  integer not null,
  selected_by  text[] not null default '{}',
  url          text not null,
  source_id    text not null references public.sources(id)
);
create index on public.parl_scrutins (date);

create table public.parl_votes (
  scrutin_id      text not null references public.parl_scrutins(id),
  person_id       text not null references public.persons(id),
  position        text not null check (position in ('pour', 'contre', 'abstention', 'nonVotant')),
  by_delegation   boolean not null,
  group_id        text references public.parl_organes(id),
  group_position  text,                                            -- majority position of the group, as published
  cause           text,
  mise_au_point   text,                                            -- the member's own published correction, if any
  source_id       text not null references public.sources(id),
  primary key (scrutin_id, person_id)
);
create index on public.parl_votes (person_id);

create table public.parl_amendments (
  id             text primary key,                                 -- '<amendment id>:<person id>'
  amendment_id   text not null,
  chamber        text not null check (chamber in ('AN', 'SEN')),
  person_id      text not null references public.persons(id),
  role           text not null check (role in ('premier_signataire', 'cosignataire')),
  as_rapporteur  boolean not null,
  signatories    integer not null,
  number         text not null,
  text_ref       text,
  text_number    text,
  text_title     text,
  text_id        text references public.parl_texts(id),
  article        text,
  filed          date,
  outcome        text,                                             -- as published: Adopté, Rejeté, Retiré, Tombé…
  state          text,
  url            text,
  source_id      text not null references public.sources(id)
);
create index on public.parl_amendments (person_id, role);

create table public.parl_questions (
  id         text primary key,
  chamber    text not null check (chamber in ('AN', 'SEN')),
  person_id  text not null references public.persons(id),
  kind       text not null,                                        -- QE, QOSD, QG
  number     text,
  title      text,
  rubrique   text,
  ministry   text,
  asked      date,
  answered   date,
  status     text,
  url        text,
  source_id  text not null references public.sources(id)
);
create index on public.parl_questions (person_id);

-- HATVP: every declaration (metadata and link). Asset declarations: link and dates only, never their contents.
create table public.parl_interest_declarations (
  id              text primary key,
  person_id       text not null references public.persons(id),
  doc_type        text not null,                                   -- DIA, DIAM, DSP, DSPM…
  deposited       date,
  published       date,
  status          text,
  url             text,
  open_data_file  text,
  source_id       text not null references public.sources(id)
);

-- Outside activities from the latest declaration of interests, as declared; the member's own sections only
-- (never the spouse's or the assistants' sections: JM, 5 Nov 2026).
create table public.parl_interest_items (
  id                 text primary key,
  person_id          text not null references public.persons(id),
  declaration_uuid   text not null,
  declaration_label  text,
  deposited          date,
  section            text not null check (section in ('activProfCinqDerniereDto', 'activConsultantDto',
                       'participationDirigeantDto', 'participationFinanciereDto', 'fonctionBenevoleDto',
                       'mandatElectifDto', 'observationInteretDto')),
  position           integer not null,
  fields             jsonb not null,
  amounts            jsonb not null,
  source_id          text not null references public.sources(id)
);
create index on public.parl_interest_items (person_id);

do $$
declare t text;
begin
  foreach t in array array['parl_mandate_details', 'parl_organes', 'parl_memberships', 'parl_texts', 'parl_scrutins',
                           'parl_votes', 'parl_amendments', 'parl_questions', 'parl_interest_declarations',
                           'parl_interest_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
