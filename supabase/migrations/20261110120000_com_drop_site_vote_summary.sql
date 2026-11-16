-- B1: drop the old average of the website-quality votes (DRAFT, NOT applied: needs JM's go).
-- Replaced by com_site_vote_distribution (20261107173708, applied 7 Nov 2026). Neither main nor dev calls the old
-- function since release #71 (9 Nov 2026): checked with git grep on origin/main and origin/dev, 10 Nov 2026.
-- Removing it also removes the last way to read an average of visitor votes (CLAUDE.md principle 4: distribution only).
-- Additive for the app: no table or data change; com_site_votes and com_site_vote_distribution are untouched.

drop function if exists public.com_site_vote_summary(text);

notify pgrst, 'reload schema';
