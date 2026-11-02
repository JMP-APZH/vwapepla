-- Card v2: whole municipal council, terms, photos, town-hall website audit (facts) and visitor votes (opinion).

-- Terms (mandats). Budget years "in office" exclude the election year (shared between outgoing and incoming teams).
create table public.terms (
  id               text primary key,             -- '2014-2020'
  election_year    smallint not null,
  start_date       date not null,
  end_date         date,
  first_full_year  smallint not null,
  last_full_year   smallint not null
);
alter table public.terms enable row level security;
create policy "public read" on public.terms for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.terms from anon, authenticated;

-- Officeholders: whole council (RNE) + past mayors (sourced history file).
alter table public.officeholders drop constraint officeholders_role_check;
alter table public.officeholders add constraint officeholders_role_check check (role in ('maire', 'adjoint', 'conseiller'));
alter table public.officeholders drop constraint officeholders_commune_code_role_mandate_start_key;
alter table public.officeholders add column rank smallint;                    -- deputy order (1er adjoint = 1)
alter table public.officeholders add column term_id text references public.terms(id);
alter table public.officeholders add column verified boolean not null default true;  -- history rows: reviewed by JM
alter table public.officeholders add column source_url text;                 -- history rows: page proving the fact
alter table public.officeholders
  add constraint officeholders_natural_key unique (commune_code, role, last_name, first_name, mandate_start);

-- Photos taken from official town-hall pages, shown with credit; removed on request (removed_at).
create table public.media (
  id               text primary key,              -- '<insee>-mayor_portrait'
  commune_code     text not null references public.communes(code),
  kind             text not null check (kind in ('mayor_portrait', 'council_photo')),
  storage_path     text not null,                 -- path in Storage bucket 'media'
  source_page_url  text not null,
  credit           text not null,
  retrieved        date not null,
  removed_at       timestamptz,
  note             text
);
alter table public.media enable row level security;
create policy "public read" on public.media for select to anon, authenticated using (removed_at is null);
revoke insert, update, delete, truncate on public.media from anon, authenticated;
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;

-- Town-hall website audit (FACTS): criteria validated by JM, one dated audit per commune, evidence per item.
create table public.audit_criteria (
  key            text primary key,
  family         text not null check (family in ('legal', 'quality', 'civic')),
  label_fr       text not null,
  description_fr text,
  legal_ref      text,                            -- e.g. 'CGCT art. L2313-1'
  applies_if     text,                            -- e.g. 'population >= 3500'; null = all communes
  display_order  integer not null
);
create table public.site_audits (
  id           text primary key,                  -- '<insee>-<yyyy-mm-dd>'
  commune_code text not null references public.communes(code),
  audited_on   date not null,
  site_url     text,
  auditor      text not null,
  reviewed_by  text,
  notes        text
);
create table public.site_audit_items (
  audit_id      text not null references public.site_audits(id) on delete cascade,
  criterion_key text not null references public.audit_criteria(key),
  status        text not null check (status in ('yes', 'partial', 'no', 'na')),
  evidence_url  text,
  archive_url   text,
  note          text,
  primary key (audit_id, criterion_key)
);
do $$
declare t text;
begin
  foreach t in array array['audit_criteria', 'site_audits', 'site_audit_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Visitor votes on website quality (OPINION). Table fully hidden from the public; written only by the server
-- (secret key) through cast_site_vote; read only as aggregates through site_vote_summary (n >= 20).
create table public.site_votes (
  id           bigint generated always as identity primary key,
  commune_code text not null references public.communes(code),
  question     text not null check (question in ('facile_a_trouver', 'a_jour', 'comprehensible', 'demarches')),
  score        smallint not null check (score between 1 and 5),
  voter_hash   text not null check (length(voter_hash) = 64),   -- sha256(ip + user agent + daily secret salt); no IP stored
  created_at   timestamptz not null default now()
);
create index on public.site_votes (voter_hash, commune_code, question, created_at);
alter table public.site_votes enable row level security;          -- no policy: invisible to anon/authenticated
revoke all on public.site_votes from anon, authenticated;

create function public.cast_site_vote(p_commune text, p_question text, p_score int, p_voter_hash text)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.site_votes
             where voter_hash = p_voter_hash and commune_code = p_commune and question = p_question
               and created_at > now() - interval '30 days') then
    return 'already_voted';
  end if;
  if (select count(*) from public.site_votes
      where voter_hash = p_voter_hash and created_at > now() - interval '1 day') >= 40 then
    return 'rate_limited';
  end if;
  insert into public.site_votes (commune_code, question, score, voter_hash)
  values (p_commune, p_question, p_score, p_voter_hash);
  return 'ok';
end $$;
revoke execute on function public.cast_site_vote(text, text, int, text) from public, anon, authenticated;
grant execute on function public.cast_site_vote(text, text, int, text) to service_role;

create function public.site_vote_summary(p_commune text)
returns table (question text, votes bigint, average numeric)
language sql stable security definer set search_path = ''
as $$
  select v.question, count(*) as votes,
         case when count(*) >= 20 then round(avg(v.score), 1) end as average   -- hidden below 20 votes
  from public.site_votes v
  where v.commune_code = p_commune
  group by v.question
$$;
revoke execute on function public.site_vote_summary(text) from public;
grant execute on function public.site_vote_summary(text) to anon, authenticated;
