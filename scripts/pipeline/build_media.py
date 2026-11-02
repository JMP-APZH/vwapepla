"""Mayor portraits: data/media/portraits.yaml -> resized JPEGs in Supabase Storage + data/build/media.json.

For each entry: download the official image (TLS verified), check it is an image, resize to 600 px on the long side,
re-encode as JPEG (drops EXIF/GPS metadata), name it by content hash so a changed photo gets a new URL.
Idempotent: same source image -> same file name; existing removals (media.removed_at) are kept by the upsert.

Run:  python -I scripts/pipeline/build_media.py            # build data/build/media.json only
      python -I scripts/pipeline/build_media.py --upload   # + upload files to the 'media' bucket (.env.local)
then: python -I scripts/pipeline/load_supabase.py media
"""
import hashlib, io, json, pathlib, sys, urllib.error, urllib.request

import yaml
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "media" / "portraits.yaml"
CACHE = ROOT / "data" / "raw" / "media"  # gitignored
OUT = ROOT / "data" / "build" / "media.json"
UA = {"User-Agent": "Mozilla/5.0 (vwapepla.org civic transparency; contact vwapepla.org@gmail.com)"}
MAX = 600

sys.path.insert(0, str(pathlib.Path(__file__).parent))
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


def main():
    doc = yaml.safe_load(SRC.read_text(encoding="utf-8"))
    CACHE.mkdir(parents=True, exist_ok=True)
    do_upload = "--upload" in sys.argv
    if do_upload:
        e = env()
        base, key = e["SUPABASE_URL"].rstrip("/"), e["SUPABASE_SECRET_KEY"]
    rows, seen = [], set()
    for p in doc["portraits"]:
        code = p["commune_code"]
        assert code not in seen, f"duplicate {code}"
        seen.add(code)
        for f in ("image_url", "source_page_url", "credit", "evidence"):
            assert p.get(f), f"{code}: missing {f}"
        cached = CACHE / f"{code}.src"
        raw = cached.read_bytes() if cached.exists() else fetch(p["image_url"])
        cached.write_bytes(raw)
        jpeg, size = process(raw)
        path = f"portraits/{code}-{hashlib.sha256(jpeg).hexdigest()[:10]}.jpg"
        if do_upload:
            upload(base, key, path, jpeg)
        rows.append({
            "id": f"{code}-mayor_portrait", "commune_code": code, "kind": "mayor_portrait", "storage_path": path,
            "source_page_url": p["source_page_url"], "credit": p["credit"], "retrieved": str(doc["retrieved"]),
            "note": p["evidence"],
        })
        print(f"{code} {size[0]}x{size[1]} {len(jpeg) // 1024} KB -> {path}{' (uploaded)' if do_upload else ''}")
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(rows)} portraits -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
