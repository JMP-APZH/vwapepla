# B1 — Comparisons (Step 3, proposal for JM, 3 Nov 2026)

No ranking, no score. Every comparison names its group and its source.

## 1. National stratum averages: the official dataset
**DGFiP, "Comptes individuels des communes (fichier global)"**, data.economie.gouv.fr, Licence Ouverte 2.0. One dataset
per period (2018, 2019-2020, 2021, 2022, 2023-2024, 2025), all added to `scripts/communes/sources.py` and downloaded
with `download_sources.py --domain communes`: 34 Martinique rows per year (Martinique = `dep` **103** in these files).

For each budget item, the file gives the commune's amount (k€), its value per inhabitant (`f…`), and **the average of
its national stratum** (`m…`). For the main lines it also gives structure ratios (`r…`, `rm…`).
Stratum = population band (`nomsst1`) × type of intercommunality (`nomsst2`). All 34 Martinique communes are
"appartenant à un groupement fiscalisé (FPU)". The bands are 500-2 000 (6 communes), 2 000-3 500 (3), 3 500-5 000 (6),
5 000-10 000 (7), 10 000-20 000 (9), 20 000-50 000 (2), 50 000-100 000 (1).

**Caveat that decides the design:** these files cover the **main budget only** ("Budget principal seul"). The card uses
the OFGL **consolidated** accounts (main + annex budgets), like the AFD. Measured on 2024, DGFiP main budget ÷ OFGL
consolidated, per inhabitant, over the 34 communes:

| Item | Median | P25-P75 | Min-max |
|---|---|---|---|
| Staff costs (`perso` / `frais_personnel`) | 1.000 | 1.000-1.000 | 0.96-1.00 |
| Debt (`dette` / `encours_dette`) | 1.000 | 1.000-1.000 | 0.81-1.00 |
| Operating revenue (`prod` / `rf_total`) | 1.018 | 1.001-1.045 | 1.00-1.32 |
| Équipement (`equip` / `depenses_equipement`) | 1.056 | 1.000-1.220 | 0.97-1.60 |
| Épargne brute (`caf` / `epargne_brute`) | 1.025 | 1.000-1.149 | −1.16-4.40 |

Example, Fort-de-France 2024, € / hab.: équipement 240 (DGFiP) vs 149 (OFGL). The stratum average (470) can therefore
only be compared with **the commune's own DGFiP figure**, never with the card's consolidated figure.

### Columns proposed for mapping (to validate)
| DGFiP column | Definition (official column guide, sheet 2023-2024) | Proposed use |
|---|---|---|
| `pop1`, `nomsst1`, `nomsst2` | Legal population; stratum (size; type of intercommunality) | Name of the group |
| `prod`, `fprod`, `mprod` | Total produits de fonctionnement | Denominator of the rates |
| `caf`, `fcaf`, `mcaf`, `rcaf`, `rmcaf` | Capacité d'autofinancement (CAF), and as % of operating revenue | National taux d'épargne brute |
| `dette`, `fdette`, `mdette` | Encours total de la dette au 31/12 | National debt / hab.; capacité = `dette` / `caf` |
| `equip`, `fequip`, `mequip` | Dépenses d'équipement | National équipement / hab. |
| `perso`, `fperso`, `mperso` | Charges de personnel | Staff costs / operating revenue |
| `dgf`, `fdgf`, `mdgf` | Dotation globale de fonctionnement | DGF / operating revenue (DGF only; the card's "Concours de l'État" is wider) |

Octroi de mer: no national comparison (overseas tax; nationally it falls under "autres impôts et taxes").

### Option A (recommended): official averages, same basis, on their own line
Under each figure that has one: « France, communes de 10 000 à 20 000 hab. (DGFiP, budget principal) : moyenne 456 € —
cette commune sur la même base : 240 € ». Official figures, no computation by us, the basis stated.
### Option B: national averages computed by us from the OFGL consolidated file (all communes of France)
Same basis as the card, but a Vwapepla calculation (method on the methodology page), not an official average.

## 2. Position in the Martinique stratum
Same groups as today (OFGL strata; Martinique when the stratum has fewer than 3 communes). Shown as the median and a
**spread band P25-P75**, on a thin horizontal strip with the commune's mark. No names of the other communes, no rank.

## 3. Term-on-term change
In "Trois mandats comparés": a column "Évolution" against the previous term. Rate in points ("+1,2 pt"), years
("+0,8 an"), € / hab. in euros and %. Neutral colour (no red/green).

## 4. Sourced reference lines
Only where an official threshold exists:
- **Capacité de désendettement 12 ans**, the "plafond national de référence" of the bloc communal in the loi de
  programmation des finances publiques 2018-2022 (loi n° 2018-32, art. 29). It applied to the communes with the
  contracts, and that law has expired. **To verify on Légifrance before use:** I found only secondary documents.
- No official threshold for the taux d'épargne brute or for équipement / hab.: no line.

## 5. Structural ratios (OFGL consolidated, same basis as the card)
Staff costs / operating revenue (`frais_personnel` / `rf_total`), Concours de l'État / operating revenue
(`concours_etat` / `rf_total`), Octroi de mer / operating revenue (`octroi_de_mer` / `rf_total`). Proposed place: a small
block « Structure des recettes et des dépenses » after the hero, with the Martinique stratum band and, where it
exists, the DGFiP national line (staff, DGF).

## 6. Reconciliation
Extend `reconcile_afd.py` with these checks:
- Martinique totals of the three structural ratios against the AFD Observatoire, where the AFD publishes them.
- A DGFiP/OFGL consistency check on staff costs and debt, which must agree commune by commune within 1% (except the
  communes with annex budgets, listed).
