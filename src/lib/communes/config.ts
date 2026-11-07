// Commune domain (B1) editorial settings. Shared settings: src/lib/core/config.ts. Changing them needs no data change.

export const REFERENCE_YEAR = 2024; // latest complete year (final DGFiP balances)
export const PROVISIONAL_YEARS = [2025]; // published, but subject to revision
export const FIRST_YEAR = 2018;
export const TERM = { start: 2026, end: 2032 };

// Known gaps or doubts in the official data, shown on the commune card ("Informations manquantes ou à vérifier").
// Gaps that can be detected (deputy ranks, missing years, unverified past mayors) are computed, not listed here.
export const DATA_NOTES: Record<string, string[]> = {
  "97220": ["Dette : les comptes officiels indiquent un encours de dette nul chaque année de 2013 à 2025 (150 000 € en 2012). Ce point est en cours de vérification."],
};

// Population strata (OFGL `tranche_population`, DGCL strata).
export const STRATA: Record<string, string> = {
  "0": "moins de 100 hab.",
  "1": "100 à 199 hab.",
  "2": "200 à 499 hab.",
  "3": "500 à 1 999 hab.",
  "4": "2 000 à 3 499 hab.",
  "5": "3 500 à 4 999 hab.",
  "6": "5 000 à 9 999 hab.",
  "7": "10 000 à 19 999 hab.",
  "8": "20 000 à 49 999 hab.",
  "9": "50 000 à 99 999 hab.",
};
export const MIN_STRATUM_SIZE = 3; // below this, a stratum median is not meaningful (not shown)

// "Bidjé-a an 3 chif" (JM, 3 Nov 2026): the hero trio, each KPI's canonical place (docs/branches/B1-KPI.md).
//   ratio   = amount of `num` / amount of `den` (0..1), not computable when `den` is 0 or missing
//   years   = amount of `metric` (capacité de désendettement; null when épargne brute <= 0)
//   per_hab = € per inhabitant of `metric`
export type HeroFigure =
  | { kind: "ratio"; key: string; num: string; den: string; label: string }
  | { kind: "years"; key: string; metric: string; label: string }
  | { kind: "per_hab"; key: string; metric: string; label: string };

export const HERO: HeroFigure[] = [
  { kind: "ratio", key: "taux_epargne_brute", num: "epargne_brute", den: "rf_total", label: "Taux d'épargne brute" },
  { kind: "years", key: "capacite_desendettement", metric: "capacite_desendettement", label: "Capacité de désendettement" },
  { kind: "per_hab", key: "depenses_equipement", metric: "depenses_equipement", label: "Dépenses d'équipement" },
];

// Structure of the budget (Step 3, B1-COMPARISONS.md §5): shares of operating revenue, OFGL consolidated like the card.
export const STRUCTURE: HeroFigure[] = [
  { kind: "ratio", key: "part_personnel", num: "frais_personnel", den: "rf_total", label: "Charges de personnel / recettes de fonctionnement" },
  { kind: "ratio", key: "part_etat", num: "concours_etat", den: "rf_total", label: "Dotations de l'État / recettes de fonctionnement" },
  { kind: "ratio", key: "part_octroi", num: "octroi_de_mer", den: "rf_total", label: "Octroi de mer / recettes de fonctionnement" },
];

/** Metric keys shown in the hero: not repeated with a second median elsewhere on the card. */
export const HERO_METRICS = new Set(["capacite_desendettement", "depenses_equipement"]);
/** Official reference line (Step 3, §4): "plafond national de référence" of 12 years for communes, loi n° 2018-32 du
 * 22 janvier 2018 (LPFP 2018-2022), art. 29 — verified on Légifrance on 4 Nov 2026. A benchmark of the 2018-2022
 * contracts with the State, not a legal ban. No official threshold exists for the other hero figures: no line. */
export const DEBT_CEILING_YEARS = 12;
export const DEBT_CEILING_SOURCE = "https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000036526081";
/** Above this, a capacité de désendettement gets its one-line explanation (épargne brute close to zero). */
export const VERY_LONG_DEBT_YEARS = 30;
