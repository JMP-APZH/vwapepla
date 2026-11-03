import { describe, expect, it } from "vitest";
import { lastExecutedYear, topMissions, totalsByYear as dptByYear, type DptCredit } from "./credits";
import { beneficiaryLabel, byBeneficiary, totalsByYear, type Grant } from "./grants";

const c = (edition: number, level: DptCredit["level"], label: string, stage: DptCredit["stage"], cp: number): DptCredit => ({
  edition, page: 1, level, mission: level === "total" ? null : label, code: null, label, stage, ae: cp,
  year: edition + { execution: -2, lfi: -1, plf: 0 }[stage], cp, source_id: `dpt-${edition}`,
});

describe("DPT credits", () => {
  const rows = [
    c(2026, "total", "Total général", "execution", 300), c(2026, "total", "Total général", "lfi", 310),
    c(2026, "total", "Total général", "plf", 270), c(2027, "total", "Total général", "execution", 305),
    c(2027, "total", "Total général", "lfi", 280), c(2027, "total", "Total général", "plf", 281),
    c(2027, "mission", "Enseignement scolaire", "execution", 200), c(2027, "mission", "Sécurités", "execution", 70),
    c(2027, "mission", "Culture", "execution", 35),
  ];

  it("keeps executed, voted and proposed figures apart for each year", () => {
    const t = dptByYear(rows);
    expect(t.map((r) => r.year)).toEqual([2024, 2025, 2026, 2027]);
    const y2025 = t.find((r) => r.year === 2025)!;
    expect(y2025.execution?.cp).toBe(305);
    expect(y2025.lfi?.cp).toBe(310);
    expect(y2025.plf).toBeUndefined();
    expect(t.find((r) => r.year === 2026)!.plf?.edition).toBe(2026);
  });

  it("finds the last executed year and ranks missions with the rest grouped", () => {
    expect(lastExecutedYear(rows)).toBe(2025);
    const top = topMissions(rows, 2025, 2);
    expect(top.map((m) => m.label)).toEqual(["Enseignement scolaire", "Sécurités", "Autres missions"]);
    expect(top[2].cp).toBe(35);
    expect(top.reduce((s, m) => s + m.share, 0)).toBeCloseTo(1);
  });
});

describe("investment grants", () => {
  const g = (id: string, year: number, key: string, amount: number): Grant => ({
    id, year, scheme: "DETR", beneficiary_name: "x", beneficiary_key: key, mapping_note: null, project: id,
    cost_ht: null, grant_amount: amount, rate: null, source_id: "s",
  });
  const communes = new Map([["97209", { name: "Fort-de-France", slug: "fort-de-france" }]]);
  const grants = [g("a", 2024, "commune-97209", 100), g("b", 2025, "commune-97209", 50), g("c", 2025, "ctm", 120)];

  it("labels beneficiaries, including unknown ones", () => {
    expect(beneficiaryLabel("commune-97209", communes)).toBe("Fort-de-France");
    expect(beneficiaryLabel("epci-caesm", communes)).toBe("CAESM (Espace Sud)");
    expect(beneficiaryLabel("inconnu", communes)).toMatch(/non renseigné/);
  });

  it("totals by year and by beneficiary, with the commune card link", () => {
    expect(totalsByYear(grants)).toEqual([{ year: 2024, total: 100, count: 1 }, { year: 2025, total: 170, count: 2 }]);
    const b = byBeneficiary(grants, communes);
    expect(b.map((x) => [x.key, x.total, x.slug])).toEqual([["commune-97209", 150, "fort-de-france"], ["ctm", 120, null]]);
    expect(b[0].grants.map((x) => x.id)).toEqual(["b", "a"]);
  });
});
