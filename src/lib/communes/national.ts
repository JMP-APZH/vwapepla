import type { Actual } from "./data";

// National comparison (Step 3, Option A — JM, 4 Nov 2026): DGFiP "Comptes individuels des communes", MAIN BUDGET ONLY.
// The national stratum average is always shown next to the commune's own DGFiP figure (same basis), never next to the
// card's OFGL consolidated figure. Rows are built by scripts/communes/pipeline/build.py (metric keys nat_*).

export type NationalUnit = "pct" | "years" | "eur";
export type NationalLine = {
  key: string; // nat_* metric key
  label: string; // what is compared, on the DGFiP basis
  unit: NationalUnit;
  commune: number | null; // the commune, DGFiP main budget
  average: number | null; // national average of its stratum
  sourceId: string | null;
};

/** Which DGFiP line goes under which card figure. `eur` lines compare € per inhabitant. */
export const NATIONAL_OF: Record<string, { key: string; label: string; unit: NationalUnit }> = {
  taux_epargne_brute: { key: "nat_taux_caf", label: "CAF / produits de fonctionnement", unit: "pct" },
  capacite_desendettement: { key: "nat_capacite", label: "Dette / CAF", unit: "years" },
  depenses_equipement: { key: "nat_equip", label: "Dépenses d'équipement", unit: "eur" },
  encours_dette: { key: "nat_dette", label: "Encours de la dette", unit: "eur" },
  part_personnel: { key: "nat_perso", label: "Charges de personnel", unit: "eur" },
  part_etat: { key: "nat_taux_dgf", label: "DGF / produits de fonctionnement", unit: "pct" },
};

export const NATIONAL_KEYS = Object.values(NATIONAL_OF).flatMap((n) => [n.key, `${n.key}_strate`]);

/** The national line for one card figure, from one commune's rows of the year (null when DGFiP has no row). */
export function nationalLine(cardKey: string, rows: Map<string, Actual> | undefined): NationalLine | null {
  const n = NATIONAL_OF[cardKey];
  const mine = rows?.get(n?.key ?? ""), avg = rows?.get(`${n?.key}_strate`);
  if (!n || !mine || !avg) return null;
  const v = (a: Actual) => (n.unit === "eur" ? a.eur_per_hab : a.amount);
  return { key: n.key, label: n.label, unit: n.unit, commune: v(mine), average: v(avg), sourceId: mine.source_id };
}

// DGFiP population strata (`nomsst1`). The pipeline checks, for every commune and year, that the population falls in
// the band DGFiP published (build.py, "DGFiP CI stratum").
const BANDS: [number, number][] = [
  [0, 100], [100, 200], [200, 500], [500, 2000], [2000, 3500], [3500, 5000], [5000, 10000], [10000, 20000],
  [20000, 50000], [50000, 100000],
];
const n0 = { format: (v: number) => new Intl.NumberFormat("fr-FR").format(v).replace(/\s/g, "\u00a0") }; // no break inside "10 000"

/** "communes de 10 000 à 20 000 hab." (the DGFiP stratum of this population). */
export function dgfipStratum(population: number | null | undefined): string | null {
  if (population == null) return null;
  const b = BANDS.find(([lo, hi]) => population >= lo && population < hi);
  return b ? `communes de ${n0.format(b[0])} à ${n0.format(b[1])} hab.` : "communes de 100 000 hab. et plus";
}
