-- B3 CTM, sprint 4: headline figures of the comptes administratifs voted by the Assemblée (main budget), read from the
-- standard M57 pages C1 / C2 of the published PDF, each with its page. Additive only: nothing used by `main` changes.
-- Public read, no write for anon/authenticated (loaded with the secret key by scripts/core/load_supabase.py --domain ctm).

create table public.ctm_ca_lines (
  year          smallint not null,
  budget        text not null check (budget in ('principal')),        -- annex budgets later
  line_key      text not null,                                         -- e.g. 'fonc_solde_reel' (scripts/ctm/pipeline/ca.py)
  label         text not null,
  amount        numeric not null,
  page          smallint not null,                                     -- page of the PDF
  deliberation  text not null,                                         -- e.g. '25-148-1'
  source_id     text not null references public.sources(id),
  primary key (year, budget, line_key)
);

alter table public.ctm_ca_lines enable row level security;
create policy "public read" on public.ctm_ca_lines for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.ctm_ca_lines from anon, authenticated;

notify pgrst, 'reload schema';
