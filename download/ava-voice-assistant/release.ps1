# ============================================================
#  AVA Voice Assistant - Release Script (called by runmetocreateexeforyou.bat)
#  - Fixes broken git proxy settings
#  - Syncs the repository URL from the real remote
#  - Commits everything, keeps "version" in package.json in sync
#    with the release tag (auto-bumps patch if the tag already exists)
#  - Pushes main + tag -> GitHub Actions builds the EXE installer
#    and publishes it on GitHub Releases (in-app updater reads it)
#  ASCII only - safe for Windows PowerShell 5.1
# ============================================================
param([string]$Message = "")

$RepoUrl = "https://github.com/pvwvuow/ava-voice-assistant.git"
Set-Location -Path $PSScriptRoot

function Fail($m) {
  Write-Host "  [ERROR] $m" -ForegroundColor Red
  exit 1
}

# ---------- 0) proxy guard (the old "port 443" killer) ----------
git config --global --unset http.proxy 2>$null | Out-Null
git config --global --unset https.proxy 2>$null | Out-Null

# ---------- 1) remote ----------
$hasOrigin = git remote | Select-String -Pattern "^origin$" -Quiet
if (-not $hasOrigin) {
  git remote add origin $RepoUrl
  Write-Host "  [*] Remote origin added: $RepoUrl"
} else {
  $cur = (git remote get-url origin).Trim()
  if ($cur -ne $RepoUrl) {
    git remote set-url origin $RepoUrl
    Write-Host "  [*] Remote origin fixed: $RepoUrl"
  }
}

# ---------- 1b) sync .gitignore + CI workflow to repo root ----------
$root = git rev-parse --show-toplevel 2>$null
if ($root) {
  $gi = Join-Path $PSScriptRoot ".gitignore"
  if ((Test-Path $gi) -and -not (Test-Path (Join-Path $root ".gitignore"))) {
    Copy-Item $gi (Join-Path $root ".gitignore") -Force
    Write-Host "  [*] .gitignore synced to repo root"
  }
  $wfSrc = Join-Path $PSScriptRoot ".github\workflows\build.yml"
  if (Test-Path $wfSrc) {
    $wfDir = Join-Path $root ".github\workflows"
    if (-not (Test-Path (Join-Path $wfDir "build.yml"))) {
      New-Item -ItemType Directory -Force -Path $wfDir | Out-Null
      Copy-Item $wfSrc (Join-Path $wfDir "build.yml") -Force
      Write-Host "  [*] CI workflow synced to repo root"
    } else {
      Copy-Item $wfSrc (Join-Path $wfDir "build.yml") -Force
      Write-Host "  [*] CI workflow updated at repo root"
    }
    # remove old/duplicate workflows to avoid double builds
    Get-ChildItem -Path $wfDir -Filter "*.yml" | Where-Object { $_.Name -ne "build.yml" } | ForEach-Object {
      Write-Host "  [WARN] old workflow '$($_.Name)' found - consider: git rm .github/workflows/$($_.Name)"
    }
  }
}

# ---------- 2) branch ----------
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") {
  git checkout main
  if ($LASTEXITCODE -ne 0) { Fail "Could not switch to branch 'main' (was: $branch)." }
  Write-Host "  [*] Switched to branch 'main'"
}

# ---------- 3) fetch tags (tolerate offline) ----------
git fetch origin --tags 2>$null | Out-Null

# ---------- 4) version <-> tag sync ----------
$pkgPath = Join-Path $PSScriptRoot "package.json"
$ver = ""
try {
  $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
  $ver = [string]$pkg.version
} catch {
  Fail "Cannot read version from package.json"
}
if ([string]::IsNullOrWhiteSpace($ver)) { Fail "package.json has no version field" }

$tag = "v$ver"
$tagExists = (git tag -l $tag | Out-String).Trim()
if ($tagExists -ne "") {
  # tag already used -> bump patch (0.5.0 -> 0.5.1)
  $parts = $ver.Split(".")
  $parts[2] = [string]([int]$parts[2] + 1)
  $newVer = $parts -join "."
  $env:AVA_NEWVER = $newVer
  node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version=process.env.AVA_NEWVER;fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"
  if ($LASTEXITCODE -ne 0) { Fail "Version bump failed (is Node.js installed?)" }
  $ver = $newVer
  $tag = "v$ver"
  Write-Host "  [*] Tag $tagExists was already used - version bumped to $newVer"
} else {
  Write-Host "  [*] Releasing version $ver as tag $tag"
}

# ---------- 5) commit everything ----------
git add -A
$changes = (git status --porcelain | Out-String).Trim()
if ($changes -ne "") {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
  if ([string]::IsNullOrWhiteSpace($Message)) { $Message = "AVA release $tag - $stamp" }
  git commit -m "$Message"
  if ($LASTEXITCODE -ne 0) { Fail "git commit failed." }
  Write-Host "  [*] Changes committed: $Message"
} else {
  Write-Host "  [*] Nothing new to commit"
}

# ---------- 6) sync with remote ----------
git pull --rebase origin main 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  git rebase --abort 2>$null | Out-Null
  Write-Host "  [WARN] Could not sync with GitHub (offline?) - trying to push anyway..."
}

# ---------- 7) push main ----------
git push origin main
if ($LASTEXITCODE -ne 0) { Fail "Push to GitHub failed. Check internet/VPN or credentials." }

# ---------- 8) push the release tag (triggers the EXE build) ----------
git tag -d $tag 2>$null | Out-Null
git tag $tag
if ($LASTEXITCODE -ne 0) { Fail "Could not create tag $tag" }
git push origin $tag
if ($LASTEXITCODE -ne 0) { Fail "Could not push tag $tag" }

Write-Host ""
Write-Host "  [OK] Tag $tag pushed - GitHub Actions is building the installer."
exit 0
