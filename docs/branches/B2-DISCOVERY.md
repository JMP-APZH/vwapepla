# B2 — Parlementaires : discovery (sprint 1, 3 Nov 2026)

Scope: Martinique's **4 deputies** (Assemblée nationale, one per circonscription) and **2 senators**.
Status: discovery only. No app code, no migration. Everything below comes from files downloaded by
`python -I scripts/core/download_sources.py --domain parlement` on **3 Nov 2026** (sources: `scripts/parlement/sources.py`,
manifest: `data/raw/parlement/manifest.json`, gitignored), unless marked *not downloaded*.

---

## 0. Current officeholders (verified from official data, 3 Nov 2026)

**Assemblée nationale: XVIIe législature** (mandates started 7 Jul 2024, general elections after the June 2024
dissolution; no `dateFin`, so still current). Source: AN `AMO30` (historique des députés), cross-checked with RNE `elus-deputes-dep.csv`.

| Circ. | Deputy | AN uid | Group (official label, since 19 Jul 2024) | Committee (current) | Also | RNE |
|---|---|---|---|---|---|---|
| 1re | Jiovanny **William** | PA720992 | Socialistes et apparentés (SOC), *membre apparenté* | Commission des lois (since 29 Oct 2026) | Délégation aux outre-mer | ✔ (start 2024-07-08) |
| 2e | Marcellin **Nadeau** | PA795820 | Gauche Démocrate et Républicaine (GDR) | Développement durable et aménagement du territoire, *secrétaire* | Délégation aux outre-mer | ✔ |
| 3e | Béatrice **Bellay** | PA842211 | Socialistes et apparentés (SOC) | Affaires sociales (since 27 Oct 2026) | Délégation aux outre-mer, *secrétaire* | ✔ |
| 4e | Jean-Philippe **Nilor** | PA610654 | La France insoumise – Nouveau Front Populaire (LFI-NFP) | Affaires sociales (since 30 Oct 2026) | Délégation aux outre-mer | ✔ |

William, Nadeau and Nilor were also deputies of the same circonscription in the XVIth legislature (2022–2024; Nilor
since 2012). 3e circ. in the XVIth: Johnny Hajjar (PA795828). AMO30 holds every Martinique deputy since 2002 (XIIth leg.; see §1bis).

**Sénat** (Martinique: 2 seats, elected 24 Sep 2023 by indirect suffrage, mandate from 2 Oct 2023, next renewal Sept 2029
for this series). Source: Sénat `ODSEN_GENERAL`, `ODSEN_ELUSEN`, `ODSEN_HISTOGROUPES`, cross-checked with RNE `elus-senateurs-sen.csv`.

| Senator | Matricule | Group (current) | Committee (from 6 Oct 2026) | Since | RNE |
|---|---|---|---|---|---|
| Catherine **Conconne** | 19295A | Socialiste, Écologiste et Républicain (SER) | Affaires sociales | 2017 (re-elected 2023) | ✔ |
| Frédéric **Buval** | 21096Q | Rassemblement des démocrates, progressistes et indépendants (RDPI), *apparenté* | Affaires étrangères, *vice-président* | 2023 | ✔ |

Notes from the data (to show as facts, not to interpret):
- Group codes differ between Sénat files (`ODSEN_GENERAL`: SER / RDPI; `ODSEN_HISTOGROUPES`: internal codes SOC / LREM).
  The card shows the **full official name**, never the internal code.
- Committee memberships changed in Oct 2026 in both chambers (new dates in the files at the start of the 2026–27
  session): committee membership is always shown with its dates.
- RNE gives deputies' start as 2024-07-08, AN as 2024-07-07: we use AN (the chamber) and keep RNE as cross-check only.
- RNE files were last updated 11 Aug 2026 (data.gouv.fr metadata): fine for these 6, but not a live source.
- Local offices (Sénat `ODSEN_MANDAT_LOCAL`): Conconne holds a **current** seat at the Assemblée de Martinique (CTM);
  Buval is a former mayor of La Trinité (past offices flagged `Mandat en cours = NON`). → cross-domain link, see §2.4.

---

## 1. Source inventory

All official sources below are **Licence Ouverte / Etalab 2.0** (AN: `/licence-ouverte-open-licence`; Sénat:
data.senat.fr/licence, attribution "Sénat" + date of last update; HATVP: Etalab 2.0; RNE: Etalab 2.0).
"Kept" = rows written by our filter (Martinique members only), on 3 Nov 2026.

### 1.1 Assemblée nationale — data.assemblee-nationale.fr (official)
Base: `https://data.assemblee-nationale.fr/static/openData/repository/17/…`. All files are zipped JSON (one JSON file per
object), regenerated **daily** (Last-Modified 3 Nov 2026 for every file). XML versions exist with the same content.

| Job id | File | Size (zip) | Coverage of Martinique | Kept | Fields we keep (actual source names) |
|---|---|---|---|---|---|
| `an-deputes` | `amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_…historique.json.zip` (3 175 acteurs, 10 819 organes, 59 déports) | 13.7 MB | All deputies elected in 972 since 2002, every mandate | 878 mandate rows | `uid`, `etatCivil.ident.{civ,prenom,nom}`, `uri_hatvp`; per mandate: `uid`, `typeOrgane` (ASSEMBLEE, GP, COMPER, DELEG, GE, GA, CMP, MISINFO, ORGEXTPARL, PARPOL…), `legislature`, `dateDebut`, `dateFin`, `infosQualite.{codeQualite,libQualite}`, `organes.organeRef`, `election.lieu.{region,departement,numDepartement,numCirco}`, `election.causeMandat`, `election.refCirconscription`, `mandature.{datePriseFonction,causeFin,placeHemicycle}`, `suppleants.suppleant.suppleantRef`. **Dropped** (minimisation): birth date/place, profession, addresses, e-mails. |
| `an-organes` | same zip, `organe/` | — | Groups, committees, delegations, circonscriptions referenced by those mandates | 257 | `uid`, `codeType`, `libelle`, `libelleAbrege`, `libelleAbrev`, `viMoDe.{dateDebut,dateFin}`, `legislature`, `positionPolitique`, `couleurAssociee` |
| `an-deports` | same zip, `deport/` | — | Recusals declared by deputies (conflict of interest) | 0 (none for Martinique members) | raw record: `uid`, `legislature`, `refActeur`, `dateCreation`, `portee`, `lecture`, `instance`, `cible.{type,referenceTextuelle}`, `explication` |
| `an-scrutins-17` | `loi/scrutins/Scrutins.json.zip` (9 578 scrutins, n° 1–9 578, none missing; 8 Oct 2024 → 2 Nov 2026) | 29.6 MB | All public votes of the XVIIth, **nominative positions** per group. A deputy who did not vote is simply absent from the lists | 3 552 (scrutin × Martinique deputy) | `uid`, `numero`, `dateScrutin`, `sessionRef`, `seanceRef`, `typeVote.{codeTypeVote,libelleTypeVote,typeMajorite}` (SPO ordinaire, SPS solennel, MOC motion…), `sort.{code,libelle}`, `titre`, `objet.{libelle,dossierLegislatif.dossierRef,dossierLegislatif.libelle,referenceLegislative}`, `demandeur.texte`, `syntheseVote.*`, + per Martinique deputy: `acteurRef`, `mandatRef`, `position` (pour/contre/abstention/nonVotant), group `organeRef` + `positionMajoritaire`, `parDelegation`, `causePositionVote`, `miseAuPoint` |
| `an-scrutins-17-liste` | same zip | — | Every scrutin, metadata only (national): the vote rule runs on all of them | 9 578 (SPO 9 481, SPS 74, MOC 23) | same scrutin columns, no positions |
| `an-amendements-17` | `loi/amendements_div_legis/Amendements.json.zip` (deposits 18 Sep 2024 → 2 Nov 2026) | 352 MB | Every amendment of the XVIIth | 34 430 (as author or co-signatory) | `uid`, `identification.{numeroLong,numeroOrdreDepot}`, `texteLegislatifRef`, `examenRef`, `signataires.auteur.{acteurRef,groupePolitiqueRef,typeAuteur}`, `signataires.libelle`, cosignataires, `pointeurFragmentTexte.division.articleDesignation`, `cycleDeVie.{dateDepot,dateSort,sort}`, `etatDesTraitements` + our `role` (auteur / cosignataire). Amendment text left at the source (link). |
| `an-dossiers-17` | `loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip` | 11.1 MB | All legislative files of the XVIIth (national, needed for the vote rule; 196 of them opened in earlier legislatures) | 3 390 | `uid`, `titreDossier.{titre,titreChemin,senatChemin}`, `procedureParlementaire.{code,libelle}`, `initiateur…acteurRef`, `indexation` |
| `an-questions-ecrites-17` | `questions/questions_ecrites/Questions_ecrites.json.zip` | 51 MB | Written questions | 149 (73 answered) | `uid`, `identifiant.{numero,legislature}`, `type`, `auteur.identite.acteurRef`, `auteur.groupe.abrege`, `indexationAN.{rubrique,teteAnalyse,analyses.analyse}`, `minInt.abrege`, `minAttribs…`, dates JO question/réponse, `cloture.*` |
| `an-questions-orales-17` | `questions/questions_orales_sans_debat/…json.zip` | 3.3 MB | Oral questions without debate | 4 | same |
| `an-questions-gouvernement-17` | `questions/questions_gouvernement/…json.zip` | 5.6 MB | Questions au Gouvernement (QAG) | 15 | same |

Not taken yet (documented): `AMO10` (active deputies only, subset of AMO30), comptes rendus (débats), agenda/réunions
(the AN "Réunions" files may list participants of committee meetings: **not checked yet**, sprint 2; nothing equivalent at the Sénat), rapports (in
dossiers législatifs as `actesLegislatifs`), collaborateurs CSV (out of scope), XIVe–XVIe archives (previous
terms; paths and schema differ, see §1bis).

### 1.2 Sénat — data.senat.fr (official)
| Job id | File | Format | Coverage | Kept | Fields (actual) |
|---|---|---|---|---|---|
| `senat-senateurs` | `data/senateurs/ODSEN_GENERAL.csv` | CSV, cp1252, `%` comment lines with the SQL query on top | Every senator since 1946 | 11 (current + former for Martinique) | `Matricule`, `Qualité`, `Nom usuel`, `Prénom usuel`, `État` (ACTIF/ANCIEN), `Groupe politique`, `Type d'app au grp politique`, `Commission permanente`, `Circonscription`, `Fonction au Bureau du Sénat`, (also birth/death date, e-mail, PCS: not loaded) |
| `senat-mandats-senat` | `ODSEN_ELUSEN.csv` | CSV | Senate mandates | 19 | `Identifiant mandat`, `Date d'élection`, `Date de début de mandat`, `Motif début de mandat`, `Date de fin de mandat`, `Motif fin de mandat` |
| `senat-histogroupes` | `ODSEN_HISTOGROUPES.csv` | CSV | Group history | 20 | `Code du groupe politique`, `Nom court du groupe politique`, dates d'appartenance, `Nom court fonction`, dates de fonction |
| `senat-commissions` | `ODSEN_COMS.csv` | CSV | Committees (permanent, enquête, spéciale, CMP, missions) | 68 | `Nom commission`, `Type commission`, dates d'appartenance, `Fonction`, dates de fonction |
| `senat-delegations` | `ODSEN_OFFDEL.csv` | CSV | Delegations / offices | 24 | `Nom organisme`, `Type commission`, dates, `Fonction` |
| `senat-organismes` | `ODSEN_MEMOEP.csv` | CSV | Seats in extra-parliamentary bodies (ARS board, CDCI, DETR commission…) | 34 | `Code organisme`, `Organisme`, `Début`, `Fin`, `Titulaire`, `Mode de désignation` |
| `senat-mandats-locaux` | `ODSEN_MANDAT_LOCAL.csv` | CSV | Local offices (current and past) | 33 | `Type de mandat`, `Fonction`, `Organisme`, `Mandat en cours` (no dates) |
| `senat-questions-1an` | `data/questions/questions-depuis-un-an.csv` | CSV | Written/oral/QG questions of the last 12 months | 9 | `Sort`, `Nature` (QE/QOSD/QG), `Numéro`, `Référence`, `Titre`, `Nom`, `Prénom`, `Circonscription`, `Groupe`, `Date de publication JO`, `Ministère de dépôt`, `Ministère de réponse`, `Date de réponse JO`, `Thème(s)`, `URL Question` |

Not downloaded (format): **Ameli** (amendments, `data/ameli/ameli.zip`, 155 MB PostgreSQL 8.4 dump), full **Questions**
base (`data/questions/questions.zip`, 283 MB dump), **Dosleg** (dump). They can be read without a database by streaming the
`COPY … FROM stdin` blocks of the dump in Python and filtering on the senator ids: planned for sprint 2.
**Senate votes**: data.senat.fr publishes **no scrutins dataset**. Nominative positions of public ballots exist on
senat.fr (one HTML page per scrutin) and partially in Dosleg. Open question Q4.

### 1.3 RNE — Répertoire national des élus (data.gouv.fr, Ministère de l'Intérieur)
| Job id | Resource | Kept | Fields |
|---|---|---|---|
| `rne-deputes` | `/datasets/r/1ac42ff4-…` `elus-deputes-dep.csv` | whole file (577 rows; 4 for 972) | `Code du département`, `Code de la collectivité à statut particulier`, `Code/Libellé de la circonscription législative` (97201–97204), `Nom/Prénom de l'élu`, `Code sexe`, `Date de naissance`, CSP, `Date de début du mandat` |
| `rne-senateurs` | `/datasets/r/b78f8945-…` `elus-senateurs-sen.csv` | whole (348; 2 for 972) | same without circonscription. Martinique is coded as *collectivité à statut particulier* 972 (département code empty). |
Used only to cross-check names and for `sex` (correct titles: "députée", "sénatrice").

### 1.4 HATVP — Haute Autorité pour la transparence de la vie publique (official)
| Job id | File | Kept | Fields |
|---|---|---|---|
| `hatvp-liste` | `https://www.hatvp.fr/livraison/opendata/liste.csv` (national, 3.3 MB, updated as declarations are published) | whole file (13 673 rows; 29 for the 6 members: DIA, DIAM, DSP, DSPM) | `civilite`, `prenom`, `nom`, `classement`, `type_mandat`, `qualite`, `type_document` (di = intérêts, dsp = situation patrimoniale…), `departement`, `date_publication`, `date_depot`, `nom_fichier`, `url_dossier`, `open_data`, `statut_publication`, `id_origine`, `url_photo` |
Two DSPM (modified asset declarations) of the senators are "Déclaration déposée – publication en préfecture à venir":
shown as such. hatvp.fr cuts Python downloads every ~100 kB and then refuses them while serving curl normally: the job
resumes with `Range` and falls back to the system `curl` (same URL, still scripted and hashed). Contents of
declarations: `declarations.xml` (large XML; job to add in sprint 2). Every declaration of interests (DIA/DIAM) of
the 6 members has an open-data XML (`open_data` column, checked 5 Nov 2026). **Decision Q7**: the card shows the link
(`url_dossier`; AN `uri_hatvp` gives the same link for deputies), type and dates, **and the declared outside activities
from the latest declaration of interests**, as published, dated and sourced. **Asset declarations (DSP/DSPM): link and
dates only**, never their contents; the reuse rules for declaration contents go to the pre-launch legal review.

### 1.5 Légifrance
Not needed in sprint 1: laws promulgated are referenced from AN/Sénat dossiers (`titreChemin`, JO links). Later: link the
final law (JORF NOR) on vote rows via the DILA LEGI/JORF open data if JM wants "texte promulgué".

### 1.6 Secondary (clearly labelled, *not downloaded*)
| Source | URL | Licence | Why not now |
|---|---|---|---|
| NosDéputés.fr (Regards Citoyens) | `https://www.nosdeputes.fr/deputes/enmandat/json`, `/synthese/data/json`, `/{slug}/json` | **ODbL** (data), CC-BY-SA (content) | ODbL share-alike would apply to our derived database; the shared engine stamps every file "Licence Ouverte 2.0" (would be a false source claim). Their "activity" synthesis (weeks of presence, interventions) is a *derived* metric: neutrality caveat. |
| NosSénateurs.fr | `https://www.nossenateurs.fr/…/json` | ODbL | same |
Useful as **verification** only (compare our counts with theirs), never displayed as primary.

---

## 1bis. Historical depth and cut-off (validated by JM, 5 Nov 2026)

Parliamentary data runs by **legislature / Senate term**, not by calendar year: counts are always given per term with
start and end dates, never per year (no "partial year" problem, but partial *terms*: see breaks).

| Source | Earliest complete data for Martinique | Quality breaks / partial periods |
|---|---|---|
| AN `AMO30` (identity, seats, groups, committees, functions) | **XIIth legislature, 19 Jun 2002.** The page says "since the XIth (1997)" but the file holds **no XIth seat at all** (0 ASSEMBLEE mandates for leg. 11, checked). XIIth: 572 seat mandates nationally for 577 seats (slightly incomplete; the 4 Martinique seats are present) | Committee rows for Martinique members grow from 4 (XIIth) to 158 (XVIIth): older committee history is thinner. XIIth: 3e circ. by-election 1 Jun 2003 (Edmond-Mariette). XVth: 2e circ. Azerot → Kéclard-Mondésir (23 Apr 2018, incompatibility); 3e circ. Letchimy left 1 Jul 2021 with no successor row (vacant to Jun 2022? to verify). XVIth cut short by the dissolution (19 Jun 2022 → 9 Jun 2024). |
| AN scrutins | **XIVth, 2012** (`repository/14/loi/scrutins/Scrutins_XIV.json.zip`), XVth `…/15/…/Scrutins_XV.json.zip`, XVIth/XVIIth `Scrutins.json.zip` | File names and paths differ per legislature; XIV/XV schema to check in sprint 2. XVIIth: first public scrutin 8 Oct 2024 (none Jul–Sep 2024). Only public ballots are recorded, never show-of-hands votes. |
| AN amendments, questions (QE, QOSD, QAG), dossiers | **XIVth, 2012** (pages `archives-anterieures/archives-14e`, `-15e`); XVIth under `repository/16/…` (amendments 363 MB) | Archive paths differ from current ones. |
| AN déports | 59 nationally in the file, 0 for Martinique | — |
| Sénat `ODSEN_*` (identity, mandates, groups, committees, delegations, bodies) | **1946** for mandates and groups (11 Martinique senators since) | Local offices (`ODSEN_MANDAT_LOCAL`) have **no dates**, only "en cours" yes/no. Old group rows have no start date. |
| Sénat questions | Full base since **1978** (PostgreSQL dump, not loaded); the CSV extract covers the last 12 months only | Downloaded extract: 9 questions. |
| Sénat amendments (Ameli) | Séance since **Oct 2001**, committee since **Oct 2010** | Dump only, not loaded yet. |
| Sénat votes | **None** in open data | — |
| HATVP list | **Current mandates only**: deputies' declarations from 2024, senators' from 2023 (earliest deposit for any parliamentarian in the file: 3 Apr 2023) | Declarations of earlier mandates are not in the open-data list. |
| RNE | **Current officeholders only** (snapshot, updated 11 Aug 2026) | No history: cross-check only. |

**Proposal (to validate):**
- **Deputies: full card from the XIVth legislature (20 Jun 2012); identity-only for the XIIth–XIIIth (2002–2012)**
  (seat, dates, group, committees as published, with "activité non publiée en open data avant 2012"); nothing before 2002,
  stated as "données non disponibles".
- **Senators: full card from the term starting 1 Oct 2011** (first term fully covered by Ameli in séance *and* committee
  and by the questions base); activity = questions + amendments only (no votes). **Identity-only before 2011**
  (mandates since 1946, groups, committees).
- **HATVP: current mandate only**, with a link to the person's HATVP page.
- **Build order:** sprint 2 loads the current terms (XVIIth; Senate 2023) first; previous terms (AN XIV–XVI, Senate
  2011/2017) in a later sprint once archive formats are checked. For the 4 current deputies this later covers the XVIth
  term of William, Nadeau and Nilor, and Nilor's XIVth–XVth terms; for the senators, Conconne's 2017 term.

---

## 2. Draft data model (no migration this sprint)

### 2.1 Core rows (shared tables, B2's own rows)
```
institutions  assemblee-nationale  kind=assemblee_nationale  name="Assemblée nationale"
              senat                kind=senat                name="Sénat"
bodies        assemblee-nationale-17   institution=assemblee-nationale  kind=legislature  name="XVIIe législature"
              (assemblee-nationale-16 … for previous terms)
              senat-hemicycle          institution=senat                kind=assemblee    name="Sénat"
seats         assemblee-nationale-17:depute-972-1 … -4   role=depute    constituency="972-1" … label_fr="Député de la 1re circonscription de la Martinique"
              senat-hemicycle:senateur-972  rank=1,2     role=senateur  constituency="972"   label_fr="Sénateur de la Martinique"
persons       parl-an:PA720992 …   (stable AN uid)  ·  parl-sen:19295A … (Sénat matricule)
              sex from RNE `Code sexe`; no birth date.
mandates      deputies: acquired=direct_election, start=dateDebut, end=dateFin, source=an-deputes, source_url=AN fiche
              senators: acquired=indirect_election, start=Date de début de mandat, source=senat-mandats-senat
              (a by-election / replacement by suppléant = new mandate row on the same seat)
terms         body_kind=legislature: '17' 2024-07-07 → (open); body_kind=senat: series 2023–2029
sources       one row per manifest entry (domain='parlement')
```
Senate seats are not numbered (2 senators for one constituency): `rank` only to satisfy the unique key.

### 2.2 `parl_` tables (draft)
| Table | Grain | Key columns | Source |
|---|---|---|---|
| `parl_organes` | group, committee, delegation (both chambers) | `id` (AN `PO…` / `sen:<code>`), `chamber`, `kind` (GP, COMPER, DELEG, CE, CMP…), `label_fr`, `short`, `start`, `end` | an-organes, senat-* |
| `parl_memberships` | person × organe × period × function | `person_id`, `organe_id`, `function` (membre, apparenté, secrétaire, vice-président…), `start`, `end`, `source_id` | an-deputes, senat-histogroupes/commissions/delegations |
| `parl_texts` | dossier législatif | `id` (AN `DLR…`), `title`, `procedure`, `url`, `tags` (computed by the published rule, §3.3), `source_id` | an-dossiers |
| `parl_scrutins` | one public vote | `id` (`VTANR5L17V…`), `chamber`, `date`, `type` (ordinaire/solennel/motion), `title`, `text_id`, `result`, `pour/contre/abst`, `selected_by` (rule id, §3.3), `source_id` | an-scrutins |
| `parl_votes` | scrutin × person | `scrutin_id`, `person_id`, `position` (pour/contre/abstention/non-votant), `by_delegation`, `group_id`, `group_position`, `mise_au_point` | an-scrutins |
| `parl_amendments` | amendment × person | `id`, `person_id`, `role` (auteur/cosignataire), `text_id`, `article`, `filed`, `outcome` (adopté, rejeté, retiré, tombé, irrecevable, non soutenu), `url` | an-amendements (Ameli later) |
| `parl_questions` | question | `id`, `person_id`, `chamber`, `kind` (QE, QOSD, QAG/QG), `number`, `title/rubrique`, `ministry`, `asked`, `answered`, `status`, `url` | an-questions-*, senat-questions |
| `parl_interest_declarations` | HATVP declaration (metadata; DI items in `parl_interest_items`: `declaration_id`, `section`, `label`, `period`, `amount`, as published) | `person_id`, `doc_type` (DI, DSP, DIA…), `deposited`, `published`, `status`, `url` | hatvp-liste |
| `parl_recusals` | déport | `person_id`, `target`, `scope`, `date`, `explanation` | an-deports |
Every row carries `source_id` (→ `sources`) like the commune domain. Counts shown on the card are **views** over these
tables (no stored "score").

### 2.3 Build pipeline (sprint 2)
`scripts/parlement/build.py` reads `data/raw/parlement/**` → `data/build/parlement/<table>.json`;
`scripts/parlement/tables.py` lists load order; `python -I scripts/core/load_supabase.py --domain parlement`.
Migration `supabase/migrations/<ts>_parl_init.sql` (add-only, RLS public read) after JM's approval.

### 2.4 Cross-domain identity (open question Q1)
The same human can hold a parliamentary seat and a local office (Conconne: Assemblée de Martinique, CTM = B3; Buval:
former mayor of La Trinité = B1 history; deputies may be or have been municipal councillors). Ids are built per domain
(`com-97230:BUVAL:Frédéric`, `parl-sen:21096Q`), so the same person exists twice. Options:
- **A. `person_links` core table** (`person_id`, `same_as`, `evidence_url`, `verified_by`, `verified_at`): each link is a
  sourced, reviewed fact; cards show "also: conseillère à l'Assemblée de Martinique →". *Recommended*: no id rewrite,
  no merge risk between namesakes, reversible.
- B. One canonical person id shared by all domains (needs a core-owned person registry and a migration of `com-` ids).
Matching rule proposal: same last name + first name + sex + Martinique, confirmed by an official source that names both
offices (Sénat `ODSEN_MANDAT_LOCAL`, AN `mandats` of type conseil, RNE) → `verified` only after JM's review.

---

## 3. Neutrality charter — parliament (draft for JM)

1. **Official facts only.** Group, committee, function, mandate dates are shown exactly as the chamber publishes them,
   with full official names and dates ("membre apparenté du groupe Socialistes et apparentés depuis le 19/07/2024").
   No left/right label, no colour coding of our own (AN `couleurAssociee` not used).
2. **No score, no ranking, no "most/least active".** No comparison table between the 6 members in sprint 2; deputies and
   senators are never compared with each other (different procedures, Senate has few nominative votes).
3. **Activity counts with a fixed caveat**, shown under every count:
   "Ces chiffres ne mesurent pas tout le travail parlementaire : travail en commission, rapports, auditions,
   déplacements et travail en circonscription ne sont pas comptés. Un vote non enregistré n'est pas une absence."
   - Counts shown: amendments filed **as first signatory** and their outcome; questions (by kind, answered or not);
     public votes taken part in. **Co-signatures are not counted as individual activity**: group amendments are
     co-signed by every member (XVIIth, authored / co-signed: Nilor 69 / 21 396; Bellay 445 / 6 387;
     William 188 / 5 870; Nadeau 135 / 5 232). Co-signatures are listed, never totalled next to authored amendments.
   - 16 021 of the 34 430 amendments have no outcome yet (not examined); values: Rejeté, Adopté, Tombé, Retiré,
     Non soutenu. 755 are filed as *Rapporteur* (`typeAuteur`): shown separately.
   - **No attendance rate.** Participation in public votes is not presence (most votes are by show of hands; delegated
     votes exist). Committee participation: only if the AN "Réunions" files publish it reliably (to check), shown as
     a list of meetings, never as a rate.
   - Counts always over a stated period, with the legislature start date and the date of data.
4. **Which votes appear: a mechanical, published rule (versioned, never hand-picked).** Draft rule `V1`:
   a. every **scrutin public solennel** (SPS) of the legislature (major texts, whole-text votes);
   b. every public scrutin on a **whole text** ("l'ensemble du projet/de la proposition de loi") — final votes;
   c. every public scrutin whose dossier législatif matches the **overseas list**: title/`titreChemin` contains one of
      `outre-mer`, `ultramarin`, `Martinique`, `Antilles`, `Guadeloupe`, `Guyane`, `La Réunion`, `Mayotte`,
      `octroi de mer`, `DROM`, `collectivités territoriales de Guyane et de Martinique`, or the dossier is examined by
      the Délégation aux outre-mer; or the scrutin `objet.libelle` itself contains one of those words;
   d. motions de censure (all, with the deputy's position: they are public by nature).
   The rule (keyword list + version + date) is published on the Méthodologie page; the build script stores
   `selected_by = 'V1:a'…` on each scrutin, so anyone can re-run it.
   **Test on the XVIIth data (3 Nov 2026), 9 578 scrutins:** V1 selects **628** (a: 74 solennels, b: 214 whole-text
   votes, c: 394 overseas-related, d: 23 motions de censure; parts overlap). Over those 628, recorded positions:
   William 97, Nadeau 176, Bellay 131, Nilor 201; the rest "pas de vote enregistré". 3 752 scrutins carry a dossier
   link (`objet.dossierLegislatif.dossierRef`), all found in `an-dossiers-17`.
   Observation: part *c* is dominated by amendment votes on the two Mayotte laws (2025). Option **V1-strict**: in part
   *c*, keep only whole-text and article votes. To decide (Q2).
   Changes to the list = new version, announced, never retroactive without saying so.
5. **Position shown with context, not judgement**: the deputy's position, the group's majority position and the result,
   side by side. No "rebel/loyal" label or percentage. *Mises au point* (corrections after the vote) shown as published,
   never replacing the official record.
6. **Interests (HATVP)**: link + type + publication date; "déclaration non encore publiée" stated when HATVP says so.
   Outside activities: copied **as declared** from the latest declaration of interests (no summary, no rewording, no
   € totals across items), with its date and a link to the original; an older declaration is never shown as current.
   Asset declarations: link and dates only.
7. **Missing data is stated** (`MissingInfo`): Senate votes not in open data; Senate amendments pending (Ameli);
   committee participation at the Sénat not published; activity before 2012 (AN) / 2011 (Sénat) not available.
8. **Right of reply** on every card; corrections logged.
9. **Electoral periods**: freeze editorial changes (not data refreshes) during campaign periods; same rule for all six.

---

## 4. Card draft (wireframe, shared shell `src/components/card/Card.tsx`)

```
CardShell
├─ CardHeader
│   portrait: official AN/Sénat photo (credit "© Assemblée nationale" / "© Sénat") — or initials if JM declines (Q6)
│   title:    Béatrice BELLAY — Députée de la 3e circonscription de la Martinique
│   facts:    Législature: XVIIe (depuis le 7 juil. 2024) · Groupe: Socialistes et apparentés (membre)
│             Commission: Affaires sociales (depuis le 27 oct. 2026) · Délégation aux outre-mer (secrétaire)
│   note:     "Faits publiés par l'Assemblée nationale, mis à jour le 03/11/2026"
├─ FactBlock "Mandat et fonctions"            sources=[an-deputes, an-organes]  year="XVIIe lég."
│   timeline of mandates (this and previous legislatures), groups, committees, functions, suppléant(e)
├─ FactBlock "Votes publics retenus (règle V1)"  sources=[an-scrutins-17, an-dossiers-17]
│   list: date · texte · position · position majoritaire du groupe · résultat · link to AN scrutin page
│   filter chips: solennels / votes finaux / outre-mer   ("Comment les votes sont choisis →" Méthodologie)
│   Caveat: "Un vote non enregistré n'est pas une absence…"
├─ FactBlock "Amendements"                    sources=[an-amendements-17]
│   déposés comme premier signataire: n (adoptés a, rejetés r, retirés/tombés/non soutenus x, en attente y)
│   cosignés: list only (no total next to n, charter §3.3) · link to each amendment
│   Caveat: fixed activity caveat
├─ FactBlock "Questions au Gouvernement et écrites"  sources=[an-questions-*]
│   QE n (répondues k) · QOSD · QAG — list: date, sujet (rubrique), ministère, réponse oui/non + link
├─ FactBlock "Déclarations à la HATVP"        sources=[hatvp-liste]
│   type · date de publication · link to hatvp.fr ; déports (an-deports) if any
├─ MissingInfo  [ (senators) "Présence en commission : non publiée en open data",
│                 (senators) "Votes nominatifs du Sénat : pas de jeu de données officiel", … ]
├─ Caveat (card level): activity ≠ quality of work; chamber differences; period covered
└─ RightOfReply  text="Vous êtes Béatrice Bellay ou son équipe ? Droit de réponse" subject="Fiche députée 972-3"
(no OpinionBlock for parliamentarians in sprint 2)
```
Senator card: same shell; "Votes" block replaced by MissingInfo until Q4 is decided; questions from `senat-questions`;
amendments after Ameli parsing; mandate block shows "élue au suffrage indirect (grands électeurs)".
List page `/parlementaires`: 4 deputies by circonscription + 2 senators, alphabetical within chamber; no sorting by counts.

---

## 5. Proposed shared changes (separate small PRs to `dev`, not in this branch)
1. **`scripts/core/fetching.py` — truncated downloads.** `fetch()` does not check `Content-Length`: data.assemblee-nationale.fr
   and hatvp.fr close long transfers early and the file is kept truncated without error (seen today: AMO30 zip and
   HATVP `liste.csv`, 101 kB of 3.3 MB). Fix: compare size with `Content-Length`, resume with `Range`, fall back to the system `curl`
   (hatvp.fr refuses Python after a few requests). B2 works around it in `scripts/parlement/sources.py`
   (`_fetch_complete`), to be moved to core. **May also affect B1** (large OFGL/DGFiP files: worth re-checking).
   Also: the 352 MB amendments zip is best run on its own (`--only an-amendements-17`): a full background run was
   stopped by the OS for low memory on 3 Nov 2026.
2. **Per-job licence** in `file_job()/portal_job()` (default Licence Ouverte 2.0) so an ODbL source can be recorded
   truthfully (needed before any NosDéputés/NosSénateurs download).
3. **`person_links`** core table (if Q1 = A) — core migration.
4. `bodies.kind` / `terms.body_kind` values `legislature`, `senat`: free text today, no change needed; document them.
5. `messages/*/common.json`: nothing needed now (nav label "Parlementaires" already exists).

---

## 6. Decisions (JM, 5 Nov 2026)

| # | Topic | Decision |
|---|---|---|
| Q1 | Cross-domain person | **`person_links` table** (§2.4 option A). Core table: proposed as a separate PR to `dev` (§5). |
| Q2 | Vote rule | **V1** (§3.4; 628 votes on the XVIIth), keyword list as written in §3.4. |
| Q3 | Activity counts | **Shown on the card, with caveats** (§3.3: first-signatory amendments only, co-signatures listed without total). |
| Q4 | Senate votes | **(a) now**: stated as missing on the card ("votes du Sénat non publiés en open data"). **(b) later**: senat.fr scrutin pages, see §7. |
| Q5 | Cut-off | **Accepted as proposed** (§1bis): deputies full card from the XIVth (Jun 2012), identity-only 2002–2012; senators full card from the Oct 2011 term, identity-only before. Current terms first; earlier terms: see §7. |
| Q6 | Photos | **Official AN/Sénat portraits**, credited, removable on request (same rule as mayors). |
| Q7 | HATVP | **Link + dates, and the declared outside activities** from the latest declaration of interests (§1.4, §3.6). Asset declarations: link and dates only. Sections shown: see Q7 bis. |
| Q8 | Suppléants | **Shown on the deputy card** (AMO30). |
| Q9 | Kréyòl | **Later**: French only for this domain for now. |
| Q10 | Refresh | **Weekly rebuild.** Scheduling (cron / CI workflow) touches `.github/**`: separate PR to `dev` (§5). |

Q2 bis (JM): **yes**, each deputy card also offers the **complete list of every public vote** of the term as a download
(CSV: date, scrutin n°, title, type, the deputy's position or "pas de vote enregistré", group majority position, result,
link to the AN page), not filtered by V1. Source footnote: `an-scrutins-17`, `an-scrutins-17-liste`.

Still open:
- **Q7 bis**: the declaration of interests also has sections about **other people** (spouse's professional activity,
  parliamentary assistants' other activities). Recommended: show only the member's own sections (professional and
  consulting activities, boards, financial holdings, volunteer functions, other mandates) and link to HATVP for the rest.

---

## 7. When the "later" items happen (proposal)

No date is fixed now: each item has a **decision point** with a measurable trigger, reviewed by JM.

| Item | Prerequisite (done in sprint 2) | Decision point | Then |
|---|---|---|---|
| Earlier terms (AN XIV–XVI, Sénat 2011/2017) | Current-term cards live on preview; a 1-day check of the XIV/XV archive formats (paths, schema vs XVIIth) with an effort estimate written in `docs/branches/B2.md` | **Sprint 2 review** with JM | Sprint 3 if the archive formats match (loader reused); otherwise scheduled with the estimate |
| Senate votes (Q4 b) | Check of senat.fr reuse terms (mentions légales) and of the scrutin page format | **Same review** | If reuse is allowed: scraper job in `scripts/parlement/sources.py` (sprint 3 or 4); if not: stays "(a) missing" and the card says so |
