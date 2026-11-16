import { describe, expect, it } from "vitest";
import { byTopic, text, TEXTS, type LegalText } from "./textes";

const t = (id: string, topic: LegalText["topic"]): LegalText => ({
  id, title: id, article: null, url: `https://www.legifrance.gouv.fr/${id}`, supports: "x", topic, checked: null,
});

describe("legal framework", () => {
  it("groups texts by topic in display order and drops empty topics", () => {
    const groups = byTopic([t("a", "octroi"), t("b", "institution"), t("c", "institution")]);
    expect(groups.map((g) => g.topic)).toEqual(["institution", "octroi"]);
    expect(groups[0].texts.map((x) => x.id)).toEqual(["b", "c"]);
  });

  it("ships only Légifrance links, each with the claim it supports", () => {
    expect(TEXTS.length).toBeGreaterThan(0);
    for (const x of TEXTS) {
      expect(x.url.startsWith("https://www.legifrance.gouv.fr/")).toBe(true);
      expect(x.supports.length).toBeGreaterThan(0);
    }
    expect(text("loi-2021-191")?.article).toBe("Article 1");
  });
});
