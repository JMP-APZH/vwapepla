import { describe, expect, it } from "vitest";
import type { Actual, Metric } from "./data";
import { blockLines, blockValues } from "./breakdown";

const metric = (key: string, parent_key: string | null, on_card: boolean, display_order: number,
  unit: Metric["unit"] = "eur"): Metric => ({
  key, block: "income_operating", parent_key, label_fr: key, label_kreyol: null, source_rule: "", unit, on_card,
  description_fr: null, display_order,
});
const metrics = new Map([
  metric("rf_total", null, true, 1),
  metric("impots_taxes", "rf_total", false, 2), // hidden level: its children are lifted to rf_total
  metric("impots_locaux", "impots_taxes", true, 3),
  metric("fiscalite_reversee", null, true, 4), // "dont" line of impots_locaux
  metric("autres_impots_taxes", "impots_taxes", true, 5),
  metric("octroi_de_mer", null, true, 6), // "dont" line of autres_impots_taxes
  metric("concours_etat", "rf_total", true, 7),
  metric("dgf", "concours_etat", false, 8),
].map((m) => [m.key, m]));

const row = (c: string, k: string, amount: number, perHab: number, provisional = false): Actual => ({
  commune_code: c, year: 2024, metric_key: k, amount, eur_per_hab: perHab, provisional, source_id: "ofgl",
});

describe("blockLines", () => {
  const lines = blockLines(metrics, "income_operating");
  it("lifts lines under the nearest shown ancestor and puts 'dont' lines under their superset", () => {
    expect(lines.map((l) => [l.key, l.parent, l.depth])).toEqual([
      ["rf_total", null, 0],
      ["impots_locaux", "rf_total", 1],
      ["fiscalite_reversee", "impots_locaux", 2],
      ["autres_impots_taxes", "rf_total", 1],
      ["octroi_de_mer", "autres_impots_taxes", 2],
      ["concours_etat", "rf_total", 1],
    ]);
  });
  it("marks subset lines so they are never added up", () => {
    expect(lines.filter((l) => l.subset).map((l) => l.key)).toEqual(["fiscalite_reversee", "octroi_de_mer"]);
  });
});

describe("blockValues", () => {
  const lines = blockLines(metrics, "income_operating");
  const rows = [
    row("97201", "rf_total", 1000, 100), row("97201", "impots_locaux", 500, 50), row("97201", "fiscalite_reversee", 200, 20),
    row("97201", "autres_impots_taxes", 300, 30), row("97201", "octroi_de_mer", 250, 25), row("97201", "concours_etat", 200, 20),
    row("97202", "rf_total", 2000, 300), row("97203", "rf_total", 3000, 500), row("97204", "rf_total", 9000, 900),
  ];
  const strata = new Map<string, string | null>([["97201", "3"], ["97202", "3"], ["97203", "3"], ["97204", "9"]]);

  it("non-subset children add up to their parent", () => {
    const { values } = blockValues(lines, "97201", rows, strata);
    const sum = values.filter((v) => v.parent === "rf_total" && !v.subset).reduce((s, v) => s + (v.amount ?? 0), 0);
    expect(sum).toBe(values[0].amount);
  });
  it("shares are of the displayed parent", () => {
    const { values } = blockValues(lines, "97201", rows, strata);
    expect(values.find((v) => v.key === "octroi_de_mer")!.share).toBeCloseTo(250 / 300);
    expect(values[0].share).toBeNull();
  });
  it("uses the stratum median, or Martinique when the stratum is too small", () => {
    expect(blockValues(lines, "97201", rows, strata).reference).toEqual({ kind: "stratum", size: 3 });
    expect(blockValues(lines, "97201", rows, strata).values[0].median).toBe(300);
    const r = blockValues(lines, "97204", rows, strata);
    expect(r.reference).toEqual({ kind: "martinique", size: 4 });
    expect(r.values[0].median).toBe(400);
  });
  it("keeps missing values as null, never zero", () => {
    const { values } = blockValues(lines, "97202", rows, strata);
    expect(values.find((v) => v.key === "impots_locaux")!.amount).toBeNull();
  });
});
