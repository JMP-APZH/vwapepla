import { describe, expect, it } from "vitest";
import { byNumberDesc, countsByYear, fold, parseQuery, search, type Act } from "./acts";
import { areasForYear, areaTrend, type FunctionalRow } from "./functions";

const act = (id: string, number: string | null, title: string, body: Act["body"] = "assemblee"): Act => ({
  id, body, number, year: number ? 2000 + Number(number.slice(0, 2)) : null, title, page_url: `https://x/${id}`, source_id: "ctm:s",
});

describe("acts", () => {
  const acts = [act("a", "26-90-1", "Pacte de solidarités"), act("b", "26-276-1", "Délibération budget primitif"),
                act("c", "25-148-1", "Compte administratif 2024"), act("d", null, "Subvention M. [nom masqué]", "conseil_executif")];

  it("orders by act number, numerically, most recent first", () => {
    expect([...acts].sort(byNumberDesc).map((a) => a.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("counts per year, acts without number last", () => {
    expect(countsByYear(acts)).toEqual([{ year: 2025, n: 1 }, { year: 2026, n: 2 }, { year: null, n: 1 }]);
  });

  it("searches every word, accents and case ignored, with body and year filters", () => {
    expect(fold("Délibération")).toBe("deliberation");
    expect(search(acts, { q: "pacte solidarites", body: null, year: null }).map((a) => a.id)).toEqual(["a"]);
    expect(search(acts, { q: "deliberation", body: "assemblee", year: 2026 }).map((a) => a.id)).toEqual(["b"]);
    expect(search(acts, { q: "", body: "conseil_executif", year: null }).map((a) => a.id)).toEqual(["d"]);
    expect(search(acts, { q: "25-148", body: null, year: null }).map((a) => a.id)).toEqual(["c"]);
  });

  it("reads the query string safely", () => {
    expect(parseQuery({ q: "  budget ", organe: "assemblee", annee: "2025" })).toEqual({ q: "budget", body: "assemblee", year: 2025 });
    expect(parseQuery({ organe: "x", annee: "abc" })).toEqual({ q: "", body: null, year: null });
  });
});

describe("spending by area", () => {
  const r = (year: number, section: FunctionalRow["section"], fonction: string, amount: number): FunctionalRow => ({
    year, section, fonction, label: `L${fonction}`, amount, eur_per_hab: amount / 10, provisional: year === 2025, source_id: "ctm:n",
  });
  const rows = [r(2024, "fonctionnement", "4", 60), r(2024, "investissement", "4", 10), r(2024, "fonctionnement", "0", 20),
                r(2024, "fonctionnement", "nv", 10), r(2025, "fonctionnement", "4", 70)];

  it("lists areas in code order (never ranked), the part not broken down last, with shares of the total", () => {
    const a = areasForYear(rows, 2024);
    expect(a.map((l) => l.fonction)).toEqual(["0", "4", "nv"]);
    expect(a[1]).toMatchObject({ operating: 60, investment: 10, total: 70, perHab: 7 });
    expect(a[1].share).toBeCloseTo(0.7);
  });

  it("builds the trend per area, without the part not broken down", () => {
    const t = areaTrend(rows);
    expect(t.years).toEqual([2024, 2025]);
    expect(t.provisional.has(2025)).toBe(true);
    expect(t.areas.map((a) => [a.fonction, a.values.get(2024)])).toEqual([["0", 20], ["4", 70]]);
  });
});
