import { describe, expect, it } from "vitest";
import type { Actual } from "./data";
import { dgfipStratum, nationalLine } from "./national";

const a = (metric_key: string, amount: number | null, eur_per_hab: number | null): [string, Actual] =>
  [metric_key, { commune_code: "97232", year: 2023, metric_key, amount, eur_per_hab, provisional: false, source_id: "ci-2023" }];

describe("nationalLine", () => {
  const rows = new Map([
    a("nat_equip", 793250, 91.74), a("nat_equip_strate", null, 398.38),
    a("nat_taux_caf", 0.0345, null), a("nat_taux_caf_strate", 0.1649, null),
  ]);
  it("compares € per inhabitant on the DGFiP basis", () => {
    expect(nationalLine("depenses_equipement", rows)).toMatchObject({ commune: 91.74, average: 398.38, unit: "eur", sourceId: "ci-2023" });
  });
  it("compares the published ratios", () => {
    expect(nationalLine("taux_epargne_brute", rows)).toMatchObject({ commune: 0.0345, average: 0.1649, unit: "pct" });
  });
  it("is null when DGFiP has no row or the figure has no national line", () => {
    expect(nationalLine("encours_dette", rows)).toBeNull();
    expect(nationalLine("octroi_de_mer", rows)).toBeNull();
    expect(nationalLine("depenses_equipement", undefined)).toBeNull();
  });
});

describe("dgfipStratum", () => {
  it("names the DGFiP band, lower bound included", () => {
    expect(dgfipStratum(8647)).toBe("communes de 5\u00a0000 à 10\u00a0000 hab.");
    expect(dgfipStratum(10000)).toBe("communes de 10\u00a0000 à 20\u00a0000 hab.");
    expect(dgfipStratum(null)).toBeNull();
  });
});
