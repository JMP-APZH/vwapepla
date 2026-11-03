import type { Actual } from "./data";

export type Term = {
  id: string; election_year: number; start_date: string; end_date: string | null;
  first_full_year: number; last_full_year: number;
};

export type TermRow = { key: string; label: string; kind: "avg_per_hab" | "end_per_hab" | "end_amount"; unit: "eur" | "years" };

// Indicators compared across terms. Flows: average € / inhabitant over the full years in office.
// Stocks (debt) and the debt ratio: value at the end of the last full year in office.
export const TERM_ROWS: TermRow[] = [
  { key: "rf_total", label: "Recettes de fonctionnement", kind: "avg_per_hab", unit: "eur" },
  { key: "df_total", label: "Dépenses de fonctionnement", kind: "avg_per_hab", unit: "eur" },
  { key: "di_hors_remb", label: "Investissement", kind: "avg_per_hab", unit: "eur" },
  { key: "epargne_brute", label: "Épargne brute", kind: "avg_per_hab", unit: "eur" },
  { key: "encours_dette", label: "Dette en fin de période", kind: "end_per_hab", unit: "eur" },
  { key: "capacite_desendettement", label: "Années pour rembourser (fin de période)", kind: "end_amount", unit: "years" },
];

export type TermSummary = {
  term: Term;
  years: number[]; // full years in office for which data exists
  expectedYears: number[]; // all full years in office (already elapsed)
  partial: boolean; // some full years have no data (e.g. 2008-2014: only 2012-2013 published)
  values: Record<string, number | null>;
};

/** Summaries for terms that have at least one full year of data, oldest first. */
export function summarizeTerms(terms: Term[], actuals: Actual[], rows = TERM_ROWS): TermSummary[] {
  const at = new Map(actuals.map((a) => [`${a.year}|${a.metric_key}`, a]));
  const available = new Set(actuals.filter((a) => a.metric_key === "rf_total").map((a) => a.year));
  const lastYear = Math.max(...available);
  return [...terms]
    .sort((a, b) => a.election_year - b.election_year)
    .map((term) => {
      const expectedYears: number[] = [];
      for (let y = term.first_full_year; y <= Math.min(term.last_full_year, lastYear); y++) expectedYears.push(y);
      const years = expectedYears.filter((y) => available.has(y));
      const values: Record<string, number | null> = {};
      for (const r of rows) {
        if (r.kind === "avg_per_hab") {
          const v = years.map((y) => at.get(`${y}|${r.key}`)?.eur_per_hab).filter((x): x is number => x != null);
          values[r.key] = v.length === years.length && v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
        } else {
          const end = at.get(`${years.at(-1)}|${r.key}`);
          values[r.key] = (r.kind === "end_per_hab" ? end?.eur_per_hab : end?.amount) ?? null;
        }
      }
      return { term, years, expectedYears, partial: years.length < expectedYears.length, values };
    })
    .filter((s) => s.years.length > 0);
}
