"""Acts of the préfecture (RAA): normalised rows + a theme read from the act's TITLE only (keyword rules below, shown on
the card). A theme is a reading aid, never a judgement: an act matching no rule is « autre », and every act keeps its
published title and a link to its page in the bulletin.
"""
import re
import unicodedata

# (theme, label, rules). First match wins, in this order. Rules are regular expressions on the folded title
# (lower case, no accents).
THEMES = [
    ("interim", "Intérims et suppléances",
     [r"\binterim\b", r"\bsuppleance\b", r"\bsuppleant\b"]),
    ("delegation", "Délégations de signature",
     [r"delegation de signature", r"donnant delegation"]),
    ("carburants", "Prix des carburants",
     [r"carburant", r"produits petroliers", r"prix (maxim|de vente).*(essence|gazole|super|petrol)"]),
    ("eau", "Eau et sécheresse",
     [r"secheresse", r"usages? de l.?eau", r"restriction.*\beau\b", r"\beau potable\b", r"\beaux? destinees? a la consommation"]),
    ("risques", "Risques naturels et alertes",
     [r"cyclon", r"\bvigilance\b", r"\balerte\b", r"\borsec\b", r"seisme", r"sismique", r"volcan", r"submersion",
      r"sargasse", r"catastrophe naturelle", r"inondation", r"\bplan de prevention des risques\b", r"\bppr\b"]),
    ("ordre_public", "Ordre public et rassemblements",
     [r"manifestation", r"couvre-feu", r"rassemblement", r"perimetre de protection", r"interdi\w* (de )?(la )?(vente|circulation|port|transport)",
      r"\bdrones?\b", r"videoprotection", r"\bmaintien de l.?ordre\b", r"requisition"]),
    ("chlordecone", "Chlordécone", [r"chlordecone"]),
]
LABELS = {k: label for k, label, _ in THEMES} | {"autre": "Autres actes"}
_COMPILED = [(k, [re.compile(r) for r in rules]) for k, _, rules in THEMES]


def fold(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def theme(title):
    t = fold(title)
    for key, rules in _COMPILED:
        if any(r.search(t) for r in rules):
            return key
    return "autre"


# The issuing service is the heading above the act in the Sommaire, « <issuer> / <service> ». When that heading wraps,
# only its last line is read (« Secrétariat », « des affaires juridiques / »). Such a fragment would name the wrong
# service, so the service is kept only when the heading looks whole: « X / Y », starting with a capital, not ending with
# « / », and not a wrapped tail like « aux sports / DRAJES » or « Martinique / Service … » (end of « … de Martinique »).
WHOLE_SERVICE = re.compile(r"^(?!Martinique /)[A-ZÀ-Ý].* / .*[^/\s]$")


def service(s):
    s = (s or "").strip()
    return s if WHOLE_SERVICE.match(s) else None


def build_acts(rows_by_year):
    """{year: raw rows} -> (pref_acts rows, errors). The same act can be published in two bulletins (rectified
    edition): one row per (act, bulletin), so both stay traceable."""
    out, errors, seen = [], [], set()
    for year, rows in sorted(rows_by_year.items()):
        for r in rows:
            key = f"{r['act_id']}:{r['bulletin']}"
            if key in seen:
                continue
            seen.add(key)
            if not re.fullmatch(r"\d{4}-\d\d-\d\d", r["act_date"] or ""):
                errors.append(f"acts: {key}: bad date {r['act_date']!r}")
                continue
            if not re.fullmatch(r"\d{4}-\d{4}", r["bulletin"] or ""):  # the counts view reads the year from it
                errors.append(f"acts: {key}: bulletin number not read from the file name {r['bulletin']!r}")
                continue
            out.append({"id": key, "act_id": r["act_id"], "act_date": r["act_date"], "published": r["published"] or None,
                        "bulletin": r["bulletin"], "service": service(r["service"]), "title": r["title"],
                        "pages": int(r["pages"]), "page": int(r["page"]), "pdf_url": r["pdf_url"],
                        "theme": theme(r["title"]), "source_id": f"raa-{year}"})
    return out, errors
