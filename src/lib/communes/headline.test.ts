import { describe, expect, it } from "vitest";
import type { Actual } from "./data";
import { HERO } from "./config";
import { computeHero, heroKeys } from "./headline";
import { median, perHab, years } from "@/lib/core/format";
import { debtYears, pctDec } from "./format";

const row = (c: string, k: string, amount: number | null, perHabValue: number | null = null): Actual => ({
  commune_code: c, year: 2024, metric_key: k, amount, eur_per_hab: perHabValue, provisional: false, source_id: `src-${k}`,
});

describe("format", () => {
  it("never renders a missing value as zero", () => {
    expect(perHab(null)).toBe("non calculable");
    expect(years(undefined)).toBe("non calculable");
  });
  it("shows long durations without decimals (993 ans), short ones with one; rates with one decimal", () => {
    expect(debtYears(992.94)).toBe("993 ans");
    expect(debtYears(5.66)).toBe("5,7 ans");
    expect(debtYears(null)).toBe("non calculable");
    expect(pctDec(0.0717).replace(/\s/g, " ")).toBe("7,2 %");
  });
  it("median handles even/odd/empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("computeHero", () => {
  const commune = (c: string, eb: number, rf: number, cap: number | null, eq: number) => [
    row(c, "epargne_brute", eb), row(c, "rf_total", rf), row(c, "capacite_desendettement", cap),
    row(c, "depenses_equipement", eq * 1000, eq),
  ];
  const rows = [
    ...commune("97201", 10, 100, 4, 300), ...commune("97202", -5, 100, null, 100),
    ...commune("97203", 20, 100, 2, 500), ...commune("97204", 30, 0, 993, 900), // zero revenue: rate not computable
  ];
  const strata = new Map<string, string | null>([["97201", "3"], ["97202", "3"], ["97203", "3"], ["97204", "9"]]);

  it("lists the keys the trio needs", () => {
    expect(heroKeys(HERO).sort()).toEqual(["capacite_desendettement", "depenses_equipement", "epargne_brute", "rf_total"]);
  });

  it("computes the rate, the years and € / hab.; keeps non-computable values as null", () => {
    const [rate, cap, eq] = computeHero(HERO, "97201", rows, strata);
    expect(rate.value).toBe(0.1);
    expect(cap.value).toBe(4);
    expect(eq.value).toBe(300);
    expect(computeHero(HERO, "97202", rows, strata)[1].value).toBeNull(); // épargne brute <= 0
    expect(computeHero(HERO, "97204", rows, strata)[0].value).toBeNull(); // zero denominator
    expect(computeHero(HERO, "97204", rows, strata)[1].value).toBe(993); // shown as computed, never capped
  });

  it("uses one reference group: the stratum, or Martinique when the stratum is too small", () => {
    const [rate, cap] = computeHero(HERO, "97201", rows, strata);
    expect(rate.reference).toEqual({ kind: "stratum", size: 3 });
    expect(rate.median).toBe(0.1); // -0.05, 0.1, 0.2
    expect(cap.median).toBe(3); // 4, 2 (null skipped)
    const [r4] = computeHero(HERO, "97204", rows, strata);
    expect(r4.reference).toEqual({ kind: "martinique", size: 4 });
    expect(computeHero(HERO, "97201", rows, new Map())[0].reference.kind).toBe("martinique"); // compare page
  });

  it("cites the source of each figure", () => {
    const [rate, cap] = computeHero(HERO, "97201", rows, strata);
    expect(rate.sourceIds).toEqual(["src-epargne_brute", "src-rf_total"]);
    expect(cap.sourceIds).toEqual(["src-capacite_desendettement"]);
  });
});
