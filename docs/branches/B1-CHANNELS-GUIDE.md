# Observer guide: town-hall social networks (Step 4)

One observation = one account (or one platform where nothing was found), on one day, by one person.
Facts only: no opinion on quality, no comparison between communes. The repo is public: **screenshots never go into git**.

## The quickest way: the observer page (10 Nov 2026)
You don't need to edit YAML.
1. Claude builds the page (`python -I scripts/communes/audit/channels_page.py`) and publishes it as a private artifact.
   JM shares it with the observers.
2. On the page: initials and date at the top, then for each commune and platform « Compte trouvé » (fill in the fields) or
   « Aucun compte trouvé » (where you looked). A card says « prêt » when nothing is missing, using the rules below.
3. Save each screenshot under the name shown below the platform, and send the screenshots to JM. They never go into git.
4. Touch « Copier mon relevé » at the end of each session and paste the text into the conversation with Claude.
   `apply_channels.py` then:
   - completes the pre-filled draft, or adds a new entry (an old observation is never edited);
   - adds the screenshot's sha256 when the file is in `data/raw/communes/channels-evidence/`.
5. `build_channels.py` lists anything still missing. JM reviews (`reviewed_by: JM`). The load into Supabase needs his go.

The rules below are the same, whichever way you record.

## Before you start
- Use a normal browser. If you are logged in, note it in `note:` (counts can differ when logged out).
- No tools that collect data automatically, no browser extensions that export posts, no unofficial APIs.
- Open `data/communes/audit/channels/<insee>.yaml`. Accounts linked from the official town-hall website are already
  pre-filled (`official_basis: linked_from_site`, page where the link was found, date the link was seen).

## For each platform (Facebook, Instagram, TikTok, YouTube, WhatsApp channel)
1. **Find the account.** Start from the pre-filled link. Otherwise search the platform for "Mairie de …" / "Ville de …".
   If you find nothing, record it (see "No account found").
2. **Official?**
   - `yes` + `linked_from_site` (link on the official site, URL of that page in `official_evidence_url`), or
     `platform_verified` (badge), or `town_hall_confirmed` (the town hall told us; put the message reference in `note:`);
   - `doubtful`: looks like the town hall but nothing confirms it;
   - `no`: not run by the town hall (fan page, association, elected official's personal page). Record it only if
     people may take it for the town hall's account.
3. **Last post date:** the date of the most recent post published by the account itself (not a pinned post, not a
   shared post from others).
4. **Posts in the last 90 days:** count by hand the posts of the account dated within 90 days before the observation
   day. Count each post once (a photo album or carousel = 1). If counting is not possible (too many, or dates hidden),
   leave `null` and say why in `note:`.
5. **Council meetings streamed:** `yes` if at least one municipal council meeting was broadcast (live or recorded) on
   this account in the last 12 months; put the link of one example in `council_stream_evidence_url`. `no` if you
   looked and found none; `unknown` if you could not check.
6. **Followers:** copy the number as displayed (`followers_display: "12 k"`), and in `followers` the whole number when
   it is shown exactly (else your best reading of the displayed figure, e.g. 12000 for "12 k").
7. **Screenshot:** one full-page capture of the account page showing the name, the followers and the latest posts.
   Save it as `data/raw/communes/channels-evidence/<insee>/<yyyy-mm-dd>-<platform>.png` (this folder is gitignored).
   Then run `python -I scripts/communes/audit/evidence_hash.py <that file>` and paste the two lines it prints.
8. Fill `observer:` (your initials) and `observed_on:` (the day you looked). Leave `reviewed_by:` empty: JM fills it.

## No account found
```yaml
  - platform: tiktok
    account_url: null
    searched_on: 2026-11-10
    search_note: "Recherche « Mairie de … » et « Ville de … » sur TikTok ; aucun lien sur le site officiel."
    observer: AB
    observed_on: 2026-11-10
    reviewed_by: null
```

## A new observation later
Never edit an old observation: add a new entry with the new date (the card shows the latest one, the history is kept).

## Check and publish
`python -I scripts/communes/pipeline/build_channels.py` must say `0 error`. It lists how many entries are ready and
how many are drafts. Only JM sets `reviewed_by: JM`; then he (or Claude, with his go) runs
`python -I scripts/core/load_supabase.py --domain communes com_channel_observations`.
