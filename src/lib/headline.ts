import type { Actual } from "./data";
import type { HeadlineFigure } from "./config";
import { MIN_STRATUM_SIZE } from "./config";
import { median } from "./format";

export type HeadlineValue = {
  figure: HeadlineFigure;
  value: number | null; // € / hab. or share (0..1)
  extra: number | null; // e.g. years to repay the debt
  medianMartinique: number | null;
  medianStratum: number | null; // null when the stratum is too small to compare
  stratumSize: number;
  sourceIds: string[];
};

/** Metric keys a set of figures needs. */
export function headlineKeys(figures: HeadlineFigure[]): string[] {
  return [...new Set(figures.flatMap((f) => (f.kind === "share" ? [f.metric, f.of] : [f.metric, f.extra?.metric])))]
    .filter((k): k is string => !!k);
}

/**
 * Value of each figure for one commune, with the Martinique median and the same-stratum median.
 * `rows` = the needed metrics for all communes of the year; `stratumOf` = commune code -> stratum.
 */
export function computeHeadline(
  figures: HeadlineFigure[], code: string, rows: Actual[], stratumOf: Map<string, string | null>,
): HeadlineValue[] {
  const byCommune = new Map<string, Map<string, Actual>>();
  for (const r of rows) {
    if (!byCommune.has(r.commune_code)) byCommune.set(r.commune_code, new Map());
    byCommune.get(r.commune_code)!.set(r.metric_key, r);
  }
  const valueOf = (f: HeadlineFigure, c: string): number | null => {
    const m = byCommune.get(c);
    if (!m) return null;
    if (f.kind === "share") {
      const a = m.get(f.metric)?.amount, b = m.get(f.of)?.amount;
      return a != null && b ? a / b : null;
    }
    return m.get(f.metric)?.eur_per_hab ?? null;
  };
  const stratum = stratumOf.get(code) ?? null;
  const peers = [...byCommune.keys()].filter((c) => stratum != null && stratumOf.get(c) === stratum);
  return figures.map((f) => {
    const all = [...byCommune.keys()].map((c) => valueOf(f, c)).filter((v): v is number => v != null);
    const same = peers.map((c) => valueOf(f, c)).filter((v): v is number => v != null);
    const m = byCommune.get(code);
    const keys = f.kind === "share" ? [f.metric, f.of] : [f.metric];
    return {
      figure: f,
      value: valueOf(f, code),
      extra: f.kind === "per_hab" && f.extra ? m?.get(f.extra.metric)?.amount ?? null : null,
      medianMartinique: median(all),
      medianStratum: same.length >= MIN_STRATUM_SIZE ? median(same) : null,
      stratumSize: same.length,
      sourceIds: keys.map((k) => m?.get(k)?.source_id).filter((s): s is string => !!s),
    };
  });
}
