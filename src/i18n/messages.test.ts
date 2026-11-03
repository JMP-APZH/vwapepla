import { describe, expect, it } from "vitest";
import { MESSAGES, communes, namespace } from "./index";

describe("messages", () => {
  for (const [ns, { fr, gcf }] of Object.entries(MESSAGES)) {
    it(`${ns}: every Kréyòl key exists in French, no empty value`, () => {
      const frKeys = new Set(Object.keys(fr));
      expect(Object.keys(gcf).filter((k) => !frKeys.has(k))).toEqual([]);
      for (const v of [...Object.values(fr), ...Object.values(gcf)]) expect(String(v).trim()).not.toBe("");
    });
    it(`${ns}: has a section title`, () => {
      if (ns !== "common") expect(fr).toHaveProperty("sectionTitle");
    });
  }

  it("pairs French with Kréyòl, null when not agreed", () => {
    expect(namespace({ a: "A", b: "B" }, { a: "Á" })).toEqual({ a: { fr: "A", kr: "Á" }, b: { fr: "B", kr: null } });
    expect(communes.headlineTitle.kr).toBe("Bidjé-a an 3 chif");
    expect(communes.mayor.kr).toBeNull();
  });
});
