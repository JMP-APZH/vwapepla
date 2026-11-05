# scripts/parlement — B2 · Députés et sénateurs de Martinique

Owned by B2 (see `docs/branches/B2.md`, `docs/branches/B2-DISCOVERY.md` and CLAUDE.md, "Parallel work").

## Pipeline
```
python -I scripts/core/download_sources.py --domain parlement --only <job>   # one job at a time, amendments last
python -I scripts/parlement/build.py                                          # data/build/parlement/<table>.json + checks
python -I scripts/core/media.py --domain parlement [--upload]                  # official portraits (data/parlement/media/portraits.yaml)
python -I scripts/core/load_supabase.py --domain parlement                    # upsert (secret key in .env.local)
```
- `sources.py`: the jobs (`JOBS`). National files are streamed and filtered on Martinique's members: AN JSON zips
  (AMO30, scrutins, amendements, questions, dossiers), Sénat CSVs and PostgreSQL dumps (Questions, Ameli: only the
  `COPY` blocks needed), HATVP list and declarations (whitelisted fields: the member's own sections only; never address,
  birth date, contact details, spouse or assistants), RNE and the 2024 candidacies (suppléants). The big zips (AN
  amendments 352 MB, Sénat dumps) are best run alone (`--only`).
- `build.py`: core rows of the two chambers (`institutions`, `bodies`, `seats`, `persons`, `mandates`) and the `parl_*`
  tables, current terms only. Exit 1 if: row counts differ from the manifest; not exactly 4 sitting deputies
  (circonscriptions 1–4) and 2 senators matching the RNE; a row points to an unknown person, scrutin or organe.
- `votes.py`: the published vote rule V1 (`selected_by` on every scrutin), also shown on `/parlementaires/methode`.
- `tables.py`: load order and upsert keys (migration `supabase/migrations/20261105170000_parl_init.sql`).
