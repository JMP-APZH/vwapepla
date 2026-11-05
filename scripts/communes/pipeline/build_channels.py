"""Town-hall communication channels (Step 4): data/communes/audit/channels/<insee>.yaml
-> data/build/communes/com_channel_observations.json

Validates every entry (exit 1 on error). Only entries with observed_on AND reviewed_by are exported: drafts (pre-filled
from the official websites, or not yet reviewed by JM) never reach the public table.
Screenshots stay out of git, in data/raw/communes/channels-evidence/ (gitignored); the YAML holds their path (relative
to that folder) and sha256, checked here when the file is present.
Run: python -I scripts/communes/pipeline/build_channels.py
     python -I scripts/core/load_supabase.py --domain communes com_channel_observations
"""
import datetime, hashlib, json, pathlib, re, sys

import yaml

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[3]
SRC, BUILD = ROOT / "data" / "communes" / "audit" / "channels", ROOT / "data" / "build" / "communes"
EVIDENCE = ROOT / "data" / "raw" / "communes" / "channels-evidence"
PLATFORMS = {"facebook", "instagram", "tiktok", "youtube", "whatsapp_channel"}
OFFICIAL = {"yes", "no", "doubtful"}
BASIS = {"linked_from_site", "platform_verified", "town_hall_confirmed", "none"}
STREAMED = {"yes", "no", "unknown"}
REVIEWERS = {"JM"}  # JM, 5 Nov 2026: only JM reviews
FIELDS = ["account_url", "account_name", "official", "official_basis", "official_evidence_url", "last_post_date",
          "posts_last_90_days", "council_meetings_streamed", "council_stream_evidence_url", "followers",
          "followers_display", "searched_on", "search_note", "observer", "reviewed_by", "note"]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def as_date(v):
    if v in (None, ""):
        return None
    return v if isinstance(v, datetime.date) else datetime.date.fromisoformat(str(v))


def check(o, where, today):
    """Errors of one entry (empty list = valid). Drafts are checked only for what they already contain."""
    e = []
    if o.get("platform") not in PLATFORMS:
        e.append(f"unknown platform {o.get('platform')!r}")
    for k in ("observed_on", "last_post_date", "searched_on", "link_seen_on"):
        try:
            d = as_date(o.get(k))
        except ValueError:
            e.append(f"{k}: not a date")
            continue
        if d and d > today:
            e.append(f"{k} in the future")
    if o.get("official") is not None and o["official"] not in OFFICIAL:
        e.append("official must be yes / no / doubtful")
    if o.get("official_basis") is not None and o["official_basis"] not in BASIS:
        e.append(f"official_basis must be one of {sorted(BASIS)}")
    if o.get("official") == "yes":
        if o.get("official_basis") in (None, "none"):
            e.append("official: yes needs an official_basis")
        if o.get("official_basis") == "linked_from_site" and not o.get("official_evidence_url"):
            e.append("linked_from_site needs official_evidence_url")
    if o.get("council_meetings_streamed") is not None and o["council_meetings_streamed"] not in STREAMED:
        e.append("council_meetings_streamed must be yes / no / unknown")
    if o.get("council_meetings_streamed") == "yes" and not o.get("council_stream_evidence_url"):
        e.append("council_meetings_streamed: yes needs council_stream_evidence_url")
    for k in ("posts_last_90_days", "followers"):
        if o.get(k) is not None and (not isinstance(o[k], int) or o[k] < 0):
            e.append(f"{k} must be a whole number >= 0")
    sha = o.get("screenshot_sha256")
    if sha is not None and not re.fullmatch(r"[0-9a-f]{64}", str(sha)):
        e.append("screenshot_sha256 must be 64 lowercase hex characters")
    shot = o.get("screenshot")
    if shot:
        if pathlib.PurePosixPath(shot).is_absolute() or ".." in pathlib.PurePosixPath(shot).parts:
            e.append("screenshot: path relative to data/raw/communes/channels-evidence/")
        elif (EVIDENCE / shot).exists() and sha and sha256(EVIDENCE / shot) != sha:
            e.append(f"screenshot {shot}: sha256 does not match the file")
    if o.get("observed_on"):  # a completed observation
        if not o.get("observer"):
            e.append("observed_on set but no observer")
        if o.get("account_url"):
            if not shot or not sha:
                e.append("an observed account needs screenshot + screenshot_sha256")
            if o.get("official") is None:
                e.append("an observed account needs official: yes / no / doubtful")
        elif not o.get("searched_on") or not o.get("search_note"):
            e.append("'no account found' needs searched_on + search_note")
    if o.get("reviewed_by") and o["reviewed_by"] not in REVIEWERS:
        e.append(f"reviewed_by must be one of {sorted(REVIEWERS)}")
    if o.get("reviewed_by") and not o.get("observed_on"):
        e.append("reviewed_by set on an entry that has no observed_on")
    return [f"{where}: {x}" for x in e]


def row_id(code, o):
    url = o.get("account_url") or "none"
    return f"{code}-{o['platform']}-{as_date(o['observed_on']).isoformat()}-{hashlib.sha1(url.encode()).hexdigest()[:8]}"


def main(today=None):
    today = today or datetime.date.today()
    errors, rows, drafts = [], {}, 0
    for f in sorted(SRC.glob("972*.yaml")):
        doc = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
        code = str(doc.get("commune", ""))
        if code != f.stem:
            errors.append(f"{f.name}: commune {code!r} does not match the file name")
            continue
        for i, o in enumerate(doc.get("observations") or [], 1):
            errs = check(o, f"{f.name} #{i} ({o.get('platform')})", today)
            errors += errs
            if errs or not (o.get("observed_on") and o.get("reviewed_by")):
                drafts += not errs
                continue
            rid = row_id(code, o)
            if rid in rows:
                errors.append(f"{f.name} #{i}: duplicate observation {rid}")
            rows[rid] = {"id": rid, "commune_code": code, "platform": o["platform"],
                         "observed_on": as_date(o["observed_on"]).isoformat(),
                         **{k: (as_date(o.get(k)).isoformat() if k in ("last_post_date", "searched_on") and o.get(k)
                                else o.get(k)) for k in FIELDS},
                         "screenshot_path": o.get("screenshot"), "screenshot_sha256": o.get("screenshot_sha256")}
    if errors:
        print("ERRORS:\n  " + "\n  ".join(errors))
        sys.exit(1)
    BUILD.mkdir(parents=True, exist_ok=True)
    out = sorted(rows.values(), key=lambda r: r["id"])
    (BUILD / "com_channel_observations.json").write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"com_channel_observations: {len(out)} reviewed observation(s) exported, {drafts} draft(s) kept back")


if __name__ == "__main__":
    main()
