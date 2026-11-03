# scripts/prefet — B4 · Préfet de Martinique (nommé)

Owned by B4 (see `docs/branches/B4.md`, `docs/branches/B4-DISCOVERY.md` and CLAUDE.md, "Parallel work").

## Pipeline
```
python -I scripts/core/download_sources.py --domain prefet   # data/raw/prefet/ + manifest.json
python -I scripts/prefet/build.py                             # data/build/prefet/<table>.json, checks (exit 1 on failure)
python -I scripts/core/load_supabase.py --domain prefet       # upsert (secret key in .env.local)
```
- `sources.py`: the jobs (`JOBS`). Every job writes a CSV filtered on Martinique:
  - `ssmsi-*`: recorded crime (SSMSI), commune / département / région;
  - `dgcl-dotations-investissement-<year>`: State investment grants (DETR, DSIL, DSID, DPV), 2018 →;
  - `dpt-outre-mer-<edition>`: the « MARTINIQUE » table of the DPT Outre-mer (Assemblée nationale copies; budget.gouv.fr
    blocks scripted access), extracted with `pypdf` (layout mode);
  - `jorf-nominations-972`, `jorf-parcours`: appointment decrees (Légifrance API), **only when the PISTE keys are set**.
- `build.py` (+ `grants.py`, `dpt.py`): normalised tables; gate on the DPT sums; grants mapped to a beneficiary key with
  a visible note when the key had to be deduced.
- `tables.py`: load order and upsert keys.
- `legifrance.py`: Légifrance API client (standard library).

Python packages used: `pypdf` (DPT extraction), `PyYAML` (later: overrides).

## Légifrance API (PISTE) — one-time setup
The appointment decrees of préfets, secrétaires généraux, directeurs de cabinet and sous-préfets (and their career
path) are fetched from the Journal officiel through the official Légifrance API, so the list is reproducible and new
appointments are picked up on the next run.

1. Create an account on **https://piste.gouv.fr** (free).
2. In *Mon compte* → *Consentement CGU API*, accept the terms of the **Légifrance** API.
3. *Applications* → *Créer une application* (production, not sandbox). Then edit the application and **subscribe it to
   the Légifrance API**.
4. Copy the application's **OAuth client ID** and **client secret** into `.env.local` (never in `.env`, never committed):
   ```
   PISTE_CLIENT_ID=...
   PISTE_CLIENT_SECRET=...
   ```
5. Run `python -I scripts/core/download_sources.py --domain prefet --only jorf-nominations-972 jorf-parcours`.

Troubleshooting: `invalid_client` = sandbox keys used against production (or a typo); HTTP 403 = the application is
not subscribed to the Légifrance API. The client waits 0.3 s between calls and retries on 429/5xx.
Endpoints: token `https://oauth.piste.gouv.fr/api/oauth/token` (client credentials); API
`https://api.piste.gouv.fr/dila/legifrance/lf-engine-app` (`/search` on fond JORF, `/consult/jorf`).
Licence of the texts: Licence Ouverte 2.0; credit « Journal officiel de la République française (Légifrance, DILA) ».
