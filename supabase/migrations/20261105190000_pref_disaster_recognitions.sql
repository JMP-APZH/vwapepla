-- Préfet card, sprint 3: natural disaster recognitions (« arrêtés CatNat ») in Martinique, GASPAR database.
-- One row per decree, risk, commune and event start, as published. Additive; RLS public read, writes revoked.
create table public.pref_disaster_recognitions (
  id            text primary key,                -- '<NOR>:<risk code>:<INSEE>:<event start>'
  nor           text not null,                   -- NOR of the interministerial decree, e.g. 'INTE2424582A'
  commune_code  text not null,                   -- INSEE 972xx
  risk_code     text not null,
  risk          text not null,                   -- as published: Inondations et/ou Coulées de Boue, Vents Cycloniques…
  event_start   date,
  event_end     date,
  decree_date   date,
  jo_date       date,
  source_id     text not null references public.sources(id)
);
create index on public.pref_disaster_recognitions (event_start);

alter table public.pref_disaster_recognitions enable row level security;
create policy "public read" on public.pref_disaster_recognitions for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.pref_disaster_recognitions from anon, authenticated;

notify pgrst, 'reload schema';
