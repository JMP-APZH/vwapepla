# CLAUDE.md — vwapepla.org

## What this project is
Vwapepla ("vwa pèp la" = the people's voice, in Kréyòl) is a civic transparency web app for Martinique.
It shows **sourced track-record cards** ("player cards", video-game style) of officeholders by term:
mayors (34 communes), CTM (Collectivité Territoriale de Martinique), deputies, senators, and the Préfet.

Current milestone: **MVP2 = mayors' budget cards** for the 34 communes, built from official open data,
to demo to **SEM radio** (partner for a show on mayors' budgets). Full context: `docs/BRIEF.md`.

Sister projects of the same author: prix-martinique.org (cost of living, live) and VoxPop (participatory democracy).

## Non-negotiable principles
1. **Every number has a source.** Each figure displayed links to its dataset, year, and retrieval date. No unsourced figure ever reaches the UI.
2. **Neutrality.** No global score, no ranking "best/worst mayor" in MVP2. Show statistics side by side.
   *Amendment (JM, 31 Oct 2026):* the town-hall **website audit** (facts: dated legal/quality checklist with evidence,
   criteria in `data/audit/criteria.yaml`) and anonymous **visitor votes on website quality** are allowed. Never a score
   of a mayor's budget; no league table without a further decision.
3. **Fair comparisons.** Always show per-inhabitant values, allow comparison within population strata, and display a caveat that some services (waste, water, transport) are handled by the intercommunal bodies (CACEM, CAESM, CAP Nord), which affects comparability.
4. **Facts ≠ opinions.** Facts layer (team-managed, sourced) is strictly separated from any future citizen-comment layer. MVP2 has no comments.
   Visitor votes (website quality only) are an opinion layer: separate block and table, shown only from 20 votes,
   labelled "avis des visiteurs, non représentatif"; written only server-side (secret key), never by the browser.
5. **Right of reply.** Each card has a visible "Droit de réponse" contact path for the officeholder (MVP2: mailto/form, no workflow).
6. **Reproducibility.** Data import is a script, re-runnable, idempotent, versioned. Never hand-edit figures in the database.

## Stack (confirmed by JM, 31 Oct 2026)
Next.js (current stable, App Router) · TypeScript · Tailwind CSS · shadcn/ui · Recharts · Supabase (Postgres, EU) · Vercel (EU, `cdg1`).
Commune pages pre-rendered (SSG/ISR) from Supabase. Data import: Python scripts in `scripts/` (run with `python -I`).
Analytics: PostHog EU, cookieless (`persistence: 'memory'`). Repo: public, `JMP-APZH/vwapepla`, branches `main` (prod) + `dev`.
Plan: `docs/PLAN.md`. Next.js 16 differs from older versions: read `AGENTS.md` and the bundled docs in
`node_modules/next/dist/docs/` before writing app code (Cache Components: `'use cache'` + `cacheLife` in `src/lib/data.ts`).
Data pipeline: `download_sources.py` → `pipeline/build.py` → `reconcile_afd.py` (gate) → `pipeline/load_supabase.py`.
`.env` holds public values only (committed); the Supabase secret key lives in `.env.local` only.

## Data sources (MVP2)
All sources are fetched by `python -I scripts/download_sources.py` into `data/raw/` (gitignored) with `data/raw/manifest.json`
(url, licence, retrieval date, sha256). Never download by hand.
- **Primary:** OFGL **"Comptes consolidés des communes"** (`ofgl-base-communes-consolidee`: main + annex budgets, cross flows
  neutralised; this is what AFD uses). Per-budget detail: `ofgl-base-communes`. Licence Ouverte 2.0 → credit "Source : OFGL, d'après DGFiP".
  Filter: `dep_code` 972 (INSEE 97201–97234). Coverage verified: 34/34 communes every year 2018–2025.
  Reference year **2024**; **2025 shown as provisional** (final DGFiP balances ~end of December).
- **Account detail:** DGFiP "Balances comptables des communes" 2012–2025 (data.economie.gouv.fr). Martinique is `ndept` **103**
  from 2016 (972 before) → filter on `siren` starting `21972` instead. Octroi de mer = net credit on M14 **7373** / M57 **73431**.
- **Context ("invested for your population"):** EPCI CACEM / CAESM / CAP Nord (`ofgl-base-gfp-consolidee`, `ofgl-base-ei`),
  syndicats, CCAS, EPL, commune↔EPCI flows. Also: dotations (incl. 2026), local tax bases/rates (REI), populations, OFGL aggregate formulas.
- **Benchmark / reconciliation:** AFD "Observatoire des communes de Martinique" 2024 (FY2023). `scripts/reconcile_afd.py` matches
  within 1% (debt €330.0M, investment excl. repayments €119.2M, équipement €111.9M, épargne brute €56.0M, octroi de mer €244.0M).
- **Officeholders:** RNE — Répertoire national des élus (data.gouv.fr) for current mayors' names and term start.
- **Forecast budgets (separate layer):** budgets primitifs / DOB / ROB from the communes' own documents, entered as YAML in
  `data/forecast/<insee>/<year>-<type>.yaml` (figure + source URL + page), PDFs archived in Supabase Storage. Always labelled
  "Prévisionnel"; never mixed with or charted on the same series as actuals (OFGL).

### Mapping notes (validated)
- `Recettes de fonctionnement` = Impôts et taxes + Concours de l'Etat + Subventions reçues + Ventes de biens et services + Autres recettes.
- `Impôts et taxes` = `Impôts locaux` + `Autres impôts et taxes`. **`Fiscalité reversée` is a subset of `Impôts locaux`** (OFGL formula, CN732).
- `Concours de l'Etat` = DGF + Autres dotations de fonctionnement + Péréquations et compensations fiscales.
- AFD's "119 M€ investment" = `Dépenses d'investissement hors remb` (not `Dépenses d'équipement`).
- Capacité de désendettement = Encours / Epargne brute; not computable when épargne brute ≤ 0.
- Caveats to display: M14→M57 switch 2023–2024; 2026 split year (outgoing/incoming mayor); Rivière-Pilote shows zero debt 2018–2025 (to verify).

## MVP2 scope
- Home: map or grid of the 34 communes → click → commune card.
- Commune card: mayor (from RNE), population, term (2026–2032), and budget view:
  - **Income** breakdown: local taxes, octroi de mer / other taxes, State grants (DGF etc.), service fees, borrowing.
  - **Spending** breakdown: staff costs, purchases & external charges, subsidies, interest, capital spending (équipement).
  - Key ratios: gross savings (épargne brute), debt outstanding, debt repayment capacity (years), investment per inhabitant.
  - Trend 2018 → latest year.
  - Source footnote on every block.
- Compare page: pick 2–4 communes, side-by-side income vs spending, per inhabitant.
- Méthodologie page (methodology charter, caveats, sources).
- UI in French; key labels also in Kréyòl where agreed. Mobile-first (radio audience is on phones).
- Out of scope for MVP2: user accounts, comments, promise tracking, deputies/senators/CTM/Préfet.
- Card v2 (approved 31 Oct 2026): mayor photo (official, credited, removable), whole council (RNE, no affiliation),
  three terms compared (full budget years only; 2008–14 partial), town-hall website checklist + visitor votes.
  Checklist themes (JM): basic site, follow/challenge public money, information on the commune and work done,
  status updates for residents, participative democracy. Missing or doubtful information is always stated on the card.
  Photos are reused from town-hall sites with credit + takedown (JM's decision; check in the pre-launch legal review).

## Working rules for Claude Code
- Start in plan mode for any new feature; propose the plan, wait for approval.
- Before mapping OFGL columns, download the file, list actual column names/aggregate labels, and show JM the mapping table to validate.
- Write a reconciliation check (script output) comparing our Martinique totals with the AFD Observatoire figures; report differences.
- Keep French/Kréyòl strings in a single i18n file.
- Commit small, descriptive commits. Do not commit secrets (.env.local).
