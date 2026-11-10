"""Legal framework (« Cadre légal »): curated links to Légifrance in data/ctm/textes.yaml (JM, 10 Nov 2026).

validate() returns the texts and a list of errors: every text needs an id, a title, an https Légifrance URL, the claim it
supports and a known topic. `checked` stays null until a person has opened the link (Légifrance blocks scripts); the
card then shows « lien à vérifier ». Written by build.py to src/lib/ctm/textes.json, imported by the pages.
"""
import yaml

TOPICS = ("institution", "elections", "octroi")


def validate(path):
    texts, errors, seen = yaml.safe_load(path.read_text(encoding="utf-8"))["texts"], [], set()
    for t in texts:
        name = t.get("id") or "?"
        if name in seen:
            errors.append(f"textes: duplicate id {name}")
        seen.add(name)
        for k in ("id", "title", "url", "supports", "topic"):
            if not t.get(k):
                errors.append(f"textes {name}: no {k}")
        if t.get("url") and not str(t["url"]).startswith("https://www.legifrance.gouv.fr/"):
            errors.append(f"textes {name}: not a Légifrance URL")
        if t.get("topic") not in TOPICS:
            errors.append(f"textes {name}: topic {t.get('topic')!r} not in {TOPICS}")
        t["article"] = t.get("article") or None
        t["checked"] = str(t["checked"]) if t.get("checked") else None
    return texts, errors
