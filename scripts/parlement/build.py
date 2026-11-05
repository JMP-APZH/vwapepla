"""Build normalised tables from data/raw/parlement/ into data/build/parlement/<table>.json (one JSON array per Supabase
table: core rows of the two chambers + parl_* tables). Current terms only (cut-off, docs/branches/B2-DISCOVERY.md §1bis):
the XVIIth legislature for deputies, the current mandate for senators.

Deterministic and idempotent: same raw files -> same output. Run: python -I scripts/parlement/build.py
Checks (exit 1 on failure): row counts equal to the manifest; exactly 4 sitting deputies (circonscriptions 1-4) and
2 sitting senators of Martinique, names and sex matching the RNE; every vote, amendment, question, membership points
to a known person / scrutin / organe.
"""
import collections, csv, html, json, pathlib, re, sys, unicodedata

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # our own code dir (python -I drops it)
import votes  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")
csv.field_size_limit(1 << 30)
ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW, OUT = ROOT / "data" / "raw" / "parlement", ROOT / "data" / "build" / "parlement"
MANIFEST = json.loads((RAW / "manifest.json").read_text(encoding="utf-8"))
errors = []
AN_URL, SEN_URL = "https://www.assemblee-nationale.fr", "https://www.senat.fr"


def raw(ds):
    with open(ROOT / MANIFEST[ds]["file"], encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f, delimiter=";"))
    if MANIFEST[ds]["rows"] is not None and len(rows) != MANIFEST[ds]["rows"]:
        errors.append(f"{ds}: {len(rows)} rows read, manifest says {MANIFEST[ds]['rows']}")
    return rows


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]+", " ", s.lower()).strip()


def day(s):
    """'2023-10-02 00:00:00.0' / '2024-07-07' / '11/09/2024 21:06:47' / '2026-02-04T00:05:47+01:00' -> '2024-07-07'."""
    s = (s or "").strip()
    if m := re.match(r"(\d{2})/(\d{2})/(\d{4})", s):
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return s[:10] or None


def slug(*parts):
    return re.sub(r"[^a-z0-9]+", "-", norm(" ".join(parts))).strip("-")


def ordinal(n):
    return "1re" if n == 1 else f"{n}e"


# --- sources -------------------------------------------------------------------------------------------------------
sources = [{"id": ds, "title": m["title"], "url": m["url"], "dataset_page": m["dataset_page"],
            "licence": m["licence"], "credit": m["credit"], "retrieved": m["retrieved"], "sha256": m["sha256"],
            "rows": m["rows"], "purpose": m["purpose"], "domain": "parlement"} for ds, m in sorted(MANIFEST.items())]

# --- core rows: the two chambers ------------------------------------------------------------------------------------
AN_BODY, SEN_BODY = "assemblee-nationale-17", "senat-hemicycle"
institutions = [{"id": "assemblee-nationale", "kind": "assemblee_nationale", "name": "Assemblée nationale", "code": None},
                {"id": "senat", "kind": "senat", "name": "Sénat", "code": None}]
bodies = [{"id": AN_BODY, "institution_id": "assemblee-nationale", "kind": "legislature", "name": "XVIIe législature"},
          {"id": SEN_BODY, "institution_id": "senat", "kind": "assemblee", "name": "Sénat"}]
seats = [{"id": f"{AN_BODY}:depute-972-{n}", "body_id": AN_BODY, "role": "depute", "rank": n,
          "label_fr": f"Député de la {ordinal(n)} circonscription de la Martinique", "constituency": f"972-{n}"}
         for n in range(1, 5)]
seats += [{"id": f"{SEN_BODY}:senateur-972-{n}", "body_id": SEN_BODY, "role": "senateur", "rank": n,
           "label_fr": "Sénateur de la Martinique", "constituency": "972"} for n in (1, 2)]
persons, mandates, details = [], [], []

# --- deputies (AN AMO30, cross-checked with the RNE) ------------------------------------------------------------------
RNE_LAST, RNE_FIRST, SEN_MEMBER_ID = "Nom de l'élu", "Prénom de l'élu", "Id d'appartenance"
an = raw("an-deputes")
rne_dep = {r["Code de la circonscription législative"]: r for r in raw("rne-deputes")
           if r["Code de la collectivité à statut particulier"] == "972" or r["Code du département"] == "972"}
cand = {(r["Code circonscription"], norm(r["Nom du candidat"]), norm(r["Prénom du candidat"])): r
        for r in raw("legislatives-2024-candidats-t1") if r["Code département"] == "972"}
seat_an = {}  # uid -> mandate row of the current XVIIth seat
for r in an:
    if (r["mandat.typeOrgane"] == "ASSEMBLEE" and r["mandat.legislature"] == "17" and not r["mandat.dateFin"]
            and r["mandat.election.lieu.numDepartement"] == "972"):
        seat_an[r["uid"]] = r
circos = sorted(int(r["mandat.election.lieu.numCirco"]) for r in seat_an.values())
if circos != [1, 2, 3, 4]:
    errors.append(f"sitting deputies of Martinique: circonscriptions {circos}, expected [1, 2, 3, 4]")
for uid, r in sorted(seat_an.items()):
    n = int(r["mandat.election.lieu.numCirco"])
    pid = f"parl-an:{uid}"
    last, first = r["etatCivil.ident.nom"], r["etatCivil.ident.prenom"]
    sex = "F" if r["etatCivil.ident.civ"].startswith("Mme") else "M"
    rne = rne_dep.get(f"972{n:02d}")
    if not rne or norm(rne[RNE_LAST]) != norm(last) or norm(rne[RNE_FIRST]) != norm(first) \
            or rne["Code sexe"] != sex:
        found = rne and (rne[RNE_LAST], rne[RNE_FIRST], rne["Code sexe"])
        errors.append(f"{pid}: AN {last} {first} {sex} does not match RNE circ. 972-{n}: {found}")
    persons.append({"id": pid, "last_name": last, "first_name": first, "sex": sex})
    seat = f"{AN_BODY}:depute-972-{n}"
    mandates.append({"person_id": pid, "seat_id": seat, "start_date": day(r["mandat.dateDebut"]),
                     "function_start": day(r["mandat.mandature.datePriseFonction"]), "end_date": None,
                     "acquired": "direct_election", "term_id": None, "verified": True, "source_id": "an-deputes",
                     "source_url": f"{AN_URL}/dyn/deputes/{uid}"})
    c = cand.get((f"972{n:02d}", norm(last), norm(first)))
    ok = c is not None
    if not ok:
        errors.append(f"{pid}: no 2024 candidacy found for {last} in 972-{n}")
    details.append({"id": f"{pid}:{seat}", "person_id": pid, "seat_id": seat,
                    "election_cause": r["mandat.election.causeMandat"] or None,
                    "suppleant_last_name": c["Nom remplaçant"] if ok else None,
                    "suppleant_first_name": c["Prénom remplaçant"] if ok else None,
                    "suppleant_sex": c["Sexe remplaçant"] if ok else None,
                    "suppleant_source_id": "legislatives-2024-candidats-t1" if ok else None,
                    "official_url": f"{AN_URL}/dyn/deputes/{uid}", "hatvp_url": r["uri_hatvp"] or None,
                    "source_id": "an-deputes"})
dep_ids = {f"parl-an:{u}" for u in seat_an}

# --- senators (Sénat ODSEN, cross-checked with the RNE) ---------------------------------------------------------------
sen = [r for r in raw("senat-senateurs") if r["Circonscription"].strip() == "Martinique" and r["État"] == "ACTIF"]
rne_sen = {(norm(r[RNE_LAST]), norm(r[RNE_FIRST])): r for r in raw("rne-senateurs")
           if r["Code de la collectivité à statut particulier"] == "972" or r["Code du département"] == "972"}
cur_sen = {r["Matricule"]: r for r in raw("senat-mandats-senat") if not r["Date de fin de mandat"]}
if len(sen) != 2:
    errors.append(f"sitting senators of Martinique: {len(sen)}, expected 2")
sen_start = {}
for rank, r in enumerate(sorted(sen, key=lambda r: (day(cur_sen.get(r["Matricule"], {}).get("Date d'élection")) or "",
                                                     r["Nom usuel"])), 1):
    mat, pid = r["Matricule"], f"parl-sen:{r['Matricule']}"
    last, first, sex = r["Nom usuel"], r["Prénom usuel"], "F" if r["Qualité"].startswith("Mme") else "M"
    rne = rne_sen.get((norm(last), norm(first)))
    if not rne or rne["Code sexe"] != sex:
        errors.append(f"{pid}: {last} {first} {sex} not found in RNE sénateurs (972)")
    m = cur_sen.get(mat)
    if not m:
        errors.append(f"{pid}: no current mandate in senat-mandats-senat")
        continue
    sen_start[pid] = day(m["Date de début de mandat"])
    persons.append({"id": pid, "last_name": last, "first_name": first, "sex": sex})
    seat = f"{SEN_BODY}:senateur-972-{rank}"
    url = f"{SEN_URL}/senateur/{slug(last).replace('-', '_')}_{slug(first).replace('-', '_')}{mat.lower()}.html"
    mandates.append({"person_id": pid, "seat_id": seat, "start_date": sen_start[pid], "function_start": None,
                     "end_date": None, "acquired": "indirect_election", "term_id": None, "verified": True,
                     "source_id": "senat-mandats-senat", "source_url": url})
    details.append({"id": f"{pid}:{seat}", "person_id": pid, "seat_id": seat,
                    "election_cause": (m["Motif début de mandat"] or "").strip() or None,
                    "suppleant_last_name": None, "suppleant_first_name": None, "suppleant_sex": None,
                    "suppleant_source_id": None, "official_url": url, "hatvp_url": None,
                    "source_id": "senat-mandats-senat"})
sen_ids = set(sen_start)
person_ids = dep_ids | sen_ids
an_start = {f"parl-an:{u}": day(r["mandat.dateDebut"]) for u, r in seat_an.items()}

# --- organes and memberships ------------------------------------------------------------------------------------------
organes, memberships = {}, []
for o in raw("an-organes"):
    organes[o["uid"]] = {"id": o["uid"], "chamber": "AN", "kind": o["codeType"], "label_fr": o["libelle"],
                         "short": o["libelleAbrege"] or None, "start_date": day(o["viMoDe.dateDebut"]),
                         "end_date": day(o["viMoDe.dateFin"]), "source_id": "an-organes"}
for r in an:
    pid = f"parl-an:{r['uid']}"
    if pid not in dep_ids or r["mandat.legislature"] != "17" or r["mandat.typeOrgane"] == "ASSEMBLEE":
        continue
    for oid in (r["mandat.organes.organeRef"] or "").split(","):
        if oid not in organes:
            errors.append(f"{pid}: organe {oid} not in an-organes")
            continue
        memberships.append({"id": f"{pid}:{r['mandat.uid']}:{oid}", "person_id": pid, "organe_id": oid,
                            "function": r["mandat.infosQualite.libQualite"] or None,
                            "start_date": day(r["mandat.dateDebut"]), "end_date": day(r["mandat.dateFin"]),
                            "source_id": "an-deputes"})


def sen_organe(oid, kind, label, ds):
    organes.setdefault(oid, {"id": oid, "chamber": "SEN", "kind": kind, "label_fr": label, "short": None,
                             "start_date": None, "end_date": None, "source_id": ds})


def in_term(pid, end):
    return not end or end >= sen_start[pid]


for r in raw("senat-histogroupes"):
    pid = f"parl-sen:{r['Matricule']}"
    if pid in sen_ids and in_term(pid, day(r["Date de fin d'appartenance"])):
        oid = f"sen-grp:{r['Code du groupe politique']}"
        sen_organe(oid, "GP", r["Nom court du groupe politique"], "senat-histogroupes")
        memberships.append({"id": f"{pid}:grp:{r['Id appartenance']}:{r['Id fonction occupée']}", "person_id": pid,
                            "organe_id": oid, "function": r["Nom court fonction"] or None,
                            "start_date": day(r["Date de début de la fonction"] or r["Date de début d'appartenance"]),
                            "end_date": day(r["Date de fin de la fonction"] or r["Date de fin d'appartenance"]),
                            "source_id": "senat-histogroupes"})
for ds, name_col, kind in [("senat-commissions", "Nom commission", "COM"), ("senat-delegations", "Nom organisme", "DELEG")]:
    for r in raw(ds):
        pid = f"parl-sen:{r['Matricule']}"
        if pid not in sen_ids or r[name_col].strip() in ("", "Aucune"):
            continue
        end = day(r["Fin de fonction"] or r["Fin d'appartenance"])
        if not in_term(pid, end):
            continue
        oid = f"sen-{kind.lower()}:{slug(r[name_col])}"
        sen_organe(oid, kind, r[name_col].strip(), ds)
        memberships.append({"id": f"{pid}:{kind.lower()}:{r[SEN_MEMBER_ID]}:{r['Id de fonction']}",
                            "person_id": pid, "organe_id": oid, "function": r["Fonction"].strip() or "Membre",
                            "start_date": day(r["Début de fonction"] or r["Début d'appartenance"]), "end_date": end,
                            "source_id": ds})
for r in raw("senat-organismes"):
    pid = f"parl-sen:{r['Matricule']}"
    if pid in sen_ids and in_term(pid, day(r["Fin"])):
        oid = f"sen-oep:{r['Code organisme']}"
        sen_organe(oid, "ORGEXTPARL", f"{r['Organisme'].strip()}", "senat-organismes")
        memberships.append({"id": f"{pid}:oep:{r['Identifiant appartenance']}", "person_id": pid, "organe_id": oid,
                            "function": r["Titulaire"].strip().capitalize() or None, "start_date": day(r["Début"]),
                            "end_date": day(r["Fin"]), "source_id": "senat-organismes"})
used = {m["organe_id"] for m in memberships}

# --- texts, scrutins, votes (AN) ---------------------------------------------------------------------------------------
dossiers = {d["uid"]: d for d in raw("an-dossiers-17")}
scr_list = raw("an-scrutins-17-liste")
texts, scrutins, vote_rows = {}, [], []
counts = collections.Counter()
for s in scr_list:
    dref = s["objet.dossierLegislatif.dossierRef"] or None
    d = dossiers.get(dref) if dref else None
    if dref and not d:
        errors.append(f"scrutin {s['uid']}: dossier {dref} not in an-dossiers-17")
    if d and dref not in texts:
        texts[dref] = {"id": dref, "chamber": "AN", "title": d["titreDossier.titre"],
                       "procedure": d["procedureParlementaire.libelle"] or None,
                       "url": f"{AN_URL}/dyn/{d['legislature'] or 17}/dossiers/{d['titreDossier.titreChemin'] or dref}",
                       "source_id": "an-dossiers-17"}
    parts = votes.select(s, d)
    for p in parts:
        counts[p] += 1
    counts["selected"] += bool(parts)
    scrutins.append({"id": s["uid"], "number": int(s["numero"]), "date": day(s["dateScrutin"]),
                     "type_code": s["typeVote.codeTypeVote"], "type_label": s["typeVote.libelleTypeVote"],
                     "title": s["titre"], "object": s["objet.libelle"] or None, "text_id": dref if d else None,
                     "result_code": s["sort.code"], "result_label": s["sort.libelle"],
                     "voters": int(s["syntheseVote.nombreVotants"] or 0), "pour": int(s["syntheseVote.decompte.pour"] or 0),
                     "contre": int(s["syntheseVote.decompte.contre"] or 0),
                     "abstentions": int(s["syntheseVote.decompte.abstentions"] or 0),
                     "non_votants": int(s["syntheseVote.decompte.nonVotants"] or 0),
                     "selected_by": [f"{votes.RULE}:{p}" for p in parts],
                     "url": f"{AN_URL}/dyn/17/scrutins/{s['numero']}", "source_id": "an-scrutins-17-liste"})
scr_ids = {s["id"] for s in scrutins}
MAP_POSITIONS = {"pours": "pour", "pour": "pour", "contres": "contre", "contre": "contre", "abstentions": "abstention",
                 "nonVotants": "nonVotant", "nonVotantsVolontaires": "nonVotantVolontaire"}


def own_correction(raw_json, uid):
    """The deputy's own « mise au point » (position they say they meant), from the scrutin's correction object."""
    if not raw_json or uid not in raw_json:
        return None
    obj = json.loads(raw_json)
    for key, val in obj.items():
        if key == "dysfonctionnement" and isinstance(val, dict):
            for k2, v2 in val.items():
                if uid in json.dumps(v2):
                    return f"dysfonctionnement:{MAP_POSITIONS.get(k2, k2)}"
        elif uid in json.dumps(val):
            return MAP_POSITIONS.get(key, key)
    return None


selected = {s["id"] for s in scrutins if s["selected_by"]}
for v in raw("an-scrutins-17"):
    pid = f"parl-an:{v['acteurRef']}"
    if pid not in dep_ids:
        continue  # former Martinique deputies of the file are outside the current term
    if v["uid"] not in scr_ids:
        errors.append(f"vote {v['uid']} {pid}: unknown scrutin")
        continue
    vote_rows.append({"scrutin_id": v["uid"], "person_id": pid, "position": v["position"],
                      "by_delegation": v["parDelegation"] == "true", "group_id": v["groupe_organeRef"] or None,
                      "group_position": v["groupe_positionMajoritaire"] or None,
                      "cause": v["causePositionVote"] or None, "mise_au_point": own_correction(v["miseAuPoint"], v["acteurRef"]),
                      "source_id": "an-scrutins-17"})
for v in vote_rows:
    if v["group_id"] and v["group_id"] not in organes:
        errors.append(f"vote {v['scrutin_id']}: group {v['group_id']} not in an-organes")
    elif v["group_id"]:
        used.add(v["group_id"])

# --- amendments ----------------------------------------------------------------------------------------------------
amendments = []
for a in raw("an-amendements-17"):
    author = f"parl-an:{a['signataires.auteur.acteurRef']}"
    rapporteur = a["signataires.auteur.typeAuteur"] == "Rapporteur"
    who = [(author, "premier_signataire")] if author in dep_ids else []
    co = set((a["cosignataires"] or "").split(","))
    who += [(f"parl-an:{x}", "cosignataire") for x in (a["martinique_acteurRefs"] or "").split(",")
            if x in co and f"parl-an:{x}" in dep_ids]
    num = re.search(r"(\d+)$", a["texteLegislatifRef"] or "")
    for pid, role in who:
        amendments.append({"id": f"{a['uid']}:{pid}", "amendment_id": a["uid"], "chamber": "AN", "person_id": pid,
                           "role": role, "as_rapporteur": rapporteur, "signatories": 1 + len(co - {""}),
                           "number": a["identification.numeroLong"], "text_ref": a["texteLegislatifRef"] or None,
                           "text_number": num.group(1) if num else None, "text_title": None, "text_id": None,
                           "article": a["pointeurFragmentTexte.division.articleDesignation"] or None,
                           "filed": day(a["cycleDeVie.dateDepot"]), "outcome": a["cycleDeVie.sort"] or None,
                           "state": a["cycleDeVie.etatDesTraitements.etat.libelle"] or None,
                           "url": f"{AN_URL}/dyn/17/amendements/{a['uid']}", "source_id": "an-amendements-17"})
for a in raw("senat-amendements-972"):
    pid = f"parl-sen:{a['matricule']}"
    if pid not in sen_ids or day(a["amd.datdep"]) < sen_start[pid]:
        continue
    ann, num, txt = int(a["ses.ann"]), a["amd.num"], re.match(r"\d+", a["txt.num"] or "")
    com = num.startswith("COM-")
    url = (f"{SEN_URL}/amendements/{'commissions/' if com else ''}{ann}-{ann + 1}/{txt.group(0)}/Amdt_{num}.html"
           if txt else None)
    amendments.append({"id": f"sen:{a['amd.id']}:{pid}", "amendment_id": f"sen:{a['amd.id']}", "chamber": "SEN",
                       "person_id": pid, "role": "premier_signataire" if a["amdsen.rng"] == "0" else "cosignataire",
                       "as_rapporteur": False, "signatories": int(a["signataires"]), "number": num,
                       "text_ref": a["txt.doslegsignet"] or None, "text_number": a["txt.num"] or None,
                       "text_title": a["txt.inl"] or a["txt.int"] or None, "text_id": None, "article": None,
                       "filed": day(a["amd.datdep"]), "outcome": a["sor.lib"] or None,
                       "state": "commission" if com else "séance", "url": url, "source_id": "senat-amendements-972"})

# --- questions -------------------------------------------------------------------------------------------------------
questions = []
for ds in ("an-questions-ecrites-17", "an-questions-orales-17", "an-questions-gouvernement-17"):
    for q in raw(ds):
        pid = f"parl-an:{q['auteur.identite.acteurRef']}"
        if pid not in dep_ids:
            continue
        questions.append({"id": q["uid"], "chamber": "AN", "person_id": pid, "kind": q["type"],
                          "number": q["identifiant.numero"], "title": q["indexationAN.analyses.analyse"] or None,
                          "rubrique": q["indexationAN.rubrique"] or None,
                          "ministry": q["minAttribs.minAttrib.denomination.abrege"] or q["minInt.abrege"] or None,
                          "asked": day(q["textesQuestion.texteQuestion.infoJO.dateJO"]),
                          "answered": day(q["textesReponse.texteReponse.infoJO.dateJO"]),
                          "status": q["cloture.libelleCloture"] or None,
                          "url": f"{AN_URL}/dyn/17/questions/{q['uid']}", "source_id": ds})
for q in raw("senat-questions-972"):
    pid = f"parl-sen:{q['matricule']}"
    if pid not in sen_ids or (day(q["datejodepot"]) or "") < sen_start[pid]:
        continue
    ref = q["reference"]
    questions.append({"id": f"sen:{q['id']}", "chamber": "SEN", "person_id": pid, "kind": q["natquecod"],
                      "number": q["numero"], "title": q["titre"] or None, "rubrique": q["rubrique"] or None,
                      "ministry": q["mindepotlib"] or None, "asked": day(q["datejodepot"]),
                      "answered": day(q["reponse.datejorep"]), "status": q["etaquelib"] or None,
                      "url": f"{SEN_URL}/questions/base/20{ref[3:5]}/q{ref}.html" if re.match(r"SEQ\d\d", ref) else None,
                      "source_id": "senat-questions-972"})

# --- HATVP: declarations list (all types, metadata) + items of the latest declaration of interests -----------------------
names = {(norm(p["last_name"]), norm(p["first_name"])): p["id"] for p in persons}
declarations = []
for i, h in enumerate(raw("hatvp-liste")):
    pid = names.get((norm(h["nom"]), norm(h["prenom"])))
    if not pid or h["type_mandat"] not in ("depute", "senateur") or h["departement"] != "972":
        continue
    declarations.append({"id": f"{pid}:{h['type_document']}:{h['date_depot'] or h['statut_publication'] or i}:{i}",
                         "person_id": pid, "doc_type": h["type_document"].upper(),
                         "deposited": day(h["date_depot"]), "published": day(h["date_publication"]),
                         "status": h["statut_publication"] or None, "url": h["url_dossier"] or None,
                         "open_data_file": h["open_data"] or None, "source_id": "hatvp-liste"})
by_decl = collections.defaultdict(dict)
for r in raw("hatvp-declarations-972"):
    by_decl[r["declaration"]][r["path"]] = r["value"]
latest = {}
for uuid, f in by_decl.items():
    pid = names.get((norm(f.get("general[0]/declarant[0]/nom[0]")), norm(f.get("general[0]/declarant[0]/prenom[0]"))))
    if not pid:
        errors.append(f"HATVP declaration {uuid}: declarant not a sitting member")
        continue
    d = f.get("dateDepot[0]", "")
    key = (day(d), d[11:])
    if pid not in latest or key > latest[pid][0]:
        latest[pid] = (key, uuid, f)
SECTIONS = ["activProfCinqDerniereDto", "activConsultantDto", "participationDirigeantDto", "participationFinanciereDto",
            "fonctionBenevoleDto", "mandatElectifDto", "observationInteretDto"]
interest_items = []
for pid, (key, uuid, f) in sorted(latest.items()):
    label = f.get("general[0]/typeDeclaration[0]/label[0]")
    items = collections.defaultdict(lambda: {"fields": {}, "amounts": {}})
    for path, value in f.items():
        m = re.match(r"(\w+)\[0\]/items\[0\]/items\[(\d+)\]/(.+)$", path)
        if not m or m.group(1) not in SECTIONS:
            continue
        it, sub = items[(m.group(1), int(m.group(2)))], m.group(3)
        if a := re.match(r"remuneration\[0\]/montant\[0\]/montant\[(\d+)\]/(annee|montant)\[0\]$", sub):
            it["amounts"].setdefault(int(a.group(1)), {})[a.group(2)] = value
        else:
            it["fields"][re.sub(r"\[0\]", "", sub)] = value
    for (section, pos), it in sorted(items.items(), key=lambda kv: (SECTIONS.index(kv[0][0]), kv[0][1])):
        fields = {k: v for k, v in it["fields"].items() if k not in ("motif/id", "conservee")}
        interest_items.append({"id": f"{uuid}:{section}:{pos}", "person_id": pid, "declaration_uuid": uuid,
                               "declaration_label": label, "deposited": key[0], "section": section, "position": pos,
                               "fields": {k: html.unescape(v) for k, v in fields.items()},
                               "amounts": [it["amounts"][k] for k in sorted(it["amounts"])],
                               "source_id": "hatvp-declarations-972"})
for pid in sorted(person_ids - set(latest)):
    print(f"note: no published declaration of interests in open data for {pid}")

# --- checks --------------------------------------------------------------------------------------------------------------
for t, rows in [("memberships", memberships), ("votes", vote_rows), ("amendments", amendments), ("questions", questions),
                ("declarations", declarations), ("interest items", interest_items)]:
    bad = [r for r in rows if r["person_id"] not in person_ids]
    if bad:
        errors.append(f"{t}: {len(bad)} rows for unknown persons")
if errors:
    print("\n".join(f"ERROR {e}" for e in errors))
    sys.exit(1)

# --- write ------------------------------------------------------------------------------------------------------------
OUT.mkdir(parents=True, exist_ok=True)
tables = {
    "sources": sources, "institutions": institutions, "bodies": bodies, "seats": seats, "persons": persons,
    "mandates": mandates, "parl_mandate_details": details,
    "parl_organes": sorted((organes[o] for o in used), key=lambda o: o["id"]),
    "parl_memberships": sorted(memberships, key=lambda m: m["id"]),
    "parl_texts": sorted(texts.values(), key=lambda t: t["id"]),
    "parl_scrutins": sorted(scrutins, key=lambda s: s["number"]),
    "parl_votes": sorted(vote_rows, key=lambda v: (v["scrutin_id"], v["person_id"])),
    "parl_amendments": sorted(amendments, key=lambda a: a["id"]),
    "parl_questions": sorted(questions, key=lambda q: q["id"]),
    "parl_interest_declarations": sorted(declarations, key=lambda d: d["id"]),
    "parl_interest_items": interest_items,
}
for name, rows in tables.items():
    (OUT / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{name:28s} {len(rows):6d}")

by = lambda rows, f: dict(sorted(collections.Counter(f(r) for r in rows).items()))  # noqa: E731
short = {p["id"]: p["last_name"] for p in persons}
print(f"\nrule {votes.RULE}: {counts['selected']} of {len(scrutins)} scrutins selected; parts (overlapping) "
      f"a {counts['a']}, b {counts['b']}, c {counts['c']}, d {counts['d']}")
print("recorded positions on selected scrutins:",
      by([v for v in vote_rows if v["scrutin_id"] in selected], lambda v: short[v["person_id"]]))
print("amendments as first signatory:", by([a for a in amendments if a["role"] == "premier_signataire"], lambda a: short[a["person_id"]]))
print("questions:", by(questions, lambda q: (short[q["person_id"]], q["kind"])))
print("interest items (latest declaration):", by(interest_items, lambda i: short[i["person_id"]]))
