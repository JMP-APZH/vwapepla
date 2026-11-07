import { describe, expect, it } from "vitest";
import { CTM, index, type Actual } from "./budget";
import { caComparison, caYears, type CaLine } from "./ca";

const line = (year: number, key: string, amount: number, page = 25): CaLine => ({
  year, budget: "principal", line_key: key, label: key, amount, page, deliberation: "25-148-1", source_id: `ctm:ctm-ca-${year}`,
});
const act = (year: number, key: string, bp: number): Actual => ({
  entity_siren: CTM, year, metric_key: key, amount: bp + 1, amount_bp: bp, eur_per_hab: null, scope: "consolide",
  provisional: false, source_id: "ctm:ofgl",
});

describe("comptes administratifs", () => {
  const lines = [line(2024, "fonc_depenses_reelles", 969.79), line(2024, "fonc_recettes_reelles", 1018.5),
                 line(2024, "fonc_solde_reel", 48.7), line(2024, "inv_depenses_reelles", 311.22, 23),
                 line(2024, "inv_dette_depenses", 73.02, 23), line(2024, "inv_dette_recettes", 107.5, 23),
                 line(2023, "inv_dette_recettes", 122.49, 23)];
  const actuals = index([act(2024, "df_total", 965.83), act(2024, "epargne_brute", 48.57), act(2024, "di_hors_remb", 238.2),
                         act(2024, "emprunts", 107.5), act(2023, "emprunts", 105)]);

  it("lists years, most recent first", () => {
    expect(caYears(lines)).toEqual([2024, 2023]);
  });

  it("compares each CA line with OFGL's main-budget figure, with its page and the difference", () => {
    const rows = caComparison(lines, actuals, 2024);
    const dep = rows.find((r) => r.key === "fonc_depenses")!;
    expect(dep).toMatchObject({ ca: 969.79, ofgl: 965.83, page: 25, note: "brut" });
    expect(dep.diff).toBeCloseTo(3.96);
    const inv = rows.find((r) => r.key === "investissement")!;
    expect(inv.ca).toBeCloseTo(238.2);
    expect(inv.diff).toBeCloseTo(0);
    expect(rows.find((r) => r.key === "remboursements")!.ofgl).toBeNull(); // not in OFGL here: no difference computed
    expect(rows.find((r) => r.key === "remboursements")!.diff).toBeNull();
  });

  it("flags the capitalised surplus (1068) inside chapter 923 in 2022-2023 only", () => {
    expect(caComparison(lines, actuals, 2023).find((r) => r.key === "emprunts")!.note).toBe("1068");
    expect(caComparison(lines, actuals, 2024).find((r) => r.key === "emprunts")!.note).toBeNull();
  });
});
