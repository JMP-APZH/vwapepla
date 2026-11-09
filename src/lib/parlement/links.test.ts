import { describe, expect, it } from "vitest";
import { officeHref, otherOffices, type LinkRow } from "./links";

const slugs = new Map([["97230", "la-trinite"]]);
const mandate = (start: string, end: string | null, body = "commune-97230-cm", inst = "commune-97230", label = "Maire") => ({
  start_date: start, end_date: end, source_id: "rne-maires-historique",
  seats: { label_fr: label, body_id: body, bodies: { name: "Conseil municipal", institution_id: inst, institutions: { name: "La Trinité" } } },
});
const row = (ms: ReturnType<typeof mandate>[]): LinkRow => ({ same_as: "com-97230:BUVAL:Frédéric", evidence_url: "https://www.senat.fr/x",
  evidence_label: "Sénat : maire de La Trinité", verified_by: "JM", verified_at: "2026-11-09", other: { mandates: ms } });

describe("other offices (person_links)", () => {
  it("links to the commune card or the CTM pages", () => {
    expect(officeHref("commune-97230-cm", "commune-97230", slugs)).toBe("/communes/la-trinite");
    expect(officeHref("ctm-assemblee", "ctm", slugs)).toBe("/ctm/assemblee");
    expect(officeHref("x", "commune-97201", slugs)).toBeNull();
  });

  it("merges consecutive terms of the same seat, names the commune, current first", () => {
    const out = otherOffices([row([mandate("2020-05-18", "2023-10-21"), mandate("2014-03-23", "2020-05-18"),
      mandate("2021-07-02", null, "ctm-assemblee", "ctm", "Conseiller à l'Assemblée de Martinique")])], slugs);
    expect(out.map((o) => [o.label, o.place, o.start, o.end])).toEqual([
      ["Conseiller à l'Assemblée de Martinique", "Conseil municipal", "2021-07-02", null],
      ["Maire", "La Trinité", "2014-03-23", "2023-10-21"],
    ]);
  });
});
