"""One-off: move the pre-domain raw files (data/raw/<folder>/, data/raw/manifest.json) into data/raw/communes/.

Keeps retrieval dates and checksums (no re-download): files are moved, manifest paths rewritten, `domain` added.
Safe to re-run: does nothing once data/raw/manifest.json is gone. data/raw/ is gitignored, so this only touches
the local copy. Run: python -I scripts/core/migrate_raw_layout.py
"""
import json, pathlib, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
DEST = RAW / "communes"
DOMAINS = {"communes", "parlement", "ctm", "prefet"}


def main():
    old = RAW / "manifest.json"
    if not old.exists():
        print("nothing to migrate (data/raw/manifest.json not found)")
        return
    if (DEST / "manifest.json").exists():
        sys.exit("data/raw/communes/manifest.json already exists: merge by hand")
    DEST.mkdir(parents=True, exist_ok=True)
    for d in sorted(p for p in RAW.iterdir() if p.is_dir() and p.name not in DOMAINS):
        shutil.move(str(d), str(DEST / d.name))
        print(f"moved data/raw/{d.name}/ -> data/raw/communes/{d.name}/")
    manifest = json.loads(old.read_text(encoding="utf-8"))
    for m in manifest.values():
        m["file"] = m["file"].replace("data/raw/", "data/raw/communes/", 1)
        m["domain"] = "communes"
        if not (ROOT / m["file"]).exists():
            sys.exit(f"missing after move: {m['file']}")
    (DEST / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    old.unlink()
    print(f"manifest: {len(manifest)} datasets -> data/raw/communes/manifest.json")


if __name__ == "__main__":
    main()
