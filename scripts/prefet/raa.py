"""Recueils des actes administratifs (RAA) of the préfecture de la Martinique: list of the acts, from the table of contents
(« Sommaire ») of each bulletin published on martinique.gouv.fr. Standard library + pypdf.

The site has one folder per year (RAA 2026, Archives/RAA-2025, Archives/RAAP-2016 …), with sub-folders (regular and
special editions, sometimes one per month) and pages of 10 (« (offset)/10 »). `crawl` follows every link under a year's
folder and collects the PDF links with their published date and size.

Each PDF is downloaded once (fetching.fetch: complete or nothing), its first pages read for the Sommaire, then deleted:
only the list of acts is kept, in a per-bulletin cache (data/raw/prefet/raa/cache/<n>.json) so a re-run downloads only
new bulletins. The bulletins themselves stay on the préfecture's site (each act links to its PDF and page).
"""
import html, json, pathlib, re, tempfile, time, urllib.parse, urllib.request

SITE = "https://www.martinique.gouv.fr"
ROOT_PATH = "/Publications/Recueils-des-actes-administratifs-publies"
UA = {"User-Agent": "Mozilla/5.0 (vwapepla.org civic transparency; contact vwapepla.org@gmail.com)"}
PDF_LINK = re.compile(r'href="(/contenu/telechargement/[^"]+?\.pdf)"(.*?)</a>', re.S)
META = re.compile(r"PDF\s*-\s*([\d,]+)\s*([KMG]o|[KMG]b)\s*-\s*(\d\d/\d\d/\d{4})", re.I)


# The site cuts off clients that ask too fast (seen on 5 Nov 2026: blocked for minutes after ~200 quick page loads).
# So: one request at a time, PAUSE seconds between requests, and long waits when it stops answering.
PAUSE = 2.0
BACKOFF = (30, 60, 120, 300, 600)  # seconds


def patient(call, what):
    """Run `call()`; when the site stops answering, wait BACKOFF[i] seconds and try again."""
    for i, wait in enumerate((*BACKOFF, None)):
        try:
            result = call()
            time.sleep(PAUSE)
            return result
        except Exception as e:  # noqa: BLE001 — connection dropped or refused: back off, then give up loudly
            if wait is None:
                raise
            print(f"     site not answering ({type(e).__name__}) on {what}: waiting {wait} s")
            time.sleep(wait)


def get(url):
    def call():
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
            return r.read().decode("utf-8", "replace")
    return patient(call, url)


def download(url, dest, resumes=10):
    """One bulletin, with our User-Agent (the site drops Python's default one), checked against Content-Length.
    The site ends long transfers early (4.4 MB bulletin cut at 1.9 MB, 5 Nov 2026): a short read is resumed with an
    HTTP Range request from the last byte. Still incomplete: raises, so `patient` retries and nothing is parsed."""
    dest = pathlib.Path(dest)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=900) as r, open(dest, "wb") as f:
        expected = r.headers.get("Content-Length")
        final = r.geturl()
        while chunk := r.read(1 << 20):
            f.write(chunk)
    if not (expected and expected.isdigit()):
        return
    size = int(expected)
    for _ in range(resumes):
        got = dest.stat().st_size
        if got >= size:
            break
        time.sleep(PAUSE)
        req = urllib.request.Request(final, headers={**UA, "Range": f"bytes={got}-"})
        with urllib.request.urlopen(req, timeout=900) as r, open(dest, "ab") as f:
            if r.status != 206:
                raise OSError(f"incomplete download ({got} of {size} bytes) and the server does not resume")
            while chunk := r.read(1 << 20):
                f.write(chunk)
    if dest.stat().st_size != size:
        raise OSError(f"incomplete download: {dest.stat().st_size} of {size} bytes")


def year_folders():
    """{year: folder path} from the RAA home page and its archives."""
    out = {}
    for page in (ROOT_PATH, ROOT_PATH + "/Archives"):
        for href in re.findall(r'href="(' + re.escape(ROOT_PATH) + r'/[^"]+)"', get(SITE + page)):
            m = re.search(r"/(?:R\.?A\.?A\.?P?)-(\d{4})$", href)
            if m:
                out[int(m[1])] = href
    return out


def crawl(folder):
    """Every PDF under `folder`: [{url, name, size_mb, published (YYYY-MM-DD), page}] (deduplicated by URL)."""
    seen, todo, pdfs = set(), [folder], {}
    while todo:
        path = todo.pop()
        if path in seen:
            continue
        seen.add(path)
        s = get(SITE + urllib.parse.quote(path, safe="/()%"))
        for href, rest in PDF_LINK.findall(s):
            m = META.search(html.unescape(re.sub(r"<[^>]+>", " ", rest)))
            url = SITE + urllib.parse.quote(html.unescape(href), safe="/%")  # 2016 names: « RAA - N° 02-2016-016.pdf »
            if url not in pdfs:
                size = float(m[1].replace(",", ".")) * {"k": 1 / 1024, "m": 1, "g": 1024}[m[2][0].lower()] if m else None
                d = m[3] if m else None
                pdfs[url] = {"url": url, "name": href.rsplit("/", 1)[-1], "size_mb": size,
                             "published": f"{d[6:]}-{d[3:5]}-{d[:2]}" if d else None, "page": SITE + path}
        for href in re.findall(r'href="(' + re.escape(folder) + r'/[^"#?]*)"', s):
            href = html.unescape(href)
            if href not in seen:
                todo.append(href)
    return list(pdfs.values())


# --- Sommaire --------------------------------------------------------------------------------------------------------
# Lines look like:  « R02-2026-10-30-00005 - Arrêté autorisation drones DTPN (3 pages) Page 3 »
# preceded by the service: « Préfecture de la Martinique / Cabinet du Préfet ». Titles may wrap over several lines.
ACT = re.compile(r"^(?P<id>R02-\d{4}-\d\d-\d\d-\d{3,5})\s*-\s*(?P<title>.+?)\s*\((?P<pages>\d+)\s*pages?\)\s*Page\s*(?P<page>\d+)\s*$")
ACT_START = re.compile(r"^R02-\d{4}-\d\d-\d\d-\d{3,5}\s*-")  # 3 digits in 2016, 5 later


def sommaire(pdf_path, max_pages=40):
    """Acts listed in the bulletin's Sommaire: [{act_id, act_date, service, title, pages, page}]."""
    from pypdf import PdfReader
    reader = PdfReader(str(pdf_path))
    lines, started = [], False
    for p in reader.pages[1:max_pages]:
        try:
            text = p.extract_text() or ""
        except Exception:  # noqa: BLE001 — a broken page: skip it, the act count check reports gaps
            continue
        if not started and "Sommaire" not in text:
            continue
        started = True
        if re.search(r"^\s*Préfecture de la Martinique\s*\nR02-\d{4}", text) and "Sommaire" not in text:
            break  # first act page: the Sommaire is over
        lines += [line.strip() for line in text.splitlines() if line.strip()]
    acts, service, buf = [], None, ""
    for line in lines:
        if line == "Sommaire" or re.fullmatch(r"\d+", line):
            continue
        if ACT_START.match(line) or buf:
            buf = f"{buf} {line}".strip() if buf else line
            m = ACT.match(buf)
            if m:
                d = m["id"][4:14]
                acts.append({"act_id": m["id"], "act_date": d, "service": service, "title": m["title"].strip(),
                             "pages": int(m["pages"]), "page": int(m["page"])})
                buf = ""
            elif len(buf) > 600:  # not an act line after all
                buf = ""
            continue
        service = line  # a heading line between acts = the issuing service
    return acts


def bulletin_number(name):
    """'recueil-r02-2026-374-…' or 'RAA - N° 02-2016-016.pdf' -> '2026-0374', '2016-0016'."""
    name = urllib.parse.unquote(name)
    m = re.search(r"r?0?2-(\d{4})-(\d+)", name, re.I)
    return f"{m[1]}-{int(m[2]):04d}" if m else None


def index_year(year, folder, cache_dir, log=print):
    """Acts of one year's bulletins (cached per bulletin). Returns (acts, bulletins, problems)."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    bulletins = crawl(folder)
    acts, problems = [], []
    for b in sorted(bulletins, key=lambda b: b["url"]):
        key = re.sub(r"[^a-zA-Z0-9_-]", "_", b["url"].split("/telechargement/")[-1])[:150]
        cached = cache_dir / f"{key}.json"
        if cached.exists():
            found = json.loads(cached.read_text(encoding="utf-8"))
        else:
            with tempfile.TemporaryDirectory() as tmp:
                pdf = pathlib.Path(tmp) / "raa.pdf"
                try:
                    patient(lambda: download(b["url"], pdf), b["name"])
                    found = sommaire(pdf)
                except Exception as e:  # noqa: BLE001 — one unreadable bulletin must not stop the year
                    problems.append(f"{b['name']}: {e}")
                    continue
            cached.write_text(json.dumps(found, ensure_ascii=False), encoding="utf-8")
            log(f"     {b['name']}: {len(found)} acts")
        if not found:
            problems.append(f"{b['name']}: no act found in the Sommaire")
        for a in found:
            acts.append({**a, "bulletin": bulletin_number(b["name"]) or b["name"], "published": b["published"],
                         "pdf_url": b["url"], "listing_page": b["page"]})
    return acts, bulletins, problems
