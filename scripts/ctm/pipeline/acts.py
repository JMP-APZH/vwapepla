"""Acts of the CTM bodies, from the indexes of collectivitedemartinique.mq (scripts/ctm/sources.py LISTINGS).

One row per act as listed: number (YY-NNN-K, may be missing), title as published, a display title without the
"délib n°…" / "arrêté n°…" prefix, the CTM's download page. No session date, no vote, no topic: not in the index.
Names of private individuals (after Monsieur / Madame / M. / Mme…) are masked in the stored title (data minimisation,
GDPR); the full act stays on the CTM's page linked from each row. Companies and public bodies are kept.
"""
import re

BODY = {"ctm-deliberations-assemblee": "assemblee", "ctm-arretes-deliberes-ce": "conseil_executif"}
PREFIX = re.compile(r"^\s*(d[ée]lib(?:[ée]ration)?|arr[êe]t[ée](?:\s+d[ée]lib[ée]r[ée])?|ad|n°)?[\s.\-_]*(n\s*°|n°|no)?\s*"
                    r"[0-9]{2}\s*-\s*[0-9]{1,4}\s*-?\s*[0-9]*\s*[-–:]?\s*", re.I)


PERSON = re.compile(r"\b(Monsieur|Madame|Mademoiselle|MM\.|M\.|Mme|Mlle)\s+"
                    r"(?!le\b|la\b|les\b|l'|le |la )"  # "M. le Président": a function, not a name
                    r"(?:[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'’\-]*\.?\s*){1,4}", re.U)


def mask_people(title):
    masked = PERSON.sub(lambda m: f"{m.group(1)} [nom masqué] ", title)
    return re.sub(r"\s+([,.;:)])", r"\1", re.sub(r"\s{2,}", " ", masked)).strip()


def display_title(title, number):
    """Published title without its leading act number; the published title is kept as is when nothing is removed."""
    t = PREFIX.sub("", title, count=1).strip() if number else title.strip()
    t = mask_people(t or title.strip())
    return t[:1].upper() + t[1:]


def build_acts(ds, rows, source_id):
    body = BODY[ds]
    out, seen = [], set()
    for r in rows:
        number = r["numero"].strip() or None
        key = f"{body}:{number}" if number else f"{body}:wpdm-{r['wpdm_id'] or r['page_url']}"
        if key in seen:  # the same number listed twice (e.g. corrected title): keep the first, with a suffix for the next
            key = f"{key}:{r['wpdm_id']}"
        seen.add(key)
        out.append({"id": key, "body": body, "number": number, "year": 2000 + int(number[:2]) if number else None,
                    "title": display_title(r["titre"], number),
                    "page_url": r["page_url"], "source_id": source_id})
    return out
