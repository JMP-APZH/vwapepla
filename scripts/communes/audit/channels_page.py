"""Build the observer page for the town-hall social networks (Step 4) -> data/build/communes/channels-observer.html
(gitignored).

One card per commune and platform, pre-filled from data/communes/audit/channels/<insee>.yaml (accounts linked from the
official websites). The observer looks at each account by hand in a normal browser (no scraping, no unofficial API),
types what they see, and copies the result as plain text; scripts/communes/audit/apply_channels.py writes it back
into the YAML files. Screenshots never go through the page: the observer saves them under
data/raw/communes/channels-evidence/<insee>/<yyyy-mm-dd>-<platform>.png (gitignored) and apply_channels.py adds
their sha256. The page holds drafts: it is published as a private artifact for the team, never inside the public app.
Run: python -I scripts/communes/audit/channels_page.py
"""
import json, pathlib, sys

import yaml

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[3]
CHANNELS = ROOT / "data" / "communes" / "audit" / "channels"
SITES = ROOT / "data" / "communes" / "audit" / "sites"
TEMPLATE = pathlib.Path(__file__).with_name("channels_page.html")
OUT = ROOT / "data" / "build" / "communes" / "channels-observer.html"
PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "whatsapp_channel"]


def main():
    communes = []
    for f in sorted(SITES.glob("972*.yaml")):  # the 34 communes, with their names
        site = yaml.safe_load(f.read_text(encoding="utf-8"))
        ch = CHANNELS / f.name
        doc = yaml.safe_load(ch.read_text(encoding="utf-8")) if ch.exists() else None
        obs = (doc or {}).get("observations") or []
        prefill = {}
        for o in obs:  # the latest entry per platform; completed ones are shown as « déjà relevé le … »
            p = o.get("platform")
            if p in PLATFORMS:
                prefill[p] = {k: (str(v) if v is not None else None) for k, v in o.items()
                              if k in ("account_url", "official", "official_basis", "official_evidence_url", "observed_on")}
        communes.append({"code": f.stem, "name": site["commune"], "site": site.get("site_url"), "prefill": prefill})
    data = json.dumps({"platforms": PLATFORMS, "communes": communes}, ensure_ascii=False)
    html = TEMPLATE.read_text(encoding="utf-8").replace("/*DATA*/null", data.replace("</", "<\\/"))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    filled = sum(len(c["prefill"]) for c in communes)
    print(f"{OUT.relative_to(ROOT)} · {len(communes)} communes · {filled} pre-filled account(s)")


if __name__ == "__main__":
    main()
