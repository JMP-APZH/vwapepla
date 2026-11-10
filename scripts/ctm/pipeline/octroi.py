"""Octroi de mer decisions of the Assemblée de Martinique (page /ctm/octroi-de-mer).

- classify(): every act of the Assemblée whose title mentions the octroi de mer gets one kind, by rules on its title
  (first rule that matches). « autre » is a deliberate bucket for titles that do not say what the act decides.
- read_figures(): figures transcribed by hand from scanned deliberations (no text layer) in data/ctm/octroi/*.yaml,
  each with its page and the exact wording; JM spot-checks them against the page images.
"""
import re

import yaml

OCTROI = re.compile(r"octroi de mer", re.I)
KINDS = {  # kind: label shown on the page, in display order
    "repartition": "Répartition entre les communes",
    "tarifs": "Tarifs et taux",
    "vie_chere": "Lutte contre la vie chère",
    "exonerations": "Exonérations",
    "reforme": "Réforme et évaluation du régime",
    "autre": "Autres décisions",
}
RULES = [  # (kind, pattern on the title), first match wins
    ("vie_chere", re.compile(r"vie ch[eè]re", re.I)),
    ("repartition", re.compile(r"r[ée]partition", re.I)),
    ("reforme", re.compile(r"r[ée]forme|[ée]valuation|d[ée]cret", re.I)),
    ("exonerations", re.compile(r"\b(?:exo|exon[ée]ration|oxon[ée]ration)", re.I)),
    ("tarifs", re.compile(r"tarif|taux|\btaxe\b", re.I)),
]


def classify(acts):
    """[{act_id, kind}] for the Assemblée's acts on the octroi de mer."""
    out = []
    for a in acts:
        if a["body"] != "assemblee" or not OCTROI.search(a["title"]):
            continue
        kind = next((k for k, rx in RULES if rx.search(a["title"])), "autre")
        out.append({"act_id": a["id"], "kind": kind})
    return out


def read_figures(paths, manifest):
    """[{source job, line_key, label, value, unit, page, quote}] from the YAML transcriptions; errors as a list."""
    rows, errors = [], []
    for p in sorted(paths):
        doc = yaml.safe_load(p.read_text(encoding="utf-8"))
        ds = doc["source"]
        if ds not in manifest:
            errors.append(f"{p.name}: source {ds} not downloaded")
        for f in doc["figures"]:
            missing = [k for k in ("key", "label", "value", "unit", "page", "quote") if f.get(k) in (None, "")]
            if missing:
                errors.append(f"{p.name}: {f.get('key')} lacks {missing}")
                continue
            rows.append({"source_job": ds, "deliberation": doc["deliberation"], "line_key": f["key"], "label": f["label"],
                         "value": f["value"], "unit": f["unit"], "page": f["page"], "quote": f["quote"]})
    return rows, errors
