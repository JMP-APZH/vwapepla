"""Open-data sources of the parlement domain (B2), downloaded by scripts/core/download_sources.py --domain parlement.

JOBS: one dict per dataset (fields: scripts/core/fetching.py). Files land in data/raw/parlement/<folder>/ and are listed
in data/raw/parlement/manifest.json. Official sources only (all Licence Ouverte 2.0, the licence the engine records).

National files too big to keep whole (AN JSON zips, Sénat CSVs) are streamed to a temp dir and filtered here on
Martinique's members; the fetcher writes a ';' UTF-8 CSV so the engine can count rows and hash it. Columns are the
source's own field names (dotted path for nested JSON); `record` keeps the raw JSON of the kept item when useful.
"""
import csv, functools, http.client, io, json, pathlib, re, shutil, subprocess, tempfile, time, urllib.request, zipfile

from fetching import fetch, file_job  # scripts/core (put on sys.path by download_sources.py)

AN = "https://data.assemblee-nationale.fr/static/openData/repository/17"
SEN = "https://data.senat.fr/data"
DEP_972 = "972"  # AN: election.lieu.numDepartement · Sénat: circonscription "Martinique"

_cache = {}  # url -> local zip path, so jobs of one run share a download (AMO30 is used by three jobs)
_tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)


def _get(url):
    if url not in _cache:
        p = pathlib.Path(_tmp.name) / f"{len(_cache)}{pathlib.Path(url).suffix}"
        _fetch_complete(url, p)
        _cache[url] = p
    return _cache[url]


def _fetch_complete(url, dest, stalls=3, tries=10):
    """Download checked against Content-Length, resuming with Range requests. data.assemblee-nationale.fr and hatvp.fr
    drop long transfers (hatvp.fr: every ~100 kB), and scripts/core/fetching.fetch() then keeps a truncated file
    without error. Keeps resuming while bytes arrive (at most `tries` requests, `stalls` in a row without progress),
    then falls back to the system curl."""
    part, size, stalled = dest.with_suffix(".part"), None, 0
    part.unlink(missing_ok=True)
    for _ in range(tries):
        if stalled >= stalls:
            break
        have = part.stat().st_size if part.exists() else 0
        req = urllib.request.Request(url, headers={"Range": f"bytes={have}-"} if have else {})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                if have and r.status != 206:  # server ignored Range: start again
                    have = 0
                total = r.headers.get("Content-Range", "").rpartition("/")[2] or r.headers.get("Content-Length")
                if not have:
                    size = int(total) if total and total.isdigit() else None
                with open(part, "ab" if have else "wb") as f:
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
        except (OSError, http.client.HTTPException) as e:
            print(f"     interrupted ({e}), resuming")
        now = part.stat().st_size if part.exists() else 0
        if part.exists() and (size is None or now == size):
            part.replace(dest)  # complete (or no length announced: accept what the server sent)
            return
        stalled = stalled + 1 if now <= have else 0
        time.sleep(2 ** stalled)
    # hatvp.fr ends up refusing Python's client while serving curl normally: same URL, fetched by the system curl.
    if (curl := shutil.which("curl")) and size is not None:
        print("     falling back to curl")
        subprocess.run([curl, "-sSfL", "--retry", "5", "-o", str(part), url], check=True)
        if part.stat().st_size == size:
            part.replace(dest)
            return
    raise SystemExit(f"{url}: incomplete ({now} of {size} bytes)")


def _whole(folder, ds, url, *rest):
    """file_job() whose download is length-checked."""
    return {**file_job(folder, ds, url, *rest), "fetcher": lambda dest: _fetch_complete(url, dest)}


def _json_items(url):
    """Yield every JSON document of a zip (one file per acteur / scrutin / amendement...)."""
    with zipfile.ZipFile(_get(url)) as zf:
        for name in zf.namelist():
            if name.endswith(".json"):
                with zf.open(name) as f:
                    yield name, json.load(f)


def _as_list(x):
    return [] if x is None else x if isinstance(x, list) else [x]


def _text(x):
    """AN JSON wraps some scalars as {'#text': ...} and nulls as {'@xsi:nil': 'true'}."""
    if isinstance(x, list):
        return ",".join(str(_text(v)) for v in x)
    if isinstance(x, dict):
        return x.get("#text") if "#text" in x else None if "@xsi:nil" in x else json.dumps(x, ensure_ascii=False)
    return x


def _dig(d, path):
    for k in path.split("."):
        if not isinstance(d, dict):
            return None
        d = d.get(k)
    return _text(d)


def _write(dest, header, rows):
    tmp = dest.with_suffix(".part")
    with open(tmp, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(header)
        n = 0
        for r in rows:
            w.writerow(r)
            n += 1
    tmp.replace(dest)
    print(f"     {n} rows kept")


# ------------------------------------------------------------------ Assemblée nationale (17e législature)
AMO30 = f"{AN}/amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip"


@functools.cache
def _an_martinique_actors():
    """Acteurs with an ASSEMBLEE mandate elected in Martinique, any legislature since the XIth (1997), current or former."""
    out = {}
    for name, doc in _json_items(AMO30):
        a = doc.get("acteur")
        if not a:
            continue
        for m in _as_list(_dig_raw(a, "mandats.mandat")):
            if m.get("typeOrgane") == "ASSEMBLEE" and _dig(m, "election.lieu.numDepartement") == DEP_972:
                out[_text(a["uid"])] = a
    return out


def _dig_raw(d, path):
    for k in path.split("."):
        d = d.get(k) if isinstance(d, dict) else None
    return d


DEPUTE_COLS = ["uid", "etatCivil.ident.civ", "etatCivil.ident.prenom", "etatCivil.ident.nom", "uri_hatvp"]  # no birth, address
MANDAT_COLS = ["uid", "typeOrgane", "legislature", "dateDebut", "datePublication", "dateFin", "infosQualite.codeQualite",
               "infosQualite.libQualite", "organes.organeRef", "election.lieu.region", "election.lieu.departement",
               "election.lieu.numDepartement", "election.lieu.numCirco", "election.causeMandat", "election.refCirconscription",
               "mandature.datePriseFonction", "mandature.causeFin", "mandature.placeHemicycle", "suppleants.suppleant.suppleantRef"]


def fetch_an_deputes(dest):
    """One row per mandate (Assemblée, groupe, commission, délégation...) of each Martinique deputy since 1997."""
    def rows():
        for uid, a in sorted(_an_martinique_actors().items()):
            for m in _as_list(_dig_raw(a, "mandats.mandat")):
                yield [_dig(a, c) if c != "uid" else uid for c in DEPUTE_COLS] + [_dig(m, c) for c in MANDAT_COLS]
    _write(dest, DEPUTE_COLS + ["mandat." + c for c in MANDAT_COLS], rows())


def fetch_an_organes(dest):
    """Organes (groupes, commissions...) referenced by the Martinique deputies' mandates."""
    refs = {_text(r) for a in _an_martinique_actors().values() for m in _as_list(_dig_raw(a, "mandats.mandat"))
            for r in _as_list(_dig_raw(m, "organes.organeRef"))}
    cols = ["uid", "codeType", "libelle", "libelleAbrege", "libelleAbrev", "viMoDe.dateDebut", "viMoDe.dateFin",
            "legislature", "positionPolitique", "couleurAssociee"]

    def rows():
        for name, doc in _json_items(AMO30):
            o = doc.get("organe")
            if o and _text(o.get("uid")) in refs:
                yield [_dig(o, c) for c in cols]
    _write(dest, cols, rows())


def fetch_an_deports(dest):
    """Déports (a deputy declares they will not take part in work on a subject, to avoid a conflict of interest)."""
    uids = set(_an_martinique_actors())

    def rows():
        for name, doc in _json_items(AMO30):
            d = doc.get("deport")
            if d and _text(_dig_raw(d, "refActeur") or _dig_raw(d, "acteurRef")) in uids:
                yield [_text(d.get("uid")), name, json.dumps(d, ensure_ascii=False)]
    _write(dest, ["uid", "file", "record"], rows())


SCRUTIN_COLS = ["uid", "numero", "legislature", "dateScrutin", "sessionRef", "seanceRef", "typeVote.codeTypeVote",
                "typeVote.libelleTypeVote", "typeVote.typeMajorite", "sort.code", "sort.libelle", "titre", "objet.libelle",
                "objet.dossierLegislatif.dossierRef", "objet.dossierLegislatif.libelle", "objet.referenceLegislative",
                "demandeur.texte", "modePublicationDesVotes", "syntheseVote.nombreVotants", "syntheseVote.decompte.pour",
                "syntheseVote.decompte.contre", "syntheseVote.decompte.abstentions", "syntheseVote.decompte.nonVotants"]


def fetch_an_scrutins_liste(dest):
    """Every public vote of the legislature (metadata only, national): the vote rule runs on all scrutins, and a
    Martinique deputy absent from the nominative lists has "no recorded vote" (not an absence)."""
    def rows():
        for name, doc in _json_items(f"{AN}/loi/scrutins/Scrutins.json.zip"):
            if s := doc.get("scrutin"):
                yield [_dig(s, c) for c in SCRUTIN_COLS]
    _write(dest, SCRUTIN_COLS, rows())


def fetch_an_scrutins(dest):
    """One row per (scrutin, Martinique deputy) with the recorded position, plus the scrutin's own metadata."""
    uids = set(_an_martinique_actors())
    meta = SCRUTIN_COLS
    positions = {"pours": "pour", "contres": "contre", "abstentions": "abstention", "nonVotants": "nonVotant",
                 "nonVotantsVolontaires": "nonVotantVolontaire"}

    def walk(node, pos, group, found):
        if isinstance(node, dict):
            if node.get("acteurRef") and _text(node["acteurRef"]) in uids:
                found.append((_text(node["acteurRef"]), _text(node.get("mandatRef")), pos, *group,
                              _text(node.get("parDelegation")), _text(node.get("causePositionVote"))))
            if "organeRef" in node and "vote" in node:  # a political group: its ref and majority position
                group = (_text(node["organeRef"]), _dig(node, "vote.positionMajoritaire"))
            for k, v in node.items():
                walk(v, positions.get(k, pos), group, found)
        elif isinstance(node, list):
            for v in node:
                walk(v, pos, group, found)

    def rows():
        for name, doc in _json_items(f"{AN}/loi/scrutins/Scrutins.json.zip"):
            s = doc.get("scrutin")
            if not s:
                continue
            found = []
            walk(s.get("ventilationVotes"), None, (None, None), found)
            # mises au point (corrections announced after the vote) are kept separately: the official result stays the vote
            mises = json.dumps(s.get("miseAuPoint"), ensure_ascii=False) if s.get("miseAuPoint") else None
            for f in found:
                yield [_dig(s, c) for c in meta] + list(f) + [mises]
    _write(dest, meta + ["acteurRef", "mandatRef", "position", "groupe_organeRef", "groupe_positionMajoritaire",
                         "parDelegation", "causePositionVote", "miseAuPoint"], rows())


def fetch_an_amendements(dest):
    """Amendments signed (auteur) or co-signed by a Martinique deputy; the dispositif text is left in the source."""
    uids = set(_an_martinique_actors())
    cols = ["uid", "legislature", "identification.numeroLong", "identification.numeroOrdreDepot", "texteLegislatifRef",
            "examenRef", "signataires.auteur.acteurRef", "signataires.auteur.groupePolitiqueRef", "signataires.auteur.typeAuteur",
            "signataires.libelle", "pointeurFragmentTexte.division.articleDesignation", "cycleDeVie.dateDepot",
            "cycleDeVie.dateSort", "cycleDeVie.sort", "cycleDeVie.etatDesTraitements.etat.libelle",
            "cycleDeVie.etatDesTraitements.sousEtat.libelle"]

    def rows():
        for name, doc in _json_items(f"{AN}/loi/amendements_div_legis/Amendements.json.zip"):
            a = doc.get("amendement")
            if not a:
                continue
            author = _text(_dig_raw(a, "signataires.auteur.acteurRef"))
            cos = [_text(x) for x in _as_list(_dig_raw(a, "signataires.cosignataires.acteurRef"))]
            mine = sorted(({author} | set(cos)) & uids)
            if mine:
                yield [_dig(a, c) for c in cols] + [",".join(cos), ",".join(mine), "auteur" if author in uids else "cosignataire"]
    _write(dest, cols + ["cosignataires", "martinique_acteurRefs", "role"], rows())


QUESTION_COLS = ["uid", "identifiant.numero", "identifiant.legislature", "type", "auteur.identite.acteurRef",
                 "auteur.groupe.abrege", "indexationAN.rubrique", "indexationAN.teteAnalyse", "indexationAN.analyses.analyse",
                 "minInt.abrege", "minAttribs.minAttrib.denomination.abrege", "textesQuestion.texteQuestion.infoJO.dateJO",
                 "textesReponse.texteReponse.infoJO.dateJO", "cloture.codeCloture", "cloture.libelleCloture", "cloture.dateCloture"]


def _questions(url):
    def fetcher(dest):
        uids = set(_an_martinique_actors())
        rows = ([_dig(q, c) for c in QUESTION_COLS] for _, doc in _json_items(url) if (q := doc.get("question"))
                and _text(_dig_raw(q, "auteur.identite.acteurRef")) in uids)
        _write(dest, QUESTION_COLS, rows)
    return fetcher


def fetch_an_dossiers(dest):
    """All legislative files of the 17th legislature (national, small): needed to apply the published vote rule."""
    cols = ["uid", "legislature", "titreDossier.titre", "titreDossier.titreChemin", "titreDossier.senatChemin",
            "procedureParlementaire.code", "procedureParlementaire.libelle", "initiateur.acteurs.acteur.acteurRef",
            "fusionDossier", "indexation"]

    def rows():
        for name, doc in _json_items(f"{AN}/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip"):
            d = doc.get("dossierParlementaire")
            if d:
                yield [_dig(d, c) for c in cols]
    _write(dest, cols, rows())


# ------------------------------------------------------------------ Sénat
def _senat_csv(path):
    """Sénat CSV exports: cp1252 (or utf-8), '%' comment lines with the SQL query on top, then a header line."""
    raw = _get(f"{SEN}/{path}").read_bytes()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("cp1252")
    lines = [ln for ln in text.splitlines() if not ln.startswith("%") and ln.strip()]
    dialect = csv.Sniffer().sniff(lines[0], delimiters=";,\t|")
    return list(csv.reader(io.StringIO("\n".join(lines)), dialect))


@functools.cache
def _senat_martinique_matricules():
    rows = _senat_csv("senateurs/ODSEN_GENERAL.csv")
    i = rows[0].index("Circonscription")
    return {r[0] for r in rows[1:] if re.fullmatch(r"\s*Martinique\s*", r[i])}, rows


def fetch_senat_general(dest):
    """ODSEN_GENERAL: every senator who ever sat for Martinique (current and former)."""
    mats, rows = _senat_martinique_matricules()
    _write(dest, rows[0], (r for r in rows[1:] if r[0] in mats))


def _senat_by_matricule(path):
    def fetcher(dest):
        mats, _ = _senat_martinique_matricules()
        rows = _senat_csv(path)
        _write(dest, rows[0], (r for r in rows[1:] if r[0] in mats))
    return fetcher


def fetch_senat_questions(dest):
    """Written/oral questions of the last 12 months (CSV extract) asked by Martinique's senators."""
    rows = _senat_csv("questions/questions-depuis-un-an.csv")
    i = rows[0].index("Circonscription")
    _write(dest, rows[0], (r for r in rows[1:] if r[i].strip() == "Martinique"))


def _job(folder, ds, url, title, page, credit, purpose, fetcher):
    return {**file_job(folder, ds, url, title, page, credit, purpose, encoding="utf-8"), "fetcher": fetcher}


AN_PAGE = "https://data.assemblee-nationale.fr"
AN_CREDIT = "Assemblée nationale, data.assemblee-nationale.fr"
SEN_CREDIT = "Sénat, data.senat.fr"
JOBS = [
    _job("an", "an-deputes", AMO30, "Acteurs, mandats et organes — historique depuis la XIe législature (AMO30)",
         f"{AN_PAGE}/acteurs/historique-des-deputes", AN_CREDIT,
         "Deputies elected in Martinique during the 17th legislature: identity, every mandate (seat, group, committees).",
         fetch_an_deputes),
    _job("an", "an-organes", AMO30, "Acteurs, mandats et organes — historique (AMO30), organes",
         f"{AN_PAGE}/acteurs/historique-des-deputes", AN_CREDIT,
         "Groups, committees and bodies the Martinique deputies belong(ed) to (labels, dates).", fetch_an_organes),
    _job("an", "an-deports", AMO30, "Acteurs, mandats et organes — historique (AMO30), déports",
         f"{AN_PAGE}/acteurs/historique-des-deputes", AN_CREDIT,
         "Déports (recusals declared to avoid conflicts of interest) of Martinique deputies.", fetch_an_deports),
    _job("an", "an-scrutins-17", f"{AN}/loi/scrutins/Scrutins.json.zip", "Scrutins — XVIIe législature",
         f"{AN_PAGE}/travaux-parlementaires/votes", AN_CREDIT,
         "Public votes (machine/solennels): position of each Martinique deputy, scrutin metadata.", fetch_an_scrutins),
    _job("an", "an-scrutins-17-liste", f"{AN}/loi/scrutins/Scrutins.json.zip", "Scrutins — XVIIe législature (liste)",
         f"{AN_PAGE}/travaux-parlementaires/votes", AN_CREDIT,
         "All public votes of the legislature (metadata, no positions): input of the vote-selection rule.",
         fetch_an_scrutins_liste),
    _job("an", "an-amendements-17", f"{AN}/loi/amendements_div_legis/Amendements.json.zip",
         "Amendements — XVIIe législature", f"{AN_PAGE}/travaux-parlementaires/amendements/tous-les-amendements",
         AN_CREDIT, "Amendments signed or co-signed by a Martinique deputy, with their outcome.", fetch_an_amendements),
    _job("an", "an-dossiers-17", f"{AN}/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip",
         "Dossiers législatifs — XVIIe législature", f"{AN_PAGE}/travaux-parlementaires/dossiers-legislatifs",
         AN_CREDIT, "All legislative files (titles, procedure): input of the published vote-selection rule.",
         fetch_an_dossiers),
    *[_job("an", f"an-{ds}-17", f"{AN}/questions/{path}", f"{title} — XVIIe législature",
           f"{AN_PAGE}/travaux-parlementaires/questions/{page}", AN_CREDIT,
           f"{title} asked by a Martinique deputy (subject, ministry, answer date).", _questions(f"{AN}/questions/{path}"))
      for ds, path, title, page in [
          ("questions-ecrites", "questions_ecrites/Questions_ecrites.json.zip", "Questions écrites", "questions-ecrites"),
          ("questions-orales", "questions_orales_sans_debat/Questions_orales_sans_debat.json.zip",
           "Questions orales sans débat", "questions-orales-sans-debat"),
          ("questions-gouvernement", "questions_gouvernement/Questions_gouvernement.json.zip",
           "Questions au Gouvernement", "questions-au-gouvernement")]],
    _job("senat", "senat-senateurs", f"{SEN}/senateurs/ODSEN_GENERAL.csv", "Sénateurs — informations générales (ODSEN_GENERAL)",
         "https://data.senat.fr/les-senateurs/", SEN_CREDIT,
         "Senators of Martinique (current and former): identity, group, permanent committee, status.", fetch_senat_general),
    *[_job("senat", f"senat-{ds}", f"{SEN}/senateurs/{f}.csv", title, "https://data.senat.fr/les-senateurs/", SEN_CREDIT,
           purpose, _senat_by_matricule(f"senateurs/{f}.csv"))
      for ds, f, title, purpose in [
          ("histogroupes", "ODSEN_HISTOGROUPES", "Sénateurs — historique des groupes politiques",
           "Political group membership history of Martinique's senators."),
          ("commissions", "ODSEN_COMS", "Sénateurs — historique des commissions permanentes",
           "Permanent committee membership history."),
          ("organismes", "ODSEN_MEMOEP", "Sénateurs — membres des organismes extraparlementaires",
           "Seats in extra-parliamentary bodies."),
          ("mandats-senat", "ODSEN_ELUSEN", "Sénateurs — mandats sénatoriaux", "Senate mandates (start, end, cause)."),
          ("mandats-locaux", "ODSEN_MANDAT_LOCAL", "Sénateurs — mandats locaux",
           "Local offices held by Martinique's senators (cross-domain link with communes / CTM)."),
          ("delegations", "ODSEN_OFFDEL", "Sénateurs — délégations et offices", "Delegations and offices.")]],
    _job("senat", "senat-questions-1an", f"{SEN}/questions/questions-depuis-un-an.csv",
         "Questions écrites et orales publiées depuis un an", "https://data.senat.fr/la-base-questions/", SEN_CREDIT,
         "Questions of the last 12 months by Martinique's senators (full history = PostgreSQL dump, not loaded yet).",
         fetch_senat_questions),
    # National files, small enough to keep whole (filtered at import), like the communes RNE files.
    _whole("rne", "rne-deputes", "https://www.data.gouv.fr/datasets/r/1ac42ff4-1336-44f8-a221-832039dbc142",
             "Répertoire national des élus — députés", "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1/",
             "Ministère de l'Intérieur, RNE", "Cross-check of current deputies (name, circonscription, start)."),
    _whole("rne", "rne-senateurs", "https://www.data.gouv.fr/datasets/r/b78f8945-509f-4609-a4a7-3048b8370479",
             "Répertoire national des élus — sénateurs", "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1/",
             "Ministère de l'Intérieur, RNE", "Cross-check of current senators."),
    _whole("hatvp", "hatvp-liste", "https://www.hatvp.fr/livraison/opendata/liste.csv",
             "HATVP — liste des déclarations publiées et appréciations", "https://www.hatvp.fr/open-data/",
             "Haute Autorité pour la transparence de la vie publique",
             "Declarations of interests/assets: type, dates, link (contents stay on hatvp.fr). National; filtered at import."),
]
