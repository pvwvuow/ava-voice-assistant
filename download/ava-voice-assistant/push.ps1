# ============================================================
#  AVA Voice Assistant  -  One-Command Git Publisher
#  ------------------------------------------------------------
#  Normal push:          .\push.ps1 "my update message"
#  Push + new release:   .\push.ps1 "my update message" -Release
#
#  What it does automatically:
#   1. Reads your GitHub remote and injects the correct
#      "repository" field into package.json
#      (this fixes the electron-builder error:
#       "Cannot detect repository by .git/config")
#   2. Syncs .gitignore and the CI workflow to the repo root
#   3. Never tracks node_modules / dist
#   4. Commits (default message = date/time) and pushes
#   5. With -Release: tags the version from package.json
#      (e.g. v0.3.0) so GitHub Actions builds the installer
#      and publishes it to GitHub Releases automatically
#
#  Tip: use push.cmd if PowerShell blocks scripts:
#       .\push.cmd "my update" -Release
# ============================================================
param(
  [Parameter(Position = 0)]
  [string]$Message = "",
  [switch]$Release
)

Set-Location $PSScriptRoot

function Fail($m) { Write-Host "[X] $m" -ForegroundColor Red;   exit 1 }
function Ok($m)   { Write-Host "[OK] $m" -ForegroundColor Green }
function Info($m) { Write-Host "[i]  $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "[!]  $m" -ForegroundColor Yellow }

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
  Fail "This folder is not inside a git repository. One-time setup:`n    git init`n    git remote add origin https://github.com/USERNAME/ava-voice-assistant.git"
}

$remote = git remote get-url origin 2>$null
if (-not $remote) {
  Fail "No 'origin' remote found. One-time setup:`n    git remote add origin https://github.com/USERNAME/ava-voice-assistant.git"
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
if ($Release) {
  $ver = (node -p "require('./package.json').version")
  $tag = "v$ver"
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
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
