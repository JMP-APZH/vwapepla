-- Préfet card: anonymous voter hashes of the État votes are erased after 60 days (CLAUDE.md principle 4, JM 5 Nov 2026;
-- go for B4 on 7 Nov 2026). Votes themselves (criterion, score, date) are kept, so published distributions do not change.
-- Erased by a daily pg_cron job (pg_cron enabled by B1 on 7 Nov 2026) and, as a safety net, before each new vote.
-- Additive for main: the cast function keeps its signature and return values.

alter table public.pref_state_votes alter column voter_hash drop not null;  -- the length check passes on null
comment on column public.pref_state_votes.voter_hash is
  'HMAC of ip | user agent with a monthly secret salt (no IP stored); set to null after 60 days';

create function public.pref_erase_old_vote_hashes()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  update public.pref_state_votes set voter_hash = null
  where voter_hash is not null and created_at < now() - interval '60 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.pref_erase_old_vote_hashes() from public, anon, authenticated;
grant execute on function public.pref_erase_old_vote_hashes() to service_role;

-- Same limits as before: one vote per criterion per voter hash per 30 days (the hash is monthly, so one per month),
-- 40 votes per voter per day. New: old hashes are erased first.
create or replace function public.pref_cast_state_vote(p_criterion text, p_score int, p_voter_hash text)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.pref_erase_old_vote_hashes();
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

-- Daily at 03:19 UTC (B1's communes job runs at 03:17). Re-runnable: unschedule first if it exists.
select cron.unschedule('pref-erase-vote-hashes') where exists (select 1 from cron.job where jobname = 'pref-erase-vote-hashes');
select cron.schedule('pref-erase-vote-hashes', '19 3 * * *', $$select public.pref_erase_old_vote_hashes()$$);

notify pgrst, 'reload schema';
