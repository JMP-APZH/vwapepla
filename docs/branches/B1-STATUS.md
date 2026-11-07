# B1 — Status audit (3 Nov 2026)

Branch `b1/sem-demo`, rebased on `origin/dev` (19c1025, same code as `main` fba1afd).
Checked: the code, the live database (Supabase `eiwmksgeudkjsugnvsdh`), the production site (vwapepla.org), CI, and a local
rebuild of the pipeline plus the AFD gate.
Scope references: CLAUDE.md "MVP2 scope" and "Card v2", docs/PLAN.md.

Legend: ✅ done · 🟡 partial · ❌ not started · ⚠️ broken or inconsistent · 📱 mobile status

## 1. Health checks (run today)
| Check | Result |
|---|---|
| `npm run lint`, `npm run typecheck`, `npm test` | ✅ clean; 53 tests in 8 files pass |
| CI (PR Build Check) on the last 6 PRs | ✅ all green |
| Pipeline `scripts/communes/pipeline/build.py` (local, no DB write) | ✅ "all checks passed": 34 communes, 476 commune-years, 59 metrics, 24,496 actuals, 52 entities, 16,636 entity actuals |
| Gate `scripts/communes/reconcile_afd.py` | ✅ ALL OK (AFD 2024 within 1%). One **WARN**: debt 2019 +3.4% against AFD 2021 (395.1 vs 382.0 M€), not explained yet |
| DB coverage | ✅ `com_actuals`: 34/34 communes for every year 2012–2025 |
| Migrations | ✅ all 6 applied, including `core_drop_compat_views`; `main` already used the new names (PR #13 shipped through #14 first). Old views and RPCs are gone; `com_cast_site_vote` and `com_site_vote_summary` exist |
| Production pages | ✅ `/`, `/communes`, `/communes/le-lamentin`, `/communes/comparer`, `/methodologie`, `/sources` → 200; `/sem` → 308 |
| `robots: noindex` | ✅ in place (site not to be indexed before launch) |

## 2. MVP2 scope
| Item | Status | Notes |
|---|---|---|
| Home: map or grid of the 34 communes | 🟡 | `/communes` is a 2–3 column **grid** (name + population). **No map.** The site home (`/`) now links the 4 domains (shared file). |
| Card header: mayor (RNE), population, term 2026–2032, EPCI | ✅ | Source note credits the RNE and the mayor's start date. ⚠️ **Population has no source link** in the header, on the `/communes` grid or on the compare page (principle 1). |
| Income breakdown (local taxes, octroi de mer / other taxes, State grants, fees, borrowing) | ✅ | "D'où vient l'argent du fonctionnement" + "Recettes d'investissement" (borrowing = `emprunts`). Octroi de mer shown as "dont" under other taxes. |
| Spending breakdown (staff, purchases, subsidies, interest, équipement) | ✅ | Two blocks (operating, investment). |
| Key ratios: épargne brute, debt, capacité de désendettement, investment / hab. | ✅ | "Épargne et dette" block + headline. "Non calculable" when épargne brute ≤ 0 (on the card; computed as NULL in the pipeline). |
| Trend 2018 → latest | ✅ | 4 charts (2012–2025, election years shaded) inside "Trois mandats comparés"; year switcher 2018–2025 on the budget blocks. |
| Source note on every block | 🟡 | Every FactBlock and budget block has one; the population figure does not (see above). The headline note lists sources but the 3 sets are mixed in one note. |
| "Bidjé-a an 3 chif" (headline figures) | ⚠️ | **Still 3 candidate sets stacked, with a "draft" note**, on the live card. Most visible issue for the SEM demo. → Step 2. |
| Comparison with the population stratum | 🟡 | Stratum **median** only (Martinique median when < 3 communes in the stratum). No spread band, no national stratum average, no term-on-term change. → Step 3. |
| Compare page (2–4 communes, per inhabitant) | ✅ | Every budget line, Martinique median column, caveat, sources. 📱 table scrolls sideways with sticky labels (fixed in 052d7d9). Column is the **Martinique** median, not the stratum median (differs from the card). |
| Méthodologie page | ✅ | Principles, caveats (2025 provisional, M14→M57, 2026 split year, Rivière-Pilote), sources. Does not yet describe the website audit or visitor votes. |
| Caveat on intercommunal services (CACEM, CAESM, CAP Nord) | ✅ | On the card and compare page. |
| Droit de réponse | ✅ | mailto vwapepla.org@gmail.com on every card. |
| French UI, Kréyòl labels where agreed | 🟡 | Only **1** Kréyòl label (`headlineTitle` "Bidjé-a an 3 chif"); `label_kreyol` empty for all 59 metrics. Waiting for JM's agreed list. |
| `/sem` QR redirect with UTM | ✅ | 308 → `/?utm_source=sem…` |
| PostHog EU, cookieless | ❌ | **Not installed** (no `posthog-js`, no init). The `/sem` UTM is never measured today. Shared files (layout, package.json): separate PR. |
| Per-commune share image (OG) | ❌ | No `opengraph-image`. Useful when listeners share the card. |
| Forecast budgets (BP / ROB 2026) | ❌ | Tables `com_forecast_*` exist, **0 documents**. No YAML and no loader. CLAUDE.md says `data/forecast/<insee>/`; B1 owns `data/communes/**`, so the path should become `data/communes/forecast/<insee>/` (CLAUDE.md change = shared PR). |
| "Investi pour votre population" (EPCI, syndicats, CCAS) | 🟡 | Data loaded (`com_entities` 52, `com_entity_actuals` 16,636), **not shown anywhere** on the card. |
| Playwright smoke test at 375 px, Lighthouse mobile | ❌ | Never written or run (PLAN "Verification"). |

## 3. Card v2
| Item | Status | Notes |
|---|---|---|
| Mayor photo (official, credited, removable) | 🟡 | **19 / 34** portraits; the others show initials. Credit + takedown link in place. |
| Whole council (RNE, no affiliation) | ✅ | Gendered titles; missing deputy ranks listed in "Informations manquantes". |
| Three terms compared (full budget years; 2008–14 partial) | 🟡 | Table + charts work. **0 / 64 past mayors verified**, so every past term shows "maire : en cours de vérification" (JM to check `data/communes/officeholders/history.yaml`). |
| Town-hall website (official directory) | ✅ | Annuaire Service-Public, read 2 Nov 2026; 25 sites, 9 communes with none. Hard-coded in `src/lib/communes/sites.ts`. |
| Website checklist (39 criteria, 5 themes) | 🟡 | Criteria loaded (39). 34 draft audits in `data/communes/audit/sites/*.yaml` (automated first pass). **0 audits loaded / reviewed**, so every card shows "audit en cours". Phone review page + `apply_review.py` ready, waiting for JM's review. |
| Visitor votes on website quality | 🟡 | Built (4 questions, 20-vote threshold, label "non représentatif", server-side writes, honeypot, salted monthly hash = one vote per question per month, rate limit in SQL, Cloudflare Turnstile via the shared helper). **0 votes recorded**: never tested end to end in production (needs `VOTE_SALT_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` on Vercel). Still shows an average: to change to a distribution (CLAUDE.md principle 4, 5 Nov 2026). |
| Missing or doubtful information stated | ✅ | Computed (deputy ranks, missing years, unverified past mayors) + `DATA_NOTES` (Rivière-Pilote debt). |

## 4. Broken or inconsistent
1. ⚠️ **Headline shows 3 draft sets** on production (see above) → Step 2.
2. ⚠️ **Population without a source link** (header, grid, compare).
3. ⚠️ **Median basis differs**: headline shows Martinique and stratum medians; budget blocks show the stratum median (or Martinique); compare shows Martinique. Same word "médiane", three groups → Step 2/3.
4. ⚠️ **Duplicated KPIs**: investment per inhabitant appears in all 3 headline sets, in the budget block and in the terms table; debt, épargne brute and recettes appear 2–3 times → Step 2 inventory.
5. ⚠️ AFD 2021 debt-2019 gap (+3.4%), flagged WARN, not documented on the methodology page.
6. Stale wording: commit 0d8b92e says the migration was "not applied". It is applied, and safely. `docs/branches/README.md` is correct.
7. CLAUDE.md path `data/forecast/` vs B1-owned `data/communes/` (see above).

## 5. Mobile (📱)
There is **no automated mobile test**. What was done by hand (commits 2db351d, 315a39e, 052d7d9, 697ac32): app name on one line,
charts cannot widen the page, sticky labels in the terms and compare tables, year buttons wrap (40 px targets), nav wraps.
**Not checked on a phone since the move to `/communes` and the card shell (3 Nov):**
- Headline: 3 sets × 3 tiles at `grid-cols-3`, with two lines of small median text each (11 px). Dense at 375 px.
- Budget blocks: 5 blocks × ~6 lines with 11 px secondary text. Long scroll before the council and terms sections.
- Vote form (4 × 5 buttons, 40 px) and checklist: never seen with real data on a phone.
- Compare page with 4 communes: horizontal scroll, works but needs a check.
Proposal: a Playwright smoke test at 375 px (home → card → compare → méthodologie, "every figure has a source note"),
plus a phone check by JM before the demo.

## 6. Shared-file changes B1 will need (each as its own small PR to `dev`, never in a B1 branch)
| Change | Shared file(s) | For |
|---|---|---|
| PostHog EU cookieless + `/sem` UTM view | `src/app/layout.tsx`, `package.json`/lockfile, `src/lib/core/` | SEM demo (measure the radio impact) |
| Kréyòl labels for common words, once JM agrees them | `messages/gcf/common.json` | MVP2 |
| Forecast path `data/forecast/` → `data/communes/forecast/` | `CLAUDE.md` | Forecast layer |
| Amendment allowing criteria votes (Step 5, draft only) | `CLAUDE.md` | Step 5, after JM's written decision |
| Méthodologie: website audit, visitor votes, comparison groups, national strata (Step 3) | `src/app/methodologie/` | Steps 3–5 |
| Maybe: `SourceNote` support for a single inline figure (population in the header) | `src/components/card/**` | Principle 1. A B1-only fix also works: a note in the header `note` prop. |

## 7. Suggested order for the SEM demo
1. Step 2: one headline trio, no duplicated KPIs (removes the "draft" look).
2. Population source note (B1-only fix).
3. Phone check + Playwright smoke test at 375 px.
4. PostHog (shared PR) so the `/sem` QR code is measured.
5. Step 3 comparisons; JM's review of the website audits and past mayors (data already in place, waiting for review).
