"""Print the sha256 of evidence files (screenshots) to paste into data/communes/audit/channels/<insee>.yaml.

Screenshots live in data/raw/communes/channels-evidence/ (gitignored, never committed): name them
<insee>/<yyyy-mm-dd>-<platform>.png. The path printed is relative to that folder, as the YAML expects.
Run: python -I scripts/communes/audit/evidence_hash.py data/raw/communes/channels-evidence/97209/2026-11-05-facebook.png
"""
import hashlib, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "data" / "raw" / "communes" / "channels-evidence"

for arg in sys.argv[1:] or sys.exit(__doc__):
    p = pathlib.Path(arg).resolve()
    h = hashlib.sha256(p.read_bytes()).hexdigest()
    try:
        rel = p.relative_to(EVIDENCE).as_posix()
    except ValueError:
        rel = f"(outside {EVIDENCE.relative_to(ROOT).as_posix()}/ — move it there first) {p.name}"
    print(f"screenshot: {rel}\nscreenshot_sha256: {h}\n")
