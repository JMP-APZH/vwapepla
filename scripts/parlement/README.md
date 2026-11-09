# scripts/parlement — B2 · Députés et sénateurs de Martinique

Owned by B2 (see `docs/branches/B2.md`, `docs/branches/B2-DISCOVERY.md` and CLAUDE.md, "Parallel work").

## Pipeline
```
python -I scripts/core/download_sources.py --domain parlement --only <job>   # one job at a time, amendments last
python -I scripts/parlement/build.py                                          # data/build/parlement/<table>.json + checks
python -I scripts/core/media.py --domain parlement [--upload]                  # official portraits (data/parlement/media/portraits.yaml)
python -I scripts/core/load_supabase.py --domain parlement                    # upsert (secret key in .env.local)
python -I scripts/parlement/prune.py [--dry-run]                              # delete B2's own rows the build no longer has
python -I scripts/parlement/weekly.py [--dry-run]                             # all of the above, weekly (Q10)
```
- `weekly.py`: current-term jobs every run; closed-legislature archives only when missing from the manifest; amendments
  last; then build (its checks stop the run), load, prune. Exit 1 if a current-term download failed (previous file used);
  a missing archive is only reported (stated data gap).
- `prune.py`: the loader only upserts, so rows that disappear from the build (e.g. a renamed data gap) stay online.
  Deletes them from the `parl_*` tables only, children first; stops without deleting anything if a table would lose
  more than 5 % of its rows (10 rows always allowed).
- `sources.py`: the jobs (`JOBS`). National files are streamed and filtered on Martinique's members:
  - AN JSON zips of the XVIIth legislature and the archives of the XIVth-XVIth (`an-<dataset>-<legislature>`;
    `_an_records` reads one-file-per-record zips, a single small JSON file, or, for the XIVth amendments and written
    questions, the XML twin with a streaming parser); AMO30 (every Martinique deputy since 1997);
  - Sénat CSVs and PostgreSQL dumps (Questions, Ameli, Dosleg: only the `COPY` blocks needed; Windows-1252 typography
    stored as C1 characters is decoded by `_pg_decode`); Dosleg gives every public vote since 2006-2007 and the
    nominative positions of Martinique's senators (`senat-scrutins`, `senat-votes-972`);
  - AN committee meetings (`an-reunions-17`, no names: only whether an attendance list is published);
  - HATVP list and declarations (whitelisted fields: the member's own sections only; never address, birth date,
    contact details, spouse or assistants), RNE and the 2024 candidacies (suppléants).
  The AN archive server ends long transfers early: `_get` falls back to `_patient_fetch` (HTTP Range, growing pauses;
  when its CDN serves no range, a full download from byte 0, kept only if it gets further). A job that still fails
  (XVth amendments, 7 Nov 2026) has no manifest entry: `build.py` skips it and writes a « pas encore chargés » gap.
  The big zips (AN amendments 100-650 MB, Sénat dumps) are best run alone (`--only`).
- `build.py`: core rows of the two chambers (`institutions`, `bodies` one per AN legislature, `seats`, `persons`,
  `mandates`) and the `parl_*` tables: deputies of the XIVth-XVIIth legislatures, senators whose mandate ran on or after
  the October 2011 renewal; activity kept only inside a mandate of the person. Exit 1 if: row counts differ from the
  manifest; not exactly 4 sitting deputies (circonscriptions 1-4) and 2 senators matching the RNE; two deputies on one
  seat at the same date; a row points to an unknown person, scrutin or organe. Writes `parl_data_gaps`: what the
  official data does not give (absent or partial), measured on the files and dated, shown on the cards.
- `votes.py`: the published vote rule V1 (`selected_by` on every scrutin, AN and Sénat), also on `/parlementaires/methode`.
- `tables.py`: load order and upsert keys (migrations `supabase/migrations/20261107120000_parl_init.sql`,
  `20261107160000_parl_terms.sql`).
