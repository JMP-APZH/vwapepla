# Parallel work — what was made generic (foundation, 3 Nov 2026)

Four teams, four worktrees: **B1** communes · **B2** parlementaires · **B3** CTM · **B4** Préfet.
Rules (ownership, shared files, rebase, ports): CLAUDE.md, "Parallel work". Scope of each team: `B1.md` … `B4.md`.

## Audit: mayor-specific before, generic now
| Before | Problem | Now |
|---|---|---|
| `officeholders` (commune_code NOT NULL, role maire/adjoint/conseiller) | Could not hold a deputy, senator, CTM member or préfet | Core `institutions` → `bodies` → `seats` ← `mandates` → `persons`; view `com_v_officeholders` for the commune card |
| `terms` (municipal terms + budget years) | Municipal only | Core `terms` + `body_kind`; `first/last_full_year` = budget years (communes) |
| `media` (commune_code, mayor_portrait) | A photo belongs to a person or an institution | Core `media` + `institution_id`, `person_id` |
| `sources` | Already generic | Core + `domain` |
| `communes`, `commune_years`, `metric_definitions`, `actuals`, `entities`, `entity_actuals`, `forecast_*`, `audit_criteria`, `site_audits`, `site_audit_items`, `site_votes`, `v_stratum_median`, `v_martinique_totals` | Commune domain, unprefixed | `com_*` |
| RPCs `cast_site_vote`, `site_vote_summary` | Commune domain | `com_cast_site_vote`, `com_site_vote_summary` |
| `src/i18n/strings.ts` | One file for everyone | `messages/{fr,gcf}/{common,communes,parlement,ctm,prefet}.json` + `src/i18n` |
| `src/app/commune/[slug]`, `src/app/comparer`, home = commune grid | Mixed with shared routes | `src/app/communes/{page,[slug],comparer}` (308 from the old URLs); home links the 4 domains |
| Flat `src/components`, `src/lib` | No ownership | `src/components/card` (shared shell), `src/components/communes`, `src/lib/core`, `src/lib/communes` |
| `scripts/download_sources.py` + one manifest | Shared source list | `scripts/core/download_sources.py --domain X`, lists in `scripts/<domain>/sources.py`, `data/raw/<domain>/manifest.json` |
| `scripts/pipeline/load_supabase.py` (one TABLES dict) | Shared dict | `scripts/core/load_supabase.py --domain X`, tables in `scripts/<domain>/tables.py` (prefix checked) |
| `scripts/pipeline`, `scripts/audit`, `reconcile_afd.py`, `explore_*` | Commune only | `scripts/communes/…` |
| `data/audit`, `data/media`, `data/officeholders` | Commune only | `data/communes/…` |

## Removing the compatibility layer (two steps)
1. Code (PR "drop compat views"): votes call `com_cast_site_vote`; `build_media.py` no longer writes `media.commune_code`.
   Released to `main` before step 2.
2. Migration `20261103160000_core_drop_compat_views.sql`, applied after that release: drops the views with the old names
   (`communes`, `actuals`, `officeholders`…), the old RPC names (`cast_site_vote`, `site_vote_summary`) and
   `media.commune_code` (`institution_id` becomes NOT NULL). No CASCADE: it fails safely if anything still depends on them.
