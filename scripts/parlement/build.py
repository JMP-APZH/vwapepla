"""Build normalised tables from data/raw/parlement/ into data/build/parlement/<table>.json (one JSON array per Supabase
table: core rows of the two chambers + parl_* tables).

Terms loaded (cut-off, docs/branches/B2-DISCOVERY.md §1bis; earlier terms: JM, 7 Nov 2026): deputies of Martinique of
the XIVth to XVIIth legislatures (since June 2012), senators of Martinique whose mandate ran on or after the
October 2011 renewal. Activity (votes, amendments, questions, memberships) is kept only inside a mandate of the person.

Deterministic and idempotent: same raw files -> same output. Run: python -I scripts/parlement/build.py
Checks (exit 1 on failure): row counts equal to the manifest; exactly 4 sitting deputies (circonscriptions 1-4) and
2 sitting senators of Martinique, names and sex matching the RNE; one deputy per circonscription at any date of each
legislature; every vote, amendment, question, membership points to a known person / scrutin / organe.
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
LEGS = ["14", "15", "16", "17"]  # AN legislatures loaded (XIVth: June 2012)
CURRENT = "17"
ROMAN = {"14": "XIVe", "15": "XVe", "16": "XVIe", "17": "XVIIe"}
SEN_SINCE = "2011-10-01"  # Sénat: mandates running on or after the 2011 renewal


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


def upper_first(s):
    return s[:1].upper() + s[1:]


def years(start, end):
    return f"{start[:4]}-{end[:4]}" if end else f"depuis {start[:4]}"


# --- sources -------------------------------------------------------------------------------------------------------
sources = [{"id": ds, "title": m["title"], "url": m["url"], "dataset_page": m["dataset_page"],
            "licence": m["licence"], "credit": m["credit"], "retrieved": m["retrieved"], "sha256": m["sha256"],
            "rows": m["rows"], "purpose": m["purpose"], "domain": "parlement"} for ds, m in sorted(MANIFEST.items())]

# --- core rows: the two chambers, one body per AN legislature -------------------------------------------------------------
SEN_BODY = "senat-hemicycle"
an_body = lambda leg: f"assemblee-nationale-{leg}"  # noqa: E731
AN_BODY = an_body(CURRENT)
institutions = [{"id": "assemblee-nationale", "kind": "assemblee_nationale", "name": "Assemblée nationale", "code": None},
                {"id": "senat", "kind": "senat", "name": "Sénat", "code": None}]
bodies = [{"id": an_body(leg), "institution_id": "assemblee-nationale", "kind": "legislature",
           "name": f"{ROMAN[leg]} législature"} for leg in LEGS]
bodies.append({"id": SEN_BODY, "institution_id": "senat", "kind": "assemblee", "name": "Sénat"})
seats = [{"id": f"{an_body(leg)}:depute-972-{n}", "body_id": an_body(leg), "role": "depute", "rank": n,
          "label_fr": f"Député de la {ordinal(n)} circonscription de la Martinique", "constituency": f"972-{n}"}
         for leg in LEGS for n in range(1, 5)]
seats += [{"id": f"{SEN_BODY}:senateur-972-{n}", "body_id": SEN_BODY, "role": "senateur", "rank": n,
           "label_fr": "Sénateur de la Martinique", "constituency": "972"} for n in (1, 2)]
persons, mandates, details = {}, [], []
# person -> list of (chamber, legislature or None, start, end): activity is kept only inside one of them
terms = collections.defaultdict(list)


def in_terms(pid, date, leg=None):
    """True when `date` (and the AN legislature `leg`, if given) falls inside one of the person's loaded mandates."""
    for chamber, l, start, end in terms.get(pid, []):
        if (leg is None or l == leg) and date and start <= date and (not end or date <= end):
            return True
        if leg is not None and l == leg and not date:
            return True
    return False


def in_leg(pid, leg):
    return any(l == leg for _, l, _, _ in terms.get(pid, []))


# --- deputies (AN AMO30; the sitting ones cross-checked with the RNE) ----------------------------------------------------
RNE_LAST, RNE_FIRST, SEN_MEMBER_ID = "Nom de l'élu", "Prénom de l'élu", "Id d'appartenance"
an = raw("an-deputes")
rne_dep = {r["Code de la circonscription législative"]: r for r in raw("rne-deputes")
           if r["Code de la collectivité à statut particulier"] == "972" or r["Code du département"] == "972"}
cand = {(r["Code circonscription"], norm(r["Nom du candidat"]), norm(r["Prénom du candidat"])): r
        for r in raw("legislatives-2024-candidats-t1") if r["Code département"] == "972"}
an_seats = [r for r in an if r["mandat.typeOrgane"] == "ASSEMBLEE" and r["mandat.legislature"] in LEGS
            and r["mandat.election.lieu.numDepartement"] == "972"]
current_an = [r for r in an_seats if r["mandat.legislature"] == CURRENT and not r["mandat.dateFin"]]
circos = sorted(int(r["mandat.election.lieu.numCirco"]) for r in current_an)
if circos != [1, 2, 3, 4]:
    errors.append(f"sitting deputies of Martinique: circonscriptions {circos}, expected [1, 2, 3, 4]")
for leg in LEGS:  # never two deputies on one seat at the same date
    by_circ = collections.defaultdict(list)
    for r in an_seats:
        if r["mandat.legislature"] == leg:
            by_circ[r["mandat.election.lieu.numCirco"]].append((day(r["mandat.dateDebut"]), day(r["mandat.dateFin"]) or "9999"))
    for c, spans in by_circ.items():
        spans.sort()
        if any(b[0] < a[1] for a, b in zip(spans, spans[1:])):
            errors.append(f"legislature {leg}, circonscription 972-{c}: overlapping mandates {spans}")
for r in sorted(an_seats, key=lambda r: (r["mandat.legislature"], r["mandat.election.lieu.numCirco"], r["mandat.dateDebut"])):
    uid, leg, n = r["uid"], r["mandat.legislature"], int(r["mandat.election.lieu.numCirco"])
    pid = f"parl-an:{uid}"
    last, first = r["etatCivil.ident.nom"], r["etatCivil.ident.prenom"]
    sex = "F" if r["etatCivil.ident.civ"].startswith("Mme") else "M"
    persons[pid] = {"id": pid, "last_name": last, "first_name": first, "sex": sex}
    seat = f"{an_body(leg)}:depute-972-{n}"
    start, end = day(r["mandat.dateDebut"]), day(r["mandat.dateFin"])
    terms[pid].append(("AN", leg, start, end))
    mandates.append({"person_id": pid, "seat_id": seat, "start_date": start,
                     "function_start": day(r["mandat.mandature.datePriseFonction"]), "end_date": end,
                     "acquired": "direct_election", "term_id": None, "verified": True, "source_id": "an-deputes",
                     "source_url": f"{AN_URL}/dyn/deputes/{uid}"})
    c = None
    if leg == CURRENT and not end:
        rne = rne_dep.get(f"972{n:02d}")
        if not rne or norm(rne[RNE_LAST]) != norm(last) or norm(rne[RNE_FIRST]) != norm(first) or rne["Code sexe"] != sex:
            found = rne and (rne[RNE_LAST], rne[RNE_FIRST], rne["Code sexe"])
            errors.append(f"{pid}: AN {last} {first} {sex} does not match RNE circ. 972-{n}: {found}")
        c = cand.get((f"972{n:02d}", norm(last), norm(first)))
        if c is None:
            errors.append(f"{pid}: no 2024 candidacy found for {last} in 972-{n}")
    details.append({"id": f"{pid}:{seat}", "person_id": pid, "seat_id": seat, "start_date": start,
                    "election_cause": r["mandat.election.causeMandat"] or None,
                    "end_cause": r["mandat.mandature.causeFin"] or None,
                    "suppleant_last_name": c["Nom remplaçant"] if c else None,
                    "suppleant_first_name": c["Prénom remplaçant"] if c else None,
                    "suppleant_sex": c["Sexe remplaçant"] if c else None,
                    "suppleant_source_id": "legislatives-2024-candidats-t1" if c else None,
                    "official_url": f"{AN_URL}/dyn/deputes/{uid}",
                    "hatvp_url": (r["uri_hatvp"] or None) if leg == CURRENT and not end else None,
                    "source_id": "an-deputes"})
dep_ids = {f"parl-an:{r['uid']}" for r in current_an}
an_persons = {p for p in persons if p.startswith("parl-an:")}

# --- senators (Sénat ODSEN; the sitting ones cross-checked with the RNE) ---------------------------------------------------
gen = {r["Matricule"]: r for r in raw("senat-senateurs")}
rne_sen = {(norm(r[RNE_LAST]), norm(r[RNE_FIRST])): r for r in raw("rne-senateurs")
           if r["Code de la collectivité à statut particulier"] == "972" or r["Code du département"] == "972"}
sen_rows = [r for r in raw("senat-mandats-senat") if (day(r["Date de fin de mandat"]) or "9999") >= SEN_SINCE]
sitting = [m for m, r in gen.items() if r["Circonscription"].strip() == "Martinique" and r["État"] == "ACTIF"]
if len(sitting) != 2:
    errors.append(f"sitting senators of Martinique: {len(sitting)}, expected 2")
sen_start = {}  # current mandate start of the sitting senators
by_renewal = collections.defaultdict(list)
for r in sen_rows:
    by_renewal[day(r["Date de début de mandat"])].append(r)
for start, group in sorted(by_renewal.items()):
    for rank, r in enumerate(sorted(group, key=lambda r: gen[r["Matricule"]]["Nom usuel"]), 1):
        mat, pid = r["Matricule"], f"parl-sen:{r['Matricule']}"
        g = gen[mat]
        last, first, sex = g["Nom usuel"], g["Prénom usuel"], "F" if g["Qualité"].startswith("Mme") else "M"
        end = day(r["Date de fin de mandat"])
        persons[pid] = {"id": pid, "last_name": last, "first_name": first, "sex": sex}
        terms[pid].append(("SEN", None, start, end))
        seat = f"{SEN_BODY}:senateur-972-{rank}"
        url = f"{SEN_URL}/senateur/{slug(last).replace('-', '_')}_{slug(first).replace('-', '_')}{mat.lower()}.html"
        if not end:
            sen_start[pid] = start
            rne = rne_sen.get((norm(last), norm(first)))
            if not rne or rne["Code sexe"] != sex:
                errors.append(f"{pid}: {last} {first} {sex} not found in RNE sénateurs (972)")
        mandates.append({"person_id": pid, "seat_id": seat, "start_date": start, "function_start": None,
                         "end_date": end, "acquired": "indirect_election", "term_id": None, "verified": True,
                         "source_id": "senat-mandats-senat", "source_url": url})
        details.append({"id": f"{pid}:{seat}" if not end else f"{pid}:{seat}:{start}", "person_id": pid,
                        "seat_id": seat, "start_date": start,
                        "election_cause": (r["Motif début de mandat"] or "").strip() or None,
                        "end_cause": (r["Motif fin de mandat"] or "").strip() or None if end else None,
                        "suppleant_last_name": None, "suppleant_first_name": None, "suppleant_sex": None,
                        "suppleant_source_id": None, "official_url": url, "hatvp_url": None,
                        "source_id": "senat-mandats-senat"})
if sorted(sen_start) != sorted(f"parl-sen:{m}" for m in sitting):
    errors.append(f"sitting senators {sorted(sitting)} vs current mandates {sorted(sen_start)}")
sen_ids = set(sen_start)
sen_persons = {p for p in persons if p.startswith("parl-sen:")}
current_ids = dep_ids | sen_ids
person_ids = set(persons)

# --- organes and memberships ------------------------------------------------------------------------------------------
organes, memberships = {}, []
for o in raw("an-organes"):
    organes[o["uid"]] = {"id": o["uid"], "chamber": "AN", "kind": o["codeType"], "label_fr": o["libelle"],
                         "short": o["libelleAbrege"] or None, "start_date": day(o["viMoDe.dateDebut"]),
                         "end_date": day(o["viMoDe.dateFin"]), "source_id": "an-organes"}
for r in an:
    pid = f"parl-an:{r['uid']}"
    leg = r["mandat.legislature"]
    if pid not in an_persons or not in_leg(pid, leg) or r["mandat.typeOrgane"] == "ASSEMBLEE":
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


def overlaps(pid, start, end):
    """A membership (start, end) overlapping one of the senator's loaded mandates."""
    return any((not e or (start or "") <= e) and (not end or end >= s) for _, _, s, e in terms.get(pid, []))


for r in raw("senat-histogroupes"):
    pid = f"parl-sen:{r['Matricule']}"
    start = day(r["Date de début de la fonction"] or r["Date de début d'appartenance"])
    end = day(r["Date de fin de la fonction"] or r["Date de fin d'appartenance"])
    if pid in sen_persons and overlaps(pid, start, end):
        oid = f"sen-grp:{r['Code du groupe politique']}"
        sen_organe(oid, "GP", r["Nom court du groupe politique"], "senat-histogroupes")
        memberships.append({"id": f"{pid}:grp:{r['Id appartenance']}:{r['Id fonction occupée']}", "person_id": pid,
                            "organe_id": oid, "function": r["Nom court fonction"] or None, "start_date": start,
                            "end_date": end, "source_id": "senat-histogroupes"})
for ds, name_col, kind in [("senat-commissions", "Nom commission", "COM"), ("senat-delegations", "Nom organisme", "DELEG")]:
    for r in raw(ds):
        pid = f"parl-sen:{r['Matricule']}"
        if pid not in sen_persons or r[name_col].strip() in ("", "Aucune"):
            continue
        start = day(r["Début de fonction"] or r["Début d'appartenance"])
        end = day(r["Fin de fonction"] or r["Fin d'appartenance"])
        if not overlaps(pid, start, end):
            continue
        oid = f"sen-{kind.lower()}:{slug(r[name_col])}"
        sen_organe(oid, kind, r[name_col].strip(), ds)
        memberships.append({"id": f"{pid}:{kind.lower()}:{r[SEN_MEMBER_ID]}:{r['Id de fonction']}",
                            "person_id": pid, "organe_id": oid, "function": r["Fonction"].strip() or "Membre",
                            "start_date": start, "end_date": end, "source_id": ds})
for r in raw("senat-organismes"):
    pid = f"parl-sen:{r['Matricule']}"
    if pid in sen_persons and overlaps(pid, day(r["Début"]), day(r["Fin"])):
        oid = f"sen-oep:{r['Code organisme']}"
        sen_organe(oid, "ORGEXTPARL", f"{r['Organisme'].strip()}", "senat-organismes")
        memberships.append({"id": f"{pid}:oep:{r['Identifiant appartenance']}", "person_id": pid, "organe_id": oid,
                            "function": r["Titulaire"].strip().capitalize() or None, "start_date": day(r["Début"]),
                            "end_date": day(r["Fin"]), "source_id": "senat-organismes"})
used = {m["organe_id"] for m in memberships}

# --- texts, scrutins, votes (AN, per legislature) -------------------------------------------------------------------------
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


texts, scrutins, vote_rows = {}, [], []
counts = {leg: collections.Counter() for leg in LEGS}
an_stats = {leg: collections.Counter() for leg in LEGS}
selected = set()
for leg in LEGS:
    sfx = f"-{leg}"
    dossiers = {d["uid"]: d for d in raw(f"an-dossiers{sfx}")}
    for s in raw(f"an-scrutins{sfx}-liste"):
        dref = s["objet.dossierLegislatif.dossierRef"] or None
        d = dossiers.get(dref) if dref else None
        if dref and not d:
            errors.append(f"scrutin {s['uid']}: dossier {dref} not in an-dossiers{sfx}")
        if d and dref not in texts:
            texts[dref] = {"id": dref, "chamber": "AN", "title": d["titreDossier.titre"],
                           "procedure": d["procedureParlementaire.libelle"] or None,
                           "url": f"{AN_URL}/dyn/{d['legislature'] or leg}/dossiers/{d['titreDossier.titreChemin'] or dref}",
                           "source_id": f"an-dossiers{sfx}"}
        parts = votes.select(s, d)
        for p in parts:
            counts[leg][p] += 1
        counts[leg]["selected"] += bool(parts)
        an_stats[leg]["scrutins"] += 1
        an_stats[leg]["no_dossier"] += not d
        if parts:
            selected.add(s["uid"])
        scrutins.append({"id": s["uid"], "chamber": "AN", "legislature": leg, "number": int(s["numero"]),
                         "date": day(s["dateScrutin"]), "type_code": s["typeVote.codeTypeVote"],
                         "type_label": s["typeVote.libelleTypeVote"], "title": s["titre"],
                         "object": s["objet.libelle"] or None, "text_id": dref if d else None,
                         "result_code": s["sort.code"], "result_label": s["sort.libelle"],
                         "voters": int(s["syntheseVote.nombreVotants"] or 0),
                         "pour": int(s["syntheseVote.decompte.pour"] or 0),
                         "contre": int(s["syntheseVote.decompte.contre"] or 0),
                         "abstentions": int(s["syntheseVote.decompte.abstentions"] or 0),
                         "non_votants": int(s["syntheseVote.decompte.nonVotants"] or 0),
                         "text_signet": None, "selected_by": [f"{votes.RULE}:{p}" for p in parts],
                         "url": f"{AN_URL}/dyn/{leg}/scrutins/{s['numero']}", "source_id": f"an-scrutins{sfx}-liste"})
    known = {s["id"] for s in scrutins if s["legislature"] == leg}
    for v in raw(f"an-scrutins{sfx}"):
        pid = f"parl-an:{v['acteurRef']}"
        if pid not in an_persons or not in_leg(pid, leg):
            continue  # deputies of Martinique outside the loaded terms
        if v["uid"] not in known:
            errors.append(f"vote {v['uid']} {pid}: unknown scrutin")
            continue
        an_stats[leg]["votes"] += 1
        an_stats[leg]["delegation_published"] += v["parDelegation"] in ("true", "false")
        vote_rows.append({"scrutin_id": v["uid"], "person_id": pid, "position": v["position"],
                          "by_delegation": v["parDelegation"] == "true", "group_id": v["groupe_organeRef"] or None,
                          "group_position": v["groupe_positionMajoritaire"] or None,
                          "cause": v["causePositionVote"] or None,
                          "mise_au_point": own_correction(v["miseAuPoint"], v["acteurRef"]),
                          "source_id": f"an-scrutins{sfx}"})
for v in vote_rows:
    if v["group_id"] and v["group_id"] not in organes:
        errors.append(f"vote {v['scrutin_id']}: group {v['group_id']} not in an-organes")
    elif v["group_id"]:
        used.add(v["group_id"])

# --- scrutins, votes (Sénat, Dosleg) -------------------------------------------------------------------------------------
# Every public vote in Dosleg (since the 2006-2007 session); positions of the senators during their loaded mandates.
# Result: the Sénat adopts when « pour » exceeds « contre » (absolute majority of the votes cast), as on senat.fr.
SEN_POS = {"1": "pour", "2": "contre", "3": "abstention", "4": "nonVotant"}
sen_counts = collections.Counter()
sen_scr = {}
for s in raw("senat-scrutins"):
    sid = f"sen:{s['sesann']}-{s['scrnum']}"
    parts = votes.select_senat(s)
    pour, contre = int(s["scrpou"] or 0), int(s["scrcon"] or 0)
    voters, cast = int(s["scrvot"] or 0), int(s["scrsuf"] or 0)
    title = re.sub(r"^sur\s+", "", (s["scrint"] or "").strip())
    sen_scr[sid] = {"id": sid, "chamber": "SEN", "legislature": s["sesann"], "number": int(s["scrnum"]),
                    "date": day(s["scrdat"]), "type_code": "SPO", "type_label": "scrutin public",
                    "title": upper_first(title), "object": None, "text_id": None,
                    "result_code": "adopté" if pour > contre else "rejeté",
                    "result_label": "adopté" if pour > contre else "rejeté",
                    "voters": voters or None, "pour": pour, "contre": contre,
                    "abstentions": voters - cast if voters else None, "non_votants": None,
                    "text_signet": s["loi.signet"] or None, "selected_by": [f"{votes.RULE}:{p}" for p in parts],
                    "url": f"{SEN_URL}/scrutin-public/{s['sesann']}/scr{s['sesann']}-{s['scrnum']}.html",
                    "source_id": "senat-scrutins"}
first_sen_start = min(sen_start.values())
for sid, s in sen_scr.items():
    if s["date"] >= first_sen_start:
        sen_counts["term"] += 1
        sen_counts["selected"] += bool(s["selected_by"])
        for p in s["selected_by"]:
            sen_counts[p.split(":")[1]] += 1
    if s["selected_by"]:
        selected.add(sid)
scrutins += sen_scr.values()
sen_missing = collections.defaultdict(set)


def session_in_terms(pid, sesann):
    """Sessions run from 1 October: session `sesann` (e.g. 2024 = Oct 2024-Sep 2025) overlaps a loaded mandate."""
    s, e = f"{sesann}-10-01", f"{int(sesann) + 1}-09-30"
    return any(start <= e and (not end or end >= s) for _, _, start, end in terms.get(pid, []))


for v in raw("senat-votes-972"):
    pid, sid = f"parl-sen:{v['matricule']}", f"sen:{v['sesann']}-{v['scrnum']}"
    if pid not in sen_persons:
        continue  # senators of Martinique outside the loaded mandates
    if sid not in sen_scr:
        # Published position, but the scrutin itself is missing from Dosleg's scr table (it exists on senat.fr):
        # stated as a data gap.
        if session_in_terms(pid, v["sesann"]):
            sen_missing[sid].add(pid)
        continue
    if not in_terms(pid, sen_scr[sid]["date"]):
        continue
    status = v["stavot.lib"] if v["stavotidt"] not in ("0", "") else None
    vote_rows.append({"scrutin_id": sid, "person_id": pid, "position": SEN_POS[v["posvotcod"]],
                      "by_delegation": bool(v["senmatdel"]), "group_id": None, "group_position": None,
                      "cause": status, "mise_au_point": None, "source_id": "senat-votes-972"})

# --- amendments ----------------------------------------------------------------------------------------------------
amendments = []
for leg in LEGS:
    ds = f"an-amendements-{leg}"
    for a in raw(ds):
        author = f"parl-an:{a['signataires.auteur.acteurRef']}"
        rapporteur = a["signataires.auteur.typeAuteur"] == "Rapporteur"
        who = [(author, "premier_signataire")] if author in an_persons and in_leg(author, leg) else []
        co = set((a["cosignataires"] or "").split(","))
        who += [(f"parl-an:{x}", "cosignataire") for x in (a["martinique_acteurRefs"] or "").split(",")
                if x in co and f"parl-an:{x}" in an_persons and in_leg(f"parl-an:{x}", leg)]
        num = re.search(r"(\d+)$", a["texteLegislatifRef"] or "")
        doc = a.get("documentURI") or ""
        url = (f"{AN_URL}/dyn/{leg}/amendements/{a['uid']}" if leg != "14"
               else f"{AN_URL}{doc[:-4]}.asp" if doc.endswith(".pdf") else None)
        for pid, role in who:
            amendments.append({"id": f"{a['uid']}:{pid}", "amendment_id": a["uid"], "chamber": "AN", "legislature": leg,
                               "person_id": pid, "role": role, "as_rapporteur": rapporteur,
                               "signatories": 1 + len(co - {""}), "number": a["identification.numeroLong"],
                               "text_ref": a["texteLegislatifRef"] or None,
                               "text_number": num.group(1) if num else None, "text_title": None, "text_id": None,
                               "article": a["pointeurFragmentTexte.division.articleDesignation"] or None,
                               "filed": day(a["cycleDeVie.dateDepot"]), "outcome": a["cycleDeVie.sort"] or None,
                               "state": a["cycleDeVie.etatDesTraitements.etat.libelle"] or None,
                               "url": url, "source_id": ds})
for a in raw("senat-amendements-972"):
    pid = f"parl-sen:{a['matricule']}"
    if pid not in sen_persons or not in_terms(pid, day(a["amd.datdep"])):
        continue
    ann, num, txt = int(a["ses.ann"]), a["amd.num"], re.match(r"\d+", a["txt.num"] or "")
    com = num.startswith("COM-")
    url = (f"{SEN_URL}/amendements/{'commissions/' if com else ''}{ann}-{ann + 1}/{txt.group(0)}/Amdt_{num}.html"
           if txt else None)
    amendments.append({"id": f"sen:{a['amd.id']}:{pid}", "amendment_id": f"sen:{a['amd.id']}", "chamber": "SEN",
                       "legislature": str(ann), "person_id": pid,
                       "role": "premier_signataire" if a["amdsen.rng"] == "0" else "cosignataire",
                       "as_rapporteur": False, "signatories": int(a["signataires"]), "number": num,
                       "text_ref": a["txt.doslegsignet"] or None, "text_number": a["txt.num"] or None,
                       "text_title": a["txt.inl"] or a["txt.int"] or None, "text_id": None, "article": None,
                       "filed": day(a["amd.datdep"]), "outcome": a["sor.lib"] or None,
                       "state": "commission" if com else "séance", "url": url, "source_id": "senat-amendements-972"})

# --- questions -------------------------------------------------------------------------------------------------------
questions = []
for leg in LEGS:
    for kind in ("ecrites", "orales", "gouvernement"):
        ds = f"an-questions-{kind}-{leg}"
        for q in raw(ds):
            pid = f"parl-an:{q['auteur.identite.acteurRef']}"
            if pid not in an_persons or not in_leg(pid, leg):
                continue
            questions.append({"id": q["uid"], "chamber": "AN", "legislature": leg, "person_id": pid, "kind": q["type"],
                              "number": q["identifiant.numero"], "title": q["indexationAN.analyses.analyse"] or None,
                              "rubrique": q["indexationAN.rubrique"] or None,
                              "ministry": q["minAttribs.minAttrib.denomination.abrege"] or q["minInt.abrege"] or None,
                              "asked": day(q["textesQuestion.texteQuestion.infoJO.dateJO"]),
                              "answered": day(q["textesReponse.texteReponse.infoJO.dateJO"]),
                              "status": q["cloture.libelleCloture"] or None,
                              "url": f"{AN_URL}/dyn/{leg}/questions/{q['uid']}", "source_id": ds})
for q in raw("senat-questions-972"):
    pid = f"parl-sen:{q['matricule']}"
    if pid not in sen_persons or not in_terms(pid, day(q["datejodepot"])):
        continue
    ref = q["reference"]
    questions.append({"id": f"sen:{q['id']}", "chamber": "SEN", "legislature": q["legislature"] or "", "person_id": pid,
                      "kind": q["natquecod"], "number": q["numero"], "title": q["titre"] or None,
                      "rubrique": q["rubrique"] or None, "ministry": q["mindepotlib"] or None,
                      "asked": day(q["datejodepot"]), "answered": day(q["reponse.datejorep"]),
                      "status": q["etaquelib"] or None,
                      "url": f"{SEN_URL}/questions/base/20{ref[3:5]}/q{ref}.html" if re.match(r"SEQ\d\d", ref) else None,
                      "source_id": "senat-questions-972"})

# --- HATVP: declarations list (all types, metadata) + items of the latest declaration of interests -----------------------
# Outside activities only for the sitting members (their current declaration); former members: list and links only.
names = {(norm(p["last_name"]), norm(p["first_name"])): p["id"] for p in persons.values()}
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
    if pid not in current_ids:
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

# --- data gaps: what the official open data does not give, measured on the files and dated (shown, never hidden) -------
gaps = []


def gap(gid, chamber, period, topic, status, label, detail, source, url=None, person=None):
    gaps.append({"id": gid, "chamber": chamber, "person_id": person, "period": period, "topic": topic, "status": status,
                 "label_fr": label, "detail_fr": detail, "checked_url": url or MANIFEST[source]["dataset_page"],
                 "checked_on": MANIFEST[source]["retrieved"], "source_id": source})


fmt = lambda n: f"{n:,}".replace(",", " ")  # noqa: E731  French thousands separator
pct = lambda n, d: f"{round(100 * n / d)} %"  # noqa: E731
LEG_YEARS = {"14": "2012-2017", "15": "2017-2022", "16": "2022-2024", "17": "depuis 2024"}
gap("an-votes-main-levee", "AN", "toutes législatures", "votes", "absent", "Votes à main levée",
    "La plupart des votes en séance se font à main levée ou par assis-levé : ils ne sont pas nominatifs et ne figurent "
    "dans aucune donnée. Seuls les scrutins publics donnent la position de chaque député "
    f"({', '.join(f'{ROMAN[l]} : {fmt(an_stats[l]["scrutins"])}' for l in LEGS)}). "
    "« Pas de vote enregistré » ne veut donc pas dire absent.", "an-scrutins-17-liste")
for leg in LEGS:
    st = an_stats[leg]
    period = f"{ROMAN[leg]} législature ({LEG_YEARS[leg]})"
    if st["no_dossier"]:
        whole = st["no_dossier"] == st["scrutins"]
        gap(f"an-{leg}-votes-dossier", "AN", period, "votes", "absent" if whole else "partiel",
            "Scrutins sans dossier législatif",
            (f"Aucun des {fmt(st['scrutins'])} scrutins publics de la {ROMAN[leg]} législature n'est rattaché à son dossier "
             "législatif dans les données de l'Assemblée" if whole else
             f"{fmt(st['no_dossier'])} scrutins publics sur {fmt(st['scrutins'])} ({pct(st['no_dossier'], st['scrutins'])}) "
             "ne sont rattachés à aucun dossier législatif dans les données de l'Assemblée")
            + " : pour eux, la règle de sélection V1 ne lit que l'objet du scrutin.", f"an-scrutins-{leg}-liste")
    if st["votes"] and not st["delegation_published"]:
        gap(f"an-{leg}-votes-delegation", "AN", period, "votes", "absent", "Votes par délégation non signalés",
            f"Les données de la {ROMAN[leg]} législature ne disent pas si un vote a été émis par délégation "
            "(un député votant pour un collègue) : ce n'est donc jamais indiqué pour cette période.", f"an-scrutins-{leg}")
    own = [a for a in amendments if a["chamber"] == "AN" and a["legislature"] == leg and a["role"] == "premier_signataire"]
    no_outcome = sum(1 for a in own if not a["outcome"])
    if leg != CURRENT and own and no_outcome:
        gap(f"an-{leg}-amendements-issue", "AN", period, "amendements", "partiel", "Issue des amendements non publiée",
            f"{fmt(no_outcome)} des {fmt(len(own))} amendements déposés comme premier signataire par les députés de "
            f"Martinique pendant la {ROMAN[leg]} législature n'ont pas d'issue (adopté, rejeté, retiré, tombé…) dans les "
            "données publiées, alors que la législature est close.", f"an-amendements-{leg}")
# Committee attendance: coverage of the published lists (never anyone's attendance).
retrieved = MANIFEST["an-reunions-17"]["retrieved"]
meetings = [m for m in raw("an-reunions-17") if m["cycleDeVie.etat"].startswith("Confirm") and day(m["timeStampDebut"]) <= retrieved]
listed = sum(1 for m in meetings if int(m["participantsInternes.count"]) > 0)
gap("an-17-presence-commission", "AN", "XVIIe législature", "presence", "partiel", "Présence en commission",
    f"L'Assemblée publie une liste de présence pour {fmt(listed)} réunions de commission sur {fmt(len(meetings))} tenues "
    f"depuis juillet 2024 ({pct(listed, len(meetings))}), selon les commissions. Vwapepla n'affiche pas ces présences : "
    "un décompte se lirait comme un taux de présence, et le travail en commission ne se résume pas à être présent.",
    "an-reunions-17")
presence_coverage = {}
for pid in sorted(dep_ids):
    own = [m for m in memberships if m["person_id"] == pid and organes[m["organe_id"]]["kind"] in ("COMPER", "CNPE", "DELEG")]
    mine = [x for x in meetings if any(x["organeReuniRef"] == m["organe_id"] and (m["start_date"] or "") <= day(x["timeStampDebut"])
                                       and (not m["end_date"] or day(x["timeStampDebut"]) <= m["end_date"]) for m in own)]
    if mine:  # printed for the team (decision point), not stored: attendance itself is not shown (JM, 7 Nov 2026)
        presence_coverage[pid] = (sum(1 for x in mine if int(x["participantsInternes.count"]) > 0), len(mine))
gap("an-presence-anterieure", "AN", "XIVe à XVIe législatures (2012-2024)", "presence", "absent",
    "Présence en commission (législatures précédentes)",
    "Les agendas des législatures précédentes ne sont pas chargés : rien n'est affiché sur la présence en commission "
    "avant 2024, comme pour la législature en cours.", "an-reunions-17",
    url="https://data.assemblee-nationale.fr/archives-anterieures/archives-15e/agendas")
sen_period = f"depuis octobre {SEN_SINCE[:4]}"
gap("sen-votes-groupe", "SEN", sen_period, "votes", "partiel", "Votes de groupe au Sénat",
    "Au Sénat, lors d'un scrutin public ordinaire, un délégué de chaque groupe peut déposer les bulletins de tous ses "
    "membres : une position publiée ne dit pas si le sénateur était présent dans l'hémicycle. Seules les positions sont "
    "publiées, pas la présence.", "senat-votes-972")
gap("sen-votes-solennel", "SEN", "depuis 2006", "votes", "partiel", "Scrutins solennels non signalés",
    "La base Dosleg du Sénat ne signale pas les scrutins publics solennels ni le nombre de sénateurs n'ayant pas pris "
    "part au vote : la règle V1 (a) ne s'applique pas au Sénat. Les nombres de votants, pour, contre sont ceux publiés ; "
    "les abstentions sont les votants moins les suffrages exprimés.", "senat-scrutins")
if sen_missing:
    nums = ", ".join(f"n° {k.split('-')[1]} ({k[4:8]}-{int(k[4:8]) + 1})"
                     for k in sorted(sen_missing, key=lambda k: (k[4:8], int(k.split("-")[1]))))
    gap("sen-scrutins-manquants", "SEN", sen_period, "votes", "partiel", "Scrutins absents des données ouvertes",
        f"{len(sen_missing)} scrutins publics ont des positions nominatives de sénateurs de Martinique dans la base Dosleg "
        f"du Sénat, mais ni date ni objet : ils ne sont pas affichés ici et restent consultables sur senat.fr ({nums}).",
        "senat-scrutins")
gap("sen-presence-commission", "SEN", sen_period, "presence", "absent", "Présence en commission",
    "Les données ouvertes du Sénat (data.senat.fr) ne contiennent aucune liste de présence aux réunions de commission.",
    "senat-commissions")
gap("an-avant-2012", "AN", "avant juin 2012", "mandats", "absent", "Législatures avant 2012 non chargées",
    "Vwapepla commence à la XIVe législature (juin 2012). Les données plus anciennes de l'Assemblée sont moins complètes "
    "et ne sont pas chargées : les mandats antérieurs des députés n'apparaissent pas ici.", "an-deputes",
    url="https://data.assemblee-nationale.fr/archives-anterieures")
gap("sen-avant-2011", "SEN", "avant octobre 2011", "mandats", "absent", "Mandats avant 2011 non chargés",
    "Vwapepla commence aux mandats sénatoriaux en cours au renouvellement d'octobre 2011 : les mandats plus anciens "
    "n'apparaissent pas ici.", "senat-mandats-senat")
gap("hatvp-anciens", "AN", "mandats terminés", "declarations", "partiel", "Activités déclarées des anciens parlementaires",
    "Pour les anciens députés, seules la liste et les dates des déclarations HATVP sont affichées, avec le lien vers "
    "hatvp.fr : leurs activités déclarées ne sont pas reprises.", "hatvp-liste")
gap("hatvp-anciens-sen", "SEN", "mandats terminés", "declarations", "partiel", "Activités déclarées des anciens parlementaires",
    "Pour les anciens sénateurs, seules la liste et les dates des déclarations HATVP sont affichées, avec le lien vers "
    "hatvp.fr : leurs activités déclarées ne sont pas reprises.", "hatvp-liste")
for pid in sorted(current_ids - set(latest)):
    gap(f"hatvp-declaration-interets:{pid}", "AN" if pid in dep_ids else "SEN", "mandat en cours", "declarations", "absent",
        "Déclaration d'intérêts", "Aucune déclaration d'intérêts de ce mandat dans les données ouvertes de la HATVP à la date "
        "de récupération : les activités déclarées ne peuvent pas être affichées. Voir hatvp.fr.",
        "hatvp-declarations-972", person=pid)

# --- checks --------------------------------------------------------------------------------------------------------------
for t, rows in [("memberships", memberships), ("votes", vote_rows), ("amendments", amendments), ("questions", questions),
                ("declarations", declarations), ("interest items", interest_items), ("details", details)]:
    bad = [r for r in rows if r["person_id"] not in person_ids]
    if bad:
        errors.append(f"{t}: {len(bad)} rows for unknown persons")
if errors:
    print("\n".join(f"ERROR {e}" for e in errors))
    sys.exit(1)

# --- write ------------------------------------------------------------------------------------------------------------
OUT.mkdir(parents=True, exist_ok=True)
tables = {
    "sources": sources, "institutions": institutions, "bodies": bodies, "seats": seats,
    "persons": sorted(persons.values(), key=lambda p: p["id"]),
    "mandates": sorted(mandates, key=lambda m: (m["seat_id"], m["start_date"])),
    "parl_mandate_details": sorted(details, key=lambda d: d["id"]),
    "parl_organes": sorted((organes[o] for o in used), key=lambda o: o["id"]),
    "parl_memberships": sorted(memberships, key=lambda m: m["id"]),
    "parl_texts": sorted(texts.values(), key=lambda t: t["id"]),
    "parl_scrutins": sorted(scrutins, key=lambda s: (s["chamber"], s["legislature"], s["number"])),
    "parl_votes": sorted(vote_rows, key=lambda v: (v["scrutin_id"], v["person_id"])),
    "parl_amendments": sorted(amendments, key=lambda a: a["id"]),
    "parl_questions": sorted(questions, key=lambda q: q["id"]),
    "parl_interest_declarations": sorted(declarations, key=lambda d: d["id"]),
    "parl_interest_items": interest_items,
    "parl_data_gaps": sorted(gaps, key=lambda g: g["id"]),
}
for name, rows in tables.items():
    (OUT / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{name:28s} {len(rows):6d}")

by = lambda rows, f: dict(sorted(collections.Counter(f(r) for r in rows).items()))  # noqa: E731
short = {p["id"]: p["last_name"] for p in persons.values()}
for leg in LEGS:
    c = counts[leg]
    print(f"\nrule {votes.RULE}, {ROMAN[leg]}: {c['selected']} of {an_stats[leg]['scrutins']} AN scrutins selected; "
          f"a {c['a']}, b {c['b']}, c {c['c']}, d {c['d']}")
print(f"rule {votes.RULE} (Sénat, since {first_sen_start}): {sen_counts['selected']} of {sen_counts['term']} scrutins "
      f"selected; b {sen_counts['b']}, c {sen_counts['c']}")
term_of = lambda v: next((l for l in LEGS if v["scrutin_id"].startswith(f"VTANR5L{l}")), "SEN")  # noqa: E731
print("recorded positions on selected scrutins:",
      by([v for v in vote_rows if v["scrutin_id"] in selected], lambda v: (short[v["person_id"]], term_of(v))))
print("data gaps:", len(gaps))
print("committee meetings with a published attendance list, own committees/delegations (not stored):",
      {short[p]: f"{n}/{m}" for p, (n, m) in presence_coverage.items()})
print("amendments as first signatory:", by([a for a in amendments if a["role"] == "premier_signataire"],
                                           lambda a: (short[a["person_id"]], a["legislature"] if a["chamber"] == "AN" else "SEN")))
print("questions:", by(questions, lambda q: (short[q["person_id"]], q["legislature"] if q["chamber"] == "AN" else "SEN")))
print("interest items (latest declaration):", by(interest_items, lambda i: short[i["person_id"]]))
