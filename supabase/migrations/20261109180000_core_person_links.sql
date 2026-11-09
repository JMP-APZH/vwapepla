-- person_links: the same human holding offices in several domains (B2-DISCOVERY Q1 = option A, JM 5 Nov 2026).
-- Ids are built per domain ('parl-sen:21096Q', 'com-97230:BUVAL:Frédéric', 'ctm:NILOR:Jean-Philippe'), so one person
-- can exist several times. A link is a reviewed fact, never inferred from a name: namesakes exist (Eugène / Serge
-- Larcher, Roger / Marcellin Nadeau). Each row names the official page that shows both offices and who checked it.
-- A domain writes only the links whose person_id is one of its own people (scripts/core/load_supabase.py).
-- Additive: nothing existing changes, so the app built from `main` keeps working.

create table public.person_links (
  person_id       text not null references public.persons(id),
  same_as         text not null references public.persons(id),
  evidence_url    text not null,   -- official page naming both offices (Sénat / AN fiche, RNE…)
  evidence_label  text not null,   -- what the evidence says, e.g. « Sénat : maire de La Trinité (2014-2023) »
  verified_by     text not null,   -- reviewer
  verified_at     date not null,
  primary key (person_id, same_as),
  check (person_id <> same_as)
);
-- One row per pair, whichever side wrote it.
create unique index person_links_pair on public.person_links (least(person_id, same_as), greatest(person_id, same_as));
create index person_links_same_as on public.person_links (same_as);

alter table public.person_links enable row level security;
create policy "public read" on public.person_links for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.person_links from anon, authenticated;
