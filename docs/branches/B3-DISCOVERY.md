# B3 — CTM discovery (sprint 1, 3 Nov 2026)

Scope: Collectivité Territoriale de Martinique (CTM) and its two organs, the **Assemblée de Martinique** and the
**Conseil exécutif**. Discovery only: no app code, no migration. Every figure below comes from a file downloaded by
`python -I scripts/core/download_sources.py --domain ctm` (manifest `data/raw/ctm/manifest.json`) or from a document
whose URL is given. Nothing is from memory.

**Identity of the institution (checked in OFGL and DGFiP files)**

| Entity | SIREN | Years | Where OFGL files it | Where DGFiP files it |
|---|---|---|---|---|
| CTM (since 1 Jan 2016) | **200055507** | 2016– | regions base, `reg_code` 02, `categ` CTU | départements balances, `ndept` 103, M57 |
| Région Martinique (until 2015) | 239720014 | 2012–2015 | regions base, `categ` REG | nature-fonction yearly files |
| Département de la Martinique (until 2015) | 229720016 | 2012–2015 | départements base, `dep_code` 972 | nature-fonction yearly files |

Budgets of the CTM (DGFiP `cbudg`): principal (1, "CTU MARTINIQUE"), annexes (3) "LABORATOIRE CTM MARTINIQUE",
"IRRIGATION CTM UGPISE", "NTIC CTM- TRES HAUT DEBIT" (from 2022).

---

## 1. Source inventory (official first)

Licence of all OFGL, DGFiP and RNE files: **Licence Ouverte 2.0** (Etalab). Format: CSV `;`, UTF-8 (BOM), exported
from the Opendatasoft APIs with a server-side filter (file suffix `_972`).

### 1.1 Accounts — OFGL (aggregates, the card's primary source)

| Dataset (id) | Filter | Coverage | Use |
|---|---|---|---|
| `ofgl-base-regions-consolidee` "Comptes consolidés des régions 2012-2025" | `reg_code="02"` | CTM 2016–2025 (63–67 aggregates/year), Région 2012–2015 (50–52) | **Primary**: main + annex budgets consolidated, cross flows neutralised |
| `ofgl-base-regions` | `reg_code="02"` | same, per budget | Drill-down (principal / Laboratoire / Irrigation / NTIC) |
| `ofgl-base-departements-consolidee` | `dep_code="972"` | Département 2012–2015 | Pre-2016 history (with the Région) |
| `populations-ofgl-regions` | `reg_code="02"` | 2012–2025 | Population behind `euros_par_habitant` (`ptot`) |
| `dotations-regions` "Péréquation et DILICO des régions" | `code_region="02"` | | Equalisation, DILICO |
| `methodologie-ofgl-formules-des-agregats-financiers` | Régions, Départements | | Account formula of each aggregate (reconciliation) |
| `methodologie-ofgl-definitions-agregats-financiers` | – | | Definitions (Méthodologie page) |
| `nomenclatures-budgetaires` | M57, from 2016 | | Account labels (e.g. 73432 = Octroi de mer régional) |

Columns of `ofgl-base-regions-consolidee` (actual file): `exer, outre_mer, reg_is_ctu, reg_code, reg_name, categ, siren,
lbudg, agregat, montant_bp, montant_ba, montant_flux, montant, montant_en_millions, ptot, euros_par_habitant,
ordre_analyse1_section1 … ordre_analyse4_section1, annee_join, pmun, euros_par_habitant_pmun`.
These are the same columns as the commune base plus `reg_is_ctu`, so B1's mapping logic can be reused.

Sample row (2025): `exer=2025; categ=CTU; siren=200055507; lbudg=CTU MARTINIQUE; agregat=Attribution fonds de péreq. DMTO;
montant_bp=19767034.0; montant_ba=0.0; montant_flux=0.0; montant=19767034.0; ptot=364991; euros_par_habitant=54.16`.

Key aggregates (consolidated `montant`, € million, from the downloaded file):

| Year | Entity | Recettes de fonct. | Dépenses de fonct. | Epargne brute | Encours de dette | Dépenses d'équipement | Invest. hors remb. | Frais de personnel | Allocations RSA |
|---|---|---|---|---|---|---|---|---|---|
| 2015 | Région only | 249.9 | 225.6 | 24.3 | 187.0 | 143.5 | 228.4 | 61.4 | – |
| 2015 | Département only | 629.4 | – | – | 297.7 | – | – | – | 207.8 |
| 2016 | CTM | 905.1 | 859.3 | 45.8 | 559.9 | 119.6 | 215.3 | 205.2 | 207.6 |
| 2019 | CTM | 958.4 | 850.0 | 108.4 | 669.6 | 105.4 | 189.8 | 209.6 | 203.9 |
| 2021 | CTM | 980.1 | 896.6 | 83.5 | 849.4 | 148.3 | 321.1 | 232.5 | 205.6 |
| 2022 | CTM | 1,026.1 | 893.6 | 132.4 | 881.7 | 146.8 | 257.2 | 237.5 | 205.5 |
| 2023 | CTM | 1,073.6 | 981.4 | 92.2 | 920.4 | 154.1 | 250.6 | 255.5 | 187.1 |
| **2024** | CTM | **1,018.1** | **969.7** | **48.4** | **954.8** | **136.0** | **244.1** | **266.0** | **198.5** |
| 2025 (provisional) | CTM | 1,037.2 | 998.8 | 38.4 | 1,044.5 | 130.7 | 329.6 | 261.3 | 204.6 |

The 2024 CTM aggregates include social allowances (APA €78.7M, PCH €42.5M, RSA €198.5M), taxes (TICPE €182.6M,
TVA €175.8M, TSCA €37.4M, DMTO), Concours de l'État €201.6M (DGF €144.1M), and the SDIS contribution (€19.0M). These items
belong to the former Département's competences, so a CTM figure must never be compared with a commune figure.

### 1.2 Account detail — DGFiP balances comptables (data.economie.gouv.fr)

| Dataset (id) | Filter | Coverage | Use |
|---|---|---|---|
| `balances-comptables-des-departements` ("…des départements depuis 2010", in practice 2019–2025 on the portal) | `siren="200055507"` | CTM 2019–2025, **all four budgets** | Account-level detail, octroi de mer |
| Nature-fonction yearly files (14 datasets, ids in `scripts/ctm/sources.py`, e.g. `…-avec5` = 2012, `…-nature-fonction-2024`) | `siren in (CTM, Région, Département)` | 2012–2025 | **Functional breakdown** (column `fonction`), basis of the competence tags; pre-2016 detail |

The CTM is **not** in "balances comptables des régions" (0 rows). The nature-fonction files hold the principal and
Laboratoire budgets only (no Irrigation or NTIC; 2017 has the principal budget only): use the départements balances for
account totals. Rows per year (downloaded): about 1,160–1,640 for the principal budget; 2012–2015 hold
"DEP MARTINIQUE" (+ "LABORATOIRE DEPARTEMENTAL D'HYGIENE" 2014–2015) and "REG MARTINIQUE".

Columns (actual file): `exer, ident, ndept, lbudg, insee, cbudg, ctype, cstyp, nomen, siren, cregi, cacti, secteur, finess,
codbud1, categ, bal, compte, bedeb, becre, obnetdeb, obnetcre, onbdeb, onbcre, oobdeb, oobcre, sd, sc`
(+ `fonction`, `modvthel` in the nature-fonction files).

Sample row: `exer=2024; ident=20005550700012; ndept=103; lbudg=CTU MARTINIQUE; cbudg=1; ctype=701; nomen=M57;
siren=200055507; categ=CTU; bal=DEF; compte=73432; obnetcre=92876180.45; sc=92876180.45`.
→ **Octroi de mer régional (M57 73432) 2024 = €92,876,180** (net credit).

`fonction` values seen in 2024 look like `9312`, `93021`, `90052` (functional chapter 90x = investment, 93x =
operating, then the sub-function). The mapping to the M57 functional table must be validated with JM before any tag is
shown.

### 1.3 Who holds the seats — RNE (data.gouv.fr)

| File | Coverage | Fields |
|---|---|---|
| `elus-membres-assemblee-ma.csv` "membres des assemblées des collectivités à statut particulier" (resource `a595be27-…`, updated 11 Aug 2026), national, filtered on 972 at import | CTM, Corse, Guyane | `Code/Libellé de la collectivité à statut particulier`, `Code/Libellé de la section`, `Nom/Prénom de l'élu`, `Code sexe`, `Date de naissance`, `CSP`, `Date de début du mandat`, `Libellé de la fonction`, `Date de début de la fonction` |

What it contains for 972 (52 rows): sections **Sud 15, Nord 14, Centre 12, Fort-de-France 11**. Mandates start 2 Jul 2021
(49), with three later replacements (2023-06-15, 2025-04-04, and one 2021-02-07 that looks like a typing error for
2021-07-02). Functions: Président de l'assemblée (SALIBER Lucien), 4 Vice-présidents (DUVERGER, TELLE, MARIE-SAINTE,
DINAL since 2025-06-02), Président de l'organe exécutif (LETCHIMY Serge), and **only one** "Membre de l'organe exécutif"
(MERINE Félix).

Two problems follow:
- The Conseil exécutif has 9 members (president + 8) and RNE lists 2. The other 7 must come from the Assemblée's
  election délibération (2 Jul 2021) and later replacement délibérations.
- RNE keeps Letchimy and Mérine in the Assemblée file, but executive councillors leave the Assemblée when elected and are
  replaced by the next person on their list. The 52 rows therefore probably mix the 51 Assemblée seats with executive
  members. To be checked name by name.

Data minimisation: we do not keep date of birth or CSP, same as communes (`persons` has no such columns).

### 1.4 The CTM's own documents (collectivitedemartinique.mq)

No open data: the CTM organisation on data.gouv.fr has 0 datasets. Acts are PDFs published with WordPress Download
Manager. Licence: none stated. Public administrative documents are reusable under the CRPA (art. L321-1), to confirm
in the legal review.

| Listing | Items (site counter) | Index downloaded this sprint |
|---|---|---|
| Délibérations de l'Assemblée de Martinique `/downloads/deliberations-de-lassemblee-de-martinique/` | 1,808 | **done**: 1,808 rows, `data/raw/ctm/actes/ctm-deliberations-assemblee_2026-11-03.csv` |
| Arrêtés délibérés du Président du Conseil exécutif `/downloads/arretes-deliberes-du-president-du-conseil-executif/` | 4,304 | **not yet**: the run was stopped by the machine (low memory) during this job; rerun `--only ctm-arretes-deliberes-ce` |
| Arrêtés du Président du Conseil exécutif | 3,726 | not indexed (individual decisions; later) |
| Arrêtés du Président de l'Assemblée | 74 | not indexed (later) |

The index fetcher (in `scripts/ctm/sources.py`) reads the paged listings (`?cp=N`, 10 items per page, 1 request per
second; robots.txt only disallows `?nocache=`). It writes `numero; titre; page_url; wpdm_id; taille; page_liste`.
Number pattern `YY-NNN-K`, e.g. `26-276-1 Pacte de solidarités`. The list shows **no session date and no vote count**.
Dates and votes are inside the PDFs, or in the minutes of the plenary sessions.

What the index shows: the online list covers **2022–2026 only** (number prefixes 22: 1, 23: 590, 24: 393, 25: 487,
26: 301). Older délibérations are not online, so we ask the CTM for them. 1,772 of 1,808 titles carry a number with
"n°". The other 36 write "délib 26-214-1" or "Delib-23-2-1". The regex is now looser, and only 2 titles with typos at the source ("26-90 -1", "23-306-") still lack a number; numbers are re-parsed from `titre` at build.

**Budget documents found in the index** (PDF pages on the CTM site):

| Document | Délibération |
|---|---|
| Débat d'orientations budgétaires 2024 | 24-02-1 |
| Budget primitif 2024, budget principal | 24-49-1 (+ 24-49-5/6 AP/AE) |
| Compte administratif 2023, budget principal | 24-97-1 |
| Budget supplémentaire 2024 | 24-99-1 |
| Orientations budgétaires 2025 | 24-253-1 |
| Budget primitif 2025, budget principal | 24-322-1 |
| **Compte administratif 2024** (reconciliation R6) | **25-148-1** (+ affectation des résultats 25-196-1) |
| Orientations budgétaires 2026 | 25-315-1 |
| Budget primitif 2026, budget principal | 25-376-1 |
| Compte administratif 2025: principal, LTA, BGPISE, THD | 26-147-1 … 26-147-4 (+ 26-198-1) |
| Budget supplémentaire 2026: principal and annexes LTA, BGPISE, THD, **CTEBIOM** | 26-199-1 … 26-199-6 |
| DM2 2026 | 26-272-1 |
| Rapport de la CRC (communication to the Assemblée) | 26-253-1 |
| Avis de la CRC (2024) | 24-54-1, 24-103-1 (to read: budget control referral?) |

The 2022 CA is in 23-418-1. Budget annex names in the CA (LTA = Laboratoire, BGPISE = Irrigation, THD = NTIC) match
DGFiP. **CTEBIOM** is a new annex in 2026, not yet in DGFiP. The BP and ROB go in the forecast layer (`Prévisionnel`),
as for communes.
- **Plenary session calendar and minutes (procès-verbaux).** These are needed for the sessions and for recorded votes.
- **Composition pages:** "La Collectivité" lists the Assemblée bureau, the 9 executive councillors and some group
  photos. It shows **two contradictory blocks**: an older one (Fred CLIO 3rd VP; David ZOBDA in the Exécutif) and a newer
  one (David DINAL 3rd VP; Fernand ODONNAT in the Exécutif). RNE agrees with the newer one. **No portfolio is listed.**

### 1.5 Chambre régionale des comptes (ccomptes.fr)

| Report | Date | URL |
|---|---|---|
| Rapport d'observations définitives, CTM, exercices 2021 et suivants | délibéré 10 Jun 2026; to the Assemblée on 24 Sep 2026 | https://www.ccomptes.fr/sites/default/files/2026-09/RAN2026-0326A.pdf |
| Previous control, CTM 2015–2020 (cited in the 2026 report) | | to locate on ccomptes.fr (CRC Antilles-Guyane / Martinique) |

Figures read in the 2026 report, used in §3: CAF brute of the budget principal 2021–2024 (table 17), encours 2021 and
2025, capacité de désendettement (10 years in 2021, 20 in 2024), octroi de mer (€197M in 2021 → €224M in 2024), 19
satellites, délai global de paiement about 132 days (2025), 15 recommendations. The PDF was read for discovery only. A
`file_job` will archive it once PDFs have a job type (see "Shared changes").

### 1.6 CTM satellites (own accounts)

From `ofgl-base-epl-consolidee` and `ofgl-base-syndicats-consolidee` (972). Columns EPL: `exer, categ, nom_epl, siren,
outre_mer, reg_code, reg, dep_code, dep, categorie_epl, categorie_epl_abr, libelle_cacti_simplifie, lbudg, agregat,
montant_bp, montant_ba, montant_flux, montant, ctype, cacti, cstyp, exer_texte, ordre_affichage`.

| Body | SIREN | Type | Years | Link to the CTM |
|---|---|---|---|---|
| Martinique Transport (single transport authority) | 200075356 | EPIC/régie | 2018–2025 | likely (to confirm in statutes) |
| Régie des transports de Martinique | 887569812 | EPIC | 2020–2025 | likely |
| Office de l'eau Martinique | 289720054 | EPA | 2018–2025 | to confirm |
| IMFPA (formation professionnelle adultes) | 811421429 | EPIC | 2019–2025 | CTM satellite (CRC table 9) |
| Abattoirs de Martinique | 851078865 | EPIC | 2019–2025 | CTM satellite (CRC table 9) |
| Campus caribéen des arts | 200022127 | EPA | 2018–2025 | to confirm |
| Les Coulisses (centre des arts) | 934272972 | EPIC | 2025 | to confirm |
| MDPH Martinique | 130001456 | GIP | 2018–2025 | CTM (ex-Département competence) |
| CPIOF | 200052561 | EPA | 2019–2022 | to confirm |
| PNR Martinique | 259720019 | syndicat mixte | 2018–2025 | CTM member (to confirm) |
| SMTVD (déchets) | 259720084 | syndicat | 2018–2025 | to confirm |
| Syndicat mixte de transport | 259720092 | syndicat | 2018–2025 | to confirm |
| SMEM (énergie) | 259720100 | syndicat | 2018–2025 | to confirm |
| OTI CAESM, OTC CAP Nord | 832803209, 834068603 | EPIC | | **not CTM** (intercommunalities) |

Martinique Transport 2024 (OFGL): recettes de fonctionnement €155.8M, dépenses de fonctionnement €155.3M, dépenses
d'équipement €17.5M, encours €9.9M.

Not in OFGL: **Comité martiniquais du tourisme** (CTM grant €13.5M in 2023 per the CRC), SEMs/SPL. The CRC counts 19
satellites (CTM document "Situation des satellites en 2023, édition 2025"). That document is the reference list to
obtain. Martinique Transport also publishes GTFS on data.gouv.fr (Licence Ouverte), which is useful later but not budget data.

### 1.7 Term dates (to cite on the card)

- Elections 20 and 27 Jun 2021; Assemblée installed and Exécutif elected **2 Jul 2021** (RNE function start dates).
- End of term **March 2028**: loi n° 2021-191 du 22 février 2021, art. 1 (mandate of the assemblies of Guyane and
  Martinique elected in 2021 runs until March 2028). The exact date waits for the convocation decree. The Légifrance
  link goes into `sources` before the date reaches a card.
- Previous term: Dec 2015 – Jul 2021 (first CTM assembly). Dates to source the same way if we show it. See §1.8 for the terms before the CTM.

### 1.8 Before the CTM: Région + Département, and HATVP (checked 5 Nov 2026, read-only API calls)

The CTM has had two terms: **2015–2021** (first assembly, elected Dec 2015, CTM from 1 Jan 2016) and **2021–2028**.
Before 2016 there were two separate bodies: the **Conseil régional** (Région Martinique, SIREN 239720014) and the
**Conseil général** (Département de la Martinique, SIREN 229720016).

**Accounts, how far back:**

| Years | Source | Scope | Note |
|---|---|---|---|
| 2012–2025 | OFGL consolidated bases (already in JOBS) | Main + annex budgets | Primary |
| 2008–2011 | DGFiP "Comptes individuels des régions / des départements (fichier global)" on data.economie.gouv.fr (`…-regions-fichier-global-2008`, `-2009`, `-2010`, `-2011-2012`; same for `…-departements-…`) | **Main budget only**, DGFiP summary lines and ratios (`lbudg` "REG MARTINIQUE", "DEP MARTINIQUE" present every year) | Series break at 2012 (main budget vs consolidated). 2012 is in both: used to check the overlap |
| 2012–2025 | DGFiP nature-fonction balances (already in JOBS) | Account level | Functional detail |

Nomenclatures differ: Région M71, Département M52, CTM M57 (from 2016). Before 2008, nothing found on the open-data
portals.

**Elections (Ministère de l'Intérieur, data.gouv.fr, Licence Ouverte):** results files exist for the régionales 2004
and 2010, the cantonales 2004, 2008 and 2011 (the Conseil général was renewed by halves), the territoriales 2015
("Elections régionales 2015 et des assemblées de Corse, de Guyane et de Martinique", rounds 1 and 2) and 2021
(régionales 2021, rounds 1 and 2). They give lists or candidates, votes and seats, not group membership. The 2021 file
is the source for "élu(e) sur la liste X (2021)".

**Presidents and executives of past terms:** no open dataset found. RNE holds only current mandates. The HATVP open
list (`hatvp.fr/livraison/opendata/liste.csv`) has the current CTM officeholders who filed declarations (type
`ctsp`: Président du Conseil exécutif, Conseillers exécutifs, Président and VPs of the Assemblée, with filing dates),
but not the 2015–2021 term or the former Région/Département. Past presidents need a document per election:
installation délibérations (not online before 2022), the prefecture's Recueil des actes administratifs, or the
archives. Until then, past terms show accounts and election results, and the officeholders as MissingInfo.

**Downloaded 5 Nov 2026** (21 jobs in `scripts/ctm/sources.py`, all in the manifest; xls/xlsx kept as originals
next to a ';' CSV, sha256 in `<file>.source.json`):

| File | Martinique content checked |
|---|---|
| Comptes individuels Région / Département 2008, 2009, 2010, 2011–2012 | 1 row per year each ("REG MARTINIQUE", "DEP MARTINIQUE"), 120–158 columns |
| Régionales 2004, 2010 ("Elus" sheet) | **41 elected councillors** each (list, rank, name, outgoing flag) |
| Cantonales 2004, 2008, 2011 ("Elus" sheet) | 23, 22, 23 elected councillors (canton, name, score) = one half of the Conseil général each time |
| Territoriales 2015, round 2 ("Elus" sheet) | **51 elected councillors of the first CTM assembly**, with section, list and nuance |
| Territoriales 2015, candidatures rounds 1 and 2; results rounds 1 and 2 | Lists and votes |
| Régionales 2021, candidatures round 1; results rounds 1 and 2 (territory level, code 02) | Lists, votes, seats per list. **No "Elus" sheet and no round-2 candidates** on data.gouv.fr: for 2021, "élu(e) sur la liste X" comes from matching RNE names to the round-1 lists, and round-2 mergers are flagged as MissingInfo. Licence not specified on data.gouv.fr: the manifest records "aucune licence indiquée" |
| HATVP list | 73 rows with Martinique (all mandates), 17 with `type_mandat` "ctsp" (CTM): President and 8 executive councillors, Assemblée President and VPs |
| Conseil exécutif arrêtés délibérés index | 4,304 acts (2013, 2020–2026); 342 titles without an act number, to check |
| CRC report 2026 (PDF, `crc-ctm-2026-rapport-observations-definitives`) | Archived as published, 1,161,915 bytes |

Still missing: who was elected **president** (Conseil régional, Conseil général, first CTM Assemblée and Exécutif).
These are elected by the assembly, so they are not in the election files.

**HATVP for the current Exécutif:** it lists the "Conseiller(e) exécutif(ve) de Martinique" who filed: **all 8 executive councillors** (Casimirius, Di Geronimo, Mérine, Monrose, Odonnat, René-Corail, Termon, Thaly-Bardol) plus the President (Letchimy), with declaration dates
(including Odonnat, 2025-05-29), which RNE lacks. It can corroborate the composition from the délibérations (Q1).
Now a job (`hatvp-liste-declarations`); the first download on 5 Nov was truncated by hatvp.fr (10,718 of 13,673 rows) and was redone with the fixed core `fetch`.

---

## 2. Draft data model (core model + `ctm_` tables)

**Core rows written by the ctm loader** (as allowed by CLAUDE.md, for its own rows only):

```
institutions  ctm                     kind='ctm', name='Collectivité Territoriale de Martinique', code='200055507'
bodies        ctm-assemblee           kind='assemblee',        name='Assemblée de Martinique'
              ctm-conseil-executif    kind='conseil_executif', name='Conseil exécutif de Martinique'
seats         ctm-assemblee:president                 role='president'
              ctm-assemblee:vice-president-1..4       role='vice-president', rank=n
              ctm-assemblee:conseiller                role='conseiller'   (one seat, many mandates, like communes)
              ctm-conseil-executif:president          role='president'
              ctm-conseil-executif:conseiller-1..8    role='conseiller-executif', rank=n (order of the elected list)
persons       ctm:NOM:Prénom          (no birth date, no CSP)
terms         ctm-2015-2021, ctm-2021-2028   body_kind='assemblee'; first/last_full_year = 2016–2020, 2022–2027
              before 2016 (history, two institutions): institutions `region-972` (239720014) and `departement-972`
              (229720016); terms `reg972-2004-2010`, `reg972-2010-2015`; the Conseil général by renewal
              (`dep972-2008`, `dep972-2011`), because half the councillors were elected at each renewal
mandates      councillor: acquired='direct_election', start_date = mandate start (RNE)
              president / VP / Exécutif: acquired='indirect_election', function_start = date of the electing délibération
```
Same pattern as communes: one mandate per person on their highest seat, with `start_date` (mandate) and
`function_start` (function). When a VP or executive councillor changes, the old mandate gets an `end_date` and a new
row is added. Each row has a `source_id` (RNE) or a `source_url` (délibération PDF) and `verified` (JM review for rows
not from RNE).

**Section (electoral constituency)**: `seats.constituency` cannot hold it because the `conseiller` seat is shared.
Proposal: `ctm_mandate_details (mandate_id → mandates.id, section, list_name, list_rank, source_id)`.

**Portfolios: proposal `ctm_portfolios`, not the seat label.** Portfolios change during the term, one councillor can
hold several, and each needs its own source (the president's délégation arrêté):
```
ctm_portfolios (id, mandate_id → mandates.id, label_fr, competence_tags text[], start_date, end_date,
                act_number, source_url, source_id)
```

**Groups (official fact)**:
```
ctm_groups             (id, name, declared_on, source_url, source_id)
ctm_group_memberships  (person_id, group_id, role 'president'|'membre'|'apparente', start_date, end_date,
                        source_url, source_id)
```

**Budget** (mirrors `com_*`, so the shared card blocks and B1's code patterns can be reused):
```
ctm_metric_definitions (key, block, parent_key, label_fr, label_kreyol, source_rule, unit, on_card,
                        description_fr, display_order)        -- source_rule 'ofgl:<agregat>' | 'dgfip:<accounts>' | 'derived:…'
ctm_actuals            (entity_siren, year, metric_key, amount, amount_bp, amount_ba, amount_flux, eur_per_hab,
                        provisional, source_id)   PK (entity_siren, year, metric_key)
                       -- entity_siren: 200055507, and 239720014 / 229720016 for 2012–2015 (never summed silently)
ctm_functional_actuals (year, budget, fonction, nature_chapter, section 'F'|'I', amount, competence_tag, source_id)
ctm_entities           (siren, name, kind 'epl'|'syndicat'|'sem'|'association', link_to_ctm, link_source_url)
ctm_entity_actuals     (siren, year, agregat, metric_key, amount, provisional, source_id)
ctm_forecast_documents / ctm_forecast_figures   -- BP, BS, DM, DOB, ROB, CFU; 'Prévisionnel', as for communes
```

**Acts and votes**:
```
ctm_deliberations (number PK e.g. '26-276-1', body 'assemblee'|'conseil_executif', act_type 'deliberation'|'arrete_delibere',
                   title, session_date, page_url, pdf_sha256, competence_tags text[], source_id)
ctm_votes         (deliberation_number, for, against, abstention, not_voting, source_url)  -- only where the PV
                   records them; no per-person vote unless the PV names voters (to check)
```
Draft only. The migration (`<ts>_ctm_people_budget.sql`, add-only) comes in a later sprint after your approval.

---

## 3. Reconciliation plan (`scripts/ctm/reconcile.py`, next sprint)

The rule is the same as communes: our figures must match each published total within 1%. Any difference is reported in
the script output and never hidden.

| # | Our figure | Must match | Status found in discovery |
|---|---|---|---|
| R1 | OFGL `Epargne brute` `montant_bp` | CRC 2026, table 17, CAF brute of the budget principal | **Exact**: 2021 €83,382,291 · 2022 €128,172,823 · 2023 €93,274,038 · 2024 €48,568,574 |
| R2 | OFGL `Encours de dette` | CRC 2026 §3.4.1 | **Gap**: 2021 OFGL €849,427,970 vs CRC €744,427,970 (exactly −€105.0M); 2025 OFGL bp €1,006.2M vs CRC €977.1M (−2.9%). 2022–2024 not in the CRC text. To explain before display |
| R3 | `Encours / Epargne brute` (capacité de désendettement) | CRC: 10 years (2021), 20 years (2024) | 2024: 954.8 / 48.4 = 19.7 years ✓ |
| R4 | DGFiP account family **734** "Fiscalité spécifique … Outre-mer", budget principal | CRC: €197M (2021) → €224M (2024) | **Explained** (local DGFiP file): the CRC figure is the whole 734 family, not only octroi de mer. 734 = 73411 rhums + 7342 carburants + 73432 octroi de mer régional + 73433 transport + 7348 autres. 2021 €197.7M · 2024 €224.1M (2024: 73432 €92.9M, 7342 €92.0M, 7348 €35.9M, 73433 €2.0M, 73411 €1.3M) |
| R5 | OFGL aggregates (each, each year) | Sum of DGFiP balance accounts using the OFGL formula file | Mechanical check, all years 2019–2025 |
| R6 | OFGL 2024 recettes/dépenses réelles, per budget | Compte administratif 2024 voted by the Assemblée (délib 25-148-1), and CA 2025 (26-147-1…4) for the provisional year | PDF identified, to read |
| R7 | OFGL `Impôts et taxes` 2024 €727.4M | CRC "recettes fiscales 727 M€ (2024)" | ✓ (same figure) |
| R8 | 2015 Région + Département | Their own CA 2015 (optional) | Low priority |

Provisional rule: **2025 is shown as provisional** (final DGFiP balances end of December), same as communes.

---

## 4. Neutrality charter (CTM)

1. **The budget belongs to the institution, not to a person.** Budget blocks are titled "Collectivité Territoriale
   de Martinique", never "budget de [name]". The Exécutif proposes and the Assemblée votes; the card says so in one
   neutral sentence. Years are attributed to a term, not to a president.
2. **Group affiliation is shown as an official fact.** It is shown only when sourced (group declaration, Assemblée
   publication), dated, with its source. We do not label groups "majority / opposition" unless an official document
   does. No party label inferred from the press.
3. **Competence tags** (`routes`, `collèges & lycées`, `transport`, `action sociale`, `développement économique`, plus
   `eau`, `environnement`, `formation` if you agree) come from the M57 functional breakdown and from the subject of
   each délibération. Where a competence overlaps with communes (roads vs voirie communale; collèges/lycées vs écoles;
   social action vs CCAS; economic development vs EPCI; transport via Martinique Transport), the tag links to the
   commune cards with a short caveat: "Compétence partagée : la CTM et les communes / intercommunalités interviennent
   chacune sur une partie."
4. **No score, no ranking**, and no comparison of the CTM with a commune. We may compare the CTM with itself over time,
   and later with the other CTUs (Guyane, Corse), with a caveat. That needs your decision.
5. **Every figure has a source footnote** (dataset, year, retrieval date). 2025 is provisional. Forecast documents
   (BP, ROB) are labelled `Prévisionnel` and never charted with actuals.
6. **Missing or doubtful information is stated** (e.g. "Composition du Conseil exécutif : la liste officielle publiée
   présente deux versions ; source retenue : délibération n° …").
7. **Right of reply** for each organ: the President of the Assemblée and the President of the Conseil exécutif, plus
   each person shown on a seat.
8. Electoral period (Mar 2028): strict neutrality, no new opinion feature, and the card freezes figures to official
   sources.

---

## 5. Card draft (markdown wireframe, built on `src/components/card/Card.tsx`)

### 5.1 `/ctm` — Collectivité card

```
<CardShell>
┌ CardHeader ───────────────────────────────────────────────────────────────┐
│ [Portrait: CTM logo or Hôtel de la CTM photo, credited]                   │
│ Collectivité Territoriale de Martinique                                   │
│ Population (OFGL 2025) 364 991     Mandature  2 juil. 2021 → mars 2028    │
│ Assemblée  51 conseillers, 4 sections   Conseil exécutif  9 membres       │
│ note: Sources : OFGL d'après INSEE ; loi n° 2021-191 ; RNE (11/08/2026)   │
└───────────────────────────────────────────────────────────────────────────┘
[Two tiles → /ctm/assemblee   /ctm/conseil-executif]

FactBlock "Recettes 2024"          — Impôts et taxes (dont octroi de mer régional, TVA, TICPE),
                                     Concours de l'État (DGF…), subventions, ventes, emprunts ; € et €/hab.
   ¹ Source : OFGL, d'après DGFiP — Comptes consolidés des régions, 2024, consulté le 03/11/2026
FactBlock "Dépenses 2024"          — personnel, allocations (RSA, APA, PCH), achats, subventions, intérêts,
                                     équipement ; € et €/hab.   ¹
FactBlock "Épargne, dette"          — épargne brute, encours, capacité de désendettement (années), 2016 → 2025
                                     (2025 provisoire)   ¹ ; CRC rapport 2026 cited as context
FactBlock "Par compétence"          — dépenses par fonction M57 with tags → links to commune cards
   ² Source : DGFiP — Balances comptables nature-fonction 2024
FactBlock "Fiscalité ultramarine"   — total compte 734 by year (matches the CRC), split: octroi de mer régional
                                     (73432), taxe sur les carburants (7342), autres (7348, 73433, 73411)   ²
FactBlock "Organismes satellites"   — Martinique Transport, Office de l'eau… own budgets, € (not added to CTM)
   ³ Source : OFGL — Comptes consolidés des EPL / syndicats
FactBlock "Avant 2016"              — Région + Département shown side by side, never summed silently
MissingInfo  — e.g. "compte administratif 2024 non encore rapproché", "écart d'encours 2021 avec la CRC (105 M€) en cours d'analyse"
Caveat       — "La CTM exerce les compétences d'un département et d'une région : ses montants ne se comparent pas
                à ceux d'une commune. Certaines compétences sont partagées avec les communes et intercommunalités."
             — "Passage M57 en 2016 ; 2016 = première année de la CTM."
RightOfReply — text "Le Président du Conseil exécutif et le Président de l'Assemblée peuvent demander une
               rectification ou publier une réponse." subject "Droit de réponse — CTM"
</CardShell>
```

### 5.2 `/ctm/assemblee`

```
CardHeader  Assemblée de Martinique · Président : Lucien SALIBER (depuis 2 juil. 2021)
            Vice-présidents 1–4 · 51 conseillers · 4 sections   note: Source : RNE ; délibération n° …
FactBlock "Composition"         — by section (Sud, Nord, Centre, Fort-de-France): names, function, start date ¹ RNE
FactBlock "Groupes"             — official group names and members, dated   ² déclaration / publication CTM
FactBlock "Séances"             — sessions by year, number of délibérations, link to each PDF  ³ CTM actes
FactBlock "Délibérations par compétence" — counts by tag (no judgement), latest 10 with links
FactBlock "Votes enregistrés"   — only for acts whose minutes record the votes; otherwise MissingInfo
MissingInfo, Caveat ("Un conseiller élu au Conseil exécutif quitte l'Assemblée et est remplacé.")
RightOfReply  subject "Droit de réponse — Assemblée de Martinique"
```

### 5.3 `/ctm/conseil-executif`

```
CardHeader  Conseil exécutif de Martinique · Président : Serge LETCHIMY (depuis 2 juil. 2021) · 8 conseillers exécutifs
FactBlock "Composition et délégations" — each member: portfolio(s) + competence tags + act number   ¹ arrêté / délibération
FactBlock "Arrêtés délibérés"   — counts per year and per tag, links   ² CTM actes
FactBlock "Budget proposé / exécuté" — link to the Collectivité blocks (the budget is the institution's)
MissingInfo  — "RNE ne liste que 2 des 9 membres ; composition établie d'après la délibération n° …"
RightOfReply  subject "Droit de réponse — Conseil exécutif de Martinique"
```

Person pages (`/ctm/elus/[id]`), if you want them: the seat history only, no figures attributed to the person.

---

## 6. Open questions for JM

### Decisions (JM, 3 Nov 2026)

- **Q1 composition:** yes. Délibérations are the source for the Conseil exécutif, RNE for the Assemblée; every
  disagreement is listed on the card (MissingInfo).
- **Q2 portfolios:** yes, dedicated `ctm_portfolios` table.
- **Q4 debt:** shown now with OFGL figures and a caveat stating the gap with the CRC (2021 −€105.0M, 2025 −€29.1M),
  with the CRC report linked. R2 stays open in the reconciliation script.
- **Q5 octroi de mer:** confirmed. one block "Fiscalité ultramarine" = M57 account 734, which reconciles with
  the CRC (R4), split by account, with "octroi de mer régional" always meaning 73432 only. The CTM's role in the
  communes' octroi de mer (rates, FRDE) is a later sprint.
- **Q6–Q12 (JM, 5 Nov 2026): the suggestions are adopted.** Q6: the card starts in 2016, with a separate "Avant la
  CTM" section showing the Région and the Département side by side, never summed, as far back as §1.8 allows (2008).
  Q7: the CRC list of 19 satellites is the reference, OFGL figures where they exist, short list with links on the card,
  never added to the CTM. Q8: recorded votes later, budget votes first. Q9: PDF job type (shared PR), then Supabase
  Storage, only for cited PDFs. Q10: JM or a Kréyòl speaker picks the labels from a short proposed list. Q11: Guyane
  and Corse later, separate page, per inhabitant, with a caveat. Q12: same rule as the mayors, link to the CTM's PDF
  where possible, both in the pre-launch legal review.
- **Q3 groups:** show "élu(e) sur la liste X (2021)" from the Ministère de l'Intérieur results, labelled as the
  electoral list. A group is shown only once a CTM document sources it; ask the CTM for the group declarations in
  parallel. Sources checked below.

### Sources for political groups (checked 3 Nov 2026)

| Source | What it gives | Status |
|---|---|---|
| Group declarations kept by the Assemblée (CGCT: groups are formed by a declaration to the president) | Official group name, members, president | Not published online. Ask the CTM (or CADA request) |
| Délibérations index 2022–2026 | Changes to committee membership (25-106-4, 26-89-1, 26-195-1…), règlement intérieur | No délibération on forming the groups. 2021 délibérations not online |
| Plenary minutes (procès-verbaux) | Groups as named in debate, explanations of vote | PDFs, not indexed yet |
| CTM site "La Collectivité" | Some group photos and names | Undated, already contradictory for the bureau: context only |
| Ministère de l'Intérieur, 2021 territorial election results (data.gouv.fr) | The list each councillor was elected on, and its nuance | Official, dated; it is the electoral list, not the group. Dataset to locate and add to JOBS |
| Press | | Not a source for the card |


1. **Composition source of truth.** RNE is incomplete for the Exécutif, and the CTM site shows two versions. Do you
   agree to use the délibérations (2 Jul 2021 election + replacements) as the source for the Exécutif, with RNE for the
   Assemblée and every disagreement listed in MissingInfo?
2. **Portfolios** in a `ctm_portfolios` table (proposed) rather than in the seat label: OK? Do we have a source for the
   délégations (arrêtés du Président du Conseil exécutif)? Should we index the 3,726 arrêtés to find them?
3. **Groups:** what official source do you accept (group declarations filed with the Assemblée, the CTM site)?
   Should we show "majorité / opposition" at all?
4. **Debt gap with the CRC** (2021: €105M; 2025: €29M). Do we show OFGL with a caveat now, or hold the debt block
   until it is explained?
5. **Octroi de mer:** show only account 73432 "octroi de mer régional" (€92.9M in 2024), or try to rebuild the CRC's
   €224M "produits liés à l'octroi de mer"? Also, do we show the CTM's role in the communes' octroi de mer (rates voted by
   the Assemblée, FRDE)? That would link to the communes' 73431/7373 figures.
6. **Pre-2016 history:** show Région + Département 2012–2015 side by side, or start the card in 2016?
7. **Satellites:** which list do we use (the CTM's "Situation des satellites", 19 bodies), and do we show them on the card
   or on a separate page? CMT and SEMs are not in OFGL.
8. **Recorded votes:** worth a sprint to read the minutes (PDF) for per-group votes, or counts only?
9. **PDF archiving** (délibérations, BP, CFU, CRC): add a PDF job type to `scripts/core` (shared PR) or archive in
   Supabase Storage as communes do for forecasts?
10. **Kréyòl labels** for the CTM card (e.g. "Lasanblé Matinik", "Konsèy egzékitif")? Only agreed labels.
11. **Comparison with Guyane and Corse** (the other CTUs, same OFGL base): allowed later with a caveat, or never?
12. **Legal:** reuse of the CTM PDFs (no licence stated) and of officeholder photos from the CTM site. Same rule as the
    mayors (credit + takedown)?

---

## Shared changes proposed (separate PRs to `dev`, not in this branch)

- `scripts/core/download_sources.py`: the manifest writes `licence = "Licence Ouverte 2.0"` for every job. The CTM acts
  index has no stated licence, so the manifest should take a per-job `licence` (default Licence Ouverte 2.0).
- `scripts/core/fetching.py`: a job type for **PDF** files (no CSV row count; sha256 + page count), for CRC reports,
  délibérations and budget documents.
- `messages/*/common.json`: generic labels "Prévisionnel", "Compétence partagée", "Source retenue".
- Core `terms`: CTM terms need ids that cannot clash with municipal ones (`ctm-2021-2028`), no schema change.
- Home page (`src/app/page.tsx`): link to `/ctm` once the card exists.
- `docs/` methodology page: CTM section (competences, pre-2016, satellites) when the card ships.
