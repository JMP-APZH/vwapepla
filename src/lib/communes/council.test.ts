import { describe, expect, it } from "vitest";
import { functionTitle, missingDeputyRanks } from "./council";

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
