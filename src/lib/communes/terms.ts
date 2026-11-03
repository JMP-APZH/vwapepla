import type { Actual } from "./data";

export type Term = {
  id: string; election_year: number; start_date: string; end_date: string | null;
  first_full_year: number; last_full_year: number;
};

export type TermRow =
  | { key: string; label: string; kind: "avg_per_hab" | "end_per_hab" | "end_amount"; unit: "eur" | "years" }
  | { key: string; label: string; kind: "ratio_sum"; num: string; den: string; unit: "pct" };

// The hero trio + debt, mandate by mandate (docs/branches/B1-KPI.md, JM 3 Nov 2026).
// Flows: average € / inhabitant over the full years in office. Rates: sum of the numerator / sum of the denominator over
// those years (one odd year does not dominate). Stocks (debt) and the debt ratio: end of the last full year in office.
export const TERM_ROWS: TermRow[] = [
  { key: "taux_epargne_brute", label: "Taux d'épargne brute", kind: "ratio_sum", num: "epargne_brute", den: "rf_total", unit: "pct" },
  { key: "capacite_desendettement", label: "Capacité de désendettement (fin de période)", kind: "end_amount", unit: "years" },
  { key: "depenses_equipement", label: "Dépenses d'équipement (moyenne / hab.)", kind: "avg_per_hab", unit: "eur" },
  { key: "encours_dette", label: "Dette en fin de période (/ hab.)", kind: "end_per_hab", unit: "eur" },
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
        if (r.kind === "ratio_sum") {
          const n = years.map((y) => at.get(`${y}|${r.num}`)?.amount), d = years.map((y) => at.get(`${y}|${r.den}`)?.amount);
          const complete = years.length > 0 && [...n, ...d].every((x) => x != null);
          const den = complete ? d.reduce((a, x) => a! + x!, 0)! : 0;
          values[r.key] = complete && den ? n.reduce((a, x) => a! + x!, 0)! / den : null;
        } else if (r.kind === "avg_per_hab") {
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
