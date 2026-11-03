# scripts/parlement — B2 · Députés et sénateurs de Martinique

Owned by B2 (see `docs/branches/B2.md` and CLAUDE.md, "Parallel work").

- `sources.py`: the open-data sources of this domain (`JOBS`), fetched by
  `python -I scripts/core/download_sources.py --domain parlement` into `data/raw/parlement/` with its own `manifest.json`.
- Build scripts write `data/build/parlement/<table>.json` (core people tables for this domain's rows + `parl_*` tables).
- `tables.py`: load order and upsert keys for `python -I scripts/core/load_supabase.py --domain parlement`.
