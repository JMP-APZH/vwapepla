import { describe, expect, it } from "vitest";
import { criteriaResults, overallCriteriaStatus, parseCriteriaAnswers, type CriteriaSummaryRow } from "./criteria-votes";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const KEYS = ["ecoles", "sport", "culture"];

describe("parseCriteriaAnswers", () => {
  it("keeps answered criteria, « je ne sais pas » as null, skips the rest", () => {
    expect(parseCriteriaAnswers(form({ ecoles: "4", sport: "nsp", culture: "" }), KEYS))
      .toEqual([{ criterion: "ecoles", score: 4 }, { criterion: "sport", score: null }]);
  });
  it("ignores unknown keys; rejects bad scores and empty forms", () => {
    expect(parseCriteriaAnswers(form({ autre: "3" }), KEYS)).toBeNull();
    expect(parseCriteriaAnswers(form({ ecoles: "0" }), KEYS)).toBeNull();
    expect(parseCriteriaAnswers(form({ ecoles: "6", sport: "3" }), KEYS)).toBeNull();
    expect(parseCriteriaAnswers(form({ ecoles: "2.5" }), KEYS)).toBeNull();
    expect(parseCriteriaAnswers(form({}), KEYS)).toBeNull();
  });
});

describe("criteriaResults", () => {
  const level = (criterion: string, rated: number, dk: number, score: number | null, votes: number | null, closed = false): CriteriaSummaryRow =>
    ({ criterion, rated, dont_know: dk, closed, score, votes });
  it("gives counts from 20 rated votes, and the « je ne sais pas » count always", () => {
    const rows = [
      level("ecoles", 20, 5, 1, 2), level("ecoles", 20, 5, 4, 10), level("ecoles", 20, 5, 5, 8),
      level("sport", 19, 30, null, null),
    ];
    const { closed, results } = criteriaResults(rows, KEYS);
    expect(closed).toBe(false);
    expect(results[0]).toEqual({ criterion: "ecoles", rated: 20, dontKnow: 5, counts: { 1: 2, 2: 0, 3: 0, 4: 10, 5: 8 } });
    expect(results[1]).toEqual({ criterion: "sport", rated: 19, dontKnow: 30, counts: null });
    expect(results[2]).toEqual({ criterion: "culture", rated: 0, dontKnow: 0, counts: null });
  });
  it("hides every distribution while votes are closed", () => {
    const { closed, results } = criteriaResults([level("ecoles", 25, 0, null, null, true)], KEYS);
    expect(closed).toBe(true);
    expect(results[0].counts).toBeNull();
  });
});

describe("overallCriteriaStatus", () => {
  it("is ok if one answer was recorded, else the most telling failure", () => {
    expect(overallCriteriaStatus(["already_voted", "ok"])).toBe("ok");
    expect(overallCriteriaStatus(["already_voted", "closed"])).toBe("closed");
    expect(overallCriteriaStatus(["already_voted", "already_voted"])).toBe("already_voted");
    expect(overallCriteriaStatus(["invalid"])).toBe("invalid");
  });
});
