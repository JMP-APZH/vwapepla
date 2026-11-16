// Legal framework of the CTM card (« Cadre légal »): curated links to Légifrance (data/ctm/textes.yaml, validated and
// written to textes.json by scripts/ctm/pipeline/build.py). Links, not figures: no copy of the texts is archived.
import data from "./textes.json";

export type Topic = "institution" | "elections" | "octroi";
export type LegalText = {
  id: string; title: string; article: string | null; url: string; supports: string; topic: Topic; checked: string | null;
};

export const TOPIC_ORDER: Topic[] = ["institution", "elections", "octroi"];
export const TEXTS = data as LegalText[];

/** Texts grouped by topic, in the display order; empty topics dropped. */
export function byTopic(texts: LegalText[] = TEXTS): { topic: Topic; texts: LegalText[] }[] {
  return TOPIC_ORDER.map((topic) => ({ topic, texts: texts.filter((t) => t.topic === topic) })).filter((g) => g.texts.length);
}

export function text(id: string, texts: LegalText[] = TEXTS): LegalText | undefined {
  return texts.find((t) => t.id === id);
}
