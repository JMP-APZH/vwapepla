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
  compareWith: { fr: "Comparer avec d'autres communes →", kr: null },
  otherProjects: { fr: "Autres projets", kr: null },
  noRanking: { fr: "Pas de classement : les chiffres sont présentés côte à côte.", kr: null },
  // Visitor votes (opinion layer: website quality only)
  siteTitle: { fr: "Le site internet de la mairie", kr: null },
  votesShortcut: { fr: "Donnez votre avis sur le site internet de la mairie", kr: null },
  auditTitle: { fr: "Ce que l'on trouve sur le site", kr: null },
  auditIntro: { fr: "Chaque point renvoie à la page consultée.", kr: null },
  auditPending: { fr: "Vérification du site de la mairie en cours : la liste des points contrôlés sera publiée après relecture.", kr: null },
  auditDisclaimer: {
    fr: "Constat factuel et daté sur le site internet de la mairie, pas une note du maire ni de la commune. « Non trouvé » signifie que l'information n'a pas été trouvée à cette date. La mairie peut signaler une erreur ou une mise à jour via le droit de réponse.",
    kr: null,
  },
  siteNone: { fr: "Aucun site internet n'est indiqué pour cette mairie dans l'annuaire officiel Service-Public.", kr: null },
  votesTitle: { fr: "Avis des visiteurs, non représentatif", kr: null },
  votesIntro: {
    fr: "Donnez votre avis sur le site internet de la mairie (pas sur le maire ni sur le budget). Notes de 1 (pas du tout) à 5 (tout à fait). Avis anonyme : nous ne conservons ni votre adresse IP ni votre navigateur.",
    kr: null,
  },
  votesDisclaimer: {
    fr: "Ces avis sont donnés librement par les visiteurs du site Vwapepla. Ils ne constituent pas un sondage et ne sont pas représentatifs de la population. La moyenne n'est affichée qu'à partir de 20 avis.",
    kr: null,
  },
  q_facile_a_trouver: { fr: "Les informations sont faciles à trouver", kr: null },
  q_a_jour: { fr: "Le site est à jour", kr: null },
  q_comprehensible: { fr: "Les informations sont claires et compréhensibles", kr: null },
  q_demarches: { fr: "On peut faire ses démarches en ligne", kr: null },
  votesSubmit: { fr: "Envoyer mon avis", kr: null },
  votesNotEnough: { fr: "pas encore assez d'avis", kr: null },
  votes_ok: { fr: "Merci, votre avis est enregistré. Les résultats sont mis à jour toutes les quelques minutes.", kr: null },
  votes_already_voted: { fr: "Vous avez déjà donné votre avis sur ce site ces 30 derniers jours.", kr: null },
  votes_rate_limited: { fr: "Trop d'avis envoyés aujourd'hui depuis cette connexion. Réessayez demain.", kr: null },
  votes_invalid: { fr: "Choisissez au moins une note avant d'envoyer.", kr: null },
  votes_error: { fr: "Votre avis n'a pas pu être enregistré. Réessayez plus tard.", kr: null },
} satisfies Record<string, S>;

export type StringKey = keyof typeof t;
