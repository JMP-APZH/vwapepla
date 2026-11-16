# B1 — Communication channels of the town halls (Step 4, proposal for JM, 5 Nov 2026)

## Decisions (JM, 5 Nov 2026) and status
1. Migration `com_channel_observations`: go → applied (`20261105114152_com_channels.sql`, the applied version).
2. Screenshots in `data/raw/communes/channels-evidence/` (gitignored) for now.
3. Pre-fill from the official websites: done from the 2 Nov website crawl (no request to any social network): only
   accounts linked from the home page or from at least half of the pages (site-wide header/footer), so links to a
   restaurant or an association on one inner page are left out. 19 of the 25 listed sites link at least one account.
   Communes without a listed website have no file yet (Macouba lists a Facebook page in the Service-Public directory:
   to be added by an observer with `official_basis: town_hall_confirmed` or after checking).
4. Reviewer: JM only (`REVIEWERS = {"JM"}` in `build_channels.py`).
5. (10 Nov 2026) Observer page and batch script added:
   - `scripts/communes/audit/channels_page.py` builds the page (private artifact);
   - `apply_channels.py` applies a pasted batch.
   The 9 communes without a website now have an empty file, so they appear on the page; Macouba's Facebook page from the
   Service-Public directory is still to find. A duplicate YouTube draft of Les Anses-d'Arlet (same handle, different
   case) was removed. Still to decide: who observes (initials).

Facts only: dated team observations, each with its evidence. No score, no ranking, no scraping, no unofficial API.
The repo is public: screenshots never go into git (only their path and sha256).

## 1. What is recorded
One file per commune, `data/communes/audit/channels/<insee>.yaml`. One entry per account and per observation (a new
observation is a new entry, so the history is kept). Platforms: facebook, instagram, tiktok, youtube, whatsapp_channel.

```yaml
commune: "97209"
observations:
  - platform: facebook
    account_url: https://www.facebook.com/<page>   # all values in this example are illustrative
    account_name: Ville de <commune>
    official: yes            # yes | no | doubtful
    official_basis: linked_from_site   # linked_from_site | platform_verified | town_hall_confirmed | none
    official_evidence_url: https://<site-de-la-mairie>/   # page where the link was found, if any
    last_post_date: 2026-11-02
    posts_last_90_days: 41   # counted by hand on the day; null if not countable
    council_meetings_streamed: yes   # yes | no | unknown
    council_stream_evidence_url: https://www.facebook.com/<page>/videos/<id>
    followers: 12000         # snapshot as displayed on the day (platforms round it)
    followers_display: "12 k"
    screenshot: evidence/97209/2026-11-05-facebook.png   # path in the private evidence store
    screenshot_sha256: 3f1c…
    observer: Initials (team member)
    observed_on: 2026-11-05
    reviewed_by: JM          # only reviewed entries are published
    note: null
  - platform: tiktok
    account_url: null        # no account found
    searched_on: 2026-11-05  # absence is a fact too: where and when we looked
    search_note: "Recherche du nom de la commune sur TikTok et lien absent du site officiel."
    observer: …
    observed_on: 2026-11-05
    reviewed_by: JM
```

Rules checked by `scripts/communes/pipeline/build_channels.py` (exit 1 on error, like `build_audit.py`):
- known platform; dates valid and not in the future; `posts_last_90_days` ≥ 0;
- `official: yes` requires an `official_basis` other than `none`, with an evidence URL for `linked_from_site`;
- an observed account requires `screenshot` + a 64-hex `screenshot_sha256`; the build checks the hash when the
  file is present locally;
- "no account" entries require `searched_on` and `search_note`;
- only entries with `reviewed_by` are exported (drafts never reach the public tables).

## 2. Screenshots (evidence), outside git
- Local folder `data/communes/audit/channels/evidence/` added to `.gitignore` (shared file → one-line separate PR to
  `dev`, or I keep them under `data/raw/communes/channels-evidence/`, already gitignored: **recommended, no shared
  change**).
- Long-term: a **private** Supabase Storage bucket `com-evidence` (team access only), same path. Creating it is a
  database/storage change: only with your go. The YAML keeps path + sha256, so anyone holding the file can verify it.
- `scripts/communes/evidence_hash.py <file>` prints the sha256 to paste (helper for observers).

## 3. Database (needs your go: one additive migration)
`supabase/migrations/<ts>_com_channels.sql`: table `com_channel_observations` (commune_code, platform, observed_on,
account_url, account_name, official, official_basis, official_evidence_url, last_post_date, posts_last_90_days,
council_meetings_streamed, council_stream_evidence_url, followers, followers_display, screenshot_path,
screenshot_sha256, observer, reviewed_by, note, searched_on, search_note; key commune_code + platform + observed_on +
account_url). Public read like the site audit, no write for anon/authenticated. Additive only: `main` keeps working.
Loaded by `load_supabase.py --domain communes com_channel_observations` (added to `scripts/communes/tables.py`).

## 4. On the card
In the « Site de la mairie » section, a fact block « Réseaux sociaux de la mairie » (before the visitors' opinions):
- one line per platform: account name (link), « compte officiel » + basis (e.g. « lien sur le site de la mairie »)
  or « non confirmé comme officiel », last post date, posts in the last 90 days, council meetings streamed (yes/no,
  with the link), followers « au 5 nov. 2026 »;
- « Aucun compte trouvé (recherche du 5 nov. 2026) » when we looked and found nothing; « Pas encore relevé » for
  platforms not yet observed, also listed in « Informations manquantes ou à vérifier »;
- an observation older than 6 months is marked « relevé ancien »;
- source line: « Relevé de l'équipe Vwapepla du <date>, capture d'écran conservée (empreinte sha256) ».
Neutral colours, no "active/inactive" verdict, no comparison between communes.

## 5. Who observes
Observations are made by hand by the team (observer = initials). I do not browse the platforms myself (no scraping,
and logged-out views differ). I can **pre-fill account URLs** found on the official town-hall websites
(`OFFICIAL_SITES`, header/footer links), marked `official_basis: linked_from_site`, with `observed_on` left for the
observer to fill: the card shows nothing until an observer completes and JM reviews the entry.
Deliverable for the team: a one-page observer guide (`docs/branches/B1-CHANNELS-GUIDE.md`: how to count posts,
what to capture, naming, hashing).

## Decisions needed
1. Migration `com_channel_observations` (additive): go?
2. Evidence store: `data/raw/communes/channels-evidence/` locally now (recommended), private Storage bucket later: go?
3. Pre-fill account URLs from the official town-hall websites: yes / no?
4. Reviewer: you only, or someone else on the team?
