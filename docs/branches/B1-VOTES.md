# B1 — Visitor votes on the commune's action, by criterion (Step 5, DESIGN ONLY, for JM's written decision)

Nothing is built. This document, the draft criteria (`data/communes/audit/vote_criteria.yaml`, marked PROPOSITION) and
the CLAUDE.md amendment (separate shared PR) are for JM to decide on. Same safeguards as the State's-action votes
already in production (B4, `pref_state_votes`), adapted to 34 communes.

## Decisions (JM, 5 Nov 2026, in writing)
1. CLAUDE.md amendment accepted (PR #34, text updated with decisions 2-6).
2. « Je ne sais pas » recorded, its share shown next to the distribution.
3. Monthly salt + « one vote per criterion per commune per month »; the same fix to be proposed for the website votes
   (B1) and the State votes (B4).
4. Turnstile as a shared helper for all votes (separate shared PR); JM creates the Turnstile widget in Cloudflare and
   adds the keys in Vercel.
5. Criteria: JM validates the 12 one by one (pending).
6. Voter hash erased after 60 days; votes closed during official pre-election periods.
Build starts once the 12 criteria are validated and #34 is merged.

## 1. What visitors are asked
Stem, identical for every criterion: « Comment évaluez-vous l'action de la commune sur … ? ». About the commune's
services, **never about a named person** (no mayor or deputy named in a question), and **never about the budget**
(principle 2: no score of a mayor's budget → no « gestion de l'argent public » question).

Each criterion has a **competence tag**: `commune` (the commune acts alone or mainly) or `partagee` with `others`
among `EPCI`, `CTM`, `État`, and a one-line `commune_role_fr` shown next to the question (« La commune construit et
entretient les écoles ; l'État nomme et paie les enseignants. »). Topics where the commune has no say (water,
sanitation, waste collection, public transport, lycées/collèges, routes nationales/territoriales) are **not asked**:
the block says who is in charge instead (« Eau et déchets : c'est la CACEM / CAESM / CAP Nord »), linking to the EPCI
caveat already on the card. Competence statements are marked `to_confirm` until checked against the CGCT and the
EPCI statutes on Légifrance / the EPCI sites.

Draft list (12, to validate one by one): accueil et démarches en mairie · écoles · petite enfance · action sociale
· propreté et entretien des rues · éclairage et tranquillité publique · sport et associations · culture et
patrimoine · urbanisme et logement · prévention des risques · information des habitants · écoute et participation.

## 2. Scale and display
- 1 Très insatisfaisante · 2 Plutôt insatisfaisante · 3 Ni l'un ni l'autre · 4 Plutôt satisfaisante · 5 Très
  satisfaisante, plus **« Je ne sais pas »**. Proposal: record « je ne sais pas » (score null) and show its count next
  to the distribution (« 12 % ne savent pas »), never inside it. (B4 does not record it: decision needed, §8-2.)
- **Distribution per criterion** (counts per level as a small stacked bar + numbers). **No average, no global score,
  no ranking, no comparison between communes** (no « communes les mieux notées », no map colouring).
- Shown only from **20 votes per criterion and per commune**; below: « 7 avis — résultats affichés à partir de 20 ».
- Label on the block: « Avis des visiteurs, non représentatif », in `OpinionBlock`, below the facts, never in a
  `FactBlock`, the header, a chart or the compare page.
- Votes belong to the **current term** (`term_id` 2026-2032): a new term starts from zero; past terms are not shown.

## 3. Data model (one additive migration, `<ts>_com_criteria_votes.sql`, after the go)
- `com_vote_criteria` (key, label_fr, description_fr, competence, others text[], commune_role_fr, display_order):
  public read, loaded from the YAML by `scripts/communes/pipeline/build_votes.py`.
- `com_criteria_votes` (id, commune_code, term_id, criterion, score smallint null = « je ne sais pas »,
  voter_hash, created_at): RLS on, **no policy** (invisible to the public), revoked for anon/authenticated.
- `com_cast_criteria_vote(p_commune, p_criterion, p_score, p_voter_hash)`: security definer, execute granted to
  `service_role` only; returns ok / already_voted / rate_limited / invalid.
- `com_criteria_vote_summary(p_commune)`: total and « je ne sais pas » always; counts per level only when the
  criterion has ≥ 20 votes for that commune and term.

## 4. Writes: server only
Server action in `src/app/communes/[slug]/` (same pattern as `castSiteVote`): validates the commune and criteria,
verifies Turnstile, computes the voter hash, calls the RPC with the secret key. The browser never talks to the
database for writes.

## 5. Anti-abuse
1. **Cloudflare Turnstile** (managed, invisible when possible). Site key public (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`),
   secret server-only (`TURNSTILE_SECRET_KEY`, Vercel env, never in `.env`). Token checked server-side
   (`siteverify`, with the remote IP) **before** any RPC call; failure → « vérification impossible », nothing stored.
   The widget script loads **only when the visitor opens the vote form** (the card stays cookieless and makes no
   third-party request by default). Probably useful for the website and State votes too → a shared helper
   `src/lib/core/turnstile.ts` + widget in `src/components/card/` (separate shared PR, JM's call).
2. **Salted hash**: sha256(ip | user agent | salt), salt = HMAC(secret, period). **Finding:** the current votes use a
   *daily* salt, so their « one vote per 30 days » rule actually resets every day (the hash changes at midnight).
   Proposal for these votes: a **monthly** salt (period = calendar month) and the rule « one vote per criterion per
   commune per month » — the limit then really holds, and the hash still cannot be linked across months. Decision
   needed (§8-3); the same fix could be proposed to B4 and to the website votes.
3. **Rate limits in the RPC**: one vote per criterion / commune / voter / month; max 40 votes per voter per day;
   max 5 votes per voter per minute (burst).
4. Honeypot field (as today). Monitoring: a daily count per commune in the Supabase logs; a burst (> 3× the usual)
   is reviewed by JM, and votes can be **neutralised, never edited**, by a dated, logged script.

## 6. GDPR note (for the méthodologie page and the pre-launch legal review)
- Data: score, criterion, commune, date, pseudonymous voter hash. No IP, no user agent, no cookie, no account. The
  hash is pseudonymous data (Vwapepla holds the secret), so GDPR applies: controller Vwapepla, purpose « limiter les
  votes multiples », legal basis legitimate interest (to confirm in the legal review).
- Retention: the hash is only needed while the month's limit runs → **erased (set to null) 60 days after the vote**
  by a scheduled SQL job; the anonymous vote remains.
- Turnstile: Cloudflare processes the IP to issue the token (processor; mention it, with its privacy policy link,
  next to the form and on the privacy page; loaded only on opening the form).
- Information shown under the form: what is stored, for how long, why, and that results are not representative.

## 7. Elections
No votes during the official pre-election period before municipal elections (and by-elections in that commune):
the form is closed and results are hidden, dates in config (to confirm in the legal review, code électoral L52-1).

## 8. Decisions needed from JM (in writing)
1. The CLAUDE.md amendment (shared PR): accept / change.
2. Record « je ne sais pas » and show its share next to the distribution: yes / no.
3. Monthly salt + « one vote per criterion per commune per month »: yes / no; and propose the same fix to the existing
   website and State votes: yes / no.
4. Turnstile as a shared helper for all votes (separate shared PR + Vercel env keys from JM): yes / B1 only.
5. The 12 draft criteria in `data/communes/audit/vote_criteria.yaml`: validate one by one (wording, competence).
6. Hash erasure after 60 days, and closing votes during pre-election periods: yes / no.
