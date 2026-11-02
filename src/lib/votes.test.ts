import { describe, expect, it } from "vitest";
import { clientIp, overallStatus, parseAnswers, voterHash } from "./votes";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("voterHash", () => {
  const day1 = new Date("2026-11-02T10:00:00Z"), day1b = new Date("2026-11-02T23:59:00Z"), day2 = new Date("2026-11-03T00:01:00Z");
  it("is a 64-char hex, stable within a day", () => {
    const h = voterHash("1.2.3.4", "UA", "s", day1);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(voterHash("1.2.3.4", "UA", "s", day1b)).toBe(h);
  });
  it("changes across days, voters and secrets", () => {
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
