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

## B. Fiscalité ultramarine: DGFiP balances, budget principal, net credit, 2016–2025

Sources: `balances-comptables-des-departements` (2019–2025) and the nature-fonction files 2016–2018 (2019 is in both and
identical). "Octroi de mer" on the card always means the octroi de mer régional only.

**2016–2017 (validated by JM, 7 Nov 2026):** the CTM's accounts follow the M57 chart before its 2018 renumbering. Each
line is mapped from the official account labels (OFGL nomenclature file):

| Card line | 2016–2017 account (official label) | 2016 | 2017 | 2018 account | 2018 |
|---|---|---|---|---|---|
| Total | 737 group | 180.8 | 199.6 | 734 | 197.8 |
| Octroi de mer régional | 7374 « Taxe additionnelle à l'octroi de mer » | 75.2 | 72.0 | 73432 | 75.1 |
| Taxe sur les carburants | 7372 « Taxes sur les carburants » | 72.4 | 91.5 | 7342 | 82.9 |
| Autres | 7378x « Autres » | 29.7 | 32.8 | 7348 | 36.0 |
| Transport public aérien et maritime | 7376 | 2.0 | 1.9 | 73433 | 2.0 |
| Rhums | 7371 | 1.4 | 1.3 | 73411 | 1.8 |

Check R4b (`reconcile.py`): the five taxes add up to the total, every year.

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
