import type { Actual, Metric } from "./data";
import { MIN_STRATUM_SIZE } from "./config";
import { median } from "./format";

// Budget blocks of the card, built from metric_definitions (the validated mapping, stored as data).
// A line is shown when `on_card`; its displayed parent is its nearest shown ancestor.
// "dont …" lines are subsets of another line (OFGL formulas): shown under it, never added to any sum.

export const SUBSET_OF: Record<string, string> = {
  fiscalite_reversee: "impots_locaux", // Fiscalité reversée is inside Impôts locaux (OFGL CN732)
  octroi_de_mer: "autres_impots_taxes", // DGFiP balances, M14 7373 / M57 73431
  subv_droit_prive: "depenses_intervention",
  encours_dette_bancaire: "encours_dette",
  encours_dette_depots: "encours_dette",
};

export type BlockId = "income_operating" | "spending_operating" | "income_investment" | "spending_investment" | "savings_debt";

export const BLOCKS: { id: BlockId; title: string }[] = [
  { id: "income_operating", title: "D'où vient l'argent du fonctionnement" },
  { id: "spending_operating", title: "Où va l'argent du fonctionnement" },
  { id: "income_investment", title: "Recettes d'investissement" },
  { id: "spending_investment", title: "Dépenses d'investissement" },
  { id: "savings_debt", title: "Épargne et dette" },
];

export type LineDef = {
  key: string; label: string; unit: Metric["unit"];
  parent: string | null; // nearest shown ancestor (null = top line of the block)
  depth: number; subset: boolean;
};

/** Shown lines of one block, depth-first in display order. */
export function blockLines(metrics: Map<string, Metric>, block: BlockId): LineDef[] {
  const shown = [...metrics.values()].filter((m) => m.block === block && m.on_card);
  const shownKeys = new Set(shown.map((m) => m.key));
  const parentOf = (key: string): string | null => {
    let p: string | null = SUBSET_OF[key] ?? metrics.get(key)?.parent_key ?? null;
    while (p && !shownKeys.has(p)) p = metrics.get(p)?.parent_key ?? null;
    return p;
  };
  const children = new Map<string | null, Metric[]>();
  for (const m of shown) {
    const p = parentOf(m.key);
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(m);
  }
  const out: LineDef[] = [];
  const walk = (p: string | null, depth: number) => {
    // Real parts first, then the "dont" lines, each in display order.
    const kids = (children.get(p) ?? []).sort((a, b) =>
      Number(a.key in SUBSET_OF) - Number(b.key in SUBSET_OF) || a.display_order - b.display_order);
    for (const m of kids) {
      out.push({ key: m.key, label: m.label_fr, unit: m.unit, parent: p, depth, subset: m.key in SUBSET_OF });
      walk(m.key, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export type LineValue = LineDef & {
  amount: number | null;
  perHab: number | null; // € / inhabitant (null for years / ratios)
  share: number | null; // of the displayed parent's amount
  median: number | null; // € / hab. (or years) of the reference group
  sourceId: string | null;
};

export type Reference = { kind: "stratum" | "martinique"; size: number };

/**
 * Values of one commune for one year, with the median of the same population stratum
 * (Martinique median when the stratum has fewer than MIN_STRATUM_SIZE communes).
 * `yearRows` = the block's metrics for all communes that year; `stratumOf` = commune -> stratum that year.
 */
export function blockValues(
  lines: LineDef[], code: string, yearRows: Actual[], stratumOf: Map<string, string | null>,
): { values: LineValue[]; reference: Reference } {
  const byCommune = new Map<string, Map<string, Actual>>();
  for (const r of yearRows) {
    if (!byCommune.has(r.commune_code)) byCommune.set(r.commune_code, new Map());
    byCommune.get(r.commune_code)!.set(r.metric_key, r);
  }
  const stratum = stratumOf.get(code) ?? null;
  const peers = [...byCommune.keys()].filter((c) => stratum != null && stratumOf.get(c) === stratum);
  const group = peers.length >= MIN_STRATUM_SIZE ? peers : [...byCommune.keys()];
  const reference: Reference = { kind: group === peers ? "stratum" : "martinique", size: group.length };
  const mine = byCommune.get(code);
  const comparable = (a: Actual | undefined, unit: Metric["unit"]) => (unit === "eur" ? a?.eur_per_hab : a?.amount) ?? null;
  const values = lines.map((l) => {
    const a = mine?.get(l.key);
    const parentAmount = l.parent ? mine?.get(l.parent)?.amount : null;
    return {
      ...l,
      amount: a?.amount ?? null,
      perHab: l.unit === "eur" ? a?.eur_per_hab ?? null : null,
      share: a?.amount != null && parentAmount ? a.amount / parentAmount : null,
      median: median(group.map((c) => comparable(byCommune.get(c)?.get(l.key), l.unit)).filter((v): v is number => v != null)),
      sourceId: a?.source_id ?? null,
    };
  });
  return { values, reference };
}
