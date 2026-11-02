-- Officeholder sex (RNE "Code sexe", used only to write "1re adjointe" / "1er adjoint" correctly)
-- and audit-criteria themes (what each criterion helps citizens do).
alter table public.officeholders
  add column sex text check (sex in ('F', 'M'));

alter table public.audit_criteria
  add column theme text not null default 'site'
    check (theme in ('site', 'argent_public', 'information', 'suivi_usagers', 'participation'));
alter table public.audit_criteria alter column theme drop default;
