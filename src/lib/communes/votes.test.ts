import { describe, expect, it } from "vitest";
import { clientIp, overallStatus, parseAnswers, siteDistributions, voterHash } from "./votes";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("voterHash", () => {
  const day1 = new Date("2026-11-01T00:00:00Z"), day1b = new Date("2026-11-30T23:59:00Z"), day2 = new Date("2026-12-01T00:01:00Z");
  it("is a 64-char hex, stable for the whole calendar month", () => {
    const h = voterHash("1.2.3.4", "UA", "s", day1);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(voterHash("1.2.3.4", "UA", "s", day1b)).toBe(h);
  });
  it("changes across months, voters and secrets", () => {
    const h = voterHash("1.2.3.4", "UA", "s", day1);
    expect(voterHash("1.2.3.4", "UA", "s", day2)).not.toBe(h);
    expect(voterHash("1.2.3.5", "UA", "s", day1)).not.toBe(h);
    expect(voterHash("1.2.3.4", "UA", "other", day1)).not.toBe(h);
  });
  it("never contains the IP in clear", () => {
    expect(voterHash("1.2.3.4", "UA", "s", day1)).not.toContain("1.2.3.4");
  });
});

describe("clientIp", () => {
  it("takes the first X-Forwarded-For address", () => {
    expect(clientIp("203.0.113.7, 10.0.0.1", null)).toBe("203.0.113.7");
    expect(clientIp(null, "198.51.100.2")).toBe("198.51.100.2");
    expect(clientIp(null, null)).toBe("unknown");
  });
});

describe("parseAnswers", () => {
  it("keeps answered questions only", () => {
    expect(parseAnswers(form({ a_jour: "4", demarches: "" }))).toEqual([{ question: "a_jour", score: 4 }]);
  });
  it("rejects out-of-range or non-integer scores, unknown-only or empty forms", () => {
    expect(parseAnswers(form({ a_jour: "6" }))).toBeNull();
    expect(parseAnswers(form({ a_jour: "2.5" }))).toBeNull();
    expect(parseAnswers(form({ autre: "3" }))).toBeNull();
    expect(parseAnswers(form({}))).toBeNull();
  });
});

describe("overallStatus", () => {
  it("is ok when at least one answer was recorded", () => {
    expect(overallStatus(["already_voted", "ok"])).toBe("ok");
    expect(overallStatus(["already_voted", "already_voted"])).toBe("already_voted");
    expect(overallStatus(["rate_limited", "already_voted"])).toBe("rate_limited");
  });
});

describe("siteDistributions", () => {
  const row = (question: string, total: number, score: number | null, votes: number | null) => ({ question, total, score, votes });
  it("gives counts per level from 20 votes, nothing below, no average", () => {
    const { closed, results } = siteDistributions(
      [row("a_jour", 20, 1, 5), row("a_jour", 20, 5, 15), row("demarches", 4, null, null)], false);
    expect(closed).toBe(false);
    expect(results.find((r) => r.question === "a_jour")).toEqual({ question: "a_jour", total: 20, counts: { 1: 5, 2: 0, 3: 0, 4: 0, 5: 15 } });
    expect(results.find((r) => r.question === "demarches")).toEqual({ question: "demarches", total: 4, counts: null });
    expect(results.find((r) => r.question === "comprehensible")).toEqual({ question: "comprehensible", total: 0, counts: null });
    expect(JSON.stringify(results)).not.toContain("average");
  });
  it("hides all counts while votes are closed", () => {
    expect(siteDistributions([row("a_jour", 30, 3, 30)], true).results.every((r) => r.counts === null)).toBe(true);
  });
});
