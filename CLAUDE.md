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
3. **Fair comparisons.** Always show per-inhabitant values, allow comparison within population strata, and display a caveat that some services (waste, water, transport) are handled by the intercommunal bodies (CACEM, CAESM, CAP Nord), which affects comparability.
4. **Facts ≠ opinions.** Facts layer (team-managed, sourced) is strictly separated from any future citizen-comment layer. MVP2 has no comments.
5. **Right of reply.** Each card has a visible "Droit de réponse" contact path for the officeholder (MVP2: mailto/form, no workflow).
6. **Reproducibility.** Data import is a script, re-runnable, idempotent, versioned. Never hand-edit figures in the database.

## Stack (proposed — confirm with JM before scaffolding)
Same as VoxPop: Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres) · Vercel (EU region).
Charts: Recharts. Data import: TypeScript or Python script in `scripts/`.

## Data sources (MVP2)
- **Primary:** OFGL "Comptes des communes" — https://www.data.gouv.fr/datasets/comptes-des-communes-2018-2025 (origin: data.ofgl.fr). Licence Ouverte 2.0 → credit "Source : OFGL, d'après DGFiP".
  Filter Martinique: département code 972 (INSEE commune codes 97201–97234).
  Reference year: latest complete year (2024; 2025 is incomplete until DGFiP final balances ~end of December).
- **Detail (later):** DGFiP "Balances comptables des communes" (account-level).
- **Benchmark / reconciliation:** AFD "Observatoire des communes de Martinique" (5th edition, FY2023, same OFGL base). Use it to sanity-check totals (e.g., communes' debt ≈ €330M end-2023; communes' capital spending ≈ €119M in 2023).
- **Officeholders:** RNE — Répertoire national des élus (data.gouv.fr) for current mayors' names and term start.

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

## Working rules for Claude Code
- Start in plan mode for any new feature; propose the plan, wait for approval.
- Before mapping OFGL columns, download the file, list actual column names/aggregate labels, and show JM the mapping table to validate.
- Write a reconciliation check (script output) comparing our Martinique totals with the AFD Observatoire figures; report differences.
- Keep French/Kréyòl strings in a single i18n file.
- Commit small, descriptive commits. Do not commit secrets (.env.local).
