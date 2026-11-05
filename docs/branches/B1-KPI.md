# B1 — KPI de-duplication (Step 2, proposal for JM, 3 Nov 2026)

Goal: each KPI has **one canonical place** (where it is explained, compared and sourced). Other appearances are allowed
only when they add a dimension the canonical place does not have (time across terms, side by side with other communes).
The hero trio replaces the three "3 chif" candidate sets (JM, 3 Nov 2026).

Places today: **H1/H2/H3** = the 3 headline sets · **Bloc** = "Le budget en détail" (5 blocks, year switcher 2018–2025)
· **Mandats** = terms table · **Graph** = terms charts · **Comp** = compare page · **En-tête** = card header.

## Before
| KPI | H1 | H2 | H3 | Bloc | Mandats | Graph | Comp | Times on the card |
|---|---|---|---|---|---|---|---|---|
| Investissement hors remb. €/hab (`di_hors_remb`) | ● | ● | ● | ● | ● | ● | ● | **6** |
| Recettes de fonctionnement €/hab (`rf_total`) | | ● | | ● | ● | ● | ● | 4 |
| Dépenses de fonctionnement €/hab (`df_total`) | ● | | | ● | ● | ● | ● | 4 |
| Dette €/hab (`encours_dette`) | ● | | | ● | ● (fin) | ● | ● | 4 |
| Capacité de désendettement (ans) | ● (sous la dette) | | | ● | ● (fin) | | ● | 3 |
| Épargne brute €/hab | | ● | | ● | ● | | ● | 3 |
| Octroi de mer €/hab | | | ● | ● (dont) | | | ● | 2 |
| Personnel (€/hab, % des dépenses) | | | ● (%) | ● (€ + %) | | | ● | 2 |
| Dépenses d'équipement €/hab | | | | ● (sous-ligne) | | | ● | 1 |
| Taux d'épargne brute (EB / RF) | | | | | | | | 0 (new) |
| Épargne nette, other block lines | | | | ● | | | ● | 1 |
| Population | | | | | | | ● | 1 + header + list |

Comparison groups today: headline = Martinique median **and** stratum median; blocks = stratum median (Martinique if
fewer than 3 communes); compare = Martinique median. The same word "médiane" means three different things.

## After
| KPI | Canonical place | Also shown (why) | Removed from |
|---|---|---|---|
| **Taux d'épargne brute** = épargne brute / recettes de fonctionnement | **Hero** (2024) | Mandats + Graph (over time), Comp "Chiffres clés" | — (new) |
| **Capacité de désendettement** (ans; "non calculable" if épargne brute ≤ 0) | **Hero** | Mandats (end of term), Comp "Chiffres clés" | H1, block "Épargne et dette" |
| **Dépenses d'équipement €/hab** | **Hero** | Line in the investment block (it is a part of the breakdown, so the block still adds up; it shows a "chiffre clé ↑" mark, not a second median), Mandats + Graph, Comp | — |
| **Dette €/hab** | **Block "Épargne et dette"** | Mandats + Graph (end of term), Comp | H1 |
| Épargne brute €/hab | Block "Épargne et dette" | Comp | H2, Mandats (replaced by the rate) |
| Investissement hors remb. €/hab | Block "Dépenses d'investissement" (top line) | Comp | H1, H2, H3, Mandats, Graph (replaced by équipement) |
| Recettes de fonctionnement €/hab | Block "D'où vient l'argent" | Comp | H2, Mandats, Graph |
| Dépenses de fonctionnement €/hab | Block "Où va l'argent" | Comp | H1, Mandats, Graph |
| Octroi de mer, personnel | Their block lines | Comp | H3 (Step 3 adds the shares of operating revenue as structural ratios) |
| Every other block line | Its block | Comp | — |
| Population | Header (with a source note, now missing) | `/communes` list and Comp (navigation, context) | — |

Result: the card shows the 3 hero figures once for 2024. "Trois mandats" shows **the same 3 + debt**, mandate by
mandate (4 charts: rate, years, équipement €/hab, debt €/hab). The blocks hold the detail for every year.
No figure appears twice for the same year with the same comparison.

**One comparison rule on the card:** the stratum median (Martinique median if the stratum has fewer than 3 communes),
always named ("médiane des 5 communes de 10 000 à 19 999 hab."). Step 3 adds the spread band and the national average.
**Compare page:** Martinique median of the 34 communes (the communes picked can be in different strata), labelled as such.

## Hero trio, 2024 values (check)
| | Le Lamentin | Median of the 34 | Range |
|---|---|---|---|
| Taux d'épargne brute | 7,2 % | 6,6 % | −10,8 % to 19,6 % |
| Capacité de désendettement | 5,7 ans | 3,1 ans | 5 communes not computable; max 993 ans (Le Robert) |
| Dépenses d'équipement | 341 €/hab | 296 €/hab | — |
| (Dette, in the block) | 801 €/hab | 364 €/hab | — |

Not computable in 2024 (épargne brute ≤ 0 or no figure): Grand'Rivière, Rivière-Pilote, Le Morne-Rouge, Saint-Pierre,
Le Morne-Vert. Very high values: Le Robert 993 ans, Basse-Pointe 81 ans (épargne brute close to zero).

## Decisions for JM
1. **Very high capacité (Le Robert 993 ans).** Proposal: show the computed figure, with a short explanation under it
   when it is over 30 years: "épargne brute très faible cette année-là : le délai n'a pas de sens pratique". No cap and
   no hiding. Official reference lines come in Step 3.
2. **"Trois mandats" charts.** Proposal: 4 charts = hero trio + debt €/hab, replacing operating revenue, operating
   spending and investment. Their year-by-year values stay in the blocks (year switcher).
3. **Équipement in the investment block.** Proposal: keep the line (the breakdown must add up) with a "chiffre clé ↑"
   mark instead of a second median.
4. **Taux d'épargne brute for a mandate.** Proposal: sum of épargne brute ÷ sum of recettes over the full years of the
   mandate (not an average of yearly rates, so one odd year does not dominate).

## Files (all B1-owned, no shared change)
`src/lib/communes/{config,headline,terms,breakdown}.ts` (+ tests), `src/components/communes/{HeadlineSets→Hero,
TermsChart,TermsComparison,BudgetBreakdown}.tsx`, `src/app/communes/[slug]/page.tsx`, `src/app/communes/comparer/page.tsx`,
`messages/fr/communes.json`. No database change: the rate is computed from `epargne_brute` and `rf_total`.
