# B1 — Status (10 Nov 2026)

Branch `b1/next` from `origin/dev` 754f10d (`main` = `dev` since release #80, 10 Nov 2026).
Checked today: the code, the live database (Supabase `eiwmksgeudkjsugnvsdh`, read-only queries), `npm run lint` and
`npm run typecheck` (clean). Not run today (memory limits on the machine): `npm test`, `next build`, the pipeline.
Previous audit (3 Nov 2026) replaced by this file. Design and decisions per step: `B1-KPI.md` (step 2),
`B1-COMPARISONS.md` (step 3), `B1-CHANNELS.md` (step 4), `B1-VOTES.md` (step 5).

Legend: ✅ live in production · 🟡 built, waiting for data or review · ❌ not started · ⚠️ to fix

## 1. Released
| Release | Date | B1 content |
|---|---|---|
| #38 | 7 Nov | Hero trio and one place per KPI (#20), comparisons (#21), past mayors from official sources (#17) |
| #71 | 9 Nov | Channels block (#32), Turnstile and one vote per month on website votes (#46), votes on the commune's action (#51), website votes as a distribution (#59) |
| #80 | 10 Nov | No B1 change (préfet, CTM, Méthodologie « Données personnelles », no legal review) |

## 2. Card and pages
| Item | Status | Notes |
|---|---|---|
| `/communes` grid, card, compare page, Méthodologie | ✅ | Grid (no map). Compare: 2–4 communes, Martinique median. |
| Header: mayor (RNE), population, term, EPCI | ✅ | |
| Hero trio (taux d'épargne brute, capacité de désendettement, équipement / hab.) | ✅ | #20; stratum median, named group. |
| Budget blocks 2018–2025, 2025 provisional | ✅ | `com_actuals` 29,936 rows, 2012–2025, 34/34 communes. |
| Comparisons: Martinique band, national DGFiP line, structure, term change, 12-year line | ✅ | 5,440 `nat_*` rows loaded. |
| « Investi pour votre population » (EPCI, syndicats, CCAS) | 🟡 | Data loaded (52 entities, 16,636 rows), not shown on the card. |
| Three terms compared, past mayors | ✅ | 1,059 officeholder rows; **12 past mayors not verified** (11 of the 2008–2014 term, plus Sainte-Marie 2017), shown as such. |
| Mayor portraits | 🟡 | 19 / 34 (`media`, credited, removable); the others show initials. |
| Whole council (RNE) | ✅ | |
| Town-hall website (Service-Public directory) | ✅ | 25 sites, 9 communes without one (`src/lib/communes/sites.ts`). |
| Website checklist (39 criteria, 5 themes) | 🟡 | Criteria loaded (39). **0 audits loaded.** 34 automated drafts in `data/communes/audit/sites/` (1,326 items: 246 yes, 210 partial, 349 no, 521 n/a), none reviewed. Phone review page + `apply_review.py` ready. Waiting for JM's review. |
| Town-hall social networks (step 4) | 🟡 | Table and block live, **0 observations loaded**. 25 files pre-filled from the official sites (49 accounts: 19 Facebook, 15 Instagram, 13 YouTube, 2 WhatsApp), none observed or reviewed. Waiting for observers, then JM. |
| Votes on website quality | ✅ / ⚠️ | Distribution, 20-vote threshold, closed in pre-election periods. 1 vote recorded (4 Nov, commune 97222, before Turnstile). |
| Votes on the commune's action (12 criteria) | ✅ / ⚠️ | Criteria loaded (12), **all `ref_status: to_confirm`**. 0 votes. No closure dates (`com_vote_closures` empty). |
| Hash erasure | ✅ | `pg_cron` `com-erase-vote-hashes` 03:17 UTC, active. |
| Forecast budgets (BP / ROB) | ❌ | Tables exist, 0 documents. |
| Kréyòl labels | 🟡 | Only `headlineTitle`; 0 / 79 metric labels. Waiting for JM's list. |
| Share image per commune (OG) | ❌ | No `opengraph-image`. |
| State investment grants per commune (from B4) | ❌ | Offered by B4 (`getCommuneGrants`, PR #75 merged), approved by JM 10 Nov. Not planned yet. |

## 3. To fix or check
1. ⚠️ **Votes refused in production.** Votes reached `main` with #71. `TURNSTILE_SECRET_KEY` is set for Preview only
   (JM's choice, 10 Nov), so on vwapepla.org every vote gets « Votre avis n'a pas pu être enregistré » (the check fails
   closed; nothing is stored). Either add the Production secret, plus `vwapepla.org` in the Turnstile widget's hostnames, or hide
   the two vote forms in production until then. JM's decision.
2. ⚠️ **End-to-end test vote not passed yet.** On the `dev` preview, after the site key, hostname and Preview secret
   were fixed: the widget loads; JM's vote on deployment `dpl_HkcETtt6…` got « n'a pas pu être enregistré » because that
   build had no secret (Vercel request log: no call to Cloudflare). To repeat on a build made after the secret was set.
   The automated browser gets no Turnstile token (bot detection), so JM casts the test vote himself.
3. `com_site_vote_summary` still exists; `main` and `dev` no longer call it. Migration
   `20261110120000_com_drop_site_vote_summary.sql` written as a draft, **NOT applied**: waits for JM's go.
4. Migration file names: `com_channels` renamed to its applied version (20261105114152). Several files of other teams and
   `core_` files also differ from their applied versions (e.g. `20261103120000_core_people_and_com_prefix`, applied
   20261103093422). This has no effect on the database; it is left to the coordinator.
5. AFD 2021 debt-2019 gap (+3.4%), WARN in `reconcile_afd.py`, not explained on the Méthodologie page.
6. No legal review (JM, 10 Nov): closure dates come from the decree convening the voters of each election; the
   competence statements are checked against the CGCT and the EPCI statutes by the team.

## 4. Waiting for JM
- Review of the 34 website audits (phone review page).
- Decision on item 3.1 (production secret or hide the vote forms) and the test vote (3.2).
- Go for the migration dropping `com_site_vote_summary`.
- Corrections, if any, to the 12 competence statements once checked.
- Reviewer for the channel observations (observers: team).
- Kréyòl labels; past mayors still unverified (12).

## 5. Shared-file needs (coordinator session's PRs, not B1)
| Need | Shared file(s) | For |
|---|---|---|
| PostHog EU, cookieless, `/sem` UTM | `src/app/layout.tsx`, `package.json`/lockfile, `src/lib/core/` | Measure the radio audience |
| Playwright (dev dependency) + 375 px smoke test in CI | `package.json`/lockfile, `.github/workflows/` | Mobile check of all cards |
| Méthodologie: website audit, visitor votes (Turnstile, hash, 60 days), competence statements | `src/app/methodologie/` | Votes live since #71 |
| Kréyòl common words, once agreed | `messages/gcf/common.json` | MVP2 |
| Forecast path `data/forecast/` → `data/communes/forecast/` | `CLAUDE.md` | Forecast layer |
| Maybe: a default OG image for the site | `src/app/opengraph-image.tsx` (root) | Share preview outside `/communes` |

## 6. This session (10 Nov 2026, plan approved by JM)
| Item | Where | Waiting for |
|---|---|---|
| Drop `com_site_vote_summary` | PR #81: draft migration `20261110120000_com_drop_site_vote_summary.sql`, **NOT applied** | JM's go to apply, then merge |
| Website-audit review | Private artifact « Relecture des audits de sites » (`review_page.py`, with an « Aller vite » box) | JM's review on the phone, then paste |
| Channel observations | PR #83: observer page (`channels_page.py`, private artifact « Relevé des réseaux sociaux des mairies ») + `apply_channels.py`; 9 empty files; duplicate draft removed | Observers named by JM; then the batches, JM's review and his go to load |
| Share image per commune | PR #82: `opengraph-image` + `twitter-image`, hero trio 2024 with the group median and the card's notes | Merge (CI green on the first commit; preview checked for Le Lamentin and Le Robert) |
| Competence statements | PR #84: table in `B1-VOTES.md`: 8 confirmed, 3 corrections proposed (petite enfance + CTM, risques + EPCI/GEMAPI, éclairage via SMEM), CCAS wording, EPCI statutes still open | JM's OK on the corrections; then YAML `confirmed` + `ref_urls`, and a reload with his go |
| State grants block (from B4) | Not started | A separate plan after JM's OK |

Not run locally (memory limits): `npm test`, `next build`, the dev server; CI runs them on every PR.
