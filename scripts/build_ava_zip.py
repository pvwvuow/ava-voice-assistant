#!/usr/bin/env python3
"""Build the AVA release ZIP from the working tree (mirrors HEAD commit)."""
import os, zipfile, json, sys

SRC = "/home/z/my-project/download/ava-voice-assistant"
OUT = "/home/z/my-project/download/ava-voice-assistant-v0.7.0.zip"
SKIP_DIRS = {"node_modules", "dist", ".git"}
SKIP_FILES = {".DS_Store", "Thumbs.db"}

if os.path.exists(OUT):
    os.remove(OUT)

count = 0
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f in SKIP_FILES:
                continue
            full = os.path.join(root, f)
            rel = os.path.relpath(full, SRC)
            z.write(full, rel)
            count += 1

# verify
z = zipfile.ZipFile(OUT)
names = z.namelist()
need = ["release.ps1", "runmetocreateexeforyou.bat", "push.cmd", "push.ps1",
        ".github/workflows/build.yml", ".gitignore", "package.json",
        "main.js", "preload.js", "renderer/index.html",
        "renderer/js/app.js", "renderer/css/styles.css",
        "assets/icon.ico", "LICENSE", "README.md"]
missing = [k for k in need if k not in names]
pkg = json.loads(z.read("package.json"))
ps1 = z.read("release.ps1").decode("utf-8", "ignore")

print("entries:", len(names), "(walked", count, ")")
print("zip version:", pkg["version"])
print("release.ps1 has loop-bump:", "while (TagTaken $tag)" in ps1)
appjs = z.read("renderer/js/app.js").decode("utf-8", "ignore")
mnjs = z.read("main.js").decode("utf-8", "ignore")
print("audio fix (getByteFrequencyData):", "getByteFrequencyData" in appjs)
print("UA fix (CHROME_UA):", "CHROME_UA" in mnjs)
print("missing:", missing if missing else "NONE")
print("size:", os.path.getsize(OUT), "bytes")
sys.exit(1 if missing else 0)
