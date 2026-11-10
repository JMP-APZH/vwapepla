import { describe, expect, it } from "vitest";
import type { Act } from "./acts";
import { CTM, type Actual } from "./budget";
import { actsByKind, communeRows, figuresOf, totalsByYear, type CommuneOctroi, type OctroiFigure } from "./octroi";

const com = (code: string, year: number, amount: number, provisional = false): CommuneOctroi => ({
  commune_code: code, year, amount, eur_per_hab: amount / 100, provisional, source_id: `balances-${year}`,
});
const omr = (year: number, amount: number, provisional = false): Actual => ({
  entity_siren: CTM, year, metric_key: "fum_octroi_de_mer", amount, amount_bp: amount, eur_per_hab: null, scope: "budget_principal",
  provisional, source_id: "ctm:dgfip",
});
const act = (number: string, title = number): Act => ({
  id: `assemblee:${number}`, body: "assemblee", number, year: 2000 + Number(number.slice(0, 2)), title, page_url: "u", source_id: "s",
});

describe("octroi de mer", () => {
  it("gives the communes' total and the CTM's amount per year, side by side, from 2018", () => {
    const rows = [com("97201", 2017, 5), com("97201", 2024, 10), com("97202", 2024, 20), com("97201", 2025, 12, true)];
    const t = totalsByYear(rows, [omr(2024, 92.9), omr(2025, 100, true)]);
    expect(t.map((x) => x.year)).toEqual([2024, 2025]);
    expect(t[0]).toMatchObject({ communes: 30, communesCount: 2, ctm: 92.9, provisional: false });
    expect(t[1]).toMatchObject({ communes: 12, ctm: 100, provisional: true });
  });

  it("lists communes alphabetically, never by amount, with missing values kept", () => {
    const rows = [com("97201", 2024, 50), com("97202", 2024, 10)];
    const list = communeRows(rows, [{ code: "97202", slug: "b", name: "Le Lamentin" }, { code: "97201", slug: "a", name: "Ajoupa-Bouillon" },
      { code: "97203", slug: "c", name: "Écrasé" }], 2024);
    expect(list.map((r) => r.name)).toEqual(["Ajoupa-Bouillon", "Écrasé", "Le Lamentin"]);
    expect(list[1].amount).toBeNull();
  });

  it("groups acts by kind in display order, most recent first", () => {
    const acts = [act("23-302-1"), act("25-260-4"), act("25-260-1"), act("25-198-2")];
    const groups = actsByKind([{ act_id: "assemblee:23-302-1", kind: "exonerations" }, { act_id: "assemblee:25-260-1", kind: "exonerations" },
      { act_id: "assemblee:25-260-4", kind: "exonerations" }, { act_id: "assemblee:25-198-2", kind: "repartition" },
      { act_id: "assemblee:99-1-1", kind: "autre" }], acts);
    expect(groups.map((g) => g.kind)).toEqual(["repartition", "exonerations"]);
    expect(groups[1].acts.map((a) => a.number)).toEqual(["25-260-4", "25-260-1", "23-302-1"]);
  });

  it("indexes a deliberation's figures by key", () => {
    const f: OctroiFigure = { deliberation: "25-198-2", line_key: "part_population", label: "x", value: 85, unit: "%", page: 2,
      quote: "q", source_id: "s" };
    expect(figuresOf([f], "25-198-2").get("part_population")?.value).toBe(85);
    expect(figuresOf([f], "24-300-2").size).toBe(0);
  });
});
