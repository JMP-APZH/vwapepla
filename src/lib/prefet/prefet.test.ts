import { describe, expect, it } from "vitest";
import { lastExecutedYear, topMissions, totalsByYear as dptByYear, type DptCredit } from "./credits";
import { beneficiaryLabel, byBeneficiary, totalsByYear, type Grant } from "./grants";
import { distributions, overallStatus as stateOverall, parseStateAnswers } from "./votes";
import { coverage, currentHolder, gaps, postLabel, postingYears, seatTimeline, toPostings, type MandateRow } from "./postings";

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

const m = (person: string, seat: string, start: string, end: string | null, sex: "F" | "M" = "M"): MandateRow => ({
  person_id: `pref:${person}:X`, seat_id: `prefecture-972-corps:${seat}`, start_date: start, function_start: null,
  end_date: end, source_id: "jorf-nominations-972", source_url: `https://www.legifrance.gouv.fr/jorf/id/${person}`,
  persons: { last_name: person, first_name: "X", sex },
});

describe("postings", () => {
  const rows = [
    m("ROBINE", "prefet", "2017-06-29", "2020-01-15"),
    m("CAZELLES", "prefet", "2020-02-05", "2022-07-29"),
    m("DESPLANQUES", "prefet", "2025-01-15", null),
    m("POSTEL-VINAY", "sous_prefet-2", "2013-10-08", "2015-06-01"),
    m("POSTEL-VINAY", "sous_prefet-4", "2013-10-08", "2015-06-01"),
    m("OPPILLIART", "sous_prefet-2", "2019-09-06", "2020-05-20", "F"),
    m("DE SOUSA", "sous_prefet-4", "2023-08-02", null, "F"),
  ];
  const postings = toPostings(rows);

  it("merges a joint appointment (La Trinité et Saint-Pierre) into one posting with two seats", () => {
    const pv = postings.filter((p) => p.lastName === "POSTEL-VINAY");
    expect(pv).toHaveLength(1);
    expect(pv[0].seats).toEqual(["sous_prefet-2", "sous_prefet-4"]);
    expect(postLabel(pv[0].seats, "M")).toBe("Sous-préfet de La Trinité et de Saint-Pierre");
    expect(seatTimeline(postings, "sous_prefet-4").map((p) => p.lastName)).toEqual(["DE SOUSA", "POSTEL-VINAY"]);
  });

  it("builds unique, stable slugs and writes posts in the feminine when the decree says Mme", () => {
    const slugs = postings.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain("2025-prefet-desplanques");
    expect(slugs).toContain("2023-sous-prefet-de-sousa");
    expect(postLabel(["sous_prefet-2"], "F")).toBe("Sous-préfète de La Trinité");
  });

  it("finds the current holder and the periods without any decree", () => {
    expect(currentHolder(postings, "prefet")?.lastName).toBe("DESPLANQUES");
    expect(currentHolder(postings, "sous_prefet-3")).toBeUndefined();
    expect(gaps(postings, "prefet")).toEqual([{ from: "2022-07-29", to: "2025-01-15" }]);
    expect(gaps(postings, "sous_prefet-2")).toEqual([{ from: "2015-06-01", to: "2019-09-06" }]);
  });

  it("applies the cut-off: identity only before Dec 2015, partial until 2017, full from 2018", () => {
    expect(coverage("2013-10-08", "2015-06-01")).toBe("identity");
    expect(coverage("2014-07-31", "2017-06-29")).toBe("partial");
    expect(coverage("2020-02-05", "2022-07-29")).toBe("full");
    expect(postingYears(postings.find((p) => p.lastName === "CAZELLES")!, "2026-11-05")).toEqual([2020, 2021, 2022]);
    expect(postingYears(postings.find((p) => p.lastName === "DESPLANQUES")!, "2026-11-05")).toEqual([2025, 2026]);
  });
});

describe("visitor votes on the State's action", () => {
  const keys = ["vie_chere", "chomage"];

  it("hides the distribution below 20 votes and shows counts per level from 20, with no average", () => {
    const rows = [
      { criterion: "vie_chere", total: 19, score: null, votes: null },
      { criterion: "chomage", total: "20", score: 1, votes: "12" }, { criterion: "chomage", total: "20", score: 5, votes: "8" },
    ];
    const [a, b] = distributions(rows, keys);
    expect(a).toEqual({ criterion: "vie_chere", total: 19, counts: null });
    expect(b.total).toBe(20);
    expect(b.counts).toEqual({ 1: 12, 2: 0, 3: 0, 4: 0, 5: 8 });
    expect(Object.keys(b)).not.toContain("average");
  });

  it("keeps known criteria and scores 1-5, skips « sans avis », rejects anything else", () => {
    const f = (o: Record<string, string>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.set(k, v); return fd; };
    expect(parseStateAnswers(f({ vie_chere: "4", chomage: "0", autre: "5" }), keys)).toEqual([{ criterion: "vie_chere", score: 4 }]);
    expect(parseStateAnswers(f({ vie_chere: "0", chomage: "" }), keys)).toBeNull();
    expect(parseStateAnswers(f({ vie_chere: "6" }), keys)).toBeNull();
    expect(stateOverall(["already_voted", "ok"])).toBe("ok");
    expect(stateOverall(["already_voted", "rate_limited"])).toBe("rate_limited");
  });
});
