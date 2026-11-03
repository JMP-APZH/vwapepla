-- Website audit: how each item was established (automated first pass vs checked by hand),
-- shown next to the item so visitors know what was verified by a person.
alter table public.site_audit_items
  add column method text not null default 'manual' check (method in ('automated', 'manual'));
