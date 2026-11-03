"""Automated FIRST PASS of the town-hall website audit -> data/audit/sites/<insee>.yaml (drafts for JM's review).

Input: data/raw/audit/<insee>.json (crawl_sites.py), data/audit/criteria.yaml, src/lib/sites.ts, populations.
Each criterion gets a status (yes / partial / no / na), an evidence URL and a note that says how it was found.
Heuristic keyword rules: "no" only means "not found by the automatic search" and is said so in the note.
Never overwrites an item whose `method` is `manual`, nor a file already reviewed (reviewed_by set).
Run: python -I scripts/audit/auto_audit.py
"""
import datetime, json, pathlib, re, sys, unicodedata, urllib.parse

import yaml

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW, OUT = ROOT / "data" / "raw" / "audit", ROOT / "data" / "audit" / "sites"
CRITERIA = yaml.safe_load((ROOT / "data" / "audit" / "criteria.yaml").read_text(encoding="utf-8"))["criteria"]
SITES = dict(re.findall(r'"(972\d\d)": (null|"[^"]+")', (ROOT / "src" / "lib" / "sites.ts").read_text(encoding="utf-8")))
SITES = {k: (None if v == "null" else v.strip('"')) for k, v in SITES.items()}
NAMES = {c["code"]: c["name"] for c in json.loads((ROOT / "data" / "build" / "communes.json").read_text(encoding="utf-8"))}
POP = {r["commune_code"]: r["population"] for r in json.loads((ROOT / "data" / "build" / "commune_years.json").read_text(encoding="utf-8"))
       if r["year"] == 2024}
TODAY = datetime.date.today()
MONTHS = "janvier fevrier mars avril mai juin juillet aout septembre octobre novembre decembre".split()


def norm(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()


# criterion -> (strong pattern "yes", weaker pattern "partial"), searched in link texts/URLs, then in page text.
RULES = {
    "mentions_legales": (r"mentions[ -]legales", None),
    "accessibilite": (r"accessibilite\s*:\s*(non|partiellement|totalement)\s+conforme|declaration d.accessibilite", r"accessibilite"),
    "donnees_personnelles": (r"donnees personnelles|politique de confidentialite|protection des donnees|\brgpd\b", None),
    "budget_en_ligne": (r"presentation (breve|synthetique)|note (breve|de presentation)", r"budget primitif|compte administratif|compte financier unique|budget (communal )?20(2[3-6])"),
    "rob_publie": (r"rapport d.orientations? budgetaires?|debat d.orientations? budgetaires?", r"\b[rd]ob 20(2[3-6])\b"),
    "actes_publies": (r"recueil des actes|actes administratifs|arretes (municipaux|du maire)|publication des actes|actes reglementaires", r"\barretes?\b"),
    "liste_deliberations": (r"liste des deliberations", r"deliberations?"),
    "proces_verbaux": (r"proces[ -]verba(l|ux) (de la seance|des seances|du conseil|des conseils)|^proces[ -]verbaux$|\bpv (du|de la|des) (conseils?|seances?)", r"compte[ -]rendu (du|des) conseils?"),
    "open_data": (r"data\.gouv\.fr|open ?data|donnees ouvertes", None),
    "subventions_publiees": (r"donnees essentielles.{0,40}subvention|subvention.{0,60}donnees essentielles", r"subventions? (versees|attribuees|aux associations)"),
    "marches_publics": (r"marches[ -]publics|appels? d.offres|profil (d.)?acheteur|marches-securises|achatpublic|e-marchespublics|marches-publics\.info|aws-achat|megalis|klekoon|dematis", None),
    "demarches": (r"demarches? en ligne|e-services|portail (famille|citoyen)|prendre (un )?rendez-vous|service-public\.fr", r"demarches?"),
    "contact": (r"horaires.{0,200}(\d{2}[ .]?){5}|(\d{2}[ .]?){5}.{0,200}horaires", r"nous contacter|contact"),
    "elus_presentes": (r"^(les |vos )?elus( municipaux)?$|les elus|vos elus|elus municipaux|equipe municipale|le maire et (ses|les) adjoints|^conseil municipal$", r"adjoint"),
    "calendrier_conseils": (r"prochain conseil municipal|convocation (du|au) conseil|ordre du jour (du|de la) (conseil|seance)", r"seance du conseil"),
    "budget_explique": (r"budget en bref|comprendre le budget|budget (explique|en chiffres)|l.essentiel du budget", None),
    "indemnites_elus": (r"indemnites? (des elus|de fonction)", None),
    "projets_chiffres": (r"(grands projets|projets structurants|programme d.investissement|plan pluriannuel).{0,400}\d[\d .]*(€|euros|m€)", r"grands projets|projets structurants|travaux en cours"),
    "rapports_controle": (r"chambre regionale des comptes|rapport d.observations definitives", None),
    "question_budget": (r"(question|avis).{0,60}budget|budget.{0,60}(question|avis)", None),
    "presentation_commune": (r"histoire de la (ville|commune)|decouvrir (la ville|la commune)|presentation de la (ville|commune)|^(ma|la|notre) (ville|commune)$|^(histoire|patrimoine)$", r"patrimoine|histoire"),
    "bilan_activite": (r"rapport d.activites?|bilan (de mandat|des actions|annuel)", r"\bbilan\b|realisations"),
    "magazine_municipal": (r"magazine( municipal)?|bulletin municipal|journal municipal|lettre (municipale|d.information)", r"newsletter"),
    "annuaire_services": (r"annuaire|services municipaux|equipements (municipaux|sportifs|publics)", r"nos services"),
    "langue_kreyol": (r"\bkreyol\b|\bkreol\b|\ban kreyol\b", r"creole"),
    "alertes_info": (r"vigilance|coupure d.eau|alerte meteo|alertes?|infos? pratiques", r"actualites"),
    "abonnement_alertes": (r"alertes? sms|abonnez-vous|inscri(vez|ption).{0,40}(newsletter|alertes?)|application mobile", r"newsletter"),
    "suivi_demandes": (r"suivi de (votre|ma|vos) demandes?|suivre (ma|votre) demande|espace (citoyen|usager)|compte citoyen", None),
    "signalement": (r"signaler un (probleme|incident|dysfonctionnement)|signalement|tellmycity", r"signaler"),
    "risques_majeurs": (r"\bdicrim\b|document d.information communal sur les risques", r"risques majeurs|plan communal de sauvegarde"),
    "conseil_retransmis": (r"retransmission (en direct )?(du|des) conseils?|conseils? municipa(l|ux) en (direct|live|video)|(youtube|facebook)\.com.{0,80}conseil", r"retransmis"),
    "consultations": (r"concertation|consultation (publique|citoyenne)|enquete publique", r"sondage|questionnaire"),
    "budget_participatif": (r"budget participatif", None),
    "instances_participatives": (r"conseils? de quartiers?|conseil municipal des jeunes|\bcmj\b|conseil des (sages|aines|jeunes)|comites? consultatifs?", None),
    "droit_petition": (r"petition|consultation locale|referendum local", None),
}


TEXT_YES = {"contact", "accessibilite", "donnees_personnelles", "abonnement_alertes"}  # page text is reliable enough


def search(rec, pattern, key=None):
    """Best evidence for a pattern -> (url, where, snippet, strong). Link TEXT (menu, document title) is strong;
    a match only in a URL or in running text is weak ('partial'), except for TEXT_YES criteria."""
    if not pattern:
        return None
    rx = re.compile(pattern)
    links = [(u, t, "lien") for page in rec["pages"] for u, t in page["links"]]
    links += [(d["url"], d["text"], "document") for d in rec["documents"]]
    links += [(d["url"], d["text"], "lien externe") for d in rec["external"]]
    for url, text, where in links:
        if rx.search(norm(text).strip()):
            return url, where, text, True
    for url, text, where in links:
        if rx.search(norm(urllib.parse.unquote(url))):
            return url, where + " (adresse seulement)", text or url, False
    for page in rec["pages"]:
        t = norm(page["text"])
        m = rx.search(t)
        if m:
            return page["url"], "texte de la page", t[max(0, m.start() - 60):m.end() + 60], key in TEXT_YES
    return None


def latest_date(text):
    t, found = norm(text), []
    for d, m, y in re.findall(r"\b(\d{1,2})[/.](\d{1,2})[/.](20\d\d)\b", t):
        found.append((int(y), int(m), int(d)))
    for d, mon, y in re.findall(r"\b(\d{1,2})(?:er)? (" + "|".join(MONTHS) + r") (20\d\d)\b", t):
        found.append((int(y), MONTHS.index(mon) + 1, int(d)))
    valid = []
    for y, m, d in found:
        try:
            dt = datetime.date(y, m, d)
        except ValueError:
            continue
        if dt <= TODAY:
            valid.append(dt)
    return max(valid) if valid else None


def applies(cond, code):
    if not cond:
        return True, None
    pop = POP.get(code)
    if "agents" in cond:
        if pop is not None and pop < 3500:
            return False, f"Commune de moins de 3 500 habitants ({pop} hab.) : non concernée."
        return None, "Obligation si 3 500 habitants et 50 agents ou plus : effectif non vérifié."
    if "population >= 3500" in cond:
        return (pop is not None and pop >= 3500), (None if pop is None or pop >= 3500 else f"Commune de moins de 3 500 habitants ({pop} hab.) : non concernée.")
    return True, None


def audit(code):
    site = SITES.get(code)
    raw = RAW / f"{code}.json"
    rec = json.loads(raw.read_text(encoding="utf-8")) if raw.exists() else None
    items = {}

    def put(key, status, evidence=None, note=None):
        items[key] = {"status": status, "evidence_url": evidence, "archive_url": None, "note": note, "method": "automated"}

    if not site:
        put("site_officiel", "no", None, "Aucun site internet indiqué dans l'annuaire Service-Public.")
        for c in CRITERIA:
            if c["key"] != "site_officiel":
                put(c["key"], "na", None, "Sans objet : aucun site internet indiqué.")
        return items, None
    if rec is None or rec["error"]:
        err = rec["error"] if rec else "non parcouru"
        human = "vérification anti-robot : contrôle manuel nécessaire" if rec and "bot wall" in err else f"site inaccessible ({err})"
        put("site_officiel", "partial", site, f"Site indiqué par l'annuaire, mais {human} le {TODAY.isoformat()}.")
        for c in CRITERIA:
            if c["key"] != "site_officiel":
                put(c["key"], "na", None, f"Non évalué : {human}.")
        return items, rec
    n = len(rec["pages"])
    put("site_officiel", "yes", rec["final_url"], "Site indiqué par l'annuaire Service-Public et accessible.")
    put("https", "yes" if rec["https"] else "no", rec["final_url"],
        "Connexion chiffrée (https) avec certificat valide." if rec["https"] else "Le site s'ouvre en http (non chiffré).")
    put("mobile", "yes" if rec["viewport"] else "no", rec["final_url"],
        "Page d'accueil adaptée aux écrans de téléphone (balise viewport) ; à confirmer à l'œil." if rec["viewport"]
        else "Pas de balise viewport : affichage probablement non adapté aux téléphones.")
    home_date = latest_date(rec["pages"][0]["text"]) or latest_date(" ".join(p["text"] for p in rec["pages"][:15]))
    if home_date:
        age = (TODAY - home_date).days
        put("a_jour", "yes" if age <= 92 else "partial" if age <= 366 else "no", rec["final_url"],
            f"Date la plus récente lue sur le site (accueil ou premières pages) : {home_date.strftime('%d/%m/%Y')} (il y a {age} jours).")
    else:
        put("a_jour", "no", rec["final_url"], "Aucune date lisible sur la page d'accueil (recherche automatique).")
    for c in CRITERIA:
        key = c["key"]
        if key in items:
            continue
        ok, why = applies(c.get("applies_if"), code)
        strong, weak = RULES.get(key, (None, None))
        hit = search(rec, strong, key)
        if hit and hit[3]:
            put(key, "yes", hit[0], f"Trouvé ({hit[1]}) : « {hit[2][:140]} ».")
        elif hit or (hit := search(rec, weak, key)):
            put(key, "partial", hit[0], f"Indice partiel ({hit[1]}) : « {hit[2][:140]} » ; à vérifier.")
        elif ok is False:
            put(key, "na", None, why)
        elif ok is None:
            put(key, "na", None, why + f" Rien trouvé par la recherche automatique ({n} pages lues).")
        else:
            put(key, "no", None, f"Non trouvé par la recherche automatique ({n} pages lues) ; à vérifier.")
    return items, rec


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for code in sorted(SITES):
        path = OUT / f"{code}.yaml"
        old = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else None
        if old and old.get("reviewed_by"):
            print(f"{code} reviewed by {old['reviewed_by']}: kept"); continue
        items, rec = audit(code)
        if old:  # keep items JM entered by hand
            for k, v in (old.get("items") or {}).items():
                if v.get("method") == "manual":
                    items[k] = v
        doc = {
            "commune_code": code, "commune": NAMES.get(code), "site_url": SITES.get(code),
            "audited_on": (rec or {}).get("crawled_on") or TODAY.isoformat(),
            "auditor": "Claude (première passe automatique)", "reviewed_by": None,
            "pages_read": len(rec["pages"]) if rec and not rec.get("error") else 0,
            "items": {c["key"]: items[c["key"]] for c in CRITERIA},
        }
        header = ("# Audit du site de la mairie — PREMIÈRE PASSE AUTOMATIQUE, à relire par JM.\n"
                  "# status: yes / partial / no / na · method: automated (règles par mots-clés) ou manual (relu à la main).\n"
                  "# « no » automatique = non trouvé par la recherche, pas une preuve d'absence. Rien n'est publié avant reviewed_by.\n")
        path.write_text(header + yaml.safe_dump(doc, allow_unicode=True, sort_keys=False, width=140), encoding="utf-8")
        counts = {s: sum(1 for v in doc["items"].values() if v["status"] == s) for s in ("yes", "partial", "no", "na")}
        print(code, doc["pages_read"], "pages", counts)


if __name__ == "__main__":
    main()
