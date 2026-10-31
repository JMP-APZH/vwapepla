# Plan — vwapepla.org MVP2 (mayors' budget cards)

## Context
The data exploration step is done and validated by JM. We have 35 sources for Martinique in `data/raw/`, all fetched by `scripts/download_sources.py` with a manifest. The OFGL consolidated figures reconcile with the AFD Observatoire 2024 to within 1%, and octroi de mer comes from the DGFiP balances (€244.0M in 2023, matching AFD).

Decisions JM has taken:
- **Data:** OFGL *consolidated* figures; capture every source; reference year 2024; 2025 shown as provisional.
- **Forecast layer:** a manual "forecast budgets" layer from the communes' own documents, kept separate from OFGL data.
- **Stack and tools:** Next.js App Router; a **public** GitHub repo; forecast figures as **files in the repo**, imported by a script; PostHog EU in cookieless mode.

Goal: a mobile-first site with 34 sourced commune cards, a compare page and a methodology page, deployed on Vercel EU and ready to demo to SEM radio.

## Connectors / tooling status
| Need | Status | How we'll use it |
|---|---|---|
| GitHub | ✅ `gh` CLI logged in as **JMP-APZH** (scopes: repo, workflow) | Create `JMP-APZH/vwapepla` (public), push, open PRs, set Actions secrets |
| Supabase | ✅ claude.ai Supabase connector, org "JMP-APZH's Org" | Create a new project **vwapepla** in an EU region, apply migrations, run SQL checks, get keys. On the free plan this is the 2nd *active* project (mvp1-supabase is the other). Cost will be confirmed before creating it. |
| Vercel | ❌ no connector and no CLI here | JM imports the GitHub repo in the Vercel dashboard (same as prix-martinique: Git integration plus `vercel.json`), sets env vars, adds the vwapepla.org domain. Optional alternative: `! npx vercel login` to let me use the CLI. |
| PostHog | ✅ PostHog plugin available | Create or choose a project for vwapepla (EU). Cookieless mode. |

Reused from prix-martinique (`MVP1/`): `.github/workflows/pr-build-check.yml` (lint + build on PRs, staging secrets), `keep-supabase-alive.yml` (keeps the free tier from pausing), `vercel.json` with security headers and CSP, a `main` + `dev` branch flow, and PostHog EU.

## Phase 0 — Commit and publish the repo
1. Rename branch `master` → `main`. Commit the current work in small commits: `.gitignore`, `CLAUDE.md` + `docs/`, `scripts/` (download, explore, reconcile).
2. `gh repo create JMP-APZH/vwapepla --public`, push `main`, create `dev`.
3. Update CLAUDE.md: confirmed stack, Martinique = DGFiP `ndept` 103 (972 before 2016), the data inventory, and the corrected mapping (*Fiscalité reversée* is inside *Impôts locaux*).

## Phase 1 — Data model and import into Supabase
**Migrations** (`supabase/migrations/*.sql`, applied through the connector). Row-level security is on for every table; the public role can only read; writes go through the service role in scripts only.
- `sources`: dataset id, title, url, dataset page, licence, credit, retrieved date, sha256. Loaded from `data/raw/manifest.json`.
- `communes`: insee code, slug, name, EPCI, population stratum, map shape. `commune_population` by year.
- `officeholders`: mayor name, term start/end, source_id. From RNE, a new source added to `download_sources.py`.
- `metric_definitions`: key, block (income / spending / ratio / context), label_fr, label_kreyol, OFGL aggregate or formula, display order. **This is the validated mapping table, stored as data.**
- `actuals`: commune, year, metric_key, amount, eur_per_hab, provisional (true for 2025), source_id. Long format; unique key (commune, year, metric).
- `epci_actuals`, `syndicate_actuals`, `ccas_actuals`: same shape, for "investi pour votre population".
- **Forecast layer (separate tables, never mixed with actuals):** `forecast_documents` (commune, fiscal year, type BP/BS/DM/DOB/ROB, adoption date, original url, archived Storage path, sha256, captured_by, captured_at) and `forecast_figures` (document_id, metric_key, amount, page, note).
- Views: `v_commune_card` (one row per commune and year, with derived ratios) and `v_stratum_median`.

**Import** (`scripts/import/` in Python, re-runnable, idempotent, upserts on natural keys):
- `build_actuals.py`: OFGL consolidated + DGFiP octroi de mer (M14 7373 / M57 73431). Derived figures:
  - Capacité de désendettement = debt / épargne brute, set to NULL when épargne brute ≤ 0.
  - Per-inhabitant values from `ptot`.
- `build_context.py`: EPCI, syndicates and CCAS figures. The EPCI share per commune is pro rata by population and **labelled "estimation"**; the method goes on the methodology page.
- `load_supabase.py`: pushes the tables using `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`, which is never committed.
- `reconcile_afd.py` (exists) becomes a **gate**: it exits non-zero if any indicator is more than 2% off. Add the octroi de mer line.

## Phase 2 — Forecast budgets layer (manual, sourced)
- Format: `data/forecast/<insee>/<year>-<type>.yaml`, holding document metadata plus a list of `{metric_key, amount, page}`, using the same metric keys as actuals. A JSON Schema checks it (`scripts/import/forecast.schema.json`).
- `scripts/import/load_forecast.py` validates every file: schema, metric keys known, url present, PDF archived and sha256 matching. It uploads the PDFs to the public Storage bucket `forecast-docs` (archived because campaign and council documents disappear from the web) and upserts the rows.
- **Pilot:** I search the communes' websites and council minutes for 2026 budgets primitifs / ROB 2026 for 3–4 communes (e.g. Fort-de-France, Le Lamentin, Schœlcher, Le Robert). I draft the YAML; **JM checks each figure against the PDF page before merge** (PR review). A coverage report lists which of the 34 have a 2026 budget captured.
- UI rule: forecast figures always show a **"Prévisionnel — voté le …"** badge, a different visual style, and their own source line. They are never added to or charted on the same series as actual results.

## Phase 3 — App scaffold
- `npx create-next-app` (current stable Next.js, App Router, TypeScript, Tailwind, ESLint) in `app/` at the repo root, plus shadcn/ui and Recharts.
- `src/i18n/strings.ts`: all French and Kréyòl labels in one file. Kréyòl labels go in only where JM has agreed them; the rest are left as TODOs.
- `src/lib/data.ts`: typed reads from Supabase (anon key) at **build time / ISR**. The 34 pages are pre-rendered, so a radio-driven traffic spike hits the CDN, not the database.
- `src/lib/format.ts`: euro and per-inhabitant formatting (fr-FR); "non calculable" when there is no value.

## Phase 4 — Pages (mobile-first)
- `/`: 34 communes as an SVG map of Martinique (OFGL `communes_formes_geo_svg` or IGN), with a searchable grid fallback.
- `/commune/[slug]`: the "player card".
  - **Header:** mayor (RNE), term 2026–2032, population, intercommunality.
  - **"Bidjé-a an 3 chif" strip:** three headline figures, chosen with JM.
  - **Income and spending:** each shown per inhabitant and in total, for 2024, with a year switcher; 2025 carries a "provisoire" badge.
  - **Ratios:** épargne brute, épargne nette, debt, capacité de désendettement, investment per inhabitant.
  - **Investment block:** "Investi pour votre population" = commune + estimated EPCI share + CCAS.
  - **Trend chart:** 2018 → 2025.
  - **Comparisons:** median of the same population stratum, shown side by side, with no ranking.
  - **Forecast section:** budget 2026, if captured.
  - **On every block:** a source footnote (dataset, year, retrieval date, link), plus the intercommunality caveat and the "Droit de réponse" mailto.
- `/comparer?c=97209,97213`: 2–4 communes side by side, per inhabitant.
- `/methodologie`: charter, definitions taken from `metric_definitions`, caveats (intercommunality, the M14→M57 change in 2023–24, 2026 split year, Rivière-Pilote zero debt), the EPCI pro-rata method, forecast vs actual results.
- `/sources`: generated from the `sources` table / manifest.
- `/sem`: redirect to `/` with UTM tags, for the QR code. Also a per-commune Open Graph share image (`opengraph-image.tsx`).

## Phase 5 — CI and deploy
- GitHub Actions, adapted from MVP1:
  - `pr-build-check.yml`: lint, typecheck, `vitest`, build.
  - `data-check.yml`: reconciliation gate plus forecast YAML validation, run on PRs that touch `data/forecast/` or `scripts/`.
  - `keep-supabase-alive.yml`.
- `vercel.json`: security headers and CSP adapted from MVP1, region `cdg1` (Paris). Vercel environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`.
- **JM:** import the repo in Vercel and point vwapepla.org DNS at it. Preview deploy for every PR to `dev`, production from `main`.
- PostHog EU: `persistence: 'memory'`, no cookies, autocapture limited to page views, plus a `sem` UTM view.

## Verification
- `python -I scripts/reconcile_afd.py …` → every indicator within 2% of AFD, 34/34 coverage. SQL check through the connector: `select year, count(distinct commune) from actuals` shows 34 for each year 2018–2025.
- Unit tests (vitest): per-inhabitant calculation; capacité de désendettement NULL when épargne brute ≤ 0; forecast never merged into the actuals series.
- Spot-check 3 communes in the UI against data.ofgl.fr and the DGFiP balance (e.g. Fort-de-France 2024 debt, Le Marin équipement).
- Playwright smoke test at 375 px width: home → commune → compare → methodology, with no unsourced figure (every figure has a source link next to it).
- Lighthouse on mobile for a commune page; check the Vercel preview URL before promoting to production.

## Order and checkpoints with JM
Phase 0 → 1 (**JM validates the `metric_definitions` labels and the 3 headline figures**) → 2 (**JM reviews the pilot forecast figures**) → 3–4 (**design review of one card on a phone before building all pages**) → 5 (**JM sets up Vercel and DNS**).
