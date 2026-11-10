# B3 — CTM metric mapping (validated by JM, 5 Nov 2026)

Code: `scripts/ctm/pipeline/metrics.py` (definitions), `scripts/ctm/pipeline/build.py` (build),
`scripts/ctm/reconcile.py` (gate). Values are the CTM's 2024 figures in € millions, from the downloaded files.

## A. CTM 2016–2025, Région and Département 2012–2015: OFGL consolidated accounts

Sources: `ofgl-base-regions-consolidee` (CTM, Région) and `ofgl-base-departements-consolidee` (Département). Columns
`montant` (consolidated), `montant_bp`, `montant_ba`, `montant_flux`, `euros_par_habitant` (OFGL population `ptot`).
The three bodies are never summed. 2025 is provisional.

| Block | Metric key | OFGL aggregate | CTM 2024 |
|---|---|---|---|
| Recettes | `rf_total` | Recettes de fonctionnement | 1,018.1 |
| | `impots_taxes` | Impôts et taxes | 727.4 |
| | ↳ `tva` · `ticpe` · `impots_locaux` | TVA · TICPE · Impôts locaux | 175.8 · 182.6 · 29.5 |
| | `concours_etat` | Concours de l'Etat | 201.6 |
| | ↳ `dgf` | Dotation globale de fonctionnement | 144.1 |
| | `subventions_recues` | Subventions reçues et participations | 72.5 |
| | `ventes` · `autres_rf` | Ventes de biens et services · Autres recettes de fonctionnement | 9.5 · 7.2 |
| | `emprunts` | Emprunts hors GAD | 107.5 |
| Dépenses | `df_total` | Dépenses de fonctionnement | 969.7 |
| | `frais_personnel` | Frais de personnel | 266.0 |
| | `achats` | Achats et charges externes | 60.5 |
| | `intervention` | Dépenses d'intervention | 597.1 |
| | ↳ `rsa` · `apa` · `pch` | Allocations RSA · APA · PCH | 198.5 · 78.7 · 42.5 |
| | `charges_financieres` · `autres_df` | Charges financières · Autres dépenses de fonctionnement | 30.4 · 15.6 |
| | `depenses_equipement` | Dépenses d'équipement | 136.0 |
| | `subv_equipement` | Subventions d'équipement versées | 107.7 |
| | `di_hors_remb` | Dépenses d'investissement hors remb | 244.1 |
| | `remboursements` | Remboursements d'emprunts hors GAD | 73.0 |
| Épargne, dette | `epargne_gestion` · `epargne_brute` · `epargne_nette` | Epargne de gestion · brute · nette | 78.7 · 48.4 · −24.6 |
| | `encours_dette` | Encours de dette | 954.8 |
| | `capacite_desendettement` | derived: encours ÷ épargne brute (not computable when épargne brute ≤ 0) | 19.7 years |
| Contexte | `population` | `ptot` | |

Build check: `rf_total` and `df_total` equal the sum of their parts (within 0.5 %), every body and year.

## B. Fiscalité ultramarine: DGFiP balances, budget principal, net credit, 2018–2025

Sources: `balances-comptables-des-departements` (2019–2025) and the nature-fonction file 2018 (2019 is in both and
identical). **2016–2017 are not loaded**: the CTM's accounts then follow the M57 chart before its 2018 renumbering
(no account 73432; the octroi de mer appears to be in 7372, not validated). Stated as missing on the card. "Octroi de mer" on the card always means account 73432 only.

| Metric key | Accounts | 2024 |
|---|---|---|
| `fum_total` | 734 (whole group) = the CRC's « produits liés à l'octroi de mer » | 224.1 |
| `fum_octroi_de_mer` | 73432 Octroi de mer régional | 92.9 |
| `fum_carburants` | 7342 Taxe sur les carburants | 92.0 |
| `fum_autres` | 7348 Autres impôts et taxes d'outre-mer | 35.9 |
| `fum_transport` · `fum_rhum` | 73433 transport public aérien et maritime · 73411 rhums | 2.0 · 1.3 |

## C. Région and Département 2008–2011: DGFiP comptes individuels (budget principal only)

Columns in € thousands, `scope = budget_principal` (caveat on the card). 2012 is in both sources and is the join check.

| Metric key | Column | Département 2012: DGFiP / OFGL bp | Région 2012: DGFiP / OFGL bp |
|---|---|---|---|
| `rf_total` | `pfr` | 599.4 / 599.4 | 238.4 / 238.4 |
| `df_total` | `cfr` | 543.4 / 542.9 (+0.1 %) | 182.2 / 182.2 |
| `epargne_brute` | `pfr − cfr` | 56.0 / 56.5 (−0.8 %) | 56.2 / 56.2 |
| `encours_dette` | `dba` | 314.6 / 314.6 | 111.3 / 111.3 |
| `depenses_equipement` | `ded` | 36.9 / 36.9 | 100.5 / 100.5 |
| `frais_personnel` | `chp` | 112.3 / 112.3 | 50.9 / 50.9 |

**Cause of the Département's −2.6 % on staff costs (JM asked to verify it): checked, 5 Nov 2026.** The first comparison
used OFGL's consolidated amount (€115.3M), which includes the annex budgets. Against OFGL's budget principal (€112.3M)
the comptes individuels match exactly. The remaining differences (+0.1 % and −0.8 %) are within tolerance.

## D. Reconciliation results (`python -I scripts/ctm/reconcile.py`, 5 Nov 2026: all checks pass)

- R1 Épargne brute bp 2021–2024 = CRC tableau n° 17 (p. 49), to the euro.
- R2 Encours bp 2021–2024 = CRC annex (p. 80), to the euro. **The debt gap found in discovery is in the CRC's own text**:
  p. 56 gives €744,427,970 for 2021, while the annex table gives €849,427,970 (= OFGL). For 2025 the text gives €977.1M,
  against our provisional €1,006.2M. Both are reported as "écart connu, affiché avec avertissement"; they do not fail the gate.
- R3 Capacité de désendettement 2021–2024 = CRC annex (10, 7, 10, 20 years, rounded).
- R4 Fiscalité ultramarine 734: 2021 €197.7M, 2024 €224.1M (CRC p. 43: 197 and 224 M€).
- R7 Impôts et taxes: 2021 €661.7M, 2024 €727.4M (CRC p. 42: 661 and 727 M€).
- R5 Every OFGL aggregate published for the CTM budget principal, 2019–2025 (65–67 per year), recomputed from the DGFiP
  balance accounts with OFGL's formula file: all match (tolerance 1 % or €50,000).
- Join checks: 2012 comptes individuels / OFGL bp; 2019 balances / nature-fonction.

## E. Spending by area of responsibility (sprint 3, 7 Nov 2026)

Source: DGFiP nature-fonction balances, CTM budget principal, definitive balance, 2018–2025 (`scripts/ctm/pipeline/functions.py`).
Area labels: OFGL, M57 functional nomenclature (`ofgl-fonctions-m57-libelles`, codes 0–8; 9 is « fonction en réserve »).

- `fonction` = functional chapter + area code: `93x…` operating spending of area x, `90x…` investment of area x;
  `94…` / `92…` not broken down by area (stored as `nv`, e.g. `943` interest).
- Operating spending: real accounts of class 6 (without 68, 675, 676), net debit.
- Investment: OFGL's definition of « Dépenses d'équipement » + « Subventions d'équipement versées »: debits on 20, 21, 23
  minus credits on 236, 237, 238.
- Area 4 « Santé et action sociale »: OFGL's label adds « (hors APA, RSA…) » because OFGL splits them out; in the M57
  chart, APA (43) and RSA (44) are sub-areas of 4, and they are included here.
- Starts in 2018: the M57 chart was renumbered that year.

Reconciliation (`reconcile.py`): R9 operating spending, all areas + `nv` = OFGL « Dépenses de fonctionnement » bp;
R10 investment, all areas = OFGL « Dépenses d'équipement » + « Subventions d'équipement versées » bp. Both match to the
euro, 2018–2025.

## F. Acts (sprint 3)

Indexes of the CTM's website: 1,809 délibérations of the Assemblée, 4,304 arrêtés délibérés of the Conseil exécutif
(344 without number). Stored title: the published title without its act number, with the **names of private
individuals masked** (after Monsieur / Madame / M. / Mme / Mlle; 987 titles). The full act stays on the CTM's page.
No session date, vote or topic: not in the index.

## G. Comptes administratifs voted by the Assemblée (sprint 4, 7 Nov 2026)

Sources: the main-budget CAs as published by the CTM (PDF with a text layer, archived by the downloader):
2022 délib. 23-418-1, 2023 délib. 24-97-1, 2024 délib. 25-148-1, 2025 délib. 26-147-1. Read by
`scripts/ctm/pipeline/ca.py` from the standard M57 pages **C1** (équilibre financier – investissement) and **C2**
(équilibre financier – fonctionnement), real and mixed operations. Each figure keeps its PDF page. C2 check: income −
spending = the printed balance.

Check R6 (`reconcile.py`), tolerance 1 % or €50,000:

| CA line | Compared with | Result |
|---|---|---|
| Real operating spending (C2, I) | DGFiP gross: debits on real class-6 accounts + debits on class 7 (atténuations de produits, 739) | 2022–2024 to the euro |
| Real operating income (C2, II) | DGFiP gross: credits on real class-7 accounts + credits on class 6 (atténuations de charges) | 2022–2024 within €0.17M |
| Real operating balance (C2, II − I) | OFGL « Epargne brute » bp | +0.13 %, 0.00 %, +0.28 % |
| Real investment spending minus chapter 923 | OFGL « Dépenses d'investissement hors remb » bp | within 0.03 % |
| Chapter 923 spending | OFGL « Remboursements d'emprunts hors GAD » bp | within 0.10 % |
| Chapter 923 income | OFGL « Emprunts hors GAD » bp (+ account 1068 in 2022–2023) | within 0.06 % |

Why the CA's operating totals are higher than OFGL's (about €4–5M on each side): the CA counts gross amounts, while
OFGL nets the credits on spending accounts and the debits on income accounts. The balance is the same.
In 2022 and 2023 the CA's chapter 923 income also includes the capitalised surplus (account 1068: €10.2M and €17.4M);
from 2024 it is shown on its own line.

2025: OFGL / DGFiP balances are provisional. The CA has €7.3M more operating spending than the provisional balances
(balance €32.2M against €39.5M). Reported, not failing, until the final balances are published.

## H. Forecast layer: budgets primitifs and orientation reports (sprint 5, 7 Nov 2026)

« Prévisionnel », never mixed with actuals (CLAUDE.md). Main budget only.

| Year | Budget primitif | Orientation report (ROB) |
|---|---|---|
| 2024 | délib. 24-49-1 | délib. 24-02-1 |
| 2025 | délib. 24-322-1 | délib. 24-253-1 (mostly a scan) |
| 2026 | délib. 25-376-1 | délib. 25-315-1 |

- **Budgets primitifs** (`scripts/ctm/pipeline/bp.py`): standard M57 pages **D1** (équilibre financier du budget –
  investissement) and **D2** (– fonctionnement), real operations, "RAR N-1 + vote de l'exercice". Same lines as the CA
  (§G). The planned operating balance is computed as income − spending, since the BP prints no balance. Each figure
  keeps its page.
- **Orientation reports:** narrative documents, linked only. Their explicit figures differ from year to year (2024 p. 94:
  "une CAF brute de 125 M€ et un emprunt de 150 M€, l'investissement 2024 devrait s'élever à 393 M€"; 2026: no figure
  for the year; 2025: scanned), so no figure is extracted.
- **Check F1 (`reconcile.py`, consistency only):** 9 lines read per BP; the investment total = chapter 90 + chapter 923
  spending (2026: +€0.4M, within tolerance).
- Planned vs realised is shown side by side on the card (BP vs CA), never as one series. The BP is amended during the
  year by the budget supplémentaire and the decisions modificatives, so a gap is not an error in itself.

## I. Octroi de mer: the CTM and the communes (sprint 6, 9 Nov 2026)
Mechanism (loi n° 2004-639 du 2 juillet 2004, art. 47–48): customs collect the octroi de mer; the Assemblée de Martinique
votes the rates, the exemptions and the split between the communes; the communes receive a guaranteed share (dotation
globale garantie), the remainder goes to the regional development and employment fund (FRDE); the CTM keeps its own
octroi de mer régional.

| Figure on `/ctm/octroi-de-mer` | Source | 2024 |
|---|---|---|
| Octroi de mer received by the 34 communes | `com_actuals.octroi_de_mer` (team B1: DGFiP M14 7373 / M57 73431, all budgets), read-only | €253.5M |
| Octroi de mer régional of the CTM | `ctm_actuals.fum_octroi_de_mer` (73432, §B) | €92.9M |
| Split rule between communes, from 1 Jan 2026: 85 % population, 10 % equal shares, 5 % communes below the regional average fiscal potential per inhabitant | délib. 25-198-2, p. 2 (scan, transcribed in `data/ctm/octroi/2025-repartition.yaml`) | — |
| Normal rate of the octroi de mer régional raised from 2.5 % to 3 % | délib. 24-300-2, p. 2 (scan, `data/ctm/octroi/2024-perequation.yaml`) | — |

- The two amounts are shown side by side, never summed (the FRDE and the customs' collection costs are not in either).
- Acts: the Assemblée's acts whose title mentions the octroi de mer (31, 2023–2026), classified by rules on the title
  (`scripts/ctm/pipeline/octroi.py`); « autre » when the title does not say what the act decides.
- Checks: O1 communes' 2023 total = AFD €244.0M, 34 communes every year; O2 the three shares of 25-198-2 sum to 100 %;
  O3 every classified act is in `ctm_acts`.
- Missing: FRDE amounts (no FRDE account in the CTM's DGFiP balances 2019–2025); octroi de mer collected by customs
  (no recent open data); guaranteed share per commune (25-198-2 states the rule, not the amounts); acts before 2023.
- Rate tables (26-148-1, 992 pages, one line per customs code): linked only.

## J. Legal framework (« Cadre légal », sprint 7, 10 Nov 2026)
Curated links to Légifrance (JM, 10 Nov 2026: links, no API, no archived copy) in `data/ctm/textes.yaml`, validated by
`scripts/ctm/pipeline/textes.py` and written by `build.py` to `src/lib/ctm/textes.json` (committed; no table). Légifrance
answers scripted requests with a bot challenge (HTTP 403), so URLs come from Légifrance's own pages as indexed by search
engines, and `checked` is set only when a person has opened the link; until then the card says « lien à vérifier ».
Texts: loi 2011-884; CGCT livre II (L7211-1 ff.), chapters on the Assemblée (L7222) and the Conseil exécutif (L7224),
attributions (L7251–L7254); decrees 2015-939 and 2021-483 (convocation); loi 2021-191 art. 1 (term until March 2028);
loi 2004-639 art. 47–48 (octroi de mer).
