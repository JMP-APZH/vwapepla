"""Apply an observer's batch (text copied from the observer page, channels_page.py) to
data/communes/audit/channels/<insee>.yaml.

Each line after the header "vwapepla-channels v1" is one observation (JSON). A draft entry of the same platform
(pre-filled, never observed) is completed in place; otherwise the observation is appended as a new entry: a completed
observation is never edited, so the history is kept. The screenshot's sha256 is added when the file is present under
data/raw/communes/channels-evidence/ (gitignored); without it the entry stays incomplete and build_channels.py says so.
reviewed_by is never set here: only JM reviews (build_channels.py REVIEWERS).
Run: python -I scripts/communes/audit/apply_channels.py batch.txt   (or pipe the text on stdin)
     python -I scripts/communes/pipeline/build_channels.py
"""
import hashlib, json, pathlib, re, sys

import yaml

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[3]
CHANNELS = ROOT / "data" / "communes" / "audit" / "channels"
EVIDENCE = ROOT / "data" / "raw" / "communes" / "channels-evidence"
HEADER = "vwapepla-channels v1"
ORDER = ["platform", "account_url", "account_name", "official", "official_basis", "official_evidence_url", "link_seen_on",
         "last_post_date", "posts_last_90_days", "council_meetings_streamed", "council_stream_evidence_url", "followers",
         "followers_display", "searched_on", "search_note", "screenshot", "screenshot_sha256", "observer", "observed_on",
         "reviewed_by", "note"]
ALLOWED = set(ORDER) - {"link_seen_on", "screenshot_sha256", "reviewed_by"}


def parse(text):
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines or lines[0] != HEADER:
        sys.exit(f"the text must start with the line « {HEADER} » (copied from the observer page)")
    out = []
    for n, line in enumerate(lines[1:], 2):
        try:
            o = json.loads(line)
        except json.JSONDecodeError as e:
            sys.exit(f"line {n}: not valid JSON ({e})")
        if not re.fullmatch(r"972\d\d", str(o.get("commune", ""))):
            sys.exit(f"line {n}: unknown commune {o.get('commune')!r}")
        if not re.fullmatch(r"[A-Z]{1,6}", str(o.get("observer", ""))):
            sys.exit(f"line {n}: observer must be initials (1-6 capital letters)")
        out.append(o)
    return out


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ordered(o):
    return {k: o.get(k) for k in ORDER if k in o or k in ("reviewed_by",)}


def apply(batch):
    by_file, report = {}, []
    for o in batch:
        code = o["commune"]
        path = CHANNELS / f"{code}.yaml"
        if code not in by_file:
            text = path.read_text(encoding="utf-8") if path.exists() else ""
            head = "".join(l for l in text.splitlines(keepends=True) if l.startswith("#")) if text else ""
            doc = yaml.safe_load(text) if text else None
            by_file[code] = (path, head, doc or {"commune": code, "observations": []})
        _, _, doc = by_file[code]
        obs = doc.setdefault("observations", []) or []
        doc["observations"] = obs
        entry = {k: v for k, v in o.items() if k in ALLOWED}
        if entry.get("account_url") is None:
            entry["screenshot"] = None
        shot = entry.get("screenshot")
        entry["screenshot_sha256"] = sha256(EVIDENCE / shot) if shot and (EVIDENCE / shot).exists() else None
        entry["reviewed_by"] = None
        draft = next((d for d in obs if d.get("platform") == entry["platform"] and not d.get("observed_on")
                      and (not d.get("account_url") or not entry.get("account_url")
                           or d["account_url"].rstrip("/") == entry["account_url"].rstrip("/"))), None)
        if draft is not None:
            keep = {k: draft.get(k) for k in ("link_seen_on",) if draft.get(k)}
            draft.clear()
            draft.update(ordered({**entry, **keep}))
            how = "completed draft"
        else:
            obs.append(ordered(entry))
            how = "new entry"
        missing = " · screenshot missing" if shot and not entry["screenshot_sha256"] else ""
        report.append(f"{code} {entry['platform']}: {how}{missing}")
    for path, head, doc in by_file.values():
        body = yaml.safe_dump(doc, allow_unicode=True, sort_keys=False, width=120)
        path.write_text(head + body, encoding="utf-8")
    return report


def main():
    text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8") if len(sys.argv) > 1 else sys.stdin.read()
    report = apply(parse(text))
    print("\n".join(report))
    print(f"{len(report)} observation(s) applied. Next: python -I scripts/communes/pipeline/build_channels.py")


if __name__ == "__main__":
    main()
