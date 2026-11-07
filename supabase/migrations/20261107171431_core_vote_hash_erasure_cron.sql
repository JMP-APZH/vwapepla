-- Daily erasure of visitor-vote hashes older than 60 days (JM's decision 6, 5 Nov 2026; "yes" to pg_cron on 7 Nov 2026).
-- Enables Supabase Cron (pg_cron) and schedules the communes' erasure function, which covers com_criteria_votes and
-- com_site_votes. Other domains add their own job (same pattern, their own function). Additive: main is unaffected.
-- The job runs every day at 03:17 UTC (23:17 in Martinique). cron.schedule() replaces a job with the same name.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule('com-erase-vote-hashes', '17 3 * * *', $$select public.com_erase_old_vote_hashes()$$);
