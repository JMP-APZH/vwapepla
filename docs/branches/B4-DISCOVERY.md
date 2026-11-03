# B4 — Préfet de Martinique: discovery (sprint 1, 3 Nov 2026)

**Status:** discovery only. No app code, no migration. For JM to review; open questions are listed in §5.
**Scope reminder:** the Préfet is an **appointed** senior civil servant with a duty of reserve, not an elected
official. The card describes **State action in Martinique during each posting**, not a personal political record.

Downloaded this sprint: `python -I scripts/core/download_sources.py --domain prefet` → `data/raw/prefet/` (11 files,
manifest with url, retrieval date, rows, sha256). Source list: `scripts/prefet/sources.py`.

---

## 1. Source inventory (official first)

Legend: **DL** = downloaded by the script this sprint · **Doc** = document source, inventoried, not downloaded yet
(the shared engine only writes CSV and one fixed licence; see §6, shared change 1).

### 1.1 Postings: appointment decrees (Légifrance / JORF)

| | |
|---|---|
| URL | `https://www.legifrance.gouv.fr/jorf/id/<JORFTEXT id>` (one page per decree) |
| Licence | Licence Ouverte 2.0 (DILA). Credit: « Source : Journal officiel de la République française (Légifrance) » |
| Format | HTML page per text; also the PISTE Légifrance API (free, needs an account and key) and the DILA bulk JORF XML dumps (`echanges.dila.gouv.fr/OPENDATA/`, heavy) |
| Coverage | every appointment since 1987 (electronic JORF) |
| Sample fields | title, NOR, JORF number and date, text number, signature date, Article 1 (previous post → new post) |
| Status | **Doc**: verified by hand-reading on Légifrance; for the build, a small YAML file `data/prefet/postings.yaml` (one line per decree: JORF id, NOR, dates, URL), the same pattern as `data/forecast/` in communes. No figure is typed: these are references to texts. |

Postings since the CTM was created (Dec 2015), plus the one in office at that date:

| Préfet | Appointment decree | Taking office | End of posting | Status |
|---|---|---|---|---|
| Fabrice RIGOULET-ROZE | Décret du 31 juillet 2014 — [JORFTEXT000029323000](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000029323000) | Aug 2014 (à vérifier) | 2017, successor's decree | decree seen in search, to open |
| Franck ROBINE | Décret du 29 juin 2017 — [JORFTEXT000035058982](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000035058982) | Jul 2017 (à vérifier) | Jan 2020 (lead: Wikipedia, à vérifier) | decree found |
| Stanislas CAZELLES | Décret du 5 février 2020 — [JORFTEXT000041535997](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000041535997) | 24 Feb 2020 (préfecture press release) | 23 Aug 2022 | decree found |
| Jean-Christophe BOUVIER | Décret du 29 juillet 2022 — [JORFTEXT000046113990](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000046113990) | 23 Aug 2022 | Feb 2025 (à vérifier) | decree found |
| Étienne DESPLANQUES | Décret du 15 janvier 2025, NOR INTA2501163D, JORF n°0013 du 16 janvier 2025, texte n°85 — [JORFTEXT000050980975](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000050980975) | 10 or 11 Feb 2025 (press reports differ, à vérifier) | in office (still cited as préfet in mid-2026 press; no successor decree found) | **opened and read** |

Notes:
- There is usually **no "end" decree**: a posting ends with the successor taking office or the person's next appointment
  decree ("M. X, préfet de la région Martinique, … est nommé …"). Both are JORF texts, used as the end source.
- Between postings the **secrétaire général** acts as préfet *par intérim* (probably Jan–Feb 2020, à vérifier). Interim periods must
  be shown as such, not attributed to either préfet.
- Earlier leads (out of the proposed scope): L. Prévost (decree 2 Mar 2011, JORFTEXT000023658421), A. Mancini (18 Jul 2007, JORFTEXT000000464870).
- Wikipedia / press (RCI, Outremers360, Acteurs publics) are **leads only**, never a source on the card.

### 1.2 martinique.gouv.fr (préfecture)

Site licence (mentions légales, read 3 Nov 2026): « Sauf mention contraire, tous les contenus de ce site sont sous
licence etalab-2.0 », **excluding** logos, third-party content and personal data; **photos and audiovisual content need
the author's permission**; reuse must keep the content intact and cite the date of the last update.

| Source | URL | Format | Coverage | Sample fields | Status |
|---|---|---|---|---|---|
| Recueil des actes administratifs (RAA) | `/index.php/Publications/Recueils-des-actes-administratifs-publies` (+ `/RAA-2026`, `/Archives`) | HTML index → PDF issues (`/contenu/telechargement/<id>/<id>/file/<name>.pdf`), numbered `R02-YYYY-NNN`, plus « spécial » issues | 2011 → today (latest seen: 31 Oct 2026) | per act: number, date, service (DEAL, DAAF, cabinet…), title, signatory, commune concerned | **Doc** (needs PDF archiving + text extraction) |
| Salle de presse (communiqués, invitations presse) | `/index.php/Publications/Salle-de-presse` | PDF/HTML | ~2011 → today | date, subject: taking office, crises, fuel prices, BQP… | **Doc** |
| Rapport d'activité des services de l'État (RASE) | `/index.php/Publications/Rapport-d-activite-des-services-de-l-Etat` | HTML pages → documents | 2010–2014, **2020–2024** (2015–2019 missing on the site) | yearly activity of State services by policy area | **Doc**, strong candidate for the "what the State did" block |
| Contrat de convergence et de transformation (CCT) | `/index.php/Actions-de-l-Etat/Contrat-de-convergence-et-de-transformation-de-la-Martinique` | HTML + attached PDFs | Plan 2019; CCT 2019–2022 (published 11 Jun 2020), avenant 17 May 2023, **CCT 2024–2027** (published 28 Oct 2024) | signatories, axes, amounts by party (State / CTM / EPCI), projects | **Doc**; State share to read in the signed text (press figure 182.4 M€ State of 473.9 M€ total is **not** confirmed) |
| Bouclier qualité-prix (BQP) | press kits per year, e.g. `…/DP Signature Accord BQP 2018 VF.pdf`, `…/20220506_CP Bouclier Qualité Prix 2022.pdf` | PDF | annual agreements since 2013 (law of 20 Nov 2012); 2025: 134 → 180 products; first car-repair BQP signed 23 Jun 2026 (press) | year, number of products, max basket price, signatories | **Doc**; link to prix-martinique.org for prices |
| Prix maximum des produits pétroliers | monthly CP « Révision du prix des produits pétroliers et du gaz domestique pour le mois de … » | PDF | monthly (found 2022–2024 on the site; 2026 relayed by RCI) | max price per litre (SP95, gazole, gaz) — set by **arrêté préfectoral** each 1st of the month under the arrêté interministériel du 5 février 2014 | **Doc**; candidate for a prix-martinique.org link rather than a duplicate series |

### 1.3 State spending in Martinique

| Source | URL | Licence | Format | Coverage | Sample fields | Status |
|---|---|---|---|---|---|---|
| **Document de politique transversale (DPT) Outre-mer**, annexe au PLF | PLF 2026 copy: `https://www.assemblee-nationale.fr/dyn/contenu/visualisation/1090079/file/4-DPT2026_OutreMer.pdf` (official home: budget.gouv.fr, PLF documents) | Licence Ouverte (State publication; to confirm on budget.gouv.fr) | PDF, 293 pages | yearly; the annex "répartition des crédits entre territoires" covers all 104 contributing programmes | per territory and per mission/programme: AE and CP, execution N-2, LFI N-1, PLF N | **Doc** (PDF read with pdftotext this sprint) |

DPT 2026, **Martinique** table (PDF pages 236–239), « Total général » (read with `pdftotext -layout`, to re-check with
a proper table extraction before any display):

| | Exécution 2024 | LFI 2025 | PLF 2026 |
|---|---|---|---|
| AE | 2 882 533 418 € | 2 749 129 790 € | 2 401 967 710 € |
| CP | 3 097 207 237 € | 3 061 922 207 € | 2 708 928 663 € |

Caveats to display: includes State staff costs (teachers, police, justice…) and national schemes; the préfet does not
decide most of it; PLF ≠ voted budget; only one DPT read so far (earlier years: same annex, to collect for the trend).

### 1.4 State grants to local authorities (decided by the préfet) — **DL**

| | |
|---|---|
| Dataset | DGCL, « Projets financés par les dotations de soutien à l'investissement des collectivités territoriales » — [data.gouv.fr](https://www.data.gouv.fr/datasets/projets-finances-par-les-dotations-de-soutien-a-linvestissement-des-collectivites-territoriales/) (id `6176785207139a929a2776fe`) |
| Licence | Licence Ouverte 2.0. Credit: « Source : DGCL, ministère de l'Intérieur » |
| Format | one national CSV per year (`;`, decimal comma), filtered on `beneficiaire_dep = 972` |
| Coverage | 2018–2025 (8 files) |
| Fields | `exercice, dispositif, programme, beneficiaire_type, beneficiaire_siren, beneficiaire_dep, beneficiaire_nom, beneficiaire_code_insee, intitule, cout_ht, subvention, taux` |

Martinique rows and total grants (sum of `subvention`, profile run on 3 Nov 2026, not yet reconciled):

| Year | Rows | Beneficiaries | Grants (€) | Schemes |
|---|---|---|---|---|
| 2018 | 67 | 36 | 6 508 820 | DSIL 39, DETR 28 |
| 2019 | 75 | 29 | 8 304 566 | DETR 36, DSIL 27, DPV 7, DSID 5 |
| 2020 | 60 | 28 | 10 425 185 | DETR 27, DSIL 20, DPV 6, DSID 4, DSIL exceptionnelle 3 |
| 2021 | 93 | 38 | 17 582 668 | DSIL RT 30 (France Relance), DSIL 23, DETR 20, DPV 9, DSID RT 5, DSID 3, DSIL exc. 3 |
| 2022 | 69 | 31 | 8 142 393 | DSIL 31, DETR 28, DPV 10 |
| 2023 | 68 | 31 | 7 574 499 | DETR 30, DSIL 27, DPV 10, DSID 1 |
| 2024 | 65 | 39 | 7 640 925 | DSIL 34, DETR 27, DSID 3, DPV 1 |
| 2025 | 64 | 31 | 6 898 526 | DETR 26, DSIL 26, DPV 11, DSID 1 |

Data quality found: beneficiary names not normalised ("Commune du carbet", "FORT-DE-FRANCE", "Saint-joseph");
`beneficiaire_code_insee` empty for EPCI and CTM (use SIREN); 5 rows in 2021 with an empty `beneficiaire_type`;
`beneficiaire_type = departement` = CTM. Grants are **commitments** for the year, not payments.

### 1.5 Recorded crime (SSMSI) — **DL**

| | |
|---|---|
| Dataset | SSMSI, « Bases statistiques communale, départementale et régionale de la délinquance enregistrée par la police et la gendarmerie nationales » — [data.gouv.fr](https://www.data.gouv.fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/) (id `621df2954fa5a3b5a023e23c`) |
| Licence | Licence Ouverte 2.0. Credit: « Source : SSMSI, ministère de l'Intérieur » |
| Format | communal: national `csv.gz` (40 MB) → filtered on `CODGEO_2026` 972xx; département and région CSVs filtered on 972 / 02 |
| Coverage | 2016–2025, edition of July 2026 (geography 2026); **34/34 communes**; 15 indicators (communal), 18 (département: + homicides, attempted homicides, drug use excl. AFD) |
| Fields (communal) | `CODGEO_2026, annee, indicateur, unite_de_compte, nombre, taux_pour_mille, est_diffuse, insee_pop, insee_pop_millesime, insee_log, insee_log_millesime, complement_info_nombre, complement_info_taux` |
| Rows | communes 5 100 (of which **1 947 `ndiff` = 38 %**: small counts not released, with only a regional-type estimate in `complement_info_*`), département 180, région 180 |
| Sample | 97209 Fort-de-France, 2025, « Violences physiques intrafamiliales », victims: 509, 6.74 ‰ (pop. 75 506, INSEE 2023); département 972, 2025, homicides: 39 victims |

The commune file column `CODGEO_<geography year>` changes name every edition: the fetcher matches the prefix.
Also on the page (not downloaded): the yearly *Atlas départemental* (PDF) and a methodology PDF.

### 1.6 Context sources

| Source | URL | Licence | Format | Coverage | Use | Status |
|---|---|---|---|---|---|---|
| Cour des comptes / CRC Antilles (ex-Antilles-Guyane) | ccomptes.fr (reports, CRC « rapports d'observations définitives ») | reuse allowed with source (to confirm per report) | PDF | no report found on the **préfecture / State services** in Martinique for 2024–2025; recent ones target the CGSS and the CTM (not State competences of the préfet) | context links only, by subject | **Doc** |
| IEDOM, rapport annuel Martinique | `https://www.iedom.fr/IMG/pdf/…` (e.g. `rapport_annuel_2024.pdf`; 2025 report published mid-2026) | IEDOM terms (to check; probably reproduction with source) | PDF | yearly since ~2008; edition N+1 covers year N | economic context (prices, credit, public finance), not on the card's fact blocks at first | **Doc** |
| prix-martinique.org (sister project) | prix-martinique.org | own | web | live | link from BQP / fuel blocks; no duplicate series | link |

### 1.7 Not found / to look for next sprint
- A machine-readable list of RAA acts (none: PDF only). Volume: dozens of issues per year → text extraction + manual tagging.
- Fonds vert (programme 380) projects: national open data to look for on data.gouv.fr; the DPT gives the programme total
  for Martinique only.
- Crisis records (cyclones, earthquakes, drought, social unrest, Covid): no structured dataset; built from RAA acts
  (curfews, alerts, requisitions) and press releases; Météo-France vigilance archives to check.

---

## 2. Draft data model (on the core model; no migration this sprint)

### 2.1 Core tables (B4 writes its own rows only)

| Table | Row(s) | Notes |
|---|---|---|
| `institutions` | `('prefecture-972', 'prefecture', 'Préfecture de la Martinique', null)` | kind `prefecture` already allowed. **No "État" kind needed now**: the card covers State services *under the préfet's authority* (DEAL, DAAF, DEETS, police, gendarmerie…), stored as a `service` attribute on `pref_` rows. An `etat` kind would only be useful if other teams later track State bodies outside the préfet (ARS, rectorat, ministries) → not proposed now. |
| `bodies` | `('prefecture-972-prefet', 'prefecture-972', 'prefecture', 'Corps préfectoral')` | sous-préfets (Saint-Pierre, Trinité, Le Marin) and the secrétaire général would get seats in the same body if JM wants them (§5 Q3). |
| `seats` | `('prefecture-972-prefet:prefet', …, role 'prefet', label_fr 'Préfet de la région Martinique, préfet de la Martinique')` | |
| `persons` | `'pref:DESPLANQUES:Etienne'` | name and sex only (titles: « préfète »). No birth date, no career beyond what the decree says. |
| `mandates` | one row per posting: `start_date` = decree date, `function_start` = taking office, `end_date` = handover, `acquired = 'appointment'`, `term_id = null`, `source_id = 'jorf-JORFTEXT000050980975'`, `source_url` = Légifrance URL | fits the existing columns with no change. |
| `sources` | one row per dataset (from the manifest) and one per document (decree, DPT edition, CCT, BQP…), `domain = 'prefet'` | |
| `media` | official portrait, `institution_id = 'prefecture-972'`, `person_id` | only if permission obtained (§5 Q1). |
| `terms` | not used | postings have no fixed term. |

Gap: `mandates` holds one `source_id` (appointment). End of posting and interim periods go in a B4 table rather than
a shared change: `pref_posting_events`.

### 2.2 `pref_` tables (SQL sketch, for review only)

```sql
-- Appointment, taking office, end, interim: each event with its own source (JORF text or press release).
create table pref_posting_events (
  id          text primary key,                 -- 'desplanques-2025:appointment'
  mandate_id  bigint references mandates(id),   -- null for an interim period between postings
  kind        text not null check (kind in ('appointment','taking_office','end','interim_start','interim_end')),
  event_date  date not null,
  detail      text,                             -- e.g. 'préfet de la Corrèze' (previous post, from Article 1)
  source_id   text not null references sources(id),
  source_url  text not null
);

-- Acts published in the recueil des actes administratifs (later sprint: PDF extraction + tagging).
create table pref_acts (
  id           text primary key,                -- 'R02-2026-123:2026-10-31-001'
  raa_issue    text not null,                   -- 'R02-2026-123'
  act_number   text,
  act_date     date not null,
  service      text,                            -- 'cabinet', 'DEAL', 'DAAF', 'DEETS', ...
  category     text not null,                   -- controlled list: police, environnement, prix, crise, délégation...
  title        text not null,                   -- verbatim title of the act
  commune_code text,                            -- INSEE when the act targets one commune
  signatory    text,                            -- function, not only the name (délégations de signature)
  source_id    text not null references sources(id),
  page         int not null
);

-- State programmes and contracts (DPT by programme, CCT, BQP): one row per figure, with its document page.
create table pref_state_figures (
  id          text primary key,                 -- 'dpt-2026:martinique:total:cp:execution-2024'
  programme   text not null,                    -- 'DPT Outre-mer', 'CCT 2024-2027', 'BQP 2025'
  item        text not null,                    -- mission / programme / axis / 'Total général' / 'produits'
  measure     text not null,                    -- 'AE', 'CP', 'part État', 'nombre de produits'...
  period      text not null,                    -- 'exécution 2024', 'LFI 2025', 'PLF 2026', '2024-2027'
  value       numeric not null,
  unit        text not null,                    -- 'EUR', 'produits'
  status      text not null check (status in ('exécuté','voté','prévisionnel','contractualisé')),
  source_id   text not null references sources(id),
  page        int
);

-- DETR / DSIL / DSID / DPV grants (DGCL open data), one row per project.
create table pref_investment_grants (
  id                 text primary key,          -- '<exercice>:<dispositif>:<siren>:<n>'
  year               smallint not null,
  scheme             text not null,             -- DETR, DSIL, DSIL RT, DSID, DPV...
  beneficiary_type   text,                      -- commune, epci, departement (= CTM)
  beneficiary_siren  text,
  commune_code       text,                      -- INSEE (null for EPCI / CTM)
  beneficiary_name   text not null,             -- as published
  project            text not null,
  cost_ht            numeric,
  grant_amount       numeric not null,
  rate               numeric,
  source_id          text not null references sources(id)
);

-- Recorded crime (SSMSI), long format as published, commune and département level.
create table pref_crime_stats (
  geo_level    text not null check (geo_level in ('commune','departement')),
  geo_code     text not null,                   -- 972xx or 972
  year         smallint not null,
  indicator    text not null,
  unit         text not null,                   -- Victime, Infraction, Mis en cause, Véhicule
  count        int,                             -- null when not released (est_diffuse = 'ndiff')
  rate_per_1000 numeric,
  released     boolean not null,
  population   int, population_year smallint,
  source_id    text not null references sources(id),
  primary key (geo_level, geo_code, year, indicator, unit)
);

-- Crises and alerts: built from acts and press releases, each with a source.
create table pref_crisis_events (
  id          text primary key,                 -- '<yyyy-mm>-<slug>'
  kind        text not null,                    -- cyclone, séisme, sécheresse, sanitaire, ordre public, sargasses...
  title       text not null,
  start_date  date not null,
  end_date    date,
  measures    text,                             -- factual: 'couvre-feu 21h-5h (arrêté n°…)', 'vigilance rouge'
  source_id   text not null references sources(id),
  source_url  text
);
create table pref_crisis_acts (crisis_id text references pref_crisis_events(id), act_id text references pref_acts(id),
                               primary key (crisis_id, act_id));
```

Rule for all tables: facts are attached to **dates**, and a posting is a date range. The card shows "pendant la
période où X était préfet", never "X a fait". Nothing is attributed to the person.

`scripts/prefet/tables.py` (later): `sources, institutions, bodies, seats, persons, mandates, pref_posting_events,
pref_investment_grants, pref_crime_stats, pref_state_figures, pref_crisis_events, pref_acts, pref_crisis_acts`.

---

## 3. Neutrality charter (Préfet card)

1. **Facts about State services and decisions only.** Decrees, orders (arrêtés), published State figures, signed contracts
   and agreements. No assessment of the person, no score, no ranking of préfets, no "bilan" by Vwapepla.
2. **Duty of reserve respected.** No quotes of the préfet's personal opinions; official statements are cited only as
   « communiqué de la préfecture du … », with a link.
3. **Wording.** « Arrêté préfectoral n° … du … », « les services de l'État ont … », « crédits de l'État en Martinique » —
   never « le préfet X a dépensé / obtenu / échoué ». Most State spending is national policy, not a local decision:
   every money block says who decides (Parlement, ministère, préfet).
4. **Competences are shown.** Each block carries its competence label, and the card has a fixed panel:
   - **State (préfet and State services):** public order and security (police, gendarmerie), civil protection and crisis
     management, legality control of local authorities' acts, State grants to local authorities (DETR/DSIL), regulated
     prices (fuel; BQP negotiation), environment and risk-prevention policing (ICPE, water), immigration, employment policy.
   - **CTM:** roads, transport, secondary schools (collèges, lycées), social action, economic development, octroi de mer rates.
   - **Communes:** primary schools, local police powers of the mayor, urban planning, civil status.
   - **EPCI (CACEM, CAESM, CAP Nord):** water, sanitation, waste, urban transport.
   Wording and the legal references for this panel are checked in the legal review.
5. **Context, not performance.** Crime figures are *recorded* offences (≠ actual crime; depend on reporting and police
   activity), shown with SSMSI caveats, multi-year, never as a measure of a préfet. Same for economic context (IEDOM).
6. **Periods, not people.** Trends run over years; posting boundaries are drawn as markers, with interim periods marked.
7. **Missing information is stated** (`MissingInfo`), e.g. RASE 2015–2019 not online, DPT years not yet collected.
8. **Right of reply** addressed to the **préfecture** (cabinet du préfet / service communication), not to the person:
   « La préfecture de la Martinique peut demander une correction ou apporter une précision », mailto as on other cards.
9. **No opinion layer** on this card in this phase (no visitor votes, no comments).

---

## 4. Card draft (wireframe, shared card shell)

Route proposal: `/prefet` = current posting + list of postings; `/prefet/<year>-<nom>` = one posting (e.g. `/prefet/2025-desplanques`).

```
CardShell
┌─ CardHeader ───────────────────────────────────────────────────────────────────┐
│ [Portrait or initials]  Étienne Desplanques                                    │
│                         Préfet de la région Martinique, préfet de la Martinique │
│  Nommé (non élu) par    Décret du 15 janvier 2025 (JO n°0013 du 16/01/2025)     │
│  En fonction depuis     février 2025 (date exacte à vérifier)                   │
│  Poste précédent        Préfet de la Corrèze (selon le décret)                  │
│  Représente             l'État en Martinique                                    │
│  note: Source : Journal officiel (Légifrance), décret NOR INTA2501163D [¹]      │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ FactBlock « Qui fait quoi en Martinique » (fixed panel, §3.4) ────────────────┐
│ État · CTM · Communes · Intercommunalités — one line each      [² legal texts] │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ FactBlock « Crédits de l'État en Martinique » ────────────────────────────────┐
│ Crédits de paiement : 3,10 Md€ exécutés en 2024 · 3,06 Md€ votés 2025          │
│                       2,71 Md€ proposés 2026 (PLF, « Prévisionnel »)            │
│ Top missions (bar list)                                                         │
│ Caveat: inclut les salaires des agents de l'État ; décidé surtout au niveau     │
│         national, pas par le préfet.                                            │
│ Source : DPT Outre-mer, annexe au PLF 2026, p. 236-239 [³]                      │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ FactBlock « Subventions de l'État aux communes et intercommunalités » ─────────┐
│ DETR, DSIL, DSID, DPV attribuées par le préfet — par année 2018-2025 (bars)     │
│ Table: commune · projet · coût HT · subvention · taux   (filter by commune;     │
│        link to the commune card /communes/<slug>)                               │
│ Source : DGCL, ministère de l'Intérieur, data.gouv.fr, récupéré le 03/11/2026 [⁴]│
└────────────────────────────────────────────────────────────────────────────────┘
┌─ FactBlock « Contrat de convergence et de transformation 2024-2027 » ───────────┐
│ Signataires, montant total, part État (from the signed text)    [⁵ page]        │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ FactBlock « Prix encadrés » ──────────────────────────────────────────────────┐
│ Bouclier qualité-prix : accord annuel négocié (n produits en 2025)              │
│ Carburants : prix maximum fixés chaque mois par arrêté préfectoral             │
│ → Suivre les prix sur prix-martinique.org                       [⁶]            │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ FactBlock « Délinquance enregistrée (contexte) » ─────────────────────────────┐
│ 2016-2025, Martinique: line per indicator (per 1 000 hab.), posting markers     │
│ Caveat SSMSI: faits enregistrés ≠ faits commis ; petites communes non diffusées │
│ Source : SSMSI, ministère de l'Intérieur, édition juillet 2026 [⁷]              │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ FactBlock « Crises et alertes pendant la période » ───────────────────────────┐
│ Timeline: date · type · mesures (arrêté n°…) — each item sourced  [⁸ RAA p.]    │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ FactBlock « Actes publiés » (later sprint) ───────────────────────────────────┐
│ Number of acts per category per year from the RAA                [⁹]           │
└────────────────────────────────────────────────────────────────────────────────┘
MissingInfo  - Date exacte de prise de fonctions à vérifier
             - Rapports d'activité des services de l'État 2015-2019 non publiés en ligne
Caveat       Le préfet est nommé par décret du Président de la République ; il applique
             les politiques de l'État. Cette fiche décrit l'action de l'État, pas une
             personne. Périodes d'intérim signalées.
RightOfReply « La préfecture de la Martinique peut demander une correction ou une précision. »
(no OpinionBlock)
Footnotes: each [n] = SourceNote (dataset or document, year, retrieval date, link)
```

Timeline of postings on `/prefet`: Rigoulet-Roze (2014–2017) · Robine (2017–2020) · intérim · Cazelles (2020–2022) ·
Bouvier (2022–2025) · Desplanques (2025–), each with its decree link.

---

## 5. Open questions for JM

1. **Legal review — presenting a civil servant's posting.** Name, function and posting dates come from the JORF
   (public). Points for the lawyer: (a) a préfet is an agent of the State with a duty of reserve, not an elected official:
   is a card per *posting* acceptable if it attributes nothing to the person (charter §3)? (b) GDPR: legal basis
   (public-interest information about a public function), minimisation (no career history beyond the decree, no private
   life); (c) **portrait**: martinique.gouv.fr says photos are *not* under Etalab and need the author's permission → ask the
   préfecture, or show no photo (initials); (d) defamation risk on crisis wording (loi 1881): factual wording only, sources
   per item; (e) electoral periods: does anything change for an appointed official? Proposal: add these points to the
   pre-launch legal review (BRIEF §5).
2. **History depth.** Proposal: postings since the CTM was created (Dec 2015), i.e. from Rigoulet-Roze (in office then).
   Older?
3. **Sous-préfets and secrétaire général**: include (as seats with no card) to show interim periods and signatories, or not?
4. **PISTE (Légifrance API) account**: OK to create one (key in `.env.local`) to fetch decrees by script instead of a
   hand-kept YAML of references?
5. **Visitor votes**: none on this card (proposal). Agree?
6. **DPT**: one line « crédits de l'État » with the caveat, or not shown until we have several years and a reviewed table extraction?
7. **Crime block**: show it (context, with caveats) or leave it out of the Préfet card to avoid reading it as a score?
   Proposal: show, département level first, commune level later.
8. **Kréyòl labels**: which ones (e.g. section title, « Nonmé, pa éli »)? Only with your validation.
9. **Cross-domain**: B1 may want the DETR/DSIL grants on each commune card. Proposal: B4 owns `pref_investment_grants`
   and exposes a read in `src/lib/prefet/`; B1 decides whether to show it.
10. **Priority for sprint 2**: (a) postings + grants + DPT (data ready or nearly), then (b) RAA acts and crises (PDF work).

---

## 6. Proposed shared changes (each as its own small PR to `dev`, not in this branch)

1. **Download engine: completeness check (bug, all domains).** `scripts/core/fetching.fetch` does not detect a
   connection that ends early: on 3 Nov 2026 the 40 MB SSMSI file came back truncated 3 times out of 3 without an
   error (curl got it whole). Communes downloads may be affected silently. Fix: compare with `Content-Length` and resume
   with a `Range` request (done locally for B4 in `scripts/prefet/sources.py: fetch_complete`; to move to core and reuse).
2. **Download engine: non-CSV files and per-job licence.** Optional job fields `ext` (pdf, html, xlsx…), `licence`
   (default Licence Ouverte 2.0) and no row count for non-tabular files, in `scripts/core/{fetching,download_sources}.py`,
   backward compatible. Needed to archive decrees, RAA issues, DPT, CCT, BQP PDFs with sha256 (provenance).
3. **Nothing else for now**: the core model holds postings without change (`acquired = 'appointment'`, `function_start`);
   end-of-posting and interim sources go in `pref_posting_events`. If B2/B3 also need an end-of-mandate source, a shared
   `mandates.end_source_id` could replace it later.

---

## 7. Sources consulted this sprint (all opened on 3 Nov 2026)

- Légifrance: [JORFTEXT000050980975](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000050980975) (read); decree pages
  for Robine, Cazelles, Bouvier, Rigoulet-Roze found by search (titles above), to open one by one in sprint 2.
- martinique.gouv.fr: mentions légales; Publications; Recueils des actes administratifs (RAA 2026 index); Rapport d'activité
  des services de l'État; Contrat de convergence et de transformation pages.
- Assemblée nationale copy of the DPT Outre-mer 2026 (PDF, Martinique table pp. 236–239).
- data.gouv.fr API for the SSMSI and DGCL datasets (resources, licence, update dates).
- Leads only (not sources): RCI, Outremers360, Acteurs publics, Wikipedia, prix-carburant.eu, info.fr.
