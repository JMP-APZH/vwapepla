// State credits in Martinique (DPT Outre-mer, territorial table). Each budget-bill edition E gives three stages:
// executed (E - 2), voted LFI (E - 1) and proposed PLF (E). Stages are never merged into one series: an executed
// figure, a voted one and a proposed one are different facts (PLF is « prévisionnel »).

export type Stage = "execution" | "lfi" | "plf";
export type DptCredit = {
  edition: number; page: number; level: "mission" | "programme" | "total"; mission: string | null; code: string | null;
  label: string; stage: Stage; year: number; ae: number; cp: number; source_id: string;
};
export type StageValue = { ae: number; cp: number; edition: number; page: number; sourceId: string };
export type YearRow = { year: number } & Partial<Record<Stage, StageValue>>;

/** One row per year with the executed, voted and proposed totals available for it (latest edition wins). */
export function totalsByYear(rows: DptCredit[]): YearRow[] {
  const byYear = new Map<number, YearRow>();
  for (const r of rows.filter((x) => x.level === "total").sort((a, b) => a.edition - b.edition)) {
    const row = byYear.get(r.year) ?? { year: r.year };
    row[r.stage] = { ae: r.ae, cp: r.cp, edition: r.edition, page: r.page, sourceId: r.source_id };
    byYear.set(r.year, row);
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

/** Latest year with executed figures. */
export function lastExecutedYear(rows: DptCredit[]): number | null {
  const ys = rows.filter((r) => r.level === "total" && r.stage === "execution").map((r) => r.year);
  return ys.length ? Math.max(...ys) : null;
}

/** Missions of one executed year by payments (CP), largest first; the rest summed in « Autres missions ». */
export function topMissions(rows: DptCredit[], year: number, n = 8): { label: string; cp: number; share: number }[] {
  const missions = rows.filter((r) => r.level === "mission" && r.stage === "execution" && r.year === year)
    .sort((a, b) => b.cp - a.cp);
  const total = missions.reduce((s, m) => s + m.cp, 0);
  if (!total) return [];
  const top = missions.slice(0, n).map((m) => ({ label: m.label, cp: m.cp, share: m.cp / total }));
  const rest = missions.slice(n).reduce((s, m) => s + m.cp, 0);
  return rest ? [...top, { label: "Autres missions", cp: rest, share: rest / total }] : top;
}
