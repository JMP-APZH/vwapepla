// Spending by area of responsibility (M57 functional presentation), CTM main budget, 2018 onwards (pure, tested).
// Rows: ctm_functional_actuals, built by scripts/ctm/pipeline/functions.py (B3-MAPPING.md §E).

export type FunctionalRow = {
  year: number; section: "fonctionnement" | "investissement"; fonction: string; label: string; amount: number;
  eur_per_hab: number | null; provisional: boolean; source_id: string;
};
export type AreaLine = {
  fonction: string; label: string; operating: number | null; investment: number | null; total: number;
  perHab: number | null; share: number;
};

export const NOT_BROKEN_DOWN = "nv";

/** One line per area for a year: operating, investment, total, per inhabitant, share of the total. Areas in code
 *  order (0-8), never ranked; the part not broken down by area comes last. */
export function areasForYear(rows: FunctionalRow[], year: number): AreaLine[] {
  const own = rows.filter((r) => r.year === year);
  const codes = [...new Set(own.map((r) => r.fonction))].sort((a, b) =>
    a === NOT_BROKEN_DOWN ? 1 : b === NOT_BROKEN_DOWN ? -1 : a.localeCompare(b));
  const grand = own.reduce((s, r) => s + r.amount, 0);
  return codes.map((code) => {
    const op = own.find((r) => r.fonction === code && r.section === "fonctionnement");
    const inv = own.find((r) => r.fonction === code && r.section === "investissement");
    const total = (op?.amount ?? 0) + (inv?.amount ?? 0);
    const perHab = op?.eur_per_hab != null || inv?.eur_per_hab != null ? (op?.eur_per_hab ?? 0) + (inv?.eur_per_hab ?? 0) : null;
    return { fonction: code, label: (op ?? inv)!.label, operating: op?.amount ?? null, investment: inv?.amount ?? null,
             total, perHab, share: grand ? total / grand : 0 };
  }).filter((l) => Math.abs(l.total) >= 1);
}

/** Operating + investment per area and year, for the trend table (years ascending). */
export function areaTrend(rows: FunctionalRow[]): { years: number[]; provisional: Set<number>;
  areas: { fonction: string; label: string; values: Map<number, number> }[] } {
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  const provisional = new Set(rows.filter((r) => r.provisional).map((r) => r.year));
  const byArea = new Map<string, { fonction: string; label: string; values: Map<number, number> }>();
  for (const r of rows.filter((x) => x.fonction !== NOT_BROKEN_DOWN)) {
    const a = byArea.get(r.fonction) ?? { fonction: r.fonction, label: r.label, values: new Map() };
    a.values.set(r.year, (a.values.get(r.year) ?? 0) + r.amount);
    byArea.set(r.fonction, a);
  }
  return { years, provisional, areas: [...byArea.values()].sort((a, b) => a.fonction.localeCompare(b.fonction)) };
}
