-- Visitor votes on the commune's action, by criterion (OPINION layer, CLAUDE.md principle 4, amendment of 5 Nov 2026).
-- Criteria validated by JM on 7 Nov 2026 (data/communes/audit/vote_criteria.yaml), loaded by
-- scripts/communes/pipeline/build_votes.py. Design and decisions: docs/branches/B1-VOTES.md.
-- Additive only: new tables and functions; the only change to an existing object makes com_site_votes.voter_hash
-- nullable (main never reads it), so main keeps working.
--
-- Safeguards: raw votes invisible to the public; written only by the server (secret key) through
-- com_cast_criteria_vote; read only through com_criteria_vote_summary, as a DISTRIBUTION per criterion, for the
-- current term, only from 20 votes with a score (no average, no global score, no ranking); « je ne sais pas » is
-- stored as score null and its count is shown next to the distribution; voter hash erased after 60 days; votes and
-- results closed during pre-election periods listed in com_vote_closures.

-- ============================================================ 1. Criteria (public read)
create table public.com_vote_criteria (
  key             text primary key,
  label_fr        text not null,                 -- completes the stem « Comment évaluez-vous l'action de la commune sur … ? »
  competence      text not null check (competence in ('commune', 'partagee')),
  others          text[] not null default '{}' check (others <@ array['EPCI', 'CTM', 'État']),
  commune_role_fr text not null,                 -- what the commune does on it, shown next to the question
  ref_status      text not null check (ref_status in ('to_confirm', 'confirmed')),
  display_order   smallint not null unique
);
alter table public.com_vote_criteria enable row level security;
create policy "public read" on public.com_vote_criteria for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.com_vote_criteria from anon, authenticated;

-- ============================================================ 2. Closures (pre-election periods; public read)
-- One row per period. commune_code null = all 34 communes (general municipal elections); a code = a by-election.
-- Dates decided by JM after the legal review; rows written by the loader from data/communes/audit/vote_closures.yaml.
create table public.com_vote_closures (
  id           text primary key,
  commune_code text references public.com_communes(code),
  starts_on    date not null,
  ends_on      date not null check (ends_on >= starts_on),
  reason_fr    text not null,
  source_url   text not null
);
alter table public.com_vote_closures enable row level security;
create policy "public read" on public.com_vote_closures for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.com_vote_closures from anon, authenticated;

create function public.com_votes_closed(p_commune text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.com_vote_closures c
                 where (c.commune_code is null or c.commune_code = p_commune)
                   and (now() at time zone 'America/Martinique')::date between c.starts_on and c.ends_on)
$$;
revoke execute on function public.com_votes_closed(text) from public;
grant execute on function public.com_votes_closed(text) to anon, authenticated, service_role;

-- ============================================================ 3. Votes (invisible to the public)
create table public.com_criteria_votes (
  id           bigint generated always as identity primary key,
  commune_code text not null references public.com_communes(code),
  term_id      text not null references public.terms(id),           -- votes belong to the current term only
  criterion    text not null references public.com_vote_criteria(key),
  score        smallint check (score between 1 and 5),              -- null = « je ne sais pas »
  voter_hash   text check (length(voter_hash) = 64),                -- sha256(ip | ua | monthly salt); null after 60 days
  created_at   timestamptz not null default now()
);
create index on public.com_criteria_votes (voter_hash, created_at) where voter_hash is not null;
create index on public.com_criteria_votes (commune_code, term_id, criterion);
create index on public.com_criteria_votes (created_at) where voter_hash is not null;
alter table public.com_criteria_votes enable row level security;  -- no policy: invisible to anon/authenticated
revoke all on public.com_criteria_votes from anon, authenticated;

-- Website-quality votes: same 60-day erasure, so the hash column must accept null (main never reads it).
alter table public.com_site_votes alter column voter_hash drop not null;

-- ============================================================ 4. Hash erasure (60 days)
-- Called by every vote, and daily by pg_cron if JM enables it (separate core step, see B1-VOTES.md §6).
create function public.com_erase_old_vote_hashes()
returns void
language sql security definer set search_path = ''
as $$
  update public.com_criteria_votes set voter_hash = null
   where voter_hash is not null and created_at < now() - interval '60 days';
  update public.com_site_votes set voter_hash = null
   where voter_hash is not null and created_at < now() - interval '60 days';
$$;
revoke execute on function public.com_erase_old_vote_hashes() from public, anon, authenticated;
grant execute on function public.com_erase_old_vote_hashes() to service_role;

-- ============================================================ 5. Write path (service_role only)
-- Limits: one vote per criterion per commune per voter per calendar month (UTC; the voter hash is monthly too),
-- 40 votes per voter per day, 15 per minute (one form sends up to 12 answers). Returns
-- ok / already_voted / rate_limited / closed / invalid.
create function public.com_cast_criteria_vote(p_commune text, p_criterion text, p_score int, p_voter_hash text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_term text;
begin
  perform public.com_erase_old_vote_hashes();
  if (p_score is not null and p_score not between 1 and 5) or length(coalesce(p_voter_hash, '')) <> 64
     or not exists (select 1 from public.com_vote_criteria where key = p_criterion)
     or not exists (select 1 from public.com_communes where code = p_commune) then
    return 'invalid';
  end if;
  if public.com_votes_closed(p_commune) then
    return 'closed';
  end if;
  select t.id into v_term from public.terms t
   where t.body_kind = 'conseil_municipal' and t.start_date <= current_date
     and (t.end_date is null or t.end_date > current_date)
   order by t.start_date desc limit 1;
  if v_term is null then
    return 'invalid';
  end if;
  if exists (select 1 from public.com_criteria_votes
             where voter_hash = p_voter_hash and commune_code = p_commune and criterion = p_criterion
               and created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC') then
    return 'already_voted';
  end if;
  if (select count(*) from public.com_criteria_votes
      where voter_hash = p_voter_hash and created_at > now() - interval '1 day') >= 40
     or (select count(*) from public.com_criteria_votes
         where voter_hash = p_voter_hash and created_at > now() - interval '1 minute') >= 15 then
    return 'rate_limited';
  end if;
  insert into public.com_criteria_votes (commune_code, term_id, criterion, score, voter_hash)
  values (p_commune, v_term, p_criterion, p_score, p_voter_hash);
  return 'ok';
end $$;
revoke execute on function public.com_cast_criteria_vote(text, text, int, text) from public, anon, authenticated;
grant execute on function public.com_cast_criteria_vote(text, text, int, text) to service_role;

-- ============================================================ 6. Read path (public)
-- Per criterion, for the commune and the current term: rated (votes with a score) and dont_know always;
-- counts per level (score, votes) only when rated >= 20 and votes are not closed. One row per level, or one row
-- with score/votes null below the threshold or while closed.
create function public.com_criteria_vote_summary(p_commune text)
returns table (criterion text, rated bigint, dont_know bigint, closed boolean, score smallint, votes bigint)
language sql stable security definer set search_path = ''
as $$
  with term as (
         select t.id from public.terms t
          where t.body_kind = 'conseil_municipal' and t.start_date <= current_date
            and (t.end_date is null or t.end_date > current_date)
          order by t.start_date desc limit 1),
       v as (select x.* from public.com_criteria_votes x, term
              where x.commune_code = p_commune and x.term_id = term.id),
       tot as (select criterion, count(score) as rated, count(*) - count(score) as dont_know from v group by criterion),
       lvl as (select criterion, score, count(*) as votes from v where score is not null group by criterion, score),
       cl as (select public.com_votes_closed(p_commune) as closed)
  select c.key, coalesce(tot.rated, 0), coalesce(tot.dont_know, 0), cl.closed, lvl.score, lvl.votes
  from public.com_vote_criteria c
  cross join cl
  left join tot on tot.criterion = c.key
  left join lvl on lvl.criterion = c.key and tot.rated >= 20 and not cl.closed
  order by c.display_order, lvl.score
$$;
revoke execute on function public.com_criteria_vote_summary(text) from public;
grant execute on function public.com_criteria_vote_summary(text) to anon, authenticated;

notify pgrst, 'reload schema';
