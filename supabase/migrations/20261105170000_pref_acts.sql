-- Préfet card, sprint 3: acts published in the préfecture's Recueils des actes administratifs (RAA), from 2016.
-- One row per act and bulletin, as listed in the bulletin's Sommaire; `theme` is read from the title by the keyword
-- rules of scripts/prefet/acts.py (shown on the card). Additive; RLS public read, writes revoked.
create table public.pref_acts (
  id         text primary key,                 -- '<act id>:<bulletin>'
  act_id     text not null,                    -- 'R02-2026-10-30-00005' (date of the act inside)
  act_date   date not null,
  published  date,                             -- date the bulletin was published
  bulletin   text not null,                    -- '2026-0374'
  service    text,                             -- issuing service, as in the Sommaire
  title      text not null,                    -- as published
  pages      smallint not null,
  page       smallint not null,                -- first page of the act in the bulletin
  pdf_url    text not null,
  theme      text not null,
  source_id  text not null references public.sources(id)
);
create index on public.pref_acts (theme, act_date);
create index on public.pref_acts (act_date);

alter table public.pref_acts enable row level security;
create policy "public read" on public.pref_acts for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.pref_acts from anon, authenticated;

notify pgrst, 'reload schema';

-- Counts per year and theme, for the card (the page never loads every act).
create view public.pref_acts_by_year with (security_invoker = true) as
  select extract(year from act_date)::smallint as year, theme, count(*) as acts
  from public.pref_acts group by 1, 2;
grant select on public.pref_acts_by_year to anon, authenticated;
