-- Website-quality votes shown as a DISTRIBUTION instead of an average (CLAUDE.md principle 4, amendment of 5 Nov 2026:
-- "as a distribution (no average, no global score, no ranking)"), and hidden during pre-election closures
-- (com_vote_closures, JM's decision 6).
-- The closure flag comes from com_votes_closed(p_commune) (already public), read by the site separately, so it is known
-- even for a commune with no votes yet.
-- Additive: a new read function. The old com_site_vote_summary (average) stays until main no longer calls it, then a
-- later migration drops it. com_cast_site_vote is unchanged; the new site code hides the form while closed.

create function public.com_site_vote_distribution(p_commune text)
returns table (question text, total bigint, score smallint, votes bigint)
language sql stable security definer set search_path = ''
as $$
  with v as (select x.question, x.score from public.com_site_votes x where x.commune_code = p_commune),
       tot as (select question, count(*) as total from v group by question),
       lvl as (select question, score, count(*) as votes from v group by question, score)
  select tot.question, tot.total, lvl.score, lvl.votes
  from tot
  left join lvl on lvl.question = tot.question and tot.total >= 20 and not public.com_votes_closed(p_commune)
  order by tot.question, lvl.score
$$;
revoke execute on function public.com_site_vote_distribution(text) from public;
grant execute on function public.com_site_vote_distribution(text) to anon, authenticated;

notify pgrst, 'reload schema';
