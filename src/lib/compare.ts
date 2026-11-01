import type { Actual } from "./data";
import { blockValues, type LineDef, type LineValue } from "./breakdown";

export const MAX_COMPARE = 4;

/** `?c=97209,97213&annee=2024` -> valid, distinct commune codes in the order given (max 4) and a known year. */
export function parseCompare(
  c: string | string[] | undefined, annee: string | string[] | undefined, known: Set<string>, years: number[], fallback: number,
): { codes: string[]; year: number } {
  const raw = (Array.isArray(c) ? c.join(",") : c ?? "").split(",").map((s) => s.trim());
  const codes = [...new Set(raw.filter((s) => known.has(s)))].slice(0, MAX_COMPARE);
  const y = Number(Array.isArray(annee) ? annee[0] : annee);
  return { codes, year: years.includes(y) ? y : fallback };
}

export type CompareRow = { line: LineDef; values: (LineValue | undefined)[]; medianMartinique: number | null };

/**
 * One row per budget line: each picked commune's value (in the order picked — never sorted by value)
 * and the median of the 34 communes as a neutral reference.
 */
export function compareRows(lines: LineDef[], codes: string[], yearRows: Actual[]): CompareRow[] {
  const noStrata = new Map<string, string | null>(); // -> reference group = all communes of Martinique
  const per = codes.map((code) => blockValues(lines, code, yearRows, noStrata).values);
  return lines.map((line, i) => ({
    line,
    values: per.map((v) => v[i]),
    medianMartinique: per[0]?.[i]?.median ?? blockValues([line], "", yearRows, noStrata).values[0].median,
  }));
}
