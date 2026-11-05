-- Visitor votes on the State's action in Martinique (OPINION layer, CLAUDE.md principle 4 as amended on 5 Nov 2026).
-- Criteria validated by JM (data/prefet/audit/vote_criteria_etat.yaml), loaded by scripts/prefet/build.py.
-- Votes are never about a named person. Raw votes are invisible to the public; written only by the server (secret
-- key) through pref_cast_state_vote; read only through pref_state_vote_summary, as a DISTRIBUTION of answers per
-- criterion and only from 20 votes (no average, no global score, no ranking).

create table public.pref_vote_criteria (
  key            text primary key,
  label_fr       text not null,                  -- the question, as validated
  description_fr text not null,
  competence     text not null check (competence in ('etat', 'partagee')),
  others         text[] not null default '{}',   -- who else acts on it (CTM, communes, EPCI)
  state_role_fr  text not null,                  -- what the State does on it (shown next to the question)
  fact_blocks    text[] not null default '{}',   -- card blocks shown next to the question
  display_order  smallint not null
);
alter table public.pref_vote_criteria enable row level security;
create policy "public read" on public.pref_vote_criteria for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.pref_vote_criteria from anon, authenticated;

create table public.pref_state_votes (
  id          bigint generated always as identity primary key,
  criterion   text not null references public.pref_vote_criteria(key),
  score       smallint not null check (score between 1 and 5),     -- « sans avis » is not recorded
  voter_hash  text not null check (length(voter_hash) = 64),       -- sha256(ip | user agent | daily secret salt); no IP stored
  created_at  timestamptz not null default now()
);
create index on public.pref_state_votes (voter_hash, criterion, created_at);
create index on public.pref_state_votes (criterion);
alter table public.pref_state_votes enable row level security;  -- no policy: invisible to anon/authenticated
revoke all on public.pref_state_votes from anon, authenticated;

-- Same limits as the communes' website votes: one vote per criterion per voter per 30 days, 40 votes per voter per day.
create function public.pref_cast_state_vote(p_criterion text, p_score int, p_voter_hash text)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if p_score is null or p_score not between 1 and 5 or length(coalesce(p_voter_hash, '')) <> 64
     or not exists (select 1 from public.pref_vote_criteria where key = p_criterion) then
    return 'invalid';
  end if;
  if exists (select 1 from public.pref_state_votes
             where voter_hash = p_voter_hash and criterion = p_criterion
               and created_at > now() - interval '30 days') then
    return 'already_voted';
  end if;
  if (select count(*) from public.pref_state_votes
      where voter_hash = p_voter_hash and created_at > now() - interval '1 day') >= 40 then
    return 'rate_limited';
  end if;
  insert into public.pref_state_votes (criterion, score, voter_hash) values (p_criterion, p_score, p_voter_hash);
  return 'ok';
end $$;
revoke execute on function public.pref_cast_state_vote(text, int, text) from public, anon, authenticated;
grant execute on function public.pref_cast_state_vote(text, int, text) to service_role;

-- Total per criterion always; counts per level only from 20 votes (score/votes null below the threshold).
create function public.pref_state_vote_summary()
returns table (criterion text, total bigint, score smallint, votes bigint)
language sql stable security definer set search_path = ''
as $$
  with t as (select v.criterion, count(*) as total from public.pref_state_votes v group by v.criterion),
       d as (select v.criterion, v.score, count(*) as votes from public.pref_state_votes v group by v.criterion, v.score)
  select c.key, coalesce(t.total, 0), d.score, d.votes
  from public.pref_vote_criteria c
  left join t on t.criterion = c.key
  left join d on d.criterion = c.key and t.total >= 20
$$;
revoke execute on function public.pref_state_vote_summary() from public;
grant execute on function public.pref_state_vote_summary() to anon, authenticated;

notify pgrst, 'reload schema';
