// CTM budget helpers (pure, tested in ctm.test.ts). Rows come from ctm_actuals / ctm_metric_definitions, built by
// scripts/ctm/pipeline/build.py (mapping: docs/branches/B3-MAPPING.md). The three bodies are never summed.

export const CTM = "200055507";
export const REGION = "239720014";
export const DEPARTEMENT = "229720016";
export const FIRST_CTM_YEAR = 2016;

export type Actual = {
  entity_siren: string; year: number; metric_key: string; amount: number | null; amount_bp: number | null;
  eur_per_hab: number | null; scope: "consolide" | "budget_principal"; provisional: boolean; source_id: string;
};
export type MetricDef = { key: string; block: string; parent_key: string | null; label_fr: string; unit: string; display_order: number };
export type Point = { year: number; value: number | null; provisional: boolean };
export type Line = { key: string; label: string; amount: number | null; perHab: number | null; share: number | null; sourceId: string | null };

export function index(rows: Actual[]): Map<string, Actual> {
  return new Map(rows.map((r) => [`${r.entity_siren}|${r.year}|${r.metric_key}`, r]));
}

export function get(idx: Map<string, Actual>, siren: string, year: number, key: string): Actual | undefined {
  return idx.get(`${siren}|${year}|${key}`);
}

/** Last CTM year whose accounts are final (the provisional year is shown, but labelled, and not used as reference). */
export function referenceYear(rows: Actual[]): number | null {
  const years = rows.filter((r) => r.entity_siren === CTM && !r.provisional && r.amount != null).map((r) => r.year);
  return years.length ? Math.max(...years) : null;
}

export function series(rows: Actual[], siren: string, key: string, from = FIRST_CTM_YEAR, perHab = false): Point[] {
  return rows
    .filter((r) => r.entity_siren === siren && r.metric_key === key && r.year >= from)
    .sort((a, b) => a.year - b.year)
    .map((r) => ({ year: r.year, value: perHab ? r.eur_per_hab : r.amount, provisional: r.provisional }));
}

/** A total and its parts for one year (parts in display order; share of the total, null when not computable). */
export function breakdown(idx: Map<string, Actual>, defs: MetricDef[], siren: string, year: number, parent: string): { total: Line; parts: Line[] } {
  const line = (d: MetricDef, total: number | null): Line => {
    const a = get(idx, siren, year, d.key);
    const amount = a?.amount ?? null;
    return { key: d.key, label: d.label_fr, amount, perHab: a?.eur_per_hab ?? null,
             share: amount != null && total ? amount / total : null, sourceId: a?.source_id ?? null };
  };
  const top = defs.find((d) => d.key === parent);
  if (!top) throw new Error(`unknown metric ${parent}`);
  const total = line(top, null);
  const parts = defs.filter((d) => d.parent_key === parent).sort((a, b) => a.display_order - b.display_order)
    .map((d) => line(d, total.amount));
  return { total, parts };
}

/** Rows for the "before the CTM" table: one per year, Région and Département side by side, never summed. */
export type BeforeRow = { year: number; scope: Actual["scope"]; region: number | null; departement: number | null };
export function beforeCtm(rows: Actual[], key: string): BeforeRow[] {
  const idx = index(rows);
  const years = [...new Set(rows.filter((r) => r.year < FIRST_CTM_YEAR && r.metric_key === key).map((r) => r.year))].sort();
  return years.map((year) => {
    const r = get(idx, REGION, year, key), d = get(idx, DEPARTEMENT, year, key);
    return { year, scope: (r ?? d)!.scope, region: r?.amount ?? null, departement: d?.amount ?? null };
  });
}

export function sourceIds(rows: (Actual | Line | undefined)[]): string[] {
  return [...new Set(rows.flatMap((r) => (r == null ? [] : "source_id" in r ? [r.source_id] : r.sourceId ? [r.sourceId] : [])))];
}
