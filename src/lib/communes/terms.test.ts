import { describe, expect, it } from "vitest";
import type { Actual } from "./data";
import { summarizeTerms, type Term } from "./terms";

const terms: Term[] = [
  { id: "2008-2014", election_year: 2008, start_date: "2008-03-09", end_date: "2014-03-23", first_full_year: 2009, last_full_year: 2013 },
  { id: "2014-2020", election_year: 2014, start_date: "2014-03-23", end_date: "2020-03-15", first_full_year: 2015, last_full_year: 2019 },
  { id: "2020-2026", election_year: 2020, start_date: "2020-03-15", end_date: "2026-03-15", first_full_year: 2021, last_full_year: 2025 },
  { id: "2026-2032", election_year: 2026, start_date: "2026-03-15", end_date: null, first_full_year: 2027, last_full_year: 2031 },
];

function series(from: number, to: number): Actual[] {
  const out: Actual[] = [];
  for (let y = from; y <= to; y++) {
    const base = { commune_code: "97201", year: y, provisional: false, source_id: "s", amount: 0 };
    out.push({ ...base, metric_key: "rf_total", eur_per_hab: y }); // value = year, easy averages
    out.push({ ...base, metric_key: "encours_dette", eur_per_hab: 1000 + y });
    out.push({ ...base, metric_key: "capacite_desendettement", eur_per_hab: null, amount: y === 2019 ? null : 5 });
  }
  return out;
}

describe("summarizeTerms", () => {
  const rows = [
    { key: "rf_total", label: "", kind: "avg_per_hab" as const, unit: "eur" as const },
    { key: "encours_dette", label: "", kind: "end_per_hab" as const, unit: "eur" as const },
    { key: "capacite_desendettement", label: "", kind: "end_amount" as const, unit: "years" as const },
  ];
  const s = summarizeTerms(terms, series(2012, 2025), rows);

  it("excludes the election year and terms without full years yet", () => {
    expect(s.map((t) => t.term.id)).toEqual(["2008-2014", "2014-2020", "2020-2026"]);
    expect(s[1].years).toEqual([2015, 2016, 2017, 2018, 2019]); // 2014 and 2020 = shared election years
  });

  it("flags a term whose early years are not published", () => {
    expect(s[0].years).toEqual([2012, 2013]);
    expect(s[0].partial).toBe(true);
    expect(s[1].partial).toBe(false);
  });

  it("averages flows over full years and takes stocks at the end", () => {
    expect(s[1].values.rf_total).toBe(2017); // mean of 2015..2019
    expect(s[1].values.encours_dette).toBe(1000 + 2019);
    expect(s[1].values.capacite_desendettement).toBeNull(); // not computable that year: stays null
  });
});
