import { describe, expect, it } from "vitest";
import { functionTitle, mayorsOfTerm, missingDeputyRanks } from "./council";

describe("functionTitle", () => {
  it("genders the deputy title from the RNE sex code", () => {
    expect(functionTitle({ role: "adjoint", rank: 1, sex: "F" })).toBe("1re adjointe");
    expect(functionTitle({ role: "adjoint", rank: 1, sex: "M" })).toBe("1er adjoint");
    expect(functionTitle({ role: "adjoint", rank: 4, sex: "F" })).toBe("4e adjointe");
    expect(functionTitle({ role: "adjoint", rank: 2, sex: null })).toBe("2e adjoint·e");
  });
  it("keeps Maire for everyone and no title for councillors", () => {
    expect(functionTitle({ role: "maire", rank: null, sex: "F" })).toBe("Maire");
    expect(functionTitle({ role: "conseiller", rank: null, sex: "M" })).toBeNull();
  });
});

describe("missingDeputyRanks", () => {
  it("finds a gap in the deputy ranks", () => {
    const c = [1, 2, 4, 5].map((rank) => ({ role: "adjoint" as const, rank }));
    expect(missingDeputyRanks(c)).toEqual([3]);
  });
  it("is empty when ranks are contiguous or there are no deputies", () => {
    expect(missingDeputyRanks([{ role: "adjoint", rank: 1 }, { role: "adjoint", rank: 2 }])).toEqual([]);
    expect(missingDeputyRanks([{ role: "maire", rank: null }])).toEqual([]);
  });
});

describe("mayorsOfTerm", () => {
  const base = { commune_code: "97209", role: "maire" as const, rank: null, sex: null, function_start: null, verified: true };
  const rows = [
    { ...base, last_name: "SAINT-LOUIS-AUGUSTIN", first_name: "Raymond", mandate_start: "2010-04-01", mandate_end: "2014-03-23",
      term_id: "2008-2014", source_id: "vwapepla-historique-maires", source_url: "https://fr.wikipedia.org/w/index.php?oldid=1", verified: false },
    { ...base, last_name: "LETCHIMY", first_name: "Serge", mandate_start: "2008-03-09", mandate_end: "2010-03-31",
      term_id: "2008-2014", source_id: "municipales-2008", source_url: null },
    { ...base, last_name: "LAGUERRE", first_name: "Didier", mandate_start: "2014-03-23", mandate_end: "2020-05-18",
      term_id: "2014-2020", source_id: "rne-maires-historique", source_url: null },
  ];
  it("lists the term's mayors in order with years and evidence", () => {
    expect(mayorsOfTerm(rows, "2008-2014")).toEqual([
      { name: "Serge LETCHIMY", from: 2008, to: 2010, evidence: "liste", sourceUrl: null },
      { name: "Raymond SAINT-LOUIS-AUGUSTIN", from: 2010, to: 2014, evidence: "secondaire",
        sourceUrl: "https://fr.wikipedia.org/w/index.php?oldid=1" },
    ]);
    expect(mayorsOfTerm(rows, "2014-2020").map((m) => m.evidence)).toEqual(["rne"]);
    expect(mayorsOfTerm(rows, "2020-2026")).toEqual([]);
  });
});
