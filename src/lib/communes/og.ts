// Text of the share image of a commune card (opengraph-image): the hero trio of the reference year, each with the
// median of its named group. Facts only: no vote result, no score, no rank. Same numbers and formats as the card (Hero).
import type { HeroValue } from "./headline";
import { debtYears, pctDec } from "./format";
import { eur } from "@/lib/core/format";

export type OgFigure = { label: string; value: string; median: string };

/** fr-FR formats use narrow / no-break spaces; the image font may not have them, so they become plain spaces. */
export function plainSpaces(s: string): string {
  return s.replace(/[  ]/g, " ");
}

function show(h: HeroValue, v: number | null): string {
  const s = h.figure.kind === "ratio" ? pctDec(v) : h.figure.kind === "years" ? debtYears(v) : eur(v);
  return plainSpaces(v != null && h.figure.kind === "per_hab" ? `${s} / hab.` : s);
}

/** One line per hero figure; `null` stays « non calculable », never 0. The median names its group size. */
export function ogFigures(values: HeroValue[]): OgFigure[] {
  return values.map((h) => ({
    label: h.figure.label,
    value: show(h, h.value),
    median: `médiane de ${h.reference.size} communes${h.reference.kind === "stratum" ? " de même taille" : " de Martinique"} : ${show(h, h.median)}`,
  }));
}
