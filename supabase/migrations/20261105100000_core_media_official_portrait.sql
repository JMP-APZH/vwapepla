-- Core media: one more kind, 'official_portrait', for officeholders of any domain (préfet, parlementaires, CTM).
-- Additive: the new check accepts every existing value, so `main` keeps working. Same rules as mayor portraits:
-- official source only, credited, removed on request (removed_at, hidden by RLS).
alter table public.media drop constraint if exists media_kind_check;
alter table public.media add constraint media_kind_check
  check (kind in ('mayor_portrait', 'council_photo', 'official_portrait'));

-- One portrait per person and kind (a person can be in several domains' cards, the photo is shared).
create unique index if not exists media_person_kind on public.media (person_id, kind) where person_id is not null;

notify pgrst, 'reload schema';
