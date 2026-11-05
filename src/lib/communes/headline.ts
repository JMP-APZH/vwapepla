import type { Actual } from "./data";
import type { HeroFigure } from "./config";
import { MIN_STRATUM_SIZE } from "./config";
import type { Reference } from "./breakdown";
import { median } from "@/lib/core/format";

export type HeroValue = {
  figure: HeroFigure;
  value: number | null; // share (0..1), years, or € / hab.
  median: number | null; // of the reference group
  reference: Reference;
  sourceIds: string[];
};

/** Metric keys the hero needs. */
export function heroKeys(figures: HeroFigure[]): string[] {
  return [...new Set(figures.flatMap((f) => (f.kind === "ratio" ? [f.num, f.den] : [f.metric])))];
}

/** Value of one figure from one commune's metrics of the year (null = not computable, never 0). */
export function heroValue(f: HeroFigure, m: Map<string, Actual> | undefined): number | null {
  if (!m) return null;
  if (f.kind === "ratio") {
    const a = m.get(f.num)?.amount, b = m.get(f.den)?.amount;
    return a != null && b ? a / b : null;
  }
  return f.kind === "years" ? m.get(f.metric)?.amount ?? null : m.get(f.metric)?.eur_per_hab ?? null;
}

/**
 * The hero trio for one commune, each with the median of ONE reference group — the same rule as the budget blocks:
 * communes of the same population stratum, or the whole of Martinique when the stratum has fewer than
 * MIN_STRATUM_SIZE communes (or when `stratumOf` is empty: compare page).
 */
export function computeHero(
  figures: HeroFigure[], code: string, rows: Actual[], stratumOf: Map<string, string | null>,
): HeroValue[] {
  const byCommune = new Map<string, Map<string, Actual>>();
  for (const r of rows) {
    if (!byCommune.has(r.commune_code)) byCommune.set(r.commune_code, new Map());
    byCommune.get(r.commune_code)!.set(r.metric_key, r);
  }
  const stratum = stratumOf.get(code) ?? null;
  const peers = [...byCommune.keys()].filter((c) => stratum != null && stratumOf.get(c) === stratum);
  const group = peers.length >= MIN_STRATUM_SIZE ? peers : [...byCommune.keys()];
  const reference: Reference = { kind: group === peers ? "stratum" : "martinique", size: group.length };
  const mine = byCommune.get(code);
  return figures.map((f) => ({
    figure: f,
    value: heroValue(f, mine),
    median: median(group.map((c) => heroValue(f, byCommune.get(c))).filter((v): v is number => v != null)),
    reference,
    sourceIds: heroKeys([f]).map((k) => mine?.get(k)?.source_id).filter((s): s is string => !!s),
  }));
}
