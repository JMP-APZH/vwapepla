// Editorial settings. Changing them needs no data change.

export const REFERENCE_YEAR = 2024; // latest complete year (final DGFiP balances)
export const PROVISIONAL_YEARS = [2025]; // published, but subject to revision
export const FIRST_YEAR = 2018;
export const TERM = { start: 2026, end: 2032 };

export const CONTACT_EMAIL = "contact@vwapepla.org"; // "Droit de réponse" path (MVP2: mailto)

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

// "Bidjé-a an 3 chif": three candidate sets, shown stacked until JM picks one.
export type HeadlineFigure =
  | { kind: "per_hab"; metric: string; label: string; extra?: { metric: string; label: string } }
  | { kind: "share"; metric: string; of: string; label: string };

export const HEADLINE_SETS: { id: string; title: string; figures: HeadlineFigure[] }[] = [
  {
    id: "depenser-investir-dette",
    title: "Dépenser · Investir · Dette",
    figures: [
      { kind: "per_hab", metric: "df_total", label: "Fonctionnement" },
      { kind: "per_hab", metric: "di_hors_remb", label: "Investissement" },
      {
        kind: "per_hab", metric: "encours_dette", label: "Dette",
        extra: { metric: "capacite_desendettement", label: "pour rembourser" },
      },
    ],
  },
  {
    id: "recettes-investir-epargne",
    title: "Recettes · Investir · Épargne",
    figures: [
      { kind: "per_hab", metric: "rf_total", label: "Recettes" },
      { kind: "per_hab", metric: "di_hors_remb", label: "Investissement" },
      { kind: "per_hab", metric: "epargne_brute", label: "Épargne brute" },
    ],
  },
  {
    id: "octroi-personnel-investir",
    title: "Octroi · Personnel · Investir",
    figures: [
      { kind: "per_hab", metric: "octroi_de_mer", label: "Octroi de mer" },
      { kind: "share", metric: "frais_personnel", of: "df_total", label: "Personnel / dépenses" },
      { kind: "per_hab", metric: "di_hors_remb", label: "Investissement" },
    ],
  },
];
