"""Weekly rebuild of the parlement domain (JM, 5 Nov 2026, Q10): download → build → load → prune, one step at a time.

- Downloads, each job in its own process (`download_sources.py --only <job>`), amendments last:
  every job of the current terms, every week; the closed legislatures' archives (XIV-XVI) only when they are missing
  from the manifest (first run, or a file the archive server would not deliver, e.g. an-amendements-15).
  Closed archives share a time budget (--closed-budget-minutes, default 100): once it is spent, the closed archives
  still missing are left for next week, so the build, load and prune fit in the CI job limit.
- Guard before the build: a closed legislature's amendments archive that is missing but whose rows are already online
  stops the run (exit 1). Otherwise build.py would state those amendments as « pas encore chargés » and the load would
  put that gap online next to the rows. An archive with nothing online (an-amendements-15) only keeps its gap.
  Other closed archives need no guard: build.py stops when one of them is missing, before anything is loaded.
- build.py: its checks stop the run (exit 1) before anything is loaded.
- load_supabase.py --domain parlement, then prune.py (B2's own stale rows only).
A failed download does not stop the run: the build uses the previous file of that job (its own retrieval date stays on
the cards) or states the gap. A failed current-term download makes the run exit 1 at the end, so it shows (GitHub
Actions emails the owner); a closed-legislature archive still missing is only reported (it is a stated data gap).

Run: python -I scripts/parlement/weekly.py [--dry-run] [--download-only | --skip-download] [--closed-budget-minutes N]
  --dry-run        print the jobs and the guard's decision, download and write nothing
  --download-only  downloads only (CI step 1: the cache of data/raw/parlement is saved after it, even if a later step
                   fails); the failed jobs are kept in data/raw/parlement/weekly-failed.json for step 2
  --skip-download  guard, build, load, prune on the files already there (CI step 2)
"""
import json, pathlib, subprocess, sys, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "parlement"
FAILED = RAW / "weekly-failed.json"
PY = [sys.executable, "-I"]
CLOSED = ("-14", "-15", "-16")  # closed legislatures: their archives never change


def jobs():
    sys.path.insert(0, str(ROOT / "scripts" / "core"))
    import download_sources  # noqa: E402
    return [j["id"] for j in download_sources.load_jobs("parlement")]


def closed(job):
    return any(job.endswith(s) or f"{s}-" in job for s in CLOSED)


def manifest():
    path = RAW / "manifest.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def run(*args):
    print(f"\n$ {' '.join(args)}", flush=True)
    return subprocess.run([*PY, *args], cwd=ROOT).returncode


def option(name, default):
    return int(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default


def public_env():
    vals = {}
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"')
    return vals["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/"), vals["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]


def online_amendments(leg):
    """True when AN amendments of this legislature are online (public read, one row at most)."""
    base, key = public_env()
    req = urllib.request.Request(f"{base}/rest/v1/parl_amendments?select=id&chamber=eq.AN&legislature=eq.{leg}&limit=1",
                                 headers={"apikey": key})
    with urllib.request.urlopen(req, timeout=60) as r:
        return bool(json.loads(r.read()))


def guard():
    """Closed amendments archives missing locally but loaded online: building now would hide them behind a gap."""
    have = manifest()
    blocked = []
    for job in jobs():
        if job.startswith("an-amendements-") and closed(job) and job not in have:
            leg = job.rsplit("-", 1)[1]
            on = online_amendments(leg)
            print(f"guard: {job} missing here, {'rows online: stop' if on else 'nothing online: its gap stays'}")
            if on:
                blocked.append(job)
    return blocked


def download(todo, budget_min, dry):
    start, failed, skipped = time.monotonic(), [], []
    for j in todo:
        spent = (time.monotonic() - start) / 60
        if closed(j) and spent > budget_min:
            skipped.append(j)
            continue
        if dry:
            continue
        if run("scripts/core/download_sources.py", "--domain", "parlement", "--only", j) != 0:
            failed.append(j)
    if skipped:
        print(f"\nclosed-archive budget ({budget_min} min) spent, left for next week: {', '.join(skipped)}")
    return failed + skipped


def main():
    dry = "--dry-run" in sys.argv
    have = manifest()
    todo = [j for j in jobs() if not closed(j) or j not in have]
    todo.sort(key=lambda j: "amendements" in j)  # stable: amendments last, otherwise the JOBS order
    print("jobs:", ", ".join(todo))
    if "--skip-download" in sys.argv:
        failed = json.loads(FAILED.read_text(encoding="utf-8")) if FAILED.exists() else []
    else:
        failed = download(todo, option("--closed-budget-minutes", 100), dry)
        if not dry:
            RAW.mkdir(parents=True, exist_ok=True)
            FAILED.write_text(json.dumps(failed), encoding="utf-8")
        if "--download-only" in sys.argv:
            print(f"\ndownloads done; failed or left: {', '.join(failed) or 'none'}")
            return
    blocked = guard()
    if dry:
        return
    if blocked:
        sys.exit(f"stopped before the build: {', '.join(blocked)} missing here but loaded online "
                 "(retried next week; the online data is unchanged)")
    for step in (["scripts/parlement/build.py"], ["scripts/core/load_supabase.py", "--domain", "parlement"],
                 ["scripts/parlement/prune.py"]):
        if run(*step) != 0:
            sys.exit(f"stopped at {step[0]}" + (f" (downloads failed: {', '.join(failed)})" if failed else ""))
    missing = [j for j in failed if closed(j)]
    if missing:
        print(f"\narchives still missing (stated as data gaps, retried next week): {', '.join(missing)}")
    if any(not closed(j) for j in failed):
        sys.exit(f"done, but current-term downloads failed (previous file used): {', '.join(j for j in failed if not closed(j))}")
    print("\ndone")


if __name__ == "__main__":
    main()
