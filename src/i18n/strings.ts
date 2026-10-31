// All UI strings, French + Kréyòl. Kréyòl is filled in only where agreed with JM (null = show French only).
// Metric labels live in the database (metric_definitions.label_fr / label_kreyol), not here.

type S = { fr: string; kr: string | null };

export const t = {
  siteName: { fr: "Vwapepla", kr: "Vwa pèp la" },
  tagline: { fr: "La voix du peuple : les comptes de nos communes, sourcés.", kr: null },
  homeTitle: { fr: "Les 34 communes de Martinique", kr: null },
  homeIntro: {
    fr: "Choisissez une commune pour voir d'où vient l'argent, où il va, et ce qu'elle doit. Chaque chiffre renvoie à sa source officielle.",
    kr: null,
  },
  mayor: { fr: "Maire", kr: null },
  term: { fr: "Mandat", kr: null },
  population: { fr: "Population", kr: null },
  intercommunality: { fr: "Intercommunalité", kr: null },
  stratum: { fr: "Strate", kr: null },
  headlineTitle: { fr: "Le budget en 3 chiffres", kr: "Bidjé-a an 3 chif" },
  headlineDraft: {
    fr: "Trois présentations possibles, affichées ensemble pour choisir la meilleure.",
    kr: null,
  },
  thisCommune: { fr: "Cette commune", kr: null },
  medianMartinique: { fr: "Médiane Martinique", kr: null },
  medianStratum: { fr: "Médiane même taille", kr: null },
  provisional: { fr: "provisoire", kr: null },
  provisionalNote: {
    fr: "Données provisoires : les comptes définitifs de la DGFiP sont publiés fin décembre.",
    kr: null,
  },
  source: { fr: "Source", kr: null },
  retrieved: { fr: "données récupérées le", kr: null },
  caveatEpci: {
    fr: "Une partie des services (eau, déchets, transports) est assurée par l'intercommunalité (CACEM, CAESM, CAP Nord) et n'apparaît pas dans le budget de la commune : les comparaisons entre communes doivent en tenir compte.",
    kr: null,
  },
  rightOfReply: { fr: "Droit de réponse", kr: null },
  rightOfReplyText: {
    fr: "Vous êtes élu·e ou agent de cette commune et souhaitez apporter une précision ? Écrivez-nous : votre réponse sera publiée à côté des chiffres.",
    kr: null,
  },
  methodology: { fr: "Méthodologie", kr: null },
  sources: { fr: "Sources", kr: null },
  compare: { fr: "Comparer", kr: null },
  otherProjects: { fr: "Autres projets", kr: null },
  noRanking: { fr: "Pas de classement : les chiffres sont présentés côte à côte.", kr: null },
} satisfies Record<string, S>;

export type StringKey = keyof typeof t;
