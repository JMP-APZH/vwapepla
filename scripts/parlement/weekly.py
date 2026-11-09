"""Weekly rebuild of the parlement domain (JM, 5 Nov 2026, Q10): download → build → load → prune, one step at a time.

- Downloads, each job in its own process (`download_sources.py --only <job>`), amendments last:
  every job of the current terms, every week; the closed legislatures' archives (XIV-XVI) only when they are missing
  from the manifest (first run, or a file the archive server would not deliver, e.g. an-amendements-15).
- build.py: its checks stop the run (exit 1) before anything is loaded.
- load_supabase.py --domain parlement, then prune.py (B2's own stale rows only).
A failed download does not stop the run: the build uses the previous file of that job (its own retrieval date stays on
the cards) or states the gap. A failed current-term download makes the run exit 1 at the end, so it shows (GitHub
Actions emails the owner); a closed-legislature archive still missing is only reported (it is a stated data gap).

Run: python -I scripts/parlement/weekly.py [--dry-run]   (--dry-run: print the jobs, run nothing)
"""
import json, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PY = [sys.executable, "-I"]
CLOSED = ("-14", "-15", "-16")  # closed legislatures: their archives never change


def jobs():
    sys.path.insert(0, str(ROOT / "scripts" / "core"))
    import download_sources  # noqa: E402
    return [j["id"] for j in download_sources.load_jobs("parlement")]


def closed(job):
    return any(job.endswith(s) or f"{s}-" in job for s in CLOSED)


def run(*args):
    print(f"\n$ {' '.join(args)}", flush=True)
    return subprocess.run([*PY, *args], cwd=ROOT).returncode


def main():
    manifest_path = ROOT / "data" / "raw" / "parlement" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    todo = [j for j in jobs() if not closed(j) or j not in manifest]
    todo.sort(key=lambda j: "amendements" in j)  # stable: amendments last, otherwise the JOBS order
    print("jobs:", ", ".join(todo))
    if "--dry-run" in sys.argv:
        return
    failed = [j for j in todo if run("scripts/core/download_sources.py", "--domain", "parlement", "--only", j) != 0]
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
