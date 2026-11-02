import { describe, expect, it } from "vitest";
import type { Actual } from "./data";
import type { HeadlineFigure } from "./config";
import { computeHeadline, headlineKeys } from "./headline";
import { median, perHab, years } from "./format";

const row = (c: string, k: string, amount: number | null, perHabValue: number | null = null): Actual => ({
  commune_code: c, year: 2024, metric_key: k, amount, eur_per_hab: perHabValue, provisional: false, source_id: "src",
});

describe("format", () => {
  it("never renders a missing value as zero", () => {
    expect(perHab(null)).toBe("non calculable");
    expect(years(undefined)).toBe("non calculable");
  });
  it("median handles even/odd/empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("computeHeadline", () => {
  const debt: HeadlineFigure = {
    kind: "per_hab", metric: "encours_dette", label: "Dette",
    extra: { metric: "capacite_desendettement", label: "pour rembourser" },
  };
  const staff: HeadlineFigure = { kind: "share", metric: "frais_personnel", of: "df_total", label: "Personnel" };
  const rows = [
    row("97201", "encours_dette", 1000, 100), row("97201", "capacite_desendettement", null),
    row("97202", "encours_dette", 4000, 400), row("97202", "capacite_desendettement", 4),
    row("97203", "encours_dette", 2000, 200),
    row("97204", "encours_dette", 9000, 900),
    row("97201", "frais_personnel", 60), row("97201", "df_total", 100),
    row("97202", "frais_personnel", 50), row("97202", "df_total", 0), // zero denominator -> not computable
  ];
  const strata = new Map<string, string | null>([["97201", "3"], ["97202", "3"], ["97203", "3"], ["97204", "9"]]);

  it("lists the keys a set needs", () => {
    expect(headlineKeys([debt, staff]).sort()).toEqual(
      ["capacite_desendettement", "df_total", "encours_dette", "frais_personnel"]);
  });

  it("keeps a non-computable ratio as null (negative savings), not 0", () => {
    const [h] = computeHeadline([debt], "97201", rows, strata);
    expect(h.value).toBe(100);
    expect(h.extra).toBeNull();
  });

  it("computes Martinique and same-stratum medians; hides small strata", () => {
    const [a] = computeHeadline([debt], "97201", rows, strata);
    expect(a.medianMartinique).toBe(300); // median of 100, 400, 200, 900
    expect(a.medianStratum).toBe(200); // stratum 3: 100, 400, 200
    const [b] = computeHeadline([debt], "97204", rows, strata);
    expect(b.medianStratum).toBeNull(); // stratum 9 has a single commune
  });

  it("share figures guard against a zero denominator", () => {
    const [h] = computeHeadline([staff], "97202", rows, strata);
    expect(h.value).toBeNull();
    expect(computeHeadline([staff], "97201", rows, strata)[0].value).toBe(0.6);
  });
});
