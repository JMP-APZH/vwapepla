import { describe, expect, it } from "vitest";
import { HERO } from "./config";
import type { HeroValue } from "./headline";
import { ogFigures, plainSpaces } from "./og";

const hero = (i: number, value: number | null, median: number | null, kind: "stratum" | "martinique" = "stratum"): HeroValue => ({
  figure: HERO[i], value, median, spread: null, reference: { kind, size: 5 }, sourceIds: [],
});

describe("ogFigures", () => {
  it("formats the hero trio like the card, with plain spaces", () => {
    const [rate, debt, equip] = ogFigures([hero(0, 0.0717, 0.066), hero(1, 5.66, 3.1), hero(2, 341.2, 296)]);
    expect(rate).toEqual({ label: "Taux d'épargne brute", value: "7,2 %", unit: "", note: null, median: "médiane de 5 communes de même taille : 6,6 %" });
    expect(debt.value).toBe("5,7 ans");
    expect(equip.value + equip.unit).toBe("341 € / hab.");
    expect(equip.median).toBe("médiane de 5 communes de même taille : 296 € / hab.");
    for (const f of [rate, debt, equip]) expect(f.value + f.median).not.toMatch(/[  ]/);
  });
  it("keeps « non calculable » (never 0) and names the Martinique group", () => {
    const [debt] = ogFigures([hero(1, null, 3.1, "martinique")]);
    expect(debt.value).toBe("non calculable");
    expect(debt.unit).toBe("");
    expect(debt.note).toBe("épargne brute négative ou nulle cette année-là");
    expect(debt.median).toBe("médiane de 5 communes de Martinique : 3,1 ans");
  });
  it("explains a very long capacité like the card", () => {
    expect(ogFigures([hero(1, 992.9, 3.1)])[0]).toMatchObject({ value: "993 ans", note: "épargne brute très faible cette année-là" });
    expect(ogFigures([hero(1, 5.7, 3.1)])[0].note).toBeNull();
  });
  it("plainSpaces replaces narrow and no-break spaces only", () => {
    expect(plainSpaces("1 234 € a")).toBe("1 234 € a");
  });
});
