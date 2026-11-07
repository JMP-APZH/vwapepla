-- B1 Step 4 (JM's go, 5 Nov 2026): town-hall communication channels, dated team observations (FACTS, not opinions).
-- Additive only: main does not read this table. Rows come from data/communes/audit/channels/<insee>.yaml through
-- scripts/communes/pipeline/build_channels.py; only entries reviewed by JM are exported. Screenshots stay out of git
-- and out of this table: only their path in the private evidence store and their sha256.
create table public.com_channel_observations (
  id                          text primary key,  -- '<insee>-<platform>-<observed_on>-<8 hex of the account url>'
  commune_code                text not null references public.com_communes(code),
  platform                    text not null check (platform in ('facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp_channel')),
  observed_on                 date not null,
  account_url                 text,              -- null = no account found (see searched_on / search_note)
  account_name                text,
  official                    text check (official in ('yes', 'no', 'doubtful')),
  official_basis              text check (official_basis in ('linked_from_site', 'platform_verified', 'town_hall_confirmed', 'none')),
  official_evidence_url       text,
  last_post_date              date,
  posts_last_90_days          integer check (posts_last_90_days >= 0),
  council_meetings_streamed   text check (council_meetings_streamed in ('yes', 'no', 'unknown')),
  council_stream_evidence_url text,
  followers                   integer check (followers >= 0),
  followers_display           text,
  screenshot_path             text,
  screenshot_sha256           text check (screenshot_sha256 ~ '^[0-9a-f]{64}$'),
  searched_on                 date,
  search_note                 text,
  observer                    text not null,
  reviewed_by                 text not null,
  note                        text,
  check (account_url is not null or (searched_on is not null and search_note is not null)),
  check (account_url is null or (screenshot_path is not null and screenshot_sha256 is not null))
);
create index com_channel_observations_commune on public.com_channel_observations (commune_code, platform, observed_on desc);

alter table public.com_channel_observations enable row level security;
create policy "public read" on public.com_channel_observations for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.com_channel_observations from anon, authenticated;
