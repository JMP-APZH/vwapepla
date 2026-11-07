"""Vote selection rule V1 (validated by JM, 5 Nov 2026; docs/branches/B2-DISCOVERY.md §3.4). Mechanical, versioned:
a change of rule is a new version, published on the Méthodologie page, never applied silently.

  a. every scrutin public solennel (SPS);
  b. every public scrutin on a whole text (« l'ensemble du projet / de la proposition de loi / du texte »);
  c. every public scrutin whose dossier législatif (title or path) or whose own object contains a word of the
     overseas list below;
  d. every motion de censure.

Sénat (same rule, applied to the Dosleg public votes): (a) is not applicable, Dosleg does not flag solemn votes;
(b) and (c) apply to the vote's own object (« sur l'ensemble du projet de loi… ») and the legislative file's title;
(d) does not exist in the Sénat. Stated on the Méthodologie page.

Not implemented from the written rule: « or the dossier is examined by the Délégation aux outre-mer » (the dossier
files we load do not say which delegation examined them). Stated on the Méthodologie page.
"""
import re

RULE = "V1"
RULE_DATE = "2026-11-05"
OVERSEAS = ["outre-mer", "ultramarin", "Martinique", "Antilles", "Guadeloupe", "Guyane", "La Réunion", "Mayotte",
            "octroi de mer", "DROM", "collectivités territoriales de Guyane et de Martinique"]
_KW = re.compile(r"(?<!\w)(" + "|".join(re.escape(k) for k in OVERSEAS) + r")", re.I)
_WHOLE = re.compile(r"^l'ensemble (du projet|de la proposition|du texte)", re.I)
_WHOLE_SEN = re.compile(r"\bl['’]ensemble (du projet|de la proposition|du texte)", re.I)


def select(scrutin, dossier):
    """Parts of V1 that select this scrutin, e.g. ['a', 'b'] (empty list = not selected)."""
    parts = []
    kind = scrutin["typeVote.codeTypeVote"]
    title, obj = scrutin["titre"] or "", scrutin["objet.libelle"] or ""
    if kind == "SPS":
        parts.append("a")
    if _WHOLE.search(title) or _WHOLE.search(obj):
        parts.append("b")
    text = " ".join([obj, (dossier or {}).get("titreDossier.titre") or "", (dossier or {}).get("titreDossier.titreChemin") or ""])
    if _KW.search(text):
        parts.append("c")
    if kind == "MOC" or "motion de censure" in f"{title} {obj}".lower():
        parts.append("d")
    return parts


def select_senat(scrutin):
    """Parts of V1 that select a Sénat public vote (Dosleg row of senat-scrutins): only (b) and (c) can apply."""
    obj = scrutin["scrint"] or ""
    parts = []
    if _WHOLE_SEN.search(obj):
        parts.append("b")
    if _KW.search(" ".join([obj, scrutin["loi.loient"] or "", scrutin["loi.loitit"] or "", scrutin["loi.loiint"] or ""])):
        parts.append("c")
    return parts
