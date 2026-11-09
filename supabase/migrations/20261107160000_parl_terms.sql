-- Parlement domain (B2): earlier terms (AN XIVth-XVIth legislatures, Sénat mandates since 2011; JM, 7 Nov 2026).
-- A senator can hold the same seat for two consecutive mandates: mandate details are keyed by start date too, and
-- carry the published end cause (« Fin de législature », « Démission »…). Only parl_* tables change; `main` does not
-- read them.

alter table public.parl_mandate_details
  add column start_date date,
  add column end_cause  text;

update public.parl_mandate_details d
   set start_date = m.start_date
  from public.mandates m
 where m.person_id = d.person_id and m.seat_id = d.seat_id and m.end_date is null;

alter table public.parl_mandate_details drop constraint parl_mandate_details_person_id_seat_id_key;
alter table public.parl_mandate_details alter column start_date set not null;
alter table public.parl_mandate_details add constraint parl_mandate_details_person_seat_start_key
  unique (person_id, seat_id, start_date);

notify pgrst, 'reload schema';
