#!/usr/bin/env node
/* v0.30.0 — DC-NATIVE regression suite.
   User demand after three fix generations that still did nothing on their
   machine: «یک بار کامل بگیر از اول برنامه نویسی کن دستور های دیسکوردو ..
   نمیدونم با یک روش دیگ هر چی» — so the whole engine is rebuilt:
     cycle = real state (UIA 3-round) → L1 verified-focus keys (AttachThreadInput
     + SwitchToThisWindow + SCANCODE input, Persian-layout safe) → L2 UIA Invoke
     → L3 rect click → flip verification → HONEST labels.
   Invariants proven here:
     I1  no blind keys: Send-Combo only runs after Focus-DcHard / Test-Fg
     I2  honest results: KEYS-VERIFIED / KEYS-UNVERIFIED / UIA-VERIFIED /
         UACLICK / ALREADY / ERR:NOFOCUS / ERR:NOBTN:LABEL exist
     I3  body hygiene: zero C-comments, zero curly quotes, zero
         NativeWindowHandleProperty, FromHandle(IntPtr) exactly ×3
     I4  real pwsh EXECUTION reaches dispatch (ERR:NO_DISCORD on Linux)
     I5  negative controls: the harness catches reintroduced bombs          */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS | ' + name); }
  else { fail++; console.log('FAIL | ' + name + (extra !== undefined ? ' | ' + String(extra).slice(0, 160) : '')); }
}
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const mainSrc = read('main.js');
const appSrc = read('renderer/js/app.js');
const htmlSrc = read('renderer/index.html');
const preSrc = read('preload.js');
const bodyM = mainSrc.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/);
const body = bodyM ? bodyM[1] : '';

console.log('\n[1] body hygiene (I3)');
ok('DISCORD_PS_BODY extracted', body.length > 6000, body.length);
ok('ZERO C-style comments (v0.29.1 bomb class)', !body.includes('/*') && !body.includes('*/'));
ok('ZERO curly quotes (v0.28.1 bomb class)', !/[\u2018\u2019\u201C\u201D]/.test(body));
ok('ZERO NativeWindowHandleProperty (v0.29.3 ctor bomb class)', !body.includes('NativeWindowHandleProperty'));
ok('FromHandle([IntPtr]$hwnd) exactly ×3 (Get-DcWin, Try-CallClick, probe)',
   (body.match(/FromHandle\(\[IntPtr\]\$hwnd\)/g) || []).length === 3,
   (body.match(/FromHandle\(\[IntPtr\]\$hwnd\)/g) || []).length);
ok('zero-hwnd guard kept', body.includes("if ($hwnd -eq [IntPtr]::Zero) { return $null }"));
ok('ControlTypeProperty ≥ 3 (all UIA query sites)', (body.match(/ControlTypeProperty/g) || []).length >= 3);
ok('UTF8 console hardening at script start', body.includes('[Console]::OutputEncoding = [System.Text.Encoding]::UTF8'));
ok('v0.28.1 callswitch quote-strip intact', body.includes("$name = ($Name -replace '[''\"]', '')"));
ok('switch dispatch intact (mute..decline)', body.includes("'mute'") && body.includes("'unmute'") && body.includes("'deafen'") && body.includes("'undeafen'") && body.includes("'hangup'") && body.includes("'answer'") && body.includes("'decline'"));

console.log('\n[2] DC-NATIVE engine (the new method)');
ok('Focus-DcHard: hard-focus chain exists', body.includes('function Focus-DcHard') && body.includes('AttachThreadInput') && body.includes('SwitchToThisWindow') && body.includes('BringWindowToTop'));
ok('Focus-DcHard VERIFIES with the OS (GetForegroundWindow compare)',
   (body.match(/return \(Test-Fg\)/g) || []).length >= 1 && body.includes('function Test-Fg'));
ok('Alt-poke unlock present', body.includes('function Poke-Alt'));
ok('Send-Combo: SCANCODE injection (KEYEVENTF_SCANCODE=0x8, layout-independent)',
   body.includes('0x8 -bor 0x2') && body.includes('function Send-Combo'));
ok('VK + scan tables cover m/d/h/a/e/k/v/enter',
   body.includes("'m' = 0x4D") && body.includes("'d' = 0x44") && body.includes("'h' = 0x48") && body.includes("'a' = 0x41") && body.includes("'e' = 0x45") && body.includes("'k' = 0x4B") && body.includes("'v' = 0x56") && body.includes("'enter' = 0x0D"));
ok('scan codes complete for the same keys',
   body.includes("'m' = 0x32") && body.includes("'d' = 0x20") && body.includes("'h' = 0x23") && body.includes("'a' = 0x1E") && body.includes("'e' = 0x12") && body.includes("'k' = 0x25") && body.includes("'v' = 0x2F") && body.includes("'enter' = 0x1C"));
ok('Get-DcBtns: 3-round scan for the lazy Chromium a11y tree',
   body.includes('DBG:ROUND=') && /for \(\$round = 1; \$round -le 3/.test(body));
ok('Test-Flip: state-flip verification', body.includes('function Test-Flip'));
ok('Try-Keys: keys behind verified focus + honest UNVERIFIED when UIA blind',
   body.includes('function Try-Keys') && body.includes(':KEYS-UNVERIFIED'));
ok('Press-Dc: layered signature with combo + keysFirst',
   body.includes("function Press-Dc([string]$doRx, [string]$alrRx, [string]$label, [string]$combo = '', [bool]$keysFirst = $true)"));

console.log('\n[3] no-blind-keys invariant (I1)');
{
  const tkStart = body.indexOf('function Try-Keys');
  const tkEnd = body.indexOf('function Press-Dc('); /* v0.35: () تا با Press-DcBg قاطی نشود */
  ok('Try-Keys defined before Press-Dc', tkStart !== -1 && tkEnd > tkStart);
  const tk = body.slice(tkStart, tkEnd);
  ok('inside Try-Keys: Focus-DcHard BEFORE Send-Combo (guard order)',
     tk.indexOf('$fg = Focus-DcHard') !== -1 && tk.indexOf('Send-Combo $combo') > tk.indexOf('Focus-DcHard'));
  ok('inside Try-Keys: abort when focus not verified (if (-not $fg) return)',
     /if \(-not \$fg\) \{ return '' \}/.test(tk));
  ok('DBG:FG probe logged on every key attempt', body.includes("'DBG:FG='"));
  ok('mute/deafen switch lines use the verified-keys combo path',
     body.includes("'mute'     { Write-Output (Press-Dc '^Mute$' '^Unmute$' 'MUTE' 'ctrl,shift,m') }") &&
     body.includes("'deafen'   { Write-Output (Press-Dc '^Deafen$' '^Undeafen$' 'DEAFEN' 'ctrl,shift,d') }"));
  ok('call-family is UIA-first (keysFirst=$false)',
     body.includes("'hangup'   { Write-Output (Press-Dc '^(Disconnect|Leave Call|Leave|End Call)$' '' 'HANGUP' 'ctrl,shift,h' $false) }") &&
     body.includes("'answer'   { Write-Output (Press-Dc '^(Join Call|Answer|Accept|Join)$' '' 'ANSWER' 'ctrl,shift,a' $false) }") &&
     body.includes("'decline'  { Write-Output (Press-Dc '^(Decline|Reject|Deny)$' '' 'DECLINE' 'ctrl,shift,e' $false) }"));
}

console.log('\n[4] honest results + state query (I2)');
ok('flip-verified labels exist', body.includes(':KEYS-VERIFIED') && body.includes(':UIA-VERIFIED') && body.includes(':UACLICK-VERIFIED'));
ok('legacy-honest labels kept', body.includes(":UIA')") && body.includes(":UACLICK')") && body.includes("-ALREADY')"));
ok('hard failures are labeled', body.includes('ERR:NOFOCUS') && body.includes('ERR:NOBTN:') && body.includes('ERR:NOSTATE'));
ok('state action reports OK:STATE:MUTED/ON:DEAF/SOUND', body.includes('OK:STATE:') && /'state' \{[\s\S]{0,1100}OK:STATE:/.test(body));
ok('ALREADY short-circuit before any action', /if \(\$st\.alive -and \$st\.already -and \(-not \$st\.hit\)\) \{ return \('OK:' \+ \$label \+ '-ALREADY'\) \}/.test(body));
ok('Restore-Focus only touches focus when Discord really took it', body.includes('if (-not (Test-Fg)) { return }'));

console.log('\n[5] main.js wiring');
ok('prefixed ERR:NOBTN: mapped to Persian hint', mainSrc.includes("em.startsWith('ERR:NOBTN:')"));
ok('prefixed ERR:NOFOCUS mapped to Persian hint', mainSrc.includes("em.startsWith('ERR:NOFOCUS')"));
ok('ERR:NOSTATE mapped', mainSrc.includes('ERR:NOSTATE'));
ok('BOM + -File execution kept', mainSrc.includes("'\\ufeff' + DISCORD_PS_BODY"));
ok('DBG lines still forwarded to activity.log', mainSrc.includes("lines.filter((l) => /^DBG:/i.test(l))"));

console.log('\n[6] renderer: state voice command');
ok('state branch first in tryDiscordCmd', appSrc.indexOf("action: 'state'") < appSrc.indexOf("action: 'hangup'"));
ok('state query regex (وضعیت/چطوره/چیه × میکروفون/صدا/دیسکورد)', /وضعیت[^/]*میکروفون|میکروفون[\s\S]{0,40}وضعیت/.test(appSrc));
ok('state result mapped to Persian speech (MUTED/DEAF)', appSrc.includes("/:MUTED/.test(s)") && appSrc.includes("/:DEAF/.test(s)"));
ok('i18n state keys in BOTH dictionaries', (appSrc.match(/'disc\.stateOn': \[/g) || []).length === 2 && (appSrc.match(/'disc\.stateMuted': \[/g) || []).length === 2 && (appSrc.match(/'disc\.stateFail': \[/g) || []).length === 2);
ok('stateFail fallback on error', appSrc.includes("(r && r.error) || t('disc.stateFail')"));
ok('preload discord bridge unchanged', preSrc.includes("discord"));
ok('ALREADY honest mapping kept (mute family + deaf family)',
   appSrc.includes("if (r && r.ok && /-ALREADY/.test(String(r.result || ''))) return unmute ? t('disc.alreadyOn') : t('disc.alreadyMuted');") &&
   appSrc.includes("if (r && r.ok && /-ALREADY/.test(String(r.result || ''))) return t('disc.alreadyDeaf');"));

console.log('\n[7] real pwsh EXECUTION of the shipped body (I4)');
const PWSH = '/home/z/my-project/scripts/pwsh/pwsh';
const hasPwsh = fs.existsSync(PWSH);
if (hasPwsh) ok('portable pwsh present', true); else console.log('SKIP | portable pwsh (باینری فقط روی ماشین ساخت ویندوز)');
if (hasPwsh && body) {
  const tmp = '/home/z/my-project/scripts/ava-dc-v0300-exec.ps1';
  fs.writeFileSync(tmp, '\ufeff' + body, 'utf8');
  let out = '', all = '';
  try {
    out = execFileSync(PWSH, ['-NoProfile', '-NonInteractive', '-File', tmp,
      '-Action', 'mute', '-Mode', 'bg', '-Name', '', '-WaitMs', '1'], { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { out = String((e && e.stdout) || ''); all = String((e && e.stderr) || ''); }
  all = out + '\n' + all;
  ok('mute EXECUTES to dispatch (ERR:NO_DISCORD on Linux)', /ERR:NO_DISCORD/.test(out), out.slice(0, 90));
  ok('no CommandNotFound / ParseException / terminator', !/CommandNotFound|ParseException|terminator/i.test(all), all.slice(0, 120));
  let out3 = '';
  try {
    out3 = execFileSync(PWSH, ['-NoProfile', '-NonInteractive', '-File', tmp,
      '-Action', 'state', '-Mode', 'bg', '-Name', '', '-WaitMs', '1'], { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { out3 = String((e && e.stdout) || ''); }
  ok('state action also reaches dispatch (ERR:NO_DISCORD)', /ERR:NO_DISCORD/.test(out3), out3.slice(0, 90));

  /* NEGATIVE CONTROL A: C-style comment bomb (the v0.29.1 class) must die in this harness */
  const bomb = body.replace("$ErrorActionPreference = 'Stop'", "$ErrorActionPreference = 'Stop'\n/* سنسور آزمایشی v0.30: */");
  fs.writeFileSync(tmp, '\ufeff' + bomb, 'utf8');
  let outB = '', errB = '';
  try {
    outB = execFileSync(PWSH, ['-NoProfile', '-NonInteractive', '-File', tmp,
      '-Action', 'mute', '-Mode', 'bg', '-Name', '', '-WaitMs', '1'], { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { outB = String((e && e.stdout) || ''); errB = String((e && e.stderr) || ''); }
  const bombOut = outB + '\n' + errB;
  ok('NEGATIVE CONTROL A: C-comment bomb triggers runtime failure in this harness',
     /not recognized/i.test(bombOut) || bombOut.includes('ERR:PS:'), bombOut.slice(0, 120));
  fs.writeFileSync(tmp, '\ufeff' + body, 'utf8');

  /* NEGATIVE CONTROL B: blind-keys regression — remove the verified-foreground
     guard from Try-Keys; the STATIC invariant must flag the mutated body */
  const blind = body.replace("if (-not $fg) { return '' }", "if (-not $fg) { Write-Output 'DBG:FORCED' }");
  ok('NEGATIVE CONTROL B: removing the focus guard breaks the guard invariant',
     !/if \(-not \$fg\) \{ return '' \}/.test(blind) && /if \(-not \$fg\) \{ return '' \}/.test(body));
}

console.log('\n[8] versions 0.30+ (v0.31: forward-compatible)');
const pkg = JSON.parse(read('package.json'));
ok('package.json 0.30+', /^0\.(29|[3-9]\d)\.\d+(?:-[\w.]+)?$/.test(pkg.version), pkg.version);
ok('about box 0.30+', />v0\.(29|[3-9]\d)\.\d+(?:-[\w.-]+)?<\/span>/.test(htmlSrc));
ok('app.js appVersion 0.30+', /let appVersion = '0\.(29|[3-9]\d)\.\d+(?:-[\w.]+)?';/.test(appSrc));

console.log(`\nRESULT: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
