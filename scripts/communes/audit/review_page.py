"""Build the phone review page for the website-audit drafts -> data/build/communes/audit-review.html (gitignored).

The page lists, commune by commune, what the automatic pass found, with a link to the evidence and a ready-made
"site:" search for the items it did not find. JM records a decision per item (kept in his browser only) and copies
them as plain text; scripts/communes/audit/apply_review.py writes them back into data/communes/audit/sites/<insee>.yaml.
The page holds DRAFTS: it is published as a private artifact for JM, never inside the public app.
Run: python -I scripts/communes/audit/review_page.py
"""
import json, pathlib, sys, urllib.parse

import yaml

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[3]
SITES = ROOT / "data" / "communes" / "audit" / "sites"
OUT = ROOT / "data" / "build" / "communes" / "audit-review.html"

# Words to type in a "site:" search when the automatic pass found nothing (kept short: search engines AND them).
SEARCH = {
    "budget_en_ligne": "budget primitif", "actes_publies": "arrêtés", "liste_deliberations": "délibérations",
    "proces_verbaux": "procès-verbal conseil municipal", "open_data": "données ouvertes",
    "subventions_publiees": "subventions associations", "accessibilite": "accessibilité",
    "mentions_legales": "mentions légales", "donnees_personnelles": "données personnelles",
    "demarches": "démarches", "contact": "contact", "elus_presentes": "élus", "calendrier_conseils": "conseil municipal",
    "rob_publie": "orientations budgétaires", "budget_explique": "budget", "marches_publics": "marchés publics",
    "indemnites_elus": "indemnités élus", "projets_chiffres": "travaux coût", "rapports_controle": "chambre régionale des comptes",
    "question_budget": "budget question", "presentation_commune": "histoire", "bilan_activite": "bilan",
    "magazine_municipal": "magazine", "annuaire_services": "services municipaux", "langue_kreyol": "kréyol",
    "alertes_info": "alerte", "abonnement_alertes": "newsletter", "suivi_demandes": "suivi demande",
    "signalement": "signaler", "risques_majeurs": "DICRIM", "conseil_retransmis": "conseil municipal direct",
    "consultations": "consultation", "budget_participatif": "budget participatif",
    "instances_participatives": "conseil de quartier", "droit_petition": "pétition",
}


def main():
    criteria = yaml.safe_load((ROOT / "data" / "communes" / "audit" / "criteria.yaml").read_text(encoding="utf-8"))["criteria"]
    crit = [{k: c.get(k) for k in ("key", "family", "theme", "label_fr", "description_fr", "legal_ref")} for c in criteria]
    communes = []
    for f in sorted(SITES.glob("*.yaml")):
        a = yaml.safe_load(f.read_text(encoding="utf-8"))
        host = urllib.parse.urlparse(a["site_url"]).netloc.removeprefix("www.") if a.get("site_url") else None
        items = {}
        for key, it in a["items"].items():
            q = f"site:{host} {SEARCH[key]}" if host and key in SEARCH else None
            items[key] = {"s": it["status"], "u": it.get("evidence_url"), "n": it.get("note"), "m": it.get("method"),
                          "q": "https://www.google.com/search?q=" + urllib.parse.quote_plus(q) if q else None}
        communes.append({"code": a["commune_code"], "name": a["commune"], "site": a.get("site_url"),
                         "pages": a.get("pages_read", 0), "audited": a["audited_on"], "reviewed": a.get("reviewed_by"),
                         "items": items})
    data = json.dumps({"criteria": crit, "communes": communes}, ensure_ascii=False).replace("</", "<\\/")
    template = (pathlib.Path(__file__).with_name("review_page.html")).read_text(encoding="utf-8")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(template.replace("/*__DATA__*/null", data), encoding="utf-8")
    todo = sum(1 for c in communes for i in c["items"].values() if i["s"] in ("partial", "no") and c["pages"])
    print(f"{OUT.relative_to(ROOT)} · {len(communes)} communes · {todo} items to check on crawled sites")


if __name__ == "__main__":
    main()
