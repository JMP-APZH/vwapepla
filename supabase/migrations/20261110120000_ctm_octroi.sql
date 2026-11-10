-- B3 CTM, sprint 6/7: octroi de mer decisions of the Assemblée (page /ctm/octroi-de-mer). Built by
-- scripts/ctm/pipeline/octroi.py: acts classified by rules on their title, and figures transcribed from scanned
-- deliberations (data/ctm/octroi/*.yaml, page + exact wording). Additive only: nothing used by `main` changes.
-- Public read, no write for anon/authenticated (loaded with the secret key by scripts/core/load_supabase.py --domain ctm).

create table public.ctm_octroi_acts (
  act_id  text primary key references public.ctm_acts(id),
  kind    text not null check (kind in ('repartition', 'tarifs', 'vie_chere', 'exonerations', 'reforme', 'autre'))
);

create table public.ctm_octroi_figures (
  deliberation  text not null,                                         -- e.g. '25-198-2'
  line_key      text not null,                                         -- e.g. 'part_population'
  label         text not null,
  value         numeric not null,
  unit          text not null,                                         -- '%', 'voix', 'année'
  page          smallint not null,                                     -- page of the PDF
  quote         text not null,                                         -- exact wording on that page
  source_id     text not null references public.sources(id),
  primary key (deliberation, line_key)
);

alter table public.ctm_octroi_acts enable row level security;
create policy "public read" on public.ctm_octroi_acts for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.ctm_octroi_acts from anon, authenticated;

alter table public.ctm_octroi_figures enable row level security;
create policy "public read" on public.ctm_octroi_figures for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.ctm_octroi_figures from anon, authenticated;

notify pgrst, 'reload schema';
