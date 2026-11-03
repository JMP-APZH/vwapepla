# scripts/prefet — B4 · Préfet de Martinique (nommé)

Owned by B4 (see `docs/branches/B4.md` and CLAUDE.md, "Parallel work").

- `sources.py`: the open-data sources of this domain (`JOBS`), fetched by
  `python -I scripts/core/download_sources.py --domain prefet` into `data/raw/prefet/` with its own `manifest.json`.
- Build scripts write `data/build/prefet/<table>.json` (core people tables for this domain's rows + `pref_*` tables).
- `tables.py`: load order and upsert keys for `python -I scripts/core/load_supabase.py --domain prefet`.
