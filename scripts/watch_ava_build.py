#!/usr/bin/env python3
"""Watch the AVA v0.6.2 GitHub Actions build and report the release assets."""
import json, os, sys, time, urllib.request

REPO = "pvwvuow/ava-voice-assistant"
TAG = "v0.6.2"
SHA_PREFIX = "235fbbe"
TOKEN = os.environ.get("GH_TOKEN", "")
HDR = {"Authorization": f"token {TOKEN}", "Accept": "application/vnd.github+json",
       "User-Agent": "ava-release-watcher"}
BASE = f"https://api.github.com/repos/{REPO}"


def get(url):
    req = urllib.request.Request(url, headers=HDR)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def find_run():
    d = get(f"{BASE}/actions/runs?per_page=10")
    for r in d.get("workflow_runs", []):
        if r.get("head_branch") == TAG and r.get("event") == "push":
            return r
    return None


def release_assets():
    try:
        d = get(f"{BASE}/releases/tags/{TAG}")
        return [(a["name"], a["size"], a["browser_download_url"]) for a in d.get("assets", [])]
    except Exception as e:
        return [("API-ERROR", 0, str(e))]


deadline = time.time() + 500  # ~8.3 min per invocation
run = None
seen = ""
while time.time() < deadline:
    try:
        run = find_run()
        if run:
            status = f"status={run.get('status')} conclusion={run.get('conclusion')}"
            if status != seen:
                print(f"[{time.strftime('%H:%M:%S')}] run {run['id']}: {status}", flush=True)
                seen = status
            if run.get("status") == "completed":
                print("CONCLUSION:", run.get("conclusion"), flush=True)
                if run.get("conclusion") == "success":
                    print("ASSETS:", flush=True)
                    for name, size, url in release_assets():
                        print(f"  - {name} ({size/1048576:.1f} MB)", flush=True)
                sys.exit(0 if run.get("conclusion") == "success" else 2)
        else:
            print(f"[{time.strftime('%H:%M:%S')}] waiting for run to appear...", flush=True)
    except Exception as e:
        print("poll error:", e, flush=True)
    time.sleep(25)

print("TIMEOUT: build still running - run the script again", flush=True)
sys.exit(3)
