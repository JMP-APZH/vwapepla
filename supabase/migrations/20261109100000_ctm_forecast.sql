-- B3 CTM, sprint 5: forecast layer (« Prévisionnel »), kept apart from the actuals. Budgets primitifs of the main budget
-- read from the standard M57 pages D1 / D2 (scripts/ctm/pipeline/bp.py), each figure with its page; orientation reports
-- (ROB) are listed and linked only. Additive only: nothing used by `main` changes.
-- Public read, no write for anon/authenticated (loaded with the secret key by scripts/core/load_supabase.py --domain ctm).

create table public.ctm_forecast_documents (
  id            text primary key,                                      -- e.g. 'ctm-2026-BP'
  fiscal_year   smallint not null,
  doc_type      text not null check (doc_type in ('BP', 'ROB')),
  deliberation  text not null,                                         -- e.g. '25-376-1'
  title         text not null,
  source_id     text not null references public.sources(id)
);

create table public.ctm_forecast_figures (
  document_id   text not null references public.ctm_forecast_documents(id),
  line_key      text not null,                                         -- same keys as ctm_ca_lines (bp.py / ca.py)
  label         text not null,
  amount        numeric not null,
  page          smallint not null,                                     -- page of the PDF
  quote         text,                                                  -- exact wording, for narrative documents only
  primary key (document_id, line_key)
);

alter table public.ctm_forecast_documents enable row level security;
create policy "public read" on public.ctm_forecast_documents for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.ctm_forecast_documents from anon, authenticated;

alter table public.ctm_forecast_figures enable row level security;
create policy "public read" on public.ctm_forecast_figures for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.ctm_forecast_figures from anon, authenticated;

notify pgrst, 'reload schema';
