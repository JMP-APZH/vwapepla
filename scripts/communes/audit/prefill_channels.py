"""Pre-fill data/communes/audit/channels/<insee>.yaml with the social-network accounts LINKED FROM THE OFFICIAL
TOWN-HALL WEBSITE, read from the website crawl (data/raw/communes/audit/<insee>.json, crawl_sites.py).

No request to any social network: only links the town hall itself publishes. Entries are DRAFTS (observed_on and
reviewed_by empty): the card shows nothing until an observer completes them and JM reviews them
(docs/branches/B1-CHANNELS.md, docs/branches/B1-CHANNELS-GUIDE.md).
Existing files are never overwritten (an observer may already have edited them); use --force to rewrite drafts only.
Run: python -I scripts/communes/audit/prefill_channels.py [--force]
"""
import json, pathlib, re, sys, urllib.parse

import yaml

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[3]
CRAWL, OUT = ROOT / "data" / "raw" / "communes" / "audit", ROOT / "data" / "communes" / "audit" / "channels"
PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "whatsapp_channel"]
HOSTS = {"facebook.com": "facebook", "fb.com": "facebook", "instagram.com": "instagram", "tiktok.com": "tiktok",
         "youtube.com": "youtube", "whatsapp.com": "whatsapp_channel"}
# Links that are not an account: share buttons, single posts or videos, embeds, login pages...
NOT_ACCOUNT = re.compile(r"/(sharer|share|dialog|plugins|login|intent|embed|watch|shorts|p|reel|reels|posts|photos|"
                         r"videos|events|story\.php|permalink\.php|photo\.php|photo|media|hashtag|tr|v|results|pages|groups|search)(/|\.php|$|\?)", re.I)


def account(url):
    """(platform, canonical account URL) or None."""
    u = urllib.parse.urlsplit(url.strip())
    host = u.netloc.lower().removeprefix("www.").removeprefix("m.").removeprefix("web.")
    platform = HOSTS.get(host)
    path = u.path.rstrip("/")
    if not platform or not path or NOT_ACCOUNT.search(u.path + "/"):
        return None
    if re.fullmatch(r"/\d+(_\d+)?", path):  # bare numeric ids on a home page are posts, not the town hall's page
        return None
    if platform == "whatsapp_channel" and not path.startswith("/channel/"):
        return None
    if platform == "facebook" and path == "/profile.php":  # numeric profile id lives in the query
        q = urllib.parse.parse_qs(u.query).get("id")
        return (platform, f"https://www.facebook.com/profile.php?id={q[0]}") if q else None
    parts = path.split("/")
    keep = parts[:3] if parts[1] in ("channel", "c", "user", "pg", "people") else parts[:2]  # /channel/<id>, /<name>
    return platform, f"https://www.{host}{'/'.join(keep)}"


def found(code):
    """The town hall's own accounts: linked from the home page, or from at least half of the pages read (site-wide
    header or footer). A link on one inner page (a restaurant, an association) is not the town hall's account."""
    crawl = json.loads((CRAWL / f"{code}.json").read_text(encoding="utf-8"))
    first, pages_with = {}, {}
    for i, page in enumerate(crawl["pages"]):  # crawl order: start page first
        seen = {a for a in (account(link[0] if isinstance(link, list) else link) for link in page["links"]) if a}
        for a in seen:
            first.setdefault(a, (i, page["url"]))
            pages_with[a] = pages_with.get(a, 0) + 1
    n = max(len(crawl["pages"]), 1)
    return crawl, {a: url for a, (i, url) in first.items() if i == 0 or pages_with[a] >= n / 2}


def main(force=False):
    OUT.mkdir(parents=True, exist_ok=True)
    sites = re.findall(r'"(972\d\d)": "([^"]+)"', (ROOT / "src/lib/communes/sites.ts").read_text(encoding="utf-8"))
    for code, site in sites:
        path = OUT / f"{code}.yaml"
        if path.exists() and not force:
            print(f"{code}: exists, kept")
            continue
        if path.exists() and any(o.get("observed_on") for o in (yaml.safe_load(path.read_text(encoding="utf-8")) or {})
                                 .get("observations", [])):
            print(f"{code}: has observations, kept even with --force")
            continue
        if not (CRAWL / f"{code}.json").exists():
            print(f"{code}: no crawl, skipped")
            continue
        crawl, accounts = found(code)
        obs = [{"platform": p, "account_url": url, "account_name": None, "official": "yes",
                "official_basis": "linked_from_site", "official_evidence_url": page,
                "link_seen_on": crawl["crawled_on"], "last_post_date": None, "posts_last_90_days": None,
                "council_meetings_streamed": None, "council_stream_evidence_url": None, "followers": None,
                "followers_display": None, "screenshot": None, "screenshot_sha256": None, "observer": None,
                "observed_on": None, "reviewed_by": None, "note": None}
               for (p, url), page in sorted(accounts.items(), key=lambda x: PLATFORMS.index(x[0][0]))]
        head = (f"# Réseaux sociaux de la mairie — BROUILLON pré-rempli le {crawl['crawled_on']} à partir des liens publiés\n"
                f"# sur le site officiel ({site}). À compléter par un observateur (guide : docs/branches/B1-CHANNELS-GUIDE.md),\n"
                f"# puis relu par JM. Rien n'est publié avant observed_on + reviewed_by.\n")
        body = yaml.safe_dump({"commune": code, "observations": obs}, allow_unicode=True, sort_keys=False, width=120)
        path.write_text(head + body, encoding="utf-8")
        print(f"{code}: {len(obs)} account(s) linked from the site {[o['platform'] for o in obs]}")


if __name__ == "__main__":
    main(force="--force" in sys.argv)
