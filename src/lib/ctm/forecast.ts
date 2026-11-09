// Forecast layer (« Prévisionnel »): budgets primitifs voted by the Assemblée (main budget), never mixed with the actuals
// (pure, tested). Figures: ctm_forecast_figures, read from pages D1 / D2 of the published BP (scripts/ctm/pipeline/bp.py),
// same line keys as ctm_ca_lines, so the BP (prévu) and the CA (réalisé) can sit in separate columns of one table.
// Orientation reports (ROB) are listed and linked only (docs/branches/B3-MAPPING.md §H).
import type { CaLine } from "./ca";

export type ForecastDoc = {
  id: string; fiscal_year: number; doc_type: "BP" | "ROB"; deliberation: string; title: string; source_id: string;
};
export type ForecastFigure = {
  document_id: string; line_key: string; label: string; amount: number; page: number; quote: string | null;
};
type Line = { amount: number; page: number };
export type ForecastRow = { key: string; label: string; amount: number | null; page: number | null };
export type PlannedRow = {
  key: string; label: string; planned: number | null; plannedPage: number | null;
  actual: number | null; actualPage: number | null; diff: number | null;
};

/** Lines shown, each computed the same way from the BP and from the CA. */
const ROWS: { key: string; label: string; value: (l: (k: string) => Line | undefined) => [number | null, number | null] }[] = [
  { key: "fonc_depenses", label: "Dépenses réelles de fonctionnement", value: (l) => one(l("fonc_depenses_reelles")) },
  { key: "fonc_recettes", label: "Recettes réelles de fonctionnement", value: (l) => one(l("fonc_recettes_reelles")) },
  { key: "epargne_brute", label: "Épargne brute (recettes – dépenses réelles de fonctionnement)", value: (l) => one(l("fonc_solde_reel")) },
  { key: "investissement", label: "Investissement hors remboursements d'emprunts",
    value: (l) => {
      const t = l("inv_depenses_reelles"), d = l("inv_dette_depenses");
      return [t && d ? round2(t.amount - d.amount) : null, t?.page ?? null];
    } },
  { key: "remboursements", label: "Remboursements d'emprunts", value: (l) => one(l("inv_dette_depenses")) },
  { key: "emprunts", label: "Emprunts nouveaux (chapitre 923, recettes)", value: (l) => one(l("inv_dette_recettes")) },
];

/** Deliberations of the Assemblée that amend each year's main budget after the BP (budget supplémentaire, decisions
 *  modificatives), as found in the CTM's acts index; listed and linked, figures not read. */
export const AMENDMENTS: Record<number, string[]> = {
  2024: ["24-99-1", "24-213-1", "24-277-1"],
  2025: ["25-77-1", "25-197-1", "25-285-1", "25-375-1"],
  2026: ["26-145-1", "26-199-1", "26-272-1"],
};

const one = (x: Line | undefined): [number | null, number | null] => [x?.amount ?? null, x?.page ?? null];
const round2 = (n: number) => Math.round(n * 100) / 100;

export function bpYears(docs: ForecastDoc[]): number[] {
  return [...new Set(docs.filter((d) => d.doc_type === "BP").map((d) => d.fiscal_year))].sort((a, b) => b - a);
}

export function bpDoc(docs: ForecastDoc[], year: number): ForecastDoc | undefined {
  return docs.find((d) => d.doc_type === "BP" && d.fiscal_year === year);
}

/** The BP lines of one year, each with its page. */
export function forecastRows(docs: ForecastDoc[], figures: ForecastFigure[], year: number): ForecastRow[] {
  const doc = bpDoc(docs, year);
  const l = (k: string) => figures.find((f) => f.document_id === doc?.id && f.line_key === k);
  return ROWS.map((r) => {
    const [amount, page] = r.value(l);
    return { key: r.key, label: r.label, amount, page };
  });
}

/** Years with both a BP and a CA, most recent first. */
export function plannedYears(docs: ForecastDoc[], ca: CaLine[]): number[] {
  const done = new Set(ca.map((l) => l.year));
  return bpYears(docs).filter((y) => done.has(y));
}

/** BP (prévu) beside CA (réalisé) for one year: two separate columns and their difference, never one series. */
export function plannedVsActual(docs: ForecastDoc[], figures: ForecastFigure[], ca: CaLine[], year: number): PlannedRow[] {
  const planned = forecastRows(docs, figures, year);
  const l = (k: string) => ca.find((x) => x.year === year && x.budget === "principal" && x.line_key === k);
  return ROWS.map((r, i) => {
    const [actual, actualPage] = r.value(l);
    const p = planned[i];
    return { key: r.key, label: r.label, planned: p.amount, plannedPage: p.page, actual, actualPage,
             diff: p.amount != null && actual != null ? round2(actual - p.amount) : null };
  });
}
