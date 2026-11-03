"""Légifrance API client (DILA, through the PISTE gateway): appointment decrees published in the JORF.

Needs in .env.local (never committed): PISTE_CLIENT_ID, PISTE_CLIENT_SECRET — see scripts/prefet/README.md.
Standard library only. Used by the jorf-* jobs of scripts/prefet/sources.py, which write one CSV row per text with the
raw JSON of the API response, so the build can re-parse it without calling the API again.
"""
import html, json, re, time, urllib.parse, urllib.request

TOKEN_URL = "https://oauth.piste.gouv.fr/api/oauth/token"
API = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app"
TEXT_URL = "https://www.legifrance.gouv.fr/jorf/id/{cid}"
ENV_KEYS = ("PISTE_CLIENT_ID", "PISTE_CLIENT_SECRET")


class Client:
    def __init__(self, client_id, client_secret):
        self.client_id, self.client_secret, self.token, self.expires = client_id, client_secret, None, 0

    def _token(self):
        if self.token and time.time() < self.expires - 60:
            return self.token
        data = urllib.parse.urlencode({"grant_type": "client_credentials", "client_id": self.client_id,
                                       "client_secret": self.client_secret, "scope": "openid"}).encode()
        with urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=data), timeout=60) as r:
            body = json.load(r)
        self.token, self.expires = body["access_token"], time.time() + int(body.get("expires_in", 3600))
        return self.token

    def post(self, path, payload, tries=3):
        for i in range(tries):
            req = urllib.request.Request(f"{API}{path}", data=json.dumps(payload).encode("utf-8"), method="POST",
                                         headers={"Authorization": f"Bearer {self._token()}",
                                                  "Content-Type": "application/json", "Accept": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    return json.load(r)
            except urllib.error.HTTPError as e:
                if e.code == 403:
                    raise SystemExit("Légifrance API: 403 — is the PISTE application subscribed to the Légifrance API "
                                     "(production)? See scripts/prefet/README.md") from e
                if e.code in (429, 500, 502, 503) and i < tries - 1:
                    time.sleep(5 * (i + 1))
                    continue
                raise SystemExit(f"Légifrance API {path}: HTTP {e.code} {e.read().decode('utf-8', 'replace')[:300]}")
            finally:
                time.sleep(0.3)  # stay well under the gateway's rate limit

    def search_titles(self, phrase, start="2007-01-01", end=None, page_size=100):
        """JORF texts whose title contains `phrase` (exact phrase), signed between start and end. Yields result dicts."""
        page = 1
        while True:
            filtres = [{"facette": "DATE_SIGNATURE", "dates": {"start": start, "end": end or time.strftime("%Y-%m-%d")}}]
            body = self.post("/search", {"fond": "JORF", "recherche": {
                "champs": [{"typeChamp": "TITLE", "operateur": "ET",
                            "criteres": [{"typeRecherche": "EXACTE", "valeur": phrase, "operateur": "ET"}]}],
                "filtres": filtres, "pageNumber": page, "pageSize": page_size, "operateur": "ET",
                "sort": "SIGNATURE_DATE_DESC", "typePagination": "DEFAULT"}})
            results = body.get("results") or []
            yield from results
            if page * page_size >= int(body.get("totalResultNumber") or 0) or not results:
                return
            page += 1

    def text(self, cid):
        return self.post("/consult/jorf", {"textCid": cid})


def text_cid(result):
    """JORFTEXT id of a search result (the id sits in its `titles`)."""
    for t in result.get("titles") or []:
        for k in ("cid", "id"):
            if str(t.get(k, "")).startswith("JORFTEXT"):
                return t[k]
    return None


def plain(s):
    """HTML of an article -> plain text."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()
