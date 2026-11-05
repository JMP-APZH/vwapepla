// Security and social context of the préfet card: recorded crime (SSMSI), unemployment and poverty (INSEE), and the
// split of State credits by policy area (DPT). Context figures, never a measure of a person. Pure functions, tested.
import type { DptCredit } from "./credits";

export type CrimeStat = {
  geo: "972" | "971" | "FR"; year: number; indicator: string; unit: string; count: number | null;
  rate_per_1000: number | null; computed: boolean; source_id: string;
};
export type ContextFigure = {
  id: string; indicator: "chomage_bit" | "pauvrete_menages"; geo: string; group_label: string; period: string;
  value: number; unit: string; note: string | null; quote: string | null; source_id: string; source_url: string;
};

/** SSMSI indicators shown, grouped as the SSMSI does (persons / property / drugs). AFD sub-rows are left out. */
export const CRIME_GROUPS: { label: string; indicators: string[] }[] = [
  { label: "Atteintes aux personnes", indicators: [
    "Homicides", "Tentatives d'homicide", "Violences physiques intrafamiliales", "Violences physiques hors cadre familial",
    "Violences sexuelles", "Vols avec armes", "Vols violents sans arme"] },
  { label: "Atteintes aux biens", indicators: [
    "Cambriolages de logement", "Vols sans violence contre des personnes", "Vols de véhicule", "Vols dans les véhicules",
    "Vols d'accessoires sur véhicules", "Destructions et dégradations volontaires",
    "Escroqueries et fraudes aux moyens de paiement"] },
  { label: "Stupéfiants (activité des services)", indicators: ["Trafic de stupéfiants", "Usage de stupéfiants"] },
];

export type CrimeLine = {
  indicator: string; unit: string; first: CrimeStat | undefined; last: CrimeStat | undefined;
  guadeloupe: CrimeStat | undefined; france: CrimeStat | undefined;
};

/** One line per indicator: Martinique first and last year, Guadeloupe and France the last year. */
export function crimeLines(rows: CrimeStat[]): { years: [number, number] | null; groups: { label: string; lines: CrimeLine[] }[] } {
  const mq = rows.filter((r) => r.geo === "972" && r.rate_per_1000 != null);
  if (!mq.length) return { years: null, groups: [] };
  const first = Math.min(...mq.map((r) => r.year)), last = Math.max(...mq.map((r) => r.year));
  const get = (geo: string, ind: string, y: number) => rows.find((r) => r.geo === geo && r.indicator === ind && r.year === y);
  return {
    years: [first, last],
    groups: CRIME_GROUPS.map((g) => ({
      label: g.label,
      lines: g.indicators.filter((ind) => get("972", ind, last)).map((ind) => ({
        indicator: ind, unit: get("972", ind, last)!.unit, first: get("972", ind, first), last: get("972", ind, last),
        guadeloupe: get("971", ind, last), france: get("FR", ind, last),
      })),
    })),
  };
}

export type UnemploymentRow = { year: string; mq: number | null; fm: number | null; mqYouth: number | null; fmYouth: number | null };

/** Annual ILO unemployment, Martinique next to France métropolitaine (all ages and 15-24). */
export function unemploymentRows(figures: ContextFigure[]): UnemploymentRow[] {
  const u = figures.filter((f) => f.indicator === "chomage_bit");
  const v = (geo: string, group: string, y: string) => u.find((f) => f.geo === geo && f.group_label === group && f.period === y)?.value ?? null;
  return [...new Set(u.filter((f) => f.geo === "972").map((f) => f.period))].sort().map((y) => ({
    year: y, mq: v("972", "Ensemble", y), fm: v("FM", "Ensemble", y), mqYouth: v("972", "15-24 ans", y), fmYouth: v("FM", "15-24 ans", y),
  }));
}

/**
 * Grouping of the DPT missions by policy area (Vwapepla's grouping, shown in full on the card). Missions not listed
 * fall under « Autres ». The Outre-mer mission mixes economic support (social charge exemptions) and living
 * conditions (housing): it is kept as its own line rather than split by guess.
 */
export const MISSION_GROUPS: { key: string; label: string; missions: string[] }[] = [
  { key: "securite", label: "Sécurité et justice", missions: [
    "Sécurités", "Justice", "Contrôle de la circulation et du stationnement routiers", "Immigration, asile et intégration"] },
  { key: "social", label: "Social, emploi et logement", missions: [
    "Solidarité, insertion et égalité des chances", "Travail, emploi et administration des ministères sociaux",
    "Cohésion des territoires", "Santé", "Sport, jeunesse et vie associative"] },
  { key: "outremer", label: "Mission Outre-mer (emploi, logement, conditions de vie)", missions: ["Outre-mer"] },
  { key: "economie", label: "Économie, agriculture, environnement et transports", missions: [
    "Écologie, développement et mobilité durables", "Agriculture, alimentation, forêt et affaires rurales",
    "Économie", "Développement agricole et rural", "Contrôle et exploitation aériens",
    "Financement des aides aux collectivités pour l'électrification rurale",
    "Financement des aides aux collectivités pour l’électrification rurale"] },
  { key: "education", label: "Éducation et recherche", missions: ["Enseignement scolaire", "Recherche et enseignement supérieur"] },
  { key: "collectivites", label: "Versements aux collectivités", missions: ["Relations avec les Collectivités territoriales"] },
  { key: "defense", label: "Défense", missions: ["Défense"] },
];

export type SplitLine = { key: string; label: string; cp: number; share: number; missions: string[] };

/** Executed CP of one year by policy area, from the mission lines of the DPT (latest edition carrying that year). */
export function stateSplit(rows: DptCredit[], year: number): { total: number; lines: SplitLine[] } {
  const ex = rows.filter((r) => r.level === "mission" && r.stage === "execution" && r.year === year);
  const edition = Math.max(...ex.map((r) => r.edition));
  const mine = ex.filter((r) => r.edition === edition);
  const total = mine.reduce((s, r) => s + r.cp, 0);
  const used = new Set<string>();
  const lines = MISSION_GROUPS.map((g) => {
    const m = mine.filter((r) => r.mission && g.missions.includes(r.mission));
    m.forEach((r) => used.add(r.mission!));
    const cp = m.reduce((s, r) => s + r.cp, 0);
    return { key: g.key, label: g.label, cp, share: total ? cp / total : 0, missions: m.map((r) => r.mission!) };
  });
  const rest = mine.filter((r) => !used.has(r.mission!));
  const cp = rest.reduce((s, r) => s + r.cp, 0);
  lines.push({ key: "autres", label: "Autres", cp, share: total ? cp / total : 0, missions: rest.map((r) => r.mission!) });
  return { total, lines: lines.filter((l) => l.cp > 0) };
}
