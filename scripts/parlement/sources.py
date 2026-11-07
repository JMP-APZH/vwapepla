"""Open-data sources of the parlement domain (B2), downloaded by scripts/core/download_sources.py --domain parlement.

JOBS: one dict per dataset (fields: scripts/core/fetching.py). Files land in data/raw/parlement/<folder>/ and are listed
in data/raw/parlement/manifest.json. Official sources only (all Licence Ouverte 2.0, the file_job default).

National files too big to keep whole (AN JSON zips, Sénat CSVs) are streamed to a temp dir and filtered here on
Martinique's members; the fetcher writes a ';' UTF-8 CSV so the engine can count rows and hash it. Columns are the
source's own field names (dotted path for nested JSON); `record` keeps the raw JSON of the kept item when useful.
"""
import collections, csv, functools, http.client, io, json, pathlib, re, tempfile, time, unicodedata, urllib.request, zipfile
import xml.etree.ElementTree as ET

from fetching import IncompleteDownload, fetch, file_job  # scripts/core (put on sys.path by download_sources.py)

AN = "https://data.assemblee-nationale.fr/static/openData/repository/17"
SEN = "https://data.senat.fr/data"
DEP_972 = "972"  # AN: election.lieu.numDepartement · Sénat: circonscription "Martinique"

_cache = {}  # url -> local zip path, so jobs of one run share a download (AMO30 is used by three jobs)
_tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)


def _get(url):
    if url not in _cache:
        p = pathlib.Path(_tmp.name) / f"{len(_cache)}{pathlib.Path(url).suffix}"
        try:
            fetch(url, p)  # length-checked, resumed, curl fallback (scripts/core/fetching.py)
        except IncompleteDownload:
            _patient_fetch(url, p)
        _cache[url] = p
    return _cache[url]


def _patient_fetch(url, dest, minutes=30):
    """Fallback for the AN archive server, which ends long transfers early and sometimes stalls for minutes
    (7 Nov 2026): HTTP Range requests from the last byte, with growing pauses, until the announced size is reached or
    `minutes` pass without progress. Its CDN does not serve ranges of files it marks "too big" to cache (the XVth
    amendments: 206 with no bytes): when a resume brings nothing, the next try is a full download from byte 0, kept only
    if it gets further. Same guarantee as the core fetch: a short file is never kept."""
    part, fresh = dest.with_name(dest.name + ".part"), dest.with_name(dest.name + ".fresh")
    part.unlink(missing_ok=True)
    head = urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=120)
    size = int(head.headers["Content-Length"])
    last, wait, full = time.monotonic(), 5, False
    while (have := part.stat().st_size if part.exists() else 0) < size:
        if time.monotonic() - last > minutes * 60:
            part.unlink(missing_ok=True)
            raise IncompleteDownload(f"{url}: stalled at {have:,} of {size:,} bytes for {minutes} min")
        target = fresh if full and have else part
        fresh.unlink(missing_ok=True)
        try:
            headers = {} if target is fresh or not have else {"Range": f"bytes={have}-"}
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as r,                     open(target, "ab") as f:
                if headers and r.status != 206:
                    raise IncompleteDownload(f"{url}: server does not resume")
                while chunk := r.read(1 << 20):
                    f.write(chunk)
        except (OSError, http.client.HTTPException):
            pass
        if target is fresh:
            if fresh.exists() and fresh.stat().st_size > have:
                fresh.replace(part)
            fresh.unlink(missing_ok=True)
        now = part.stat().st_size if part.exists() else 0
        if now > have:
            last, wait = time.monotonic(), 5
            print(f"     patient {'restart' if target is fresh else 'resume'}: {now:,} of {size:,} bytes", flush=True)
        else:
            full = not full  # alternate: resume from the last byte, then a full download from byte 0
            time.sleep(wait)
            wait = min(wait * 2, 120)
    if part.stat().st_size != size:
        part.unlink(missing_ok=True)
        raise IncompleteDownload(f"{url}: {part.stat().st_size:,} bytes, expected {size:,}")
    part.replace(dest)


def _json_items(url):
    """Yield every JSON document of a zip (one file per acteur / scrutin / amendement...)."""
    with zipfile.ZipFile(_get(url)) as zf:
        for name in zf.namelist():
            if name.endswith(".json"):
                with zf.open(name) as f:
                    yield name, json.load(f)


BIG_JSON = 150 * 1024 * 1024  # a single JSON file above this is read from the XML twin, streamed (XIV archives)


def _strip(tag):
    return tag.rsplit("}", 1)[-1]


def _xml_dict(el):
    """XML element -> dict shaped like the AN JSON exports (same names; '@xsi:nil'; lists for repeated children)."""
    attrs = {f"@{'xsi:' if '}' in k and 'XMLSchema-instance' in k else ''}{_strip(k)}": v for k, v in el.attrib.items()}
    kids = list(el)
    if not kids:
        text = (el.text or "").strip()
        if attrs.get("@xsi:nil") == "true":
            return {"@xsi:nil": "true"}
        return {**attrs, "#text": text} if attrs and text else (attrs or text or None)
    out = dict(attrs)
    for k in kids:
        tag, val = _strip(k.tag), _xml_dict(k)
        if tag in out:
            out[tag] = out[tag] if isinstance(out[tag], list) else [out[tag]]
            out[tag].append(val)
        else:
            out[tag] = val
    return out


def _find(node, kind):
    """Every value under key `kind` in a nested JSON document (lists flattened)."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k == kind:
                yield from (x for x in _as_list(v) if isinstance(x, dict))
            else:
                yield from _find(v, kind)
    elif isinstance(node, list):
        for v in node:
            yield from _find(v, kind)


def _an_records(url, kind):
    """Each `kind` record (scrutin, amendement, question, dossierParlementaire) of an AN zip, whatever the layout:
    one JSON file per record (XVth-XVIIth), or one file for the whole legislature (XIVth): parsed whole when small,
    else read from the published XML twin (same names) with a streaming parser."""
    if url.endswith(".xml.zip"):
        yield from _an_xml_records(url, kind)
        return
    with zipfile.ZipFile(_get(url)) as zf:
        infos = [i for i in zf.infolist() if i.filename.endswith(".json")]
        if len(infos) > 1:
            for i in infos:
                with zf.open(i) as f:
                    doc = json.load(f)
                if isinstance(doc.get(kind), dict):
                    yield doc[kind]
            return
        if infos[0].file_size <= BIG_JSON:
            with zf.open(infos[0]) as f:
                yield from _find(json.load(f), kind)
            return
    yield from _an_xml_records(url.replace(".json.zip", ".xml.zip"), kind)


def _an_xml_records(xml_url, kind):
    with zipfile.ZipFile(_get(xml_url)) as zf:
        info = max(zf.infolist(), key=lambda i: i.file_size)
        with zf.open(info) as f:
            depth = 0
            for event, el in ET.iterparse(f, events=("start", "end")):
                if _strip(el.tag) != kind:
                    continue
                if event == "start":
                    depth += 1
                    continue
                depth -= 1
                if depth == 0:
                    yield _xml_dict(el)
                    el.clear()


def _first(d, paths):
    for path in paths:
        v = _dig(d, path)
        if v not in (None, ""):
            return v
    return None


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


def _scrutins_liste(url):
    def fetcher(dest):
        """Every public vote of the legislature (metadata only, national): the vote rule runs on all scrutins, and a
        Martinique deputy absent from the nominative lists has "no recorded vote" (not an absence)."""
        _write(dest, SCRUTIN_COLS, ([_dig(s, c) for c in SCRUTIN_COLS] for s in _an_records(url, "scrutin")))
    return fetcher


fetch_an_scrutins_liste = _scrutins_liste(f"{AN}/loi/scrutins/Scrutins.json.zip")


def fetch_an_reunions(dest):
    """Every committee meeting of the legislature (national, no names): date, committee, state and whether an attendance
    list is published. Used only to state how complete the published attendance is (never shown per deputy)."""
    def rows():
        for name, doc in _json_items(f"{AN}/vp/reunions/Agenda.json.zip"):
            r = doc.get("reunion") or {}
            if r.get("@xsi:type") != "reunionCommission_type":
                continue
            listed = _as_list(((r.get("participants") or {}).get("participantsInternes") or {}).get("participantInterne"))
            yield [r.get("uid"), r.get("timeStampDebut"), r.get("organeReuniRef"), _dig(r, "cycleDeVie.etat"), len(listed)]
    _write(dest, ["uid", "timeStampDebut", "organeReuniRef", "cycleDeVie.etat", "participantsInternes.count"], rows())


def _scrutins(url):
    def fetcher(dest):
        """One row per (scrutin, Martinique deputy) with the recorded position, plus the scrutin's own metadata."""
        uids = set(_an_martinique_actors())
        meta = SCRUTIN_COLS
        # XVIIth: plural list names; XIVth and the Congrès (VTCG…) also use the singular ones ("pour", "contre"…)
        positions = {"pours": "pour", "contres": "contre", "abstentions": "abstention", "nonVotants": "nonVotant",
                     "nonVotantsVolontaires": "nonVotantVolontaire", "pour": "pour", "contre": "contre",
                     "abstention": "abstention", "nonVotant": "nonVotant", "nonVotantVolontaire": "nonVotantVolontaire"}

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
            for s in _an_records(url, "scrutin"):
                found = []
                walk(s.get("ventilationVotes"), None, (None, None), found)
                # mises au point (corrections announced after the vote) are kept separately: the official result stays the vote
                mises = json.dumps(s.get("miseAuPoint"), ensure_ascii=False) if s.get("miseAuPoint") else None
                for f in found:
                    yield [_dig(s, c) for c in meta] + list(f) + [mises]
        _write(dest, meta + ["acteurRef", "mandatRef", "position", "groupe_organeRef", "groupe_positionMajoritaire",
                             "parDelegation", "causePositionVote", "miseAuPoint"], rows())
    return fetcher


fetch_an_scrutins = _scrutins(f"{AN}/loi/scrutins/Scrutins.json.zip")


# Output column -> paths in the record (XVth-XVIIth names first, then the XIVth export's names).
AMENDEMENT_COLS = {
    "uid": ["uid"], "legislature": ["legislature", "identifiant.legislature"],
    "identification.numeroLong": ["identification.numeroLong", "numeroLong"],
    "identification.numeroOrdreDepot": ["identification.numeroOrdreDepot", "identifiant.numero"],
    "texteLegislatifRef": ["texteLegislatifRef", "identifiant.saisine.refTexteLegislatif"], "examenRef": ["examenRef"],
    "signataires.auteur.acteurRef": ["signataires.auteur.acteurRef"],
    "signataires.auteur.groupePolitiqueRef": ["signataires.auteur.groupePolitiqueRef"],
    "signataires.auteur.typeAuteur": ["signataires.auteur.typeAuteur"],
    "signataires.libelle": ["signataires.libelle", "signataires.texteAffichable"],
    "pointeurFragmentTexte.division.articleDesignation": ["pointeurFragmentTexte.division.articleDesignation",
                                                         "pointeurFragmentTexte.division.articleDesignationCourte"],
    "cycleDeVie.dateDepot": ["cycleDeVie.dateDepot", "dateDepot"],
    "cycleDeVie.dateSort": ["cycleDeVie.dateSort", "sort.dateSaisie"],
    "cycleDeVie.sort": ["cycleDeVie.sort", "sort.sortEnSeance"],
    "cycleDeVie.etatDesTraitements.etat.libelle": ["cycleDeVie.etatDesTraitements.etat.libelle", "etat"],
    "cycleDeVie.etatDesTraitements.sousEtat.libelle": ["cycleDeVie.etatDesTraitements.sousEtat.libelle"],
    "documentURI": ["representations.representation.contenu.documentURI"],
}


def _amendements(url):
    def fetcher(dest):
        """Amendments signed (auteur) or co-signed by a Martinique deputy; the dispositif text is left in the source."""
        uids = set(_an_martinique_actors())

        def rows():
            for a in _an_records(url, "amendement"):
                author = _text(_dig_raw(a, "signataires.auteur.acteurRef"))
                cos = [_text(x) for x in _as_list(_dig_raw(a, "signataires.cosignataires.acteurRef"))]
                mine = sorted(({author} | set(cos)) & uids)
                if mine:
                    yield ([_first(a, paths) for paths in AMENDEMENT_COLS.values()]
                           + [",".join(cos), ",".join(mine), "auteur" if author in uids else "cosignataire"])
        _write(dest, list(AMENDEMENT_COLS) + ["cosignataires", "martinique_acteurRefs", "role"], rows())
    return fetcher


fetch_an_amendements = _amendements(f"{AN}/loi/amendements_div_legis/Amendements.json.zip")


QUESTION_COLS = ["uid", "identifiant.numero", "identifiant.legislature", "type", "auteur.identite.acteurRef",
                 "auteur.groupe.abrege", "indexationAN.rubrique", "indexationAN.teteAnalyse", "indexationAN.analyses.analyse",
                 "minInt.abrege", "minAttribs.minAttrib.denomination.abrege", "textesQuestion.texteQuestion.infoJO.dateJO",
                 "textesReponse.texteReponse.infoJO.dateJO", "cloture.codeCloture", "cloture.libelleCloture", "cloture.dateCloture"]


QUESTION_ALT = {"indexationAN.analyses.analyse": ["indexationAN.analyses.analyse", "indexationAN.ANALYSE.ANA"]}


def _questions(url):
    def fetcher(dest):
        uids = set(_an_martinique_actors())
        rows = ([_first(q, QUESTION_ALT.get(c, [c])) for c in QUESTION_COLS] for q in _an_records(url, "question")
                if _text(_dig_raw(q, "auteur.identite.acteurRef")) in uids)
        _write(dest, QUESTION_COLS, rows)
    return fetcher


DOSSIER_COLS = ["uid", "legislature", "titreDossier.titre", "titreDossier.titreChemin", "titreDossier.senatChemin",
                "procedureParlementaire.code", "procedureParlementaire.libelle", "initiateur.acteurs.acteur.acteurRef",
                "fusionDossier", "indexation"]


def _dossiers(url):
    def fetcher(dest):
        """All legislative files of the legislature (national, small): needed to apply the published vote rule."""
        _write(dest, DOSSIER_COLS, ([_dig(d, c) for c in DOSSIER_COLS] for d in _an_records(url, "dossierParlementaire")))
    return fetcher


fetch_an_dossiers = _dossiers(f"{AN}/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip")


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


# --- Sénat PostgreSQL dumps (Questions since 1978, Ameli since 2001): streamed, only the COPY blocks needed ---------
PG_ENCODINGS = {"UTF8": "utf-8", "LATIN1": "latin-1", "LATIN9": "iso8859-15", "WIN1252": "cp1252", "SQL_ASCII": "cp1252"}
_PG_ESC = re.compile(r"\\(.)")
_PG_CHR = {"t": "\t", "n": "\n", "r": "\r", "b": "\b", "f": "\f", "v": "\v", "\\": "\\"}


# The Sénat dumps hold Windows-1252 typography (0x92 ’, 0x96 –, 0x9c œ…) stored as C1 control characters U+0080-U+009F
# (in LATIN1 dumps and, already converted, in UTF8 ones): read as cp1252 where it defines them (never legitimate text).
_C1 = {b: bytes([b]).decode("cp1252") for b in range(0x80, 0xA0) if b not in (0x81, 0x8D, 0x8F, 0x90, 0x9D)}


def _pg_decode(raw, enc):
    return raw.decode(enc).translate(_C1)


def _pg_value(v):
    return None if v == r"\N" else _PG_ESC.sub(lambda m: _PG_CHR.get(m.group(1), m.group(1)), v)


def _pg_rows(url, tables):
    """Yield (table, row dict) for the COPY blocks of `tables` in a zipped pg_dump (text format), in dump order."""
    with zipfile.ZipFile(_get(url)) as zf:
        name = max(zf.infolist(), key=lambda i: i.file_size).filename
        with zf.open(name) as f:
            enc, table, cols = "utf-8", None, None
            for raw in f:
                if table is None:
                    line = raw.decode("ascii", "replace")
                    if m := re.match(r"SET client_encoding = '(\w+)'", line):
                        enc = PG_ENCODINGS.get(m.group(1).upper(), "utf-8")
                    elif m := re.match(r"COPY (?:public\.)?(\w+) \((.*)\) FROM stdin;", line):
                        if m.group(1) in tables:
                            table, cols = m.group(1), [c.strip().strip('"') for c in m.group(2).split(",")]
                        else:
                            table, cols = "", None  # skip this block
                    continue
                if raw.startswith(b"\\."):
                    table = None
                    continue
                if table:
                    yield table, dict(zip(cols, map(_pg_value, _pg_decode(raw, enc).rstrip("\r\n").split("\t"))))


QUESTIONS_DUMP = f"{SEN}/questions/questions.zip"
SEN_QUESTION_COLS = ["id", "matricule", "natquecod", "natquelib", "legislature", "numero", "reference", "titre",
                     "rubrique", "datejodepot", "mindepotlib", "datejotran", "mintranlib", "sorquecod", "sorquelib",
                     "etaquecod", "etaquelib", "datecloture", "caduque_redeposee"]


def fetch_senat_questions_all(dest):
    """Every question asked by a senator of Martinique (all since 1946 elected; base since 1978), with the first answer
    (date, ministry, URL). Texts of questions and answers stay on senat.fr."""
    mats = _senat_martinique_matricules()[0]
    lib = {"naturequestion": {}, "sortquestion": {}, "etatquestion": {}}
    kept, answers = {}, {}
    for t, r in _pg_rows(QUESTIONS_DUMP, set(lib) | {"tam_questions", "tam_reponses"}):
        if t in lib:
            key = {"naturequestion": "natquecod", "sortquestion": "sorquecod", "etatquestion": "etaquecod"}[t]
            lib[t][r[key]] = r[key.replace("cod", "lib")]
        elif t == "tam_questions" and r["matricule"] in mats:
            kept[r["id"]] = {**r, "natquelib": lib["naturequestion"].get(r["natquecod"]),
                             "sorquelib": lib["sortquestion"].get(r["sorquecod"]),
                             "etaquelib": lib["etatquestion"].get(r["etaquecod"])}
        elif t == "tam_reponses" and r["idque"] in kept:
            if r["idque"] not in answers or (r["datejorep"] or "") < (answers[r["idque"]]["datejorep"] or "~"):
                answers[r["idque"]] = r
    def rows():
        for qid, q in sorted(kept.items(), key=lambda kv: (kv[1]["datejodepot"] or "", kv[0])):
            a = answers.get(qid, {})
            yield [q.get(c) for c in SEN_QUESTION_COLS] + [a.get("datejorep"), a.get("minreplib"), a.get("urlrep")]
    _write(dest, SEN_QUESTION_COLS + ["reponse.datejorep", "reponse.minreplib", "reponse.urlrep"], rows())


AMELI_DUMP = f"{SEN}/ameli/ameli.zip"
AMELI_COLS = ["id", "num", "rev", "typ", "datdep", "txtid", "sorid"]
AMELI_TXT_COLS = ["num", "int", "inl", "datdep", "doslegsignet", "natid", "sesinsid"]


def fetch_senat_amendements(dest):
    """Amendments (séance since Oct 2001, commission since Oct 2010) signed by a senator of Martinique: one row per
    amendment x senator, with rank (0/1 = first signatory, as published), text, session and outcome. Contents
    (dispositif, objet) stay on senat.fr."""
    mats = _senat_martinique_matricules()[0]
    # Three streamed passes (the dump lists amd, then amdsen, then sen_ameli): memory stays small.
    sens, txt, sor, ses, nat = {}, {}, {}, {}, {}
    for t, r in _pg_rows(AMELI_DUMP, {"sen_ameli", "txt_ameli", "sor", "ses", "nat"}):  # 1: who, lookups
        if t == "sen_ameli" and r["mat"] in mats:
            sens[r["entid"]] = r["mat"]
        elif t == "txt_ameli":
            txt[r["id"]] = {c: r[c] for c in AMELI_TXT_COLS}
        elif t == "sor":
            sor[r["id"]] = r["lib"]
        elif t == "ses":
            ses[r["id"]] = r["ann"]
        elif t == "nat":
            nat[r["id"]] = r["libcourt"]
    mine, n_sign = {}, collections.Counter()
    for _, r in _pg_rows(AMELI_DUMP, {"amdsen"}):  # 2: which amendments, number of signatories
        n_sign[r["amdid"]] += 1
        if r["senid"] in sens:
            mine.setdefault(r["amdid"], []).append(r)
    out = []
    for _, r in _pg_rows(AMELI_DUMP, {"amd"}):  # 3: the amendments themselves
        for s in mine.get(r["id"], []):
            x = txt.get(r["txtid"], {})
            out.append([r[c] for c in AMELI_COLS] + [sor.get(r["sorid"]), sens[s["senid"]], s["rng"], s["qua"],
                        n_sign[r["id"]]] + [x.get(c) for c in AMELI_TXT_COLS]
                       + [nat.get(x.get("natid")), ses.get(x.get("sesinsid"))])
    out.sort(key=lambda r: (r[4] or "", r[0]))
    _write(dest, [f"amd.{c}" for c in AMELI_COLS] + ["sor.lib", "matricule", "amdsen.rng", "amdsen.qua", "signataires"]
           + [f"txt.{c}" for c in AMELI_TXT_COLS] + ["nat.libcourt", "ses.ann"], out)


DOSLEG_DUMP = f"{SEN}/dosleg/dosleg.zip"
SEN_SCRUTIN_COLS = ["sesann", "scrnum", "scrdat", "scrint", "scrpou", "scrcon", "scrvot", "scrsuf", "scrmaj", "soslib",
                    "scrjso"]


def _st(x):
    return (x or "").strip()


def fetch_senat_scrutins(dest):
    """Every public vote (scrutin public) of the Sénat in Dosleg (since the 2006-2007 session): metadata, totals and the
    legislative file it belongs to (via date_seance -> lecass -> lecture -> loi). National, no positions."""
    tabs = {"scr", "date_seance", "lecass", "lecture", "loi"}
    rows = {t: [] for t in tabs}
    for t, r in _pg_rows(DOSLEG_DUMP, tabs):
        rows[t].append(r)
    ds = {r["code"]: r for r in rows["date_seance"]}
    lecass = {_st(r["lecassidt"]): r for r in rows["lecass"]}
    lecture = {_st(r["lecidt"]): r for r in rows["lecture"]}
    loi = {_st(r["loicod"]): r for r in rows["loi"]}
    def out():
        for s in sorted(rows["scr"], key=lambda s: (int(s["sesann"]), int(s["scrnum"]))):
            d = ds.get(s["code"])
            a = d and lecass.get(_st(d["lecidt"]))
            lec = (a and lecture.get(_st(a["lecidt"]))) or (d and lecture.get(_st(d["lecidt"])))
            o = (lec and loi.get(_st(lec["loicod"]))) or {}
            yield ([s[c] for c in SEN_SCRUTIN_COLS] + [_st(d and d["date_s"]) or None]
                   + [_st(o.get(c)) or None for c in ("signet", "typloicod", "loient", "loitit", "loiint")])
    _write(dest, SEN_SCRUTIN_COLS + ["date_seance.date_s", "loi.signet", "loi.typloicod", "loi.loient", "loi.loitit",
                                     "loi.loiint"], out())


def fetch_senat_votes(dest):
    """Nominative positions (votsen) of every senator of Martinique, current and former, on every public vote in
    Dosleg, with the published status (congé, président de séance, déport…) and the delegate's matricule if any."""
    mats = _senat_martinique_matricules()[0]
    lib = {"posvot": {}, "stavot": {}, "titsen": {}}
    out = []
    for t, r in _pg_rows(DOSLEG_DUMP, set(lib) | {"votsen"}):
        if t == "posvot":
            lib[t][r["posvotcod"]] = r["posvotlib"]
        elif t == "stavot":
            lib[t][r["stavotidt"]] = r["stavotlib"]
        elif t == "titsen":
            lib[t][r["titsencod"]] = r["titsenlib"]
        elif r["senmat"] in mats:
            out.append([r["sesann"], r["scrnum"], r["senmat"], r["posvotcod"], lib["posvot"].get(r["posvotcod"]),
                        r["stavotidt"], lib["stavot"].get(r["stavotidt"]), lib["titsen"].get(r["titsencod"]),
                        r["senmatdel"], r["votsenmar"]])
    out.sort(key=lambda r: (int(r[0]), int(r[1]), r[2]))
    _write(dest, ["sesann", "scrnum", "matricule", "posvotcod", "posvot.lib", "stavotidt", "stavot.lib", "titsen.lib",
                  "senmatdel", "votsenmar"], out)


HATVP_XML = "https://www.hatvp.fr/livraison/merge/declarations.xml"


def _norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]+", " ", s.lower()).strip()


def _current_members():
    """(last name, first name) normalised, of the 4 sitting deputies and 2 sitting senators of Martinique."""
    out = set()
    for a in _an_martinique_actors().values():
        for m in _as_list(_dig_raw(a, "mandats.mandat")):
            if (m.get("typeOrgane") == "ASSEMBLEE" and _dig(m, "election.lieu.numDepartement") == DEP_972
                    and _dig(m, "legislature") == "17" and not _dig(m, "dateFin")):
                out.add((_norm(_dig(a, "etatCivil.ident.nom")), _norm(_dig(a, "etatCivil.ident.prenom"))))
    mats, rows = _senat_martinique_matricules()
    h = rows[0]
    for r in rows[1:]:
        if r[0] in mats and r[h.index("État")].strip().upper() == "ACTIF":
            out.add((_norm(r[h.index("Nom usuel")]), _norm(r[h.index("Prénom usuel")])))
    return out


def _leaves(el, path=""):
    """(path, text) of every leaf element, path made of tag names joined by '/'. Repeated items keep their index."""
    kids = list(el)
    if not kids:
        yield path, (el.text or "").strip()
        return
    seen = {}
    for k in kids:
        i = seen[k.tag] = seen.get(k.tag, -1) + 1
        yield from _leaves(k, f"{path}/{k.tag}[{i}]" if path else f"{k.tag}[{i}]")


# Whitelist (JM, 5 Nov 2026, Q7 bis): the member's own sections only. Never kept: address, birth date, e-mail, phone,
# attached files, and the sections about other people (spouse: activProfConjointDto; assistants: activCollaborateursDto).
HATVP_KEEP = ("uuid", "dateDepot", "declarationVersion", "complete", "general/typeDeclaration/", "general/dateDebutMandat",
              "general/declarationModificative", "general/mandat/label", "general/qualiteMandat/labelTypeMandat",
              "general/declarant/nom", "general/declarant/prenom", "general/declarant/civilite",
              "activProfCinqDerniereDto/", "activConsultantDto/", "participationDirigeantDto/",
              "participationFinanciereDto/", "fonctionBenevoleDto/", "mandatElectifDto/", "observationInteretDto/")


def fetch_hatvp_declarations(dest):
    """Declarations of interests (DIA, DIAM) of Martinique's sitting deputies and senators: whitelisted fields as
    published (one row per leaf: declaration uuid, path, value). National file streamed, never kept."""
    members = _current_members()
    if len(members) != 6:
        raise SystemExit(f"expected 6 sitting members, found {len(members)}: {sorted(members)}")
    def rows():
        kept = 0
        for _, el in ET.iterparse(_get(HATVP_XML), events=("end",)):
            if el.tag != "declaration":
                continue
            kind = (el.findtext("general/typeDeclaration/id") or "").strip().upper()
            who = (_norm(el.findtext("general/declarant/nom")), _norm(el.findtext("general/declarant/prenom")))
            if kind.startswith("DI") and who in members:
                kept += 1
                did = (el.findtext("uuid") or "").strip()
                for path, value in _leaves(el):
                    if value and re.sub(r"\[\d+\]", "", path).startswith(HATVP_KEEP):
                        yield [did, path, value]
            el.clear()
        print(f"     {kept} declarations of interests")
    _write(dest, ["declaration", "path", "value"], rows())


def _job(folder, ds, url, title, page, credit, purpose, fetcher):
    return {**file_job(folder, ds, url, title, page, credit, purpose, encoding="utf-8"), "fetcher": fetcher}


AN_PAGE = "https://data.assemblee-nationale.fr"
REPO = "https://data.assemblee-nationale.fr/static/openData/repository"
ROMAN = {14: "XIV", 15: "XV", 16: "XVI"}
EARLIER = (14, 15, 16)
# Archive files of the earlier legislatures, as linked from data.assemblee-nationale.fr/archives-* (checked 7 Nov 2026).
# XIVth amendments and written questions: one JSON file of 0.7-1.5 GB, so the XML twin is read, streamed.
ARCHIVE = {
    14: {"scrutins": "loi/scrutins/Scrutins_XIV.json.zip",
         "amendements": "loi/amendements_legis_XIV/Amendements_XIV.xml.zip",
         "dossiers": "loi/dossiers_legislatifs/Dossiers_Legislatifs_XIV.json.zip",
         "questions-ecrites": "questions/questions_ecrites/Questions_ecrites_XIV.xml.zip",
         "questions-orales": "questions/questions_orales_sans_debat/Questions_orales_sans_debat_XIV.json.zip",
         "questions-gouvernement": "questions/questions_gouvernement/Questions_gouvernement_XIV.json.zip"},
    15: {"scrutins": "loi/scrutins/Scrutins_XV.json.zip", "amendements": "loi/amendements_legis/Amendements_XV.json.zip",
         "dossiers": "loi/dossiers_legislatifs/Dossiers_Legislatifs_XV.json.zip",
         "questions-ecrites": "questions/questions_ecrites/Questions_ecrites_XV.json.zip",
         "questions-orales": "questions/questions_orales_sans_debat/Questions_orales_sans_debat_XV.json.zip",
         "questions-gouvernement": "questions/questions_gouvernement/Questions_gouvernement_XV.json.zip"},
    16: {"scrutins": "loi/scrutins/Scrutins.json.zip", "amendements": "loi/amendements_div_legis/Amendements.json.zip",
         "dossiers": "loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip",
         "questions-ecrites": "questions/questions_ecrites/Questions_ecrites.json.zip",
         "questions-orales": "questions/questions_orales_sans_debat/Questions_orales_sans_debat.json.zip",
         "questions-gouvernement": "questions/questions_gouvernement/Questions_gouvernement.json.zip"},
}
ARCHIVE_PAGE = {14: f"{AN_PAGE}/archives-anterieures/archives-14e", 15: f"{AN_PAGE}/archives-anterieures/archives-15e",
                16: f"{AN_PAGE}/archives-16e"}


def _earlier_jobs(leg):
    """Same datasets as the XVIIth, for an earlier legislature (archives; amendments are the biggest files)."""
    url = lambda k: f"{REPO}/{leg}/{ARCHIVE[leg][k]}"  # noqa: E731
    name, page = f"{ROMAN[leg]}e législature", ARCHIVE_PAGE[leg]
    return [
        _job("an", f"an-scrutins-{leg}", url("scrutins"), f"Scrutins — {name}", page, AN_CREDIT,
             "Public votes: position of each Martinique deputy, scrutin metadata.", _scrutins(url("scrutins"))),
        _job("an", f"an-scrutins-{leg}-liste", url("scrutins"), f"Scrutins — {name} (liste)", page, AN_CREDIT,
             "All public votes of the legislature (metadata): input of the vote-selection rule.", _scrutins_liste(url("scrutins"))),
        _job("an", f"an-dossiers-{leg}", url("dossiers"), f"Dossiers législatifs — {name}", page, AN_CREDIT,
             "All legislative files (titles): input of the vote-selection rule.", _dossiers(url("dossiers"))),
        *[_job("an", f"an-{k}-{leg}", url(k), f"{title} — {name}", page, AN_CREDIT,
               f"{title} asked by a Martinique deputy (subject, ministry, answer date).", _questions(url(k)))
          for k, title in [("questions-ecrites", "Questions écrites"), ("questions-orales", "Questions orales sans débat"),
                           ("questions-gouvernement", "Questions au Gouvernement")]],
        _job("an", f"an-amendements-{leg}", url("amendements"), f"Amendements — {name}", page, AN_CREDIT,
             "Amendments signed or co-signed by a Martinique deputy, with their outcome.", _amendements(url("amendements"))),
    ]
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
    _job("an", "an-reunions-17", f"{AN}/vp/reunions/Agenda.json.zip", "Agenda — réunions de la XVIIe législature",
         f"{AN_PAGE}/travaux-parlementaires/reunions", AN_CREDIT,
         "Committee meetings (no names): how many publish an attendance list (stated as a data gap, never a rate).",
         fetch_an_reunions),
    *[_job("an", f"an-{ds}-17", f"{AN}/questions/{path}", f"{title} — XVIIe législature",
           f"{AN_PAGE}/travaux-parlementaires/questions/{page}", AN_CREDIT,
           f"{title} asked by a Martinique deputy (subject, ministry, answer date).", _questions(f"{AN}/questions/{path}"))
      for ds, path, title, page in [
          ("questions-ecrites", "questions_ecrites/Questions_ecrites.json.zip", "Questions écrites", "questions-ecrites"),
          ("questions-orales", "questions_orales_sans_debat/Questions_orales_sans_debat.json.zip",
           "Questions orales sans débat", "questions-orales-sans-debat"),
          ("questions-gouvernement", "questions_gouvernement/Questions_gouvernement.json.zip",
           "Questions au Gouvernement", "questions-au-gouvernement")]],
    *[job for leg in EARLIER for job in _earlier_jobs(leg)],
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
    _job("senat", "senat-questions-972", QUESTIONS_DUMP, "Base Questions (dump PostgreSQL, depuis 1978)",
         "https://data.senat.fr/la-base-questions/", SEN_CREDIT,
         "Every question of Martinique's senators, with first answer date and ministry (texts stay on senat.fr).",
         fetch_senat_questions_all),
    _job("senat", "senat-amendements-972", AMELI_DUMP, "Ameli — amendements (dump PostgreSQL)",
         "https://data.senat.fr/ameli/", SEN_CREDIT,
         "Amendments signed by Martinique's senators (séance since 2001, commission since 2010), rank and outcome.",
         fetch_senat_amendements),
    _job("senat", "senat-scrutins", DOSLEG_DUMP, "Dosleg — scrutins publics (dump PostgreSQL)",
         "https://data.senat.fr/dosleg/", SEN_CREDIT,
         "Every public vote of the Sénat since 2006-2007 (object, totals, legislative file): input of the vote rule.",
         fetch_senat_scrutins),
    _job("senat", "senat-votes-972", DOSLEG_DUMP, "Dosleg — votes nominatifs des sénateurs (dump PostgreSQL)",
         "https://data.senat.fr/dosleg/", SEN_CREDIT,
         "Position of each senator of Martinique (current and former) on every public vote, with published status.",
         fetch_senat_votes),
    # National files, small enough to keep whole (filtered at import), like the communes RNE files.
    file_job("rne", "rne-deputes", "https://www.data.gouv.fr/datasets/r/1ac42ff4-1336-44f8-a221-832039dbc142",
             "Répertoire national des élus — députés", "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1/",
             "Ministère de l'Intérieur, RNE", "Cross-check of current deputies (name, circonscription, start)."),
    file_job("rne", "rne-senateurs", "https://www.data.gouv.fr/datasets/r/b78f8945-509f-4609-a4a7-3048b8370479",
             "Répertoire national des élus — sénateurs", "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1/",
             "Ministère de l'Intérieur, RNE", "Cross-check of current senators."),
    file_job("elections", "legislatives-2024-candidats-t1",
             "https://www.data.gouv.fr/datasets/r/cd5b39e6-5feb-4864-b274-3431ed81442c",
             "Élections législatives des 30 juin et 7 juillet 2024 — liste des candidats du 1er tour",
             "https://www.data.gouv.fr/datasets/elections-legislatives-des-30-juin-et-7-juillet-2024-liste-des-candidats-du-1er-tour",
             "Ministère de l'Intérieur",
             "Suppléant(e) of each elected deputy (AN open data only gives an id). National; filtered at import."),
    file_job("hatvp", "hatvp-liste", "https://www.hatvp.fr/livraison/opendata/liste.csv",
             "HATVP — liste des déclarations publiées et appréciations", "https://www.hatvp.fr/open-data/",
             "Haute Autorité pour la transparence de la vie publique",
             "Declarations of interests/assets: type, dates, link, open-data XML name. National; filtered at import."),
    _job("hatvp", "hatvp-declarations-972", HATVP_XML,
         "HATVP — déclarations publiées (fichier complet, XML)", "https://www.hatvp.fr/open-data/",
         "Haute Autorité pour la transparence de la vie publique",
         "Declarations of interests of the 6 sitting members, fields as published (outside activities on the card).",
         fetch_hatvp_declarations),
]
