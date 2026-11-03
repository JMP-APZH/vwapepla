"""Crawl each town-hall website (first pass of the website audit) into data/raw/communes/audit/<insee>.json (gitignored).

Polite and reproducible: identifies itself, honours robots.txt, TLS verified, one request at a time per site with a
pause, same host only, at most MAX_PAGES HTML pages (links that look relevant to the criteria are visited first).
Documents (PDF, DOCX...) are not downloaded: their URL and link text are recorded as evidence candidates.
Site list: src/lib/communes/sites.ts (Service-Public directory). Run: python -I scripts/communes/audit/crawl_sites.py [insee ...]
"""
import concurrent.futures as cf, datetime, heapq, json, pathlib, re, ssl, sys, time, unicodedata
import urllib.error, urllib.parse, urllib.request, urllib.robotparser

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = ROOT / "data" / "raw" / "communes" / "audit"
UA = "VwapeplaAudit/0.1 (+https://vwapepla.org; vwapepla.org@gmail.com)"
MAX_PAGES, PAUSE, TIMEOUT = 80, 0.7, 25
DOC = re.compile(r"\.(pdf|docx?|xlsx?|odt|ods|zip)(\?|$)", re.I)
SKIP = re.compile(r"\.(jpe?g|png|gif|webp|svg|mp4|mp3|css|js|ico|woff2?)(\?|$)|^(mailto|tel|javascript):", re.I)
PRIORITY = re.compile(r"mairie|municipal|conseil|elus|deliber|proces|budget|compte|finance|acte|arrete|marche|"
                      r"mention|accessib|donnees|confidential|demarche|service|contact|risque|dicrim|participat|"
                      r"citoyen|quartier|jeunes|actualite|magazine|bulletin|journal|publication|document|petition|"
                      r"subvention|association|projet|travaux|bilan|indemnit|chambre|alerte|signal", re.I)


def norm(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def sites():
    src = (ROOT / "src" / "lib" / "communes" / "sites.ts").read_text(encoding="utf-8")
    return {k: v for k, v in re.findall(r'"(972\d\d)": "([^"]+)"', src)}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"})
    with urllib.request.urlopen(req, timeout=TIMEOUT, context=ssl.create_default_context()) as r:
        ctype = r.headers.get("content-type", "")
        body = r.read(3_000_000).decode("utf-8", "replace") if "html" in ctype else ""
        return r.geturl(), r.status, ctype, body


def links(base, html):
    out = []
    for m in re.finditer(r'<a\b[^>]*href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', html, re.I | re.S):
        href, text = m.group(1).strip(), re.sub(r"<[^>]+>|\s+", " ", m.group(2)).strip()
        if SKIP.search(href):
            continue
        out.append((urllib.parse.urljoin(base, href), text[:200]))
    return out


def text_of(html):
    html = re.sub(r"<(script|style|noscript)\b.*?</\1>", " ", html, flags=re.I | re.S)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).strip()


def crawl(code, start):
    rec = {"commune_code": code, "start_url": start, "crawled_on": datetime.date.today().isoformat(),
           "error": None, "final_url": None, "https": None, "viewport": None, "pages": [], "documents": [], "external": []}
    try:
        final, status, ctype, html = fetch(start)
    except ssl.SSLError as e:
        rec["error"] = f"TLS: {e.__class__.__name__}"; return rec
    except urllib.error.HTTPError as e:
        rec["error"] = f"HTTP {e.code}"; return rec
    except Exception as e:
        rec["error"] = f"{e.__class__.__name__}: {str(e)[:120]}"; return rec
    rec["final_url"], rec["https"] = final, final.startswith("https://")
    rec["viewport"] = bool(re.search(r'<meta[^>]+name=["\']viewport["\'][^>]+width=device-width', html, re.I))
    if re.search(r"just a moment|cf-challenge|challenge-platform", html, re.I) and len(text_of(html)) < 400:
        rec["error"] = "bot wall (Cloudflare challenge)"; return rec
    host = urllib.parse.urlparse(final).netloc.removeprefix("www.")
    # robots.txt read with OUR user agent (RobotFileParser.read() uses Python's default UA, which some sites refuse,
    # and then wrongly concludes "disallow all"). 4xx = no restriction (usual convention), 5xx/network = stop.
    robots = urllib.robotparser.RobotFileParser()
    try:
        req = urllib.request.Request(urllib.parse.urljoin(final, "/robots.txt"), headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=ssl.create_default_context()) as r:
            robots.parse(r.read().decode("utf-8", "replace").splitlines())
    except urllib.error.HTTPError as e:
        robots.parse([] if 400 <= e.code < 500 else ["User-agent: *", "Disallow: /"])
    except Exception:
        robots.parse(["User-agent: *", "Disallow: /"])
    seen, docs, ext = {final}, {}, {}
    queue = []  # (priority, order, url, anchor)
    order = 0

    def push(url, text):
        nonlocal order
        u = url.split("#")[0]
        h = urllib.parse.urlparse(u).netloc.removeprefix("www.")
        if h != host:
            if h:
                ext.setdefault(u, text)
            return
        if DOC.search(u):
            docs.setdefault(u, text); return
        if u in seen:
            return
        seen.add(u); order += 1
        heapq.heappush(queue, (0 if PRIORITY.search(norm(u + " " + text)) else 1, order, u, text))

    def record(url, html):
        title = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        rec["pages"].append({"url": url, "title": re.sub(r"\s+", " ", title.group(1)).strip() if title else "",
                             "text": text_of(html)[:20000], "links": links(url, html)})
        for u, t in rec["pages"][-1]["links"]:
            push(u, t)

    record(final, html)
    while queue and len(rec["pages"]) < MAX_PAGES:
        _, _, url, _ = heapq.heappop(queue)
        if not robots.can_fetch(UA, url):
            continue
        time.sleep(PAUSE)
        try:
            u, status, ctype, body = fetch(url)
        except Exception:
            continue
        if body:
            record(u, body)
    rec["documents"] = [{"url": u, "text": t} for u, t in docs.items()]
    rec["external"] = [{"url": u, "text": t} for u, t in list(ext.items())[:400]]
    return rec


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    todo = sites()
    if sys.argv[1:]:
        todo = {k: v for k, v in todo.items() if k in sys.argv[1:]}
    with cf.ThreadPoolExecutor(8) as ex:  # 8 different sites at once; one request at a time per site
        for rec in ex.map(lambda kv: crawl(*kv), todo.items()):
            (OUT / f"{rec['commune_code']}.json").write_text(json.dumps(rec, ensure_ascii=False), encoding="utf-8")
            print(f"{rec['commune_code']} {len(rec['pages']):3d} pages {len(rec['documents']):4d} docs "
                  f"{'ERR ' + rec['error'] if rec['error'] else ''} {rec['final_url'] or rec['start_url']}")


if __name__ == "__main__":
    main()
