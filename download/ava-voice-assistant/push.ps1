# ============================================================
#  AVA Voice Assistant  -  One-Command Git Publisher
#  ------------------------------------------------------------
#  Normal push:          .\push.ps1 "my update message"
#  Push + new release:   .\push.ps1 "my update message" -Release
#  Release + custom ver: .\push.ps1 "my update" -Release -Version 0.5.0
#
#  What it does automatically:
#   1. Reads your GitHub remote and injects the correct
#      "repository" field into package.json
#      (fixes electron-builder "Cannot detect repository")
#   2. Warns if a wrong git proxy is configured
#      (fixes "Failed to connect to github.com port 443")
#   3. Syncs .gitignore and the CI workflow to the repo root
#   4. Never tracks node_modules / dist
#   5. Commits (default message = date/time) and pushes
#   6. With -Release: bumps the patch version in package.json
#      (0.4.0 -> 0.4.1) or uses -Version, then tags vX.Y.Z so
#      GitHub Actions builds the installer and publishes it
#      to GitHub Releases automatically
#
#  Tip: use push.cmd if PowerShell blocks scripts:
#       .\push.cmd "my update" -Release
# ============================================================
param(
  [Parameter(Position = 0)]
  [string]$Message = "",
  [switch]$Release,
  [string]$Version = ""
)

Set-Location $PSScriptRoot

function Fail($m) { Write-Host "[X] $m" -ForegroundColor Red;   exit 1 }
function Ok($m)   { Write-Host "[OK] $m" -ForegroundColor Green }
function Info($m) { Write-Host "[i]  $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "[!]  $m" -ForegroundColor Yellow }

function Get-PkgVersion {
  if (Get-Command node -ErrorAction SilentlyContinue) {
    return ((node -p "require('./package.json').version").Trim())
  }
  $raw = Get-Content package.json -Raw
  if ($raw -match '"version"\s*:\s*"([^"]+)"') { return $Matches[1] }
  return "0.0.0"
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor DarkGray
Write-Host "  AVA - auto push to GitHub"                    -ForegroundColor DarkGray
Write-Host "=============================================" -ForegroundColor DarkGray

# ---------- 1) git + remote checks ----------
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Fail "git not found. Install it from https://git-scm.com then run again."
}

$root = git rev-parse --show-toplevel 2>$null
if (-not $root) {
  Fail "This folder is not inside a git repository. One-time setup:`n    git init`n    git remote add origin https://github.com/pvwvuow/ava-voice-assistant.git"
}

$remote = git remote get-url origin 2>$null
if (-not $remote) {
  Fail "No 'origin' remote found. One-time setup:`n    git remote add origin https://github.com/pvwvuow/ava-voice-assistant.git"
}
Info "remote: $remote"

# ---------- 2) auto-fix "repository" in package.json ----------
$slug = $null
if ($remote -match 'github\.com[/:]') {
  $slug = ($remote -replace '\.git\s*$', '') -replace '^.*github\.com[/:]', ''
  if (Get-Command node -ErrorAction SilentlyContinue) {
    $env:AVA_REPO_URL = "https://github.com/$slug.git"
    node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.repository={type:'git',url:process.env.AVA_REPO_URL};p.build=p.build||{};p.build.publish={provider:'github'};fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"
    if ($LASTEXITCODE -eq 0) { Ok "package.json repository -> $env:AVA_REPO_URL" }
    else { Warn "could not update package.json (node error) - CI will fix it anyway" }
  } else {
    Warn "node not found - skipping package.json fix (GitHub Actions will fix it automatically)"
  }
} else {
  Warn "remote is not GitHub - skipping repository auto-fix"
}

# ---------- 2b) git proxy check (past incident: wrong proxy blocked github.com:443) ----------
$proxy = git config --get http.proxy 2>$null
if ($proxy) {
  Warn "git http.proxy is set to '$proxy'"
  Warn "if push fails with 'Failed to connect to github.com port 443', run:"
  Warn "    git config --global --unset http.proxy"
}

# ---------- 2c) release: bump version BEFORE commit ----------
$newVer = $null
if ($Release) {
  $cur = Get-PkgVersion
  if ($Version) {
    $newVer = $Version
  } else {
    $parts = $cur.Split('.')
    if ($parts.Count -eq 3) {
      $parts[2] = [string]([int]$parts[2] + 1)
      $newVer = ($parts -join '.')
    } else { $newVer = $cur }
  }
  if (Get-Command node -ErrorAction SilentlyContinue) {
    $env:AVA_VER = $newVer
    node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version=process.env.AVA_VER;fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"
    if ($LASTEXITCODE -eq 0) { Ok "version: $cur -> $newVer (written to package.json)" }
    else { Warn "could not bump version - will tag as v$cur"; $newVer = $cur }
  } else {
    Warn "node not found - version stays $cur"
    $newVer = $cur
  }
  if (-not $Message) { $Message = "Release v$newVer" }
}

# ---------- 3) sync .gitignore + CI workflow to repo root ----------
$gi = Join-Path $PSScriptRoot '.gitignore'
if (Test-Path $gi) { Copy-Item $gi (Join-Path $root '.gitignore') -Force }

$wfSrc = Join-Path $PSScriptRoot '.github\workflows\build.yml'
$wfDir = Join-Path $root '.github\workflows'
if (Test-Path $wfSrc) {
  New-Item -ItemType Directory -Force -Path $wfDir | Out-Null
  Copy-Item $wfSrc $wfDir -Force
  Ok "CI workflow synced to repo root (.github/workflows/build.yml)"
}
Get-ChildItem $wfDir -Filter *.yml -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne 'build.yml' } |
  ForEach-Object {
    Warn "old workflow '$($_.Name)' found in repo - delete it to avoid double builds:"
    Warn "    git rm .github/workflows/$($_.Name)  then run push again"
  }

# ---------- 4) never track heavy folders ----------
if (Test-Path 'node_modules') { git rm -r --cached node_modules --quiet 2>$null }
if (Test-Path 'dist')         { git rm -r --cached dist --quiet 2>$null }

# ---------- 5) commit ----------
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Info "nothing new to commit"
} else {
  if (-not $Message) { $Message = "Update " + (Get-Date -Format 'yyyy-MM-dd HH:mm') }
  git commit --quiet -m "$Message"
  if ($LASTEXITCODE -eq 0) { Ok "committed: $Message" }
  else { Fail "commit failed" }
}

# ---------- 6) push ----------
$branch = git rev-parse --abbrev-ref HEAD 2>$null
if (-not $branch) { $branch = 'main' }

git pull --rebase origin $branch 2>$null
if ($LASTEXITCODE -ne 0) { Warn "pull failed (first push? no upstream yet) - continuing" }

git push -u origin $branch
if ($LASTEXITCODE -ne 0) {
  Fail "push failed - check your internet / GitHub login. Try:  gh auth login"
}
Ok "pushed to origin/$branch"

# ---------- 7) optional: tag + release ----------
if ($Release -and $newVer) {
  $tag = "v$newVer"
  git tag -d $tag 2>$null
  git push origin ":refs/tags/$tag" 2>$null
  git tag $tag
  git push origin $tag
  if ($LASTEXITCODE -ne 0) { Fail "tag push failed" }
  Ok "tag $tag pushed"

  Write-Host ""
  Info "GitHub Actions is now building the Windows installer (~5 min)"
  Info "watch it here: https://github.com/$slug/actions"
  Info "users download from: https://github.com/$slug/releases/latest"
  Info "installed apps update themselves automatically (electron-updater)"
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
