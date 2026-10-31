# First prompt to paste in Claude Code

Read CLAUDE.md and docs/BRIEF.md. We are starting MVP2 of vwapepla.org (mayors' budget cards for the 34 communes of Martinique, demo for SEM radio).

Step 1 — Data exploration only, no app code yet:
1. Download the OFGL "Comptes des communes" dataset (data.gouv.fr link in CLAUDE.md), keep raw files in data/raw/ (gitignored).
2. Filter Martinique (département 972) and confirm all 34 communes are present for each year 2018–2024; report gaps.
3. List the available aggregates and propose a mapping table: our card labels (income / spending / ratios) → OFGL aggregate names.
4. Compute Martinique totals for 2023 (communes' debt outstanding, capital spending, gross savings) and compare with the AFD Observatoire 2024 edition figures; report differences and likely reasons.

Then stop and show me: the mapping table, the coverage check, and the reconciliation. After my validation we will plan the app (stack in CLAUDE.md) in plan mode.
