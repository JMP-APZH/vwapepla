import { describe, expect, it } from "vitest";
import { amendmentsNotLoaded, gapsFor, type Amendment, type DataGap, type Question, type Scrutin, type Vote } from "./activity";
import { formerMembers, inTermRow, termPeriod, toMembers, toPeople, type MandateRow, type Membership } from "./members";
import { currentRows, currentTerm, formerLabel, pastTerms, termSummary } from "./terms";

const row = (person: string, seat: string, start: string, end: string | null, last = "NILOR", first = "Jean-Philippe"): MandateRow => ({
  person_id: person, seat_id: seat, start_date: start, function_start: null, end_date: end, source_id: "an-deputes", source_url: null,
  persons: { last_name: last, first_name: first, sex: "M" },
});
const rows = [
  row("parl-an:PA1", "assemblee-nationale-14:depute-972-4", "2012-06-20", "2017-06-20"),
  row("parl-an:PA1", "assemblee-nationale-17:depute-972-4", "2024-07-07", null),
  row("parl-an:PA1", "assemblee-nationale-15:depute-972-4", "2017-06-18", "2022-06-21"),
  row("parl-an:PA2", "assemblee-nationale-15:depute-972-3", "2017-06-18", "2021-07-01", "LETCHIMY", "Serge"),
  row("parl-sen:X", "senat-hemicycle:senateur-972-1", "2011-10-01", "2017-10-01", "ANTISTE", "Maurice"),
  row("parl-sen:X", "senat-hemicycle:senateur-972-1", "2017-10-02", "2023-10-01", "ANTISTE", "Maurice"),
];
const people = toPeople(rows, [{ person_id: "parl-an:PA2", seat_id: "assemblee-nationale-15:depute-972-3", start_date: "2017-06-18",
  election_cause: "élections générales", end_cause: "Démission", suppleant_last_name: null, suppleant_first_name: null,
  suppleant_sex: null, suppleant_source_id: null, official_url: "u", hatvp_url: null, source_id: "an-deputes" }],
  toMembers(rows, []));

describe("terms", () => {
  it("gathers every mandate of a person, most recent first, and keeps the current member", () => {
    const nilor = people.find((p) => p.personId === "parl-an:PA1")!;
    expect(nilor.terms.map((t) => t.legislature)).toEqual(["17", "15", "14"]);
    expect(currentTerm(nilor)?.legislature).toBe("17");
    expect(pastTerms(nilor).map(termPeriod)).toEqual(["XVe législature (2017-2022)", "XIVe législature (2012-2017)"]);
  });

  it("lists former members by most recent mandate, with the published end cause", () => {
    const former = formerMembers(people);
    expect(former.map((p) => p.lastName)).toEqual(["Antiste", "Letchimy"]);
    expect(former[1].terms[0].endCause).toBe("Démission");
    expect(formerLabel(former[1].terms[0], "M")).toBe("Ancien député de la 3e circonscription de la Martinique");
    expect(termPeriod(former[0].terms[0])).toBe("Mandat sénatorial 2017-2023");
  });

  it("matches AN rows by legislature and Sénat rows by date", () => {
    const nilor = people.find((p) => p.personId === "parl-an:PA1")!;
    expect(inTermRow({ chamber: "AN", legislature: "15" }, "2030-01-01", nilor.terms[1])).toBe(true);
    expect(inTermRow({ chamber: "AN", legislature: "17" }, "2018-01-01", nilor.terms[1])).toBe(false);
    const antiste = people.find((p) => p.personId === "parl-sen:X")!;
    expect(inTermRow({ chamber: "SEN", legislature: "2013" }, "2013-05-02", antiste.terms[1])).toBe(true);
    expect(inTermRow({ chamber: "SEN", legislature: "2013" }, "2013-05-02", antiste.terms[0])).toBe(false);
    expect(currentRows([{ chamber: "AN" as const, legislature: "15" }, { chamber: "AN" as const, legislature: "17" }], () => null,
      currentTerm(nilor)).map((r) => r.legislature)).toEqual(["17"]);
  });

  it("summarises one term with the same figures as the current one", () => {
    const t = people.find((p) => p.personId === "parl-an:PA1")!.terms[1]; // XVth
    const scr = (id: string, leg: string): Scrutin => ({ id, chamber: "AN", legislature: leg, number: 1, date: "2018-01-01", type_code: "SPO",
      type_label: "", title: "", object: null, text_id: null, result_code: null, result_label: null, voters: null, pour: 0, contre: 0,
      abstentions: 0, non_votants: 0, text_signet: null, selected_by: ["V1:b"], url: "", source_id: "s" });
    const vote: Vote = { scrutin_id: "a", person_id: "parl-an:PA1", position: "pour", by_delegation: false, group_id: null,
      group_position: null, cause: null, mise_au_point: null, source_id: "s" };
    const am = (leg: string, outcome: string | null): Amendment => ({ id: leg + outcome, amendment_id: "x", chamber: "AN", legislature: leg,
      person_id: "p", role: "premier_signataire", as_rapporteur: false, signatories: 1, number: "1", text_ref: null, text_number: null,
      text_title: null, article: null, filed: null, outcome, state: null, url: null, source_id: "s" });
    const q: Question = { id: "q", chamber: "AN", legislature: "15", person_id: "p", kind: "QE", number: null, title: null,
      rubrique: null, ministry: null, asked: null, answered: "2019-01-01", status: null, url: null, source_id: "s" };
    const gp: Membership = { id: "g", person_id: "p", organe_id: "PO1", function: "Membre", start_date: "2017-06-27", end_date: "2022-06-21",
      source_id: "s", parl_organes: { kind: "GP", label_fr: "Gauche démocrate et républicaine", short: null, chamber: "AN" } };
    const s = termSummary(t, [scr("a", "15"), scr("b", "15"), scr("c", "17")], [vote], [am("15", "Adopté"), am("15", null), am("17", "Rejeté")], [q], [gp]);
    expect(s).toMatchObject({ selected: 2, recorded: 1, amendments: { total: 2, adopted: 1, pending: 1 },
      groups: ["Gauche démocrate et républicaine"] });
    expect(s.questions).toEqual([{ kind: "QE", label: "Questions écrites", total: 1, answered: 1 }]);
  });

  it("shows the gaps of a legislature only to members who sat in it, and former-member gaps only to them", () => {
    const g = (id: string): DataGap => ({ id, chamber: "AN", person_id: null, period: "", topic: "votes", status: "partiel",
      label_fr: id, detail_fr: "", checked_url: null, checked_on: "2026-11-07", source_id: null });
    const all = [g("an-14-votes-dossier"), g("an-17-votes-dossier"), g("an-votes-main-levee"), g("hatvp-anciens")];
    expect(gapsFor(all, { chamber: "AN", personId: "p", legislatures: ["17"], current: true }).map((x) => x.id))
      .toEqual(["an-17-votes-dossier", "an-votes-main-levee"]);
    expect(gapsFor(all, { chamber: "AN", personId: "p", legislatures: ["14"], current: false }).map((x) => x.id))
      .toEqual(["an-14-votes-dossier", "an-votes-main-levee", "hatvp-anciens"]);
  });

  it("lists the legislatures whose amendments are not loaded, so they are never shown as zero", () => {
    const g = (id: string): DataGap => ({ id, chamber: "AN", person_id: null, period: "", topic: "amendements", status: "absent",
      label_fr: id, detail_fr: "", checked_url: null, checked_on: "2026-11-07", source_id: null });
    expect([...amendmentsNotLoaded([g("an-15-amendements-non-charges"), g("an-14-amendements-issue")])]).toEqual(["15"]);
  });
});
