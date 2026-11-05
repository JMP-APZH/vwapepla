"""Official portraits for any domain: data/<domain>/media/portraits.yaml -> resized JPEGs in Supabase Storage
+ data/build/<domain>/media.json (rows of the core `media` table, kind 'official_portrait').

Same rules as the mayors' portraits (scripts/communes/pipeline/build_media.py): official source only, credited, removed
on request (media.removed_at); the official page must name the person (`evidence`), never a match by eye. Download with
TLS verified, check it is an image, resize to 600 px on the long side, re-encode as JPEG (drops EXIF/GPS metadata),
name the file by content hash so a changed photo gets a new URL. Idempotent; removals are kept by the upsert.

YAML:
  retrieved: 2026-11-05
  portraits:
    - person_id: "pref:DESPLANQUES:Etienne"         # core persons id, built by the domain pipeline
      institution_id: prefecture-972                # core institutions id
      image_url: https://…/portrait.jpg
      source_page_url: https://…/page-naming-the-person
      credit: "Photo : préfecture de la Martinique"
      evidence: 'Page title "Etienne Desplanques, préfet de la région Martinique" above the photo.'

Run:  python -I scripts/core/media.py --domain prefet            # build data/build/prefet/media.json only
      python -I scripts/core/media.py --domain prefet --upload   # + upload to the 'media' bucket (.env.local)
then: python -I scripts/core/load_supabase.py --domain prefet media
"""
import argparse, hashlib, io, json, pathlib, re, sys, urllib.error, urllib.request

import yaml
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[2]
UA = {"User-Agent": "Mozilla/5.0 (vwapepla.org civic transparency; contact vwapepla.org@gmail.com)"}
MAX = 600
KIND = "official_portrait"
REQUIRED = ("person_id", "institution_id", "image_url", "source_page_url", "credit", "evidence")

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # python -I drops the script dir
from load_supabase import env  # noqa: E402


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def process(raw):
    im = Image.open(io.BytesIO(raw))
    im.load()
    im = im.convert("RGB")
    im.thumbnail((MAX, MAX))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=85, optimize=True, progressive=True)  # no exif= -> metadata dropped
    return buf.getvalue(), im.size


def upload(base, key, path, data):
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "image/jpeg",
               "x-upsert": "true", "Cache-Control": "max-age=31536000"}
    req = urllib.request.Request(f"{base}/storage/v1/object/media/{path}", method="POST", headers=headers, data=data)
    try:
        urllib.request.urlopen(req, timeout=60).read()
    except urllib.error.HTTPError as e:
        sys.exit(f"upload {path}: HTTP {e.code} {e.read().decode('utf-8', 'replace')[:300]}")


def slug(person_id):
    return re.sub(r"[^a-z0-9]+", "-", person_id.lower()).strip("-")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain", required=True)
    ap.add_argument("--upload", action="store_true")
    a = ap.parse_args()
    src = ROOT / "data" / a.domain / "media" / "portraits.yaml"
    cache = ROOT / "data" / "raw" / a.domain / "media"  # gitignored
    out = ROOT / "data" / "build" / a.domain / "media.json"
    doc = yaml.safe_load(src.read_text(encoding="utf-8"))
    persons = {p["id"] for p in json.loads((out.parent / "persons.json").read_text(encoding="utf-8"))}
    cache.mkdir(parents=True, exist_ok=True)
    if a.upload:
        e = env()
        base, key = e["SUPABASE_URL"].rstrip("/"), e["SUPABASE_SECRET_KEY"]
    rows, seen = [], set()
    for p in doc.get("portraits") or []:
        missing = [f for f in REQUIRED if not p.get(f)]
        if missing:
            sys.exit(f"{p.get('person_id')}: missing {missing}")
        if p["person_id"] in seen:
            sys.exit(f"duplicate {p['person_id']}")
        if p["person_id"] not in persons:
            sys.exit(f"{p['person_id']}: not in data/build/{a.domain}/persons.json (run the domain build first)")
        seen.add(p["person_id"])
        name = slug(p["person_id"])
        cached = cache / f"{name}.src"
        raw = cached.read_bytes() if cached.exists() else fetch(p["image_url"])
        cached.write_bytes(raw)
        jpeg, size = process(raw)
        path = f"portraits/{a.domain}/{name}-{hashlib.sha256(jpeg).hexdigest()[:10]}.jpg"
        if a.upload:
            upload(base, key, path, jpeg)
        rows.append({"id": f"{p['person_id']}-{KIND}", "institution_id": p["institution_id"],
                     "person_id": p["person_id"], "kind": KIND, "storage_path": path,
                     "source_page_url": p["source_page_url"], "credit": p["credit"],
                     "retrieved": str(doc["retrieved"]), "note": p["evidence"]})
        print(f"{p['person_id']} {size[0]}x{size[1]} {len(jpeg) // 1024} KB -> {path}{' (uploaded)' if a.upload else ''}")
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(rows)} portraits -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
