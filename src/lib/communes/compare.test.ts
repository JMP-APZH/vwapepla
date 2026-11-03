import { describe, expect, it } from "vitest";
import type { Actual } from "./data";
import type { LineDef } from "./breakdown";
import { compareRows, parseCompare } from "./compare";

const known = new Set(["97201", "97202", "97203", "97204", "97209"]);

describe("parseCompare", () => {
  it("keeps known, distinct codes in the order given, at most 4", () => {
    expect(parseCompare("97209,97201,97209,99999,97202,97203,97204", undefined, known, [2024], 2024).codes)
      .toEqual(["97209", "97201", "97202", "97203"]);
  });
  it("falls back to the reference year for unknown years", () => {
    expect(parseCompare("97201", "1999", known, [2023, 2024], 2024).year).toBe(2024);
    expect(parseCompare("97201", "2023", known, [2023, 2024], 2024).year).toBe(2023);
    expect(parseCompare(undefined, undefined, known, [2024], 2024).codes).toEqual([]);
  });
});

describe("compareRows", () => {
  const line: LineDef = { key: "rf_total", label: "Recettes", unit: "eur", parent: null, depth: 0, subset: false };
  const row = (c: string, v: number): Actual => ({
    commune_code: c, year: 2024, metric_key: "rf_total", amount: v * 1000, eur_per_hab: v, provisional: false, source_id: "s",
  });
  const rows = [row("97201", 100), row("97202", 300), row("97203", 200)];
  it("keeps the picked order and gives the Martinique median", () => {
    const [r] = compareRows([line], ["97202", "97201"], rows);
    expect(r.values.map((v) => v?.perHab)).toEqual([300, 100]);
    expect(r.medianMartinique).toBe(200);
  });
});
