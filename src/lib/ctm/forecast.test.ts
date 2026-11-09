import { describe, expect, it } from "vitest";
import type { CaLine } from "./ca";
import { bpYears, forecastRows, plannedVsActual, plannedYears, type ForecastDoc, type ForecastFigure } from "./forecast";

const doc = (year: number, type: "BP" | "ROB"): ForecastDoc => ({
  id: `ctm-${year}-${type}`, fiscal_year: year, doc_type: type, deliberation: "x", title: "t", source_id: `ctm:ctm-${type}-${year}`,
});
const fig = (year: number, key: string, amount: number, page = 32): ForecastFigure => ({
  document_id: `ctm-${year}-BP`, line_key: key, label: key, amount, page, quote: null,
});
const ca = (year: number, key: string, amount: number, page = 25): CaLine => ({
  year, budget: "principal", line_key: key, label: key, amount, page, deliberation: "25-148-1", source_id: "ctm:ca",
});

describe("forecast layer", () => {
  const docs = [doc(2024, "BP"), doc(2024, "ROB"), doc(2026, "BP"), doc(2026, "ROB")];
  const figs = [fig(2024, "fonc_solde_reel", 90.63), fig(2024, "inv_depenses_reelles", 458.79, 30),
                fig(2024, "inv_dette_depenses", 74.75, 30), fig(2024, "inv_dette_recettes", 150, 30),
                fig(2026, "fonc_solde_reel", 70.99)];
  const lines = [ca(2024, "fonc_solde_reel", 48.7), ca(2024, "inv_depenses_reelles", 311.22, 23),
                 ca(2024, "inv_dette_depenses", 73.02, 23), ca(2025, "fonc_solde_reel", 32.2)];

  it("lists BP years only, most recent first; planned-vs-actual years need a CA", () => {
    expect(bpYears(docs)).toEqual([2026, 2024]);
    expect(plannedYears(docs, lines)).toEqual([2024]);
  });

  it("reads the BP lines of one year with their pages; investment excludes repayments", () => {
    const rows = forecastRows(docs, figs, 2024);
    expect(rows.find((r) => r.key === "epargne_brute")).toMatchObject({ amount: 90.63, page: 32 });
    expect(rows.find((r) => r.key === "investissement")).toMatchObject({ amount: 384.04, page: 30 });
    expect(rows.find((r) => r.key === "fonc_depenses")).toMatchObject({ amount: null, page: null });
    expect(forecastRows(docs, figs, 2026).find((r) => r.key === "epargne_brute")!.amount).toBe(70.99);
  });

  it("puts the BP and the CA in separate columns with their pages and the difference (réalisé − prévu)", () => {
    const rows = plannedVsActual(docs, figs, lines, 2024);
    expect(rows.find((r) => r.key === "epargne_brute")).toMatchObject(
      { planned: 90.63, plannedPage: 32, actual: 48.7, actualPage: 25, diff: -41.93 });
    expect(rows.find((r) => r.key === "investissement")).toMatchObject({ planned: 384.04, actual: 238.2, diff: -145.84 });
    expect(rows.find((r) => r.key === "emprunts")).toMatchObject({ planned: 150, actual: null, diff: null });
  });
});
