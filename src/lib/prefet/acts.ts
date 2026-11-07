// Acts published in the préfecture's Recueils des actes administratifs (RAA). Themes come from the act's title only
// (keyword rules in scripts/prefet/acts.py, listed on the card); a theme is a reading aid, not a judgement.

export type Act = {
  id: string; act_id: string; act_date: string; published: string | null; bulletin: string; service: string | null;
  title: string; pages: number; page: number; pdf_url: string; theme: string; source_id: string;
};
export type ActCount = { year: number; theme: string; acts: number | string };

/** Same order and labels as scripts/prefet/acts.py THEMES. */
export const THEMES: { key: string; label: string; rule: string }[] = [
  { key: "interim", label: "Intérims et suppléances", rule: "intérim, suppléance" },
  { key: "delegation", label: "Délégations de signature", rule: "délégation de signature" },
  { key: "carburants", label: "Prix des carburants", rule: "carburant, produits pétroliers" },
  { key: "eau", label: "Eau et sécheresse", rule: "sécheresse, usages de l'eau, restriction d'eau, eau potable" },
  { key: "risques", label: "Risques naturels et alertes", rule: "cyclone, vigilance, alerte, ORSEC, séisme, volcan, submersion, sargasses, catastrophe naturelle, inondation, plan de prévention des risques" },
  { key: "ordre_public", label: "Ordre public et rassemblements", rule: "manifestation, couvre-feu, rassemblement, périmètre de protection, interdiction de vente / circulation / port, drones, vidéoprotection, réquisition" },
  { key: "chlordecone", label: "Chlordécone", rule: "chlordécone" },
  { key: "autre", label: "Autres actes", rule: "aucune des règles ci-dessus" },
];

/** Link to the act's first page inside its bulletin (PDF viewers honour #page=). */
export function actUrl(a: Pick<Act, "pdf_url" | "page">): string {
  return `${a.pdf_url}#page=${a.page}`;
}

/** Counts per year (rows) and theme (columns), with the total per year; years ascending. */
export function countTable(rows: ActCount[]): { years: number[]; get: (year: number, theme: string) => number; total: (year: number) => number } {
  const m = new Map(rows.map((r) => [`${r.year}:${r.theme}`, Number(r.acts)]));
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  const get = (y: number, t: string) => m.get(`${y}:${t}`) ?? 0;
  return { years, get, total: (y) => THEMES.reduce((s, t) => s + get(y, t.key), 0) };
}
