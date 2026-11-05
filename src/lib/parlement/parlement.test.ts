import { describe, expect, it } from "vitest";
import { NO_VOTE, outcomeCounts, otherOutcomes, questionCounts, recorded, voteLines, type Amendment, type Question, type Scrutin, type Vote } from "./activity";
import { toCsv } from "./csv";
import { bySection, isAssetDeclaration, itemView, type InterestItem } from "./interests";
import { currentGroup, displayName, groupByKind, seatLabel, slugify, toMembers, type MandateRow, type Membership } from "./members";
import { fill } from "./text";

const mandate = (person: string, seat: string, last: string, first: string, sex: "F" | "M"): MandateRow => ({
  person_id: person, seat_id: seat, start_date: "2024-07-07", function_start: null, end_date: null, source_id: "s", source_url: null,
  persons: { last_name: last, first_name: first, sex },
});

describe("members", () => {
  it("orders deputies by circonscription, then senators alphabetically; never by a figure", () => {
    const ms = toMembers([
      mandate("parl-sen:2", "senat-hemicycle:senateur-972-1", "CONCONNE", "Catherine", "F"),
      mandate("parl-an:3", "assemblee-nationale-17:depute-972-3", "BELLAY", "Béatrice", "F"),
      mandate("parl-sen:1", "senat-hemicycle:senateur-972-2", "Buval", "Frédéric", "M"),
      mandate("parl-an:1", "assemblee-nationale-17:depute-972-1", "William", "Jiovanny", "M"),
    ], []);
    expect(ms.map((m) => m.lastName)).toEqual(["William", "Bellay", "Buval", "Conconne"]);
    expect(ms[1].slug).toBe("beatrice-bellay");
    expect(ms[2].chamber).toBe("SEN");
  });

  it("writes seat titles from the official civility", () => {
    expect(seatLabel({ chamber: "AN", rank: 3, sex: "F" })).toBe("Députée de la 3e circonscription de la Martinique");
    expect(seatLabel({ chamber: "AN", rank: 1, sex: "M" })).toBe("Député de la 1re circonscription de la Martinique");
    expect(seatLabel({ chamber: "SEN", rank: 1, sex: "F" })).toBe("Sénatrice de la Martinique");
  });

  it("normalises names for display and slugs", () => {
    expect(displayName("JEAN-PHILIPPE")).toBe("Jean-Philippe");
    expect(displayName("catherine")).toBe("Catherine");
    expect(slugify("Béatrice", "Bellay")).toBe("beatrice-bellay");
  });

  const ms = (kind: string, start: string, end: string | null, label = kind): Membership => ({
    id: `${kind}${start}`, person_id: "p", organe_id: kind, function: "Membre", start_date: start, end_date: end, source_id: "s",
    parl_organes: { kind, label_fr: label, short: null, chamber: "AN" },
  });
  it("finds the current group and orders kinds", () => {
    const list = [ms("GA", "2024-09-01", null), ms("GP", "2024-07-08", "2025-01-01", "old"), ms("GP", "2025-01-02", null, "new"), ms("COMPER", "2024-07-19", null)];
    expect(currentGroup(list, "2026-11-05")?.parl_organes.label_fr).toBe("new");
    expect(groupByKind(list).map((g) => g.kind)).toEqual(["GP", "COMPER", "GA"]);
  });
});

describe("activity", () => {
  const s = (id: string, n: number): Scrutin => ({ id, number: n, date: "2025-01-01", type_code: "SPO", type_label: "", title: id,
    object: null, text_id: null, result_code: null, result_label: null, pour: 0, contre: 0, abstentions: 0, non_votants: 0,
    selected_by: ["V1:a"], url: "", source_id: "s" });
  it("lists every selected scrutin, « pas de vote enregistré » when no position is published", () => {
    const votes: Vote[] = [{ scrutin_id: "a", person_id: "p", position: "pour", by_delegation: true, group_id: null,
      group_position: "contre", mise_au_point: "contre", source_id: "s" }];
    const lines = voteLines([s("a", 1), s("b", 2)], votes);
    expect(lines.map((l) => l.position)).toEqual([NO_VOTE, "Pour"]);
    expect(lines[1]).toMatchObject({ groupPosition: "Contre", byDelegation: true, correction: "Contre" });
    expect(recorded(lines)).toBe(1);
  });

  const am = (role: Amendment["role"], outcome: string | null): Amendment => ({ id: `${role}${outcome}${Math.random()}`, amendment_id: "x",
    chamber: "AN", person_id: "p", role, as_rapporteur: false, signatories: 1, number: "1", text_ref: null, text_number: null,
    text_title: null, article: null, filed: null, outcome, state: null, url: null, source_id: "s" });
  it("counts first-signatory amendments only, by published outcome", () => {
    const rows = [am("premier_signataire", "Adopté"), am("premier_signataire", "Rejeté"), am("premier_signataire", "Tombé"),
      am("premier_signataire", null), am("cosignataire", "Adopté"), am("premier_signataire", "Rejeté - vote unique")];
    expect(outcomeCounts(rows)).toEqual({ total: 5, adopted: 1, rejected: 2, other: 1, pending: 1 });
    expect(otherOutcomes(rows)).toEqual([["Tombé", 1]]);
  });

  it("counts questions by kind with published answers", () => {
    const q = (kind: string, answered: string | null): Question => ({ id: kind + answered, chamber: "AN", person_id: "p", kind,
      number: null, title: null, rubrique: null, ministry: null, asked: null, answered, status: null, url: null, source_id: "s" });
    expect(questionCounts([q("QG", null), q("QE", "2025-01-01"), q("QE", null)])).toEqual([
      { kind: "QE", label: "Questions écrites", total: 2, answered: 1 },
      { kind: "QG", label: "Questions au Gouvernement", total: 1, answered: 0 }]);
  });
});

describe("interests", () => {
  const item: InterestItem = { id: "1", person_id: "p", declaration_uuid: "u", declaration_label: "DIA", deposited: "2024-01-01",
    section: "participationDirigeantDto", position: 0, source_id: "s",
    fields: { nomSociete: "ADFMPS", activite: "Association de financement", "remuneration/brutNet": "Net", dateDebut: "01/2018" },
    amounts: [{ annee: "2018", montant: "0" }, { annee: "2019", montant: "0" }] };
  it("shows an item as declared, amounts per year without a total", () => {
    expect(itemView(item)).toEqual({ title: "ADFMPS",
      details: [{ label: "Activité", value: "Association de financement" }, { label: "Début", value: "01/2018" }],
      amounts: ["2018 : 0 € (net)", "2019 : 0 € (net)"] });
  });
  it("keeps the form's section order and never shows asset declarations' contents", () => {
    expect(bySection([{ ...item, section: "mandatElectifDto" }, item]).map((g) => g.section))
      .toEqual(["participationDirigeantDto", "mandatElectifDto"]);
    expect(isAssetDeclaration({ doc_type: "DSPM" })).toBe(true);
    expect(isAssetDeclaration({ doc_type: "DIA" })).toBe(false);
  });
});

describe("csv and text", () => {
  it("writes a semicolon CSV with a BOM, source lines and escaped cells", () => {
    const out = toCsv("T", [{ id: "s", title: "Src", url: "u", dataset_page: null, licence: "LO 2.0", credit: "Source : X", retrieved: "2026-11-03" }],
      ["note"], ["a", "b"], [["x;y", 'q"'], [null, 2]]);
    expect(out.startsWith("﻿# T\r\n# Source : X — Src — LO 2.0 — récupéré le 2026-11-03 — u\r\n# note\r\n")).toBe(true);
    expect(out).toContain('a;b\r\n"x;y";"q"""\r\n;2\r\n');
  });
  it("fills placeholders", () => {
    expect(fill("{n} sur {total}", { n: 3, total: 4 })).toBe("3 sur 4");
  });
});
