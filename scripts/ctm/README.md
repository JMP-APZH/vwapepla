# scripts/ctm — B3 · Collectivité Territoriale de Martinique (Assemblée, Conseil exécutif)

Owned by B3 (see `docs/branches/B3.md` and CLAUDE.md, "Parallel work").

- `sources.py`: the open-data sources of this domain (`JOBS`), fetched by
  `python -I scripts/core/download_sources.py --domain ctm` into `data/raw/ctm/` with its own `manifest.json`.
- Build scripts write `data/build/ctm/<table>.json` (core people tables for this domain's rows + `ctm_*` tables).
- `tables.py`: load order and upsert keys for `python -I scripts/core/load_supabase.py --domain ctm`.
