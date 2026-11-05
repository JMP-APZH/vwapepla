import { describe, expect, it } from "vitest";
import { beforeCtm, breakdown, CTM, DEPARTEMENT, index, referenceYear, REGION, series, sourceIds, type Actual, type MetricDef } from "./budget";
import { bySection, EXECUTIF, inBothBodies, members, oddDates, roleLabel, roundTwo, T2021, type ElectoralList, type MandateRow } from "./people";

const a = (siren: string, year: number, key: string, amount: number | null, extra: Partial<Actual> = {}): Actual => ({
  entity_siren: siren, year, metric_key: key, amount, amount_bp: amount, eur_per_hab: amount == null ? null : amount / 100,
  scope: year < 2012 ? "budget_principal" : "consolide", provisional: siren === CTM && year === 2025, source_id: `ctm:s${year}`, ...extra,
});
const d = (key: string, parent: string | null, order: number): MetricDef => ({ key, block: "recettes", parent_key: parent, label_fr: key, unit: "eur", display_order: order });

describe("budget", () => {
  const rows = [a(CTM, 2024, "rf_total", 1000), a(CTM, 2024, "impots_taxes", 700), a(CTM, 2024, "concours_etat", 300),
                a(CTM, 2025, "rf_total", 1100), a(CTM, 2016, "rf_total", 900), a(REGION, 2015, "rf_total", 250),
                a(DEPARTEMENT, 2015, "rf_total", 630), a(REGION, 2010, "rf_total", 240), a(DEPARTEMENT, 2010, "rf_total", null)];
  const defs = [d("rf_total", null, 1), d("concours_etat", "rf_total", 3), d("impots_taxes", "rf_total", 2)];

  it("uses the last final year as reference, never the provisional one", () => {
    expect(referenceYear(rows)).toBe(2024);
  });

  it("splits a total into its parts, in display order, with shares", () => {
    const b = breakdown(index(rows), defs, CTM, 2024, "rf_total");
    expect(b.total.amount).toBe(1000);
    expect(b.parts.map((p) => p.key)).toEqual(["impots_taxes", "concours_etat"]);
    expect(b.parts[0].share).toBeCloseTo(0.7);
    expect(sourceIds([b.total, ...b.parts])).toEqual(["ctm:s2024"]);
  });

  it("gives the CTM series from 2016, with the provisional year flagged", () => {
    const s = series(rows, CTM, "rf_total");
    expect(s.map((p) => p.year)).toEqual([2016, 2024, 2025]);
    expect(s.at(-1)!.provisional).toBe(true);
  });

  it("keeps the Région and the Département side by side before 2016, never summed, null kept", () => {
    const b = beforeCtm(rows, "rf_total");
    expect(b).toEqual([
      { year: 2010, scope: "budget_principal", region: 240, departement: null },
      { year: 2015, scope: "consolide", region: 250, departement: 630 },
    ]);
  });
});

describe("people", () => {
  const m = (id: string, seat: string, sex: "F" | "M", extra: Partial<MandateRow> = {}): MandateRow => ({
    person_id: `ctm:${id}:X`, seat_id: seat, start_date: "2021-07-02", function_start: null, end_date: null, verified: true,
    source_id: "ctm:rne", source_url: null, term_id: T2021, persons: { last_name: id, first_name: "X", sex }, ...extra,
  });
  const mandates = [
    m("A", "ctm-assemblee:conseiller", "F"), m("B", "ctm-assemblee:president", "M", { function_start: "2021-07-02" }),
    m("C", `${EXECUTIF}:conseiller-executif`, "M", { function_start: "2021-02-07" }),
    m("D", `${EXECUTIF}:conseiller-executif`, "F", { verified: false, source_id: "ctm:hatvp" }),
    m("E", `${EXECUTIF}:conseiller-executif`, "M", { start_date: "2021-02-07", function_start: "2021-02-07", verified: false }),
    m("A", `${EXECUTIF}:conseiller-executif`, "F", { verified: false }),
  ];
  const sections = [{ person_id: "ctm:A:X", term_id: T2021, section: "Section du Sud", source_id: "ctm:rne" }];
  const lists: ElectoralList[] = [2, 1].map((n) => ({ id: `ctm-2021-t2-${n}`, election_year: 2021, round: 2, number: n, label_short: `L${n}`,
    label: `Liste ${n}`, nuance: null, head: "H", votes: 1, pct_exprimes: null, seats: 1, source_id: "ctm:r" }));
  const lm = [{ person_id: "ctm:A:X", list_id: "ctm-2021-t2-1", match: "deduit" as const, note: null, source_id: "ctm:c" }];

  it("writes titles according to sex", () => {
    expect(roleLabel("ctm-assemblee:president", "F")).toBe("Présidente de l'Assemblée");
    expect(roleLabel(`${EXECUTIF}:conseiller-executif`, "F")).toBe("Conseillère exécutive");
  });

  it("lists the members of a body with section and list, officers first", () => {
    const asm = members(mandates, sections, lm, lists, T2021, "ctm-assemblee");
    expect(asm.map((x) => x.role)).toEqual(["president", "conseiller"]);
    expect(asm[1]).toMatchObject({ section: "Section du Sud", list: { label: "Liste 1", match: "deduit" } });
    expect(bySection(asm).at(-1)!.section).toBe("Section non renseignée");
  });

  it("returns every disagreement between sources", () => {
    expect(inBothBodies(mandates, T2021)).toEqual(["X A"]);
    const exec = members(mandates, sections, lm, lists, T2021, EXECUTIF);
    expect(oddDates(exec).map((x) => x.name)).toEqual(["X C", "X E"]); // function before the mandate; mandate before the term
    expect(exec.filter((x) => !x.verified).map((x) => x.name)).toEqual(["X A", "X D", "X E"]);
  });

  it("orders the round-2 lists by list number, not by result", () => {
    expect(roundTwo(lists, 2021).map((l) => l.number)).toEqual([1, 2]);
  });
});
