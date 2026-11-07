-- Préfet domain: personal facts stated in an official biography, starting with the place of birth (JM, 5 Nov 2026).
-- Only where the préfecture's official biography states it; the place only, never the birth date (data minimisation).
-- Additive; RLS public read, writes revoked (loader uses the secret key).
create table public.pref_person_facts (
  id               text primary key,                              -- '<person id>:<fact>'
  person_id        text not null references public.persons(id),
  fact             text not null check (fact in ('birthplace')),
  value            text not null,                                 -- e.g. 'Vannes (Morbihan)'
  quote            text not null,                                 -- sentence of the biography (birth date cut)
  source_id        text not null references public.sources(id),
  source_page_url  text not null,                                 -- page of the biography
  retrieved        date not null,
  unique (person_id, fact)
);

alter table public.pref_person_facts enable row level security;
create policy "public read" on public.pref_person_facts for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.pref_person_facts from anon, authenticated;

notify pgrst, 'reload schema';
