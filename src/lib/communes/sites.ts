// Official town-hall websites, as listed by the Annuaire de l'administration (Service-Public.fr, DILA).
// Read on 2 Nov 2026 from api-lannuaire.service-public.fr (dataset api-lannuaire-administration, pivot "mairie").
// null = no website listed (Macouba lists only a Facebook page, not counted as a website).
// Visitor votes are offered only where a website is listed. Superseded by site_audits.site_url once audits exist.

export const SITES_SOURCE = {
  label: "Annuaire de l'administration — Service-Public.fr (DILA)",
  url: "https://lannuaire.service-public.fr/",
  retrieved: "2026-11-02",
};

export const OFFICIAL_SITES: Record<string, string | null> = {
  "97201": "http://ville-ajoupabouillon.fr/",
  "97202": "https://ville-ansesdarlet.fr",
  "97203": "https://villedebassepointe.fr",
  "97204": "https://www.villeducarbet.fr/",
  "97205": "https://mairiecasepilote.fr/",
  "97206": null,
  "97207": "https://www.villededucos.fr/",
  "97208": null,
  "97209": "https://www.fortdefrance.fr/",
  "97210": "https://www.ville-francois.fr/",
  "97211": "http://www.grand-riviere.com/",
  "97212": null,
  "97213": "https://www.mairie-lelamentin.fr/",
  "97214": "https://villedulorrain.com/v2/",
  "97215": null,
  "97216": null,
  "97217": "https://www.villedumarin.org/",
  "97218": null,
  "97219": "https://www.mairie-precheur.com/",
  "97220": null,
  "97221": "https://riviere-salee.fr/",
  "97222": "https://www.ville-robert.fr/",
  "97223": "https://www.villedusaintesprit.fr/",
  "97224": "https://saintjoseph972.com",
  "97225": "https://www.saintpierre-mq.fr",
  "97226": "http://www.sainte-anne972.fr",
  "97227": "https://www.sainteluce.fr/accueil.php",
  "97228": "https://ville-saintemarie.com/",
  "97229": "https://www.mairie-schoelcher.fr/",
  "97230": null,
  "97231": "https://villedestroisilets.com/",
  "97232": "https://ville-vauclin.fr/",
  "97233": null,
  "97234": "https://www.ville-bellefontaine.fr/",
};
