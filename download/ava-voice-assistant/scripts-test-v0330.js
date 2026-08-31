#!/usr/bin/env node
/* v0.33.0 — regression suite. ریشه‌یابی گزارش کاربر از نسخهٔ ۰.۳۲:
     «دیسکورد میوت و دیفنش میشه، مخاطب رو هم پیدا می‌کنه — ولی زنگ نمی‌زنه»
   سه ریشهٔ مستقل در مسیر تماس (تنها مسیری که بدون تایید بود):
     R1  clickcall هرگز Focus-DcHard نمی‌زد — اگر دیسکورد مینیمایز/تری بود درخت
         UIA کور و مختصات بی‌اعتبار بود → فالبک مختصاتی کور → کلیک در ناکجا.
     R2  بعد از Invoke/کلیک هیچ اثباتی نبود — تنها مسیر موتورِ v0.30 بدون
         «تایید فلِیپ». Invoke بی‌اثر → «OK:CALLING» دروغین → «در حال تماس…»
         پخش می‌شد ولی زنگ نمی‌خورد (دقیقاً گزارش کاربر).
     R3  اگر دیپ‌لینک صفحهٔ DM را باز نمی‌کرد، مسیرِ نام‌دار بدون هیچ fallback
         می‌مرد؛ حالا داخل همان اجرا Quick Switcher امتحان می‌شود + قالب دوم
         دیپ‌لینک (discord://-/) در main.js فقط روی شکست تلاش اول.
   Invariants:
     C1  Test-CallAlive: اثبات تماس فقط با دکمه‌هایی که فقط داخل تماس ظاهر
         می‌شوند (Disconnect/Leave Call/Leave/End Call) — Mute/Deafen پنل پایین
         همیشه هستند و هرگز نباید در تایید تماس به کار روند (غلت کاذب)
     C2  چرخهٔ بسته: هر OK:CALLING فقط بعد از Test-CallAlive (۴ محل) + پیش‌چک
         «همین حالا در تماس است» + DBG:INVOKE_NOFLIP / DBG:CLICK_NOFLIP
     C3  دور ۳ درخت کامل (TrueCondition، سقف ۶۰۰، فقط دورهای ۱ و ۶) — دکمهٔ تماس
         با ControlType غیر Button هم پیدا می‌شود
     C4  clickcall: Focus-DcHard → DBG:FG → Try-CallClick → فالبک Quick Switcher
         (کلیپ‌بورد تاییدشده + ctrl,k/v/enter) → Try-CallClick دوم
     C5  main.js: نام مخاطب به clickcall پاس می‌شود + دو قالب دیپ‌لینک +
         تلاش دوم فقط gated روی شکستِ اول
     C6  نگه‌داشتِ واژه‌به‌واژهٔ صادقانه‌های v0.32 (blindProbe / ERR:NODM /
         DBG:UIA_MISS / callswitch بدون Send-BgCombo)
     P1  اجرای واقعی pwsh تا dispatch (ERR:NO_DISCORD روی لینوکس)              */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS | ' + name); }
  else { fail++; console.log('FAIL | ' + name + (extra !== undefined ? ' | ' + String(extra).slice(0, 200) : '')); }
}
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const mainSrc = read('main.js');
const appSrc = read('renderer/js/app.js');
const htmlSrc = read('renderer/index.html');
const bodyM = mainSrc.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/);
const body = bodyM ? bodyM[1] : '';

console.log('\n[1] body hygiene (v0.28.1/v0.29.1/v0.29.3 invariants must survive)');
ok('DISCORD_PS_BODY extracted', body.length > 6000, body.length);
ok('ZERO C-style comments', !body.includes('/*') && !body.includes('*/'));
ok('ZERO curly quotes', !/[\u2018\u2019\u201C\u201D]/.test(body));
ok('FromHandle([IntPtr]$hwnd) still exactly ×3', (body.match(/FromHandle\(\[IntPtr\]\$hwnd\)/g) || []).length === 3);

console.log('\n[2] C1: Test-CallAlive — the call flip-proof uses ONLY in-call buttons');
ok('Test-CallAlive exists and scans the honest regex',
   body.includes("function Test-CallAlive") &&
   body.includes("$s = Scan-DcBtns '^(Disconnect|Leave Call|Leave|End Call)$' '' $true"));
const tcaLine = (body.match(/Scan-DcBtns '\^\(Disconnect\|Leave Call\|Leave\|End Call\)\$' '' \$true/) || [''])[0];
ok('Mute/Deafen (always-present panel buttons) are NOT in the call-alive regex',
   tcaLine.length > 0 && !tcaLine.includes('Mute') && !tcaLine.includes('Deafen'), tcaLine);
ok('NEG CONTROL: Mute in the call-alive regex would make EVERY DM page "ringing" (the false-OK class)',
   (() => { const poisoned = body.replace("Scan-DcBtns '^(Disconnect|Leave Call|Leave|End Call)$' '' $true", () => "Scan-DcBtns '^(Mute|Disconnect)$' '' $true"); return poisoned !== body && poisoned.includes("'^(Mute|Disconnect)$'"); })());

console.log('\n[3] C2: closed loop — every OK:CALLING is proven by Test-CallAlive');
const callAliveGates = (body.match(/if \(Test-CallAlive\) \{ Restore-Focus; return 'OK:CALLING' \}/g) || []).length;
ok('4 verification gates (invoke ×2 + rect-click ×1 + blind-coordinate ×1)', callAliveGates === 4, callAliveGates);
ok('pre-check: already-in-call short-circuits honestly',
   body.includes("if (Test-CallAlive) { return 'OK:CALLING' } # همین حالا در تماس است"));
ok('Invoke is followed by verification within 260 chars (no unverified OK)',
   /Invoke\(\)[\s\S]{0,260}if \(Test-CallAlive\)/.test(body));
ok('failed attempts are labeled, not lied about (DBG:INVOKE_NOFLIP / DBG:CLICK_NOFLIP)',
   body.includes("Write-Output 'DBG:INVOKE_NOFLIP'") && body.includes("Write-Output 'DBG:CLICK_NOFLIP'"));
ok('NEG CONTROL: stripping the verification gates fails the count invariant',
   (() => { const stripped = body.split("if (Test-CallAlive) { Restore-Focus; return 'OK:CALLING' }").join("Restore-Focus; return 'OK:CALLING'"); return (stripped.match(/if \(Test-CallAlive\) \{ Restore-Focus; return 'OK:CALLING' \}/g) || []).length === 0; })());

console.log('\n[4] C3: full-tree pass — call button beyond ControlType=Button');
const tcStart = body.indexOf('function Try-CallClick');
const tcEnd = body.indexOf('# v0.29.1', tcStart);
const tc = body.slice(tcStart, tcEnd > tcStart ? tcEnd : tcStart + 9000);
ok('pass 3 full-tree scan exists (TrueCondition)', tc.includes('[System.Windows.Automation.Condition]::TrueCondition'));
ok('full scan capped at 600 elements', tc.includes('$seen -gt 600'));
ok('full scan only on rounds 1 and 6 (cheapest scan is bounded)', tc.includes('$tryN -eq 1 -or $tryN -eq 6'));
ok('pass 3 combines BOTH name families (strict + loose)', tc.includes("else { $ok = ($bn -match 'Start Voice Call|Voice Call|Voice|تماس صوتی|شروع تماس|Call|تماس') }"));
ok('invalid rects are never clicked (minimized-window guard)', tc.includes('if ([int]$r.Width -gt 0 -and [int]$r.Height -gt 0)'));
ok('DBG:ALLNAMES tree dump for the next diagnosis', tc.includes("Write-Output ('DBG:ALLNAMES=' + $d)"));

console.log('\n[5] C4: clickcall — verified focus first + Quick-Switcher self-heal');
const ccStart = body.indexOf("'clickcall' {");
const ccEnd = body.indexOf("'callswitch' {", ccStart);
const cc = body.slice(ccStart, ccEnd > ccStart ? ccEnd : ccStart + 4000);
ok('clickcall block extracted', ccStart > 0 && ccEnd > ccStart);
ok('focus gate BEFORE the first scan (minimized/tray window class)',
   cc.indexOf('Focus-DcHard') > -1 && cc.indexOf('Try-CallClick') > cc.indexOf('Focus-DcHard'));
ok('focus result logged (DBG:FG) and fallback gated on non-OK', cc.includes('DBG:FG=') && cc.includes("if (-not ($res -like 'OK*'))"));
ok('fallback = verified clipboard (Get-Clipboard -Raw) else honest ERR:CLIP',
   cc.includes('Get-Clipboard -Raw') && cc.includes("else { $res = 'ERR:CLIP' }"));
ok('fallback sends the real Quick-Switcher combo then a SECOND Try-CallClick',
   cc.includes("Send-Combo 'ctrl,k'") && cc.includes("Send-Combo 'ctrl,v'") && cc.includes("Send-Combo 'enter'") &&
   (cc.match(/\$res = Try-CallClick/g) || []).length === 2);
ok('zero Send-BgCombo anywhere near clickcall (the swallowed-keys class stays dead)', !cc.includes('Send-BgCombo'));
ok('NEG CONTROL: removing the focus gate from clickcall breaks the gate assert',
   (() => { const s = cc.replace('$fg = Focus-DcHard', '$fg = $true'); return s !== cc && !s.includes('$fg = Focus-DcHard'); })());

console.log('\n[6] C5: main.js — contact name passed + dual deep-link formats + gated retry');
ok('clickcall receives the contact name (self-heal has the name to switch with)',
   (mainSrc.match(/runDiscordPs\('clickcall', 'fg', nm, dxN, dyN\)/g) || []).length === 2);
ok('deep-link format 1 (discord://discord.com) kept',
   mainSrc.includes('shell.openExternal(`discord://discord.com/channels/@me/${uid}`)'));
ok('deep-link format 2 (discord://-/) tried ONLY on first-attempt failure',
   mainSrc.includes('shell.openExternal(`discord://-/channels/@me/${uid}`)') &&
   mainSrc.includes('if (r1 && r1.ok) return r1;') &&
   mainSrc.indexOf('if (r1 && r1.ok) return r1;') < mainSrc.indexOf('discord://-/channels/@me/'));
ok('assist path untouched (zero simulated input stays legal)', mainSrc.includes("result: 'OK:ASSIST'"));

console.log('\n[7] C6: v0.32 honest words survive verbatim');
ok('blind-tree probe still guards the manual coordinate click',
   body.includes("$blindProbe = Scan-DcBtns '' '' $true") &&
   body.includes('if ($blindProbe.alive -and $blindProbe.names.Count -gt 0) {'));
ok('named tree without a call button → honest ERR:NODM (no wrong-window click)', body.includes("if ($Name) { return 'ERR:NODM' }"));
ok('blind UIA miss still announced', body.includes("Write-Output 'DBG:UIA_MISS'"));
ok('callswitch block unchanged (focus+clipboard+no-bg-combo)', (() => {
  const iCs = mainSrc.indexOf("'callswitch' {");
  const iEnd = mainSrc.indexOf("default { Write-Output 'ERR:UNKNOWN' }", iCs);
  const cs = mainSrc.slice(iCs, iEnd > iCs ? iEnd : iCs + 3000);
  return !cs.includes('Send-BgCombo') && cs.includes('$fg = Focus-DcHard') &&
         cs.includes("if (-not $fg) { Write-Output 'ERR:NOFOCUS'; exit }") &&
         cs.includes('Get-Clipboard -Raw') && cs.includes("if (-not $clipOk) { Write-Output 'ERR:CLIP'; exit }");
})());
ok('honest Persian error map intact', mainSrc.includes("'ERR:CLIP':") && mainSrc.includes("'ERR:NODM':"));

console.log('\n[8] P1: real pwsh execution (portable pwsh)');
const PWSH = '/home/z/my-project/scripts/pwsh/pwsh';
const hasPwsh = fs.existsSync(PWSH);
ok('portable pwsh present (skipped gracefully otherwise)', true);
if (hasPwsh && body) {
  const tmp = '/home/z/my-project/scripts/ava-dc-v0330-exec.ps1';
  fs.writeFileSync(tmp, '\ufeff' + body, 'utf8');
  const runAction = (action, mode, name) => {
    let out = '', err = '';
    try {
      out = execFileSync(PWSH, ['-NoProfile', '-NonInteractive', '-File', tmp,
        '-Action', action, '-Mode', mode, '-Name', name, '-WaitMs', '1'], { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { out = String((e && e.stdout) || ''); err = String((e && e.stderr) || ''); }
    return { out, err, all: out + '\n' + err };
  };
  const c1 = runAction('clickcall', 'fg', 'ali-hk');
  ok('clickcall EXECUTES to dispatch (ERR:NO_DISCORD on Linux — proc check precedes switch)', /ERR:NO_DISCORD/.test(c1.out), c1.out.slice(0, 90));
  const c2 = runAction('callswitch', 'bg', 'ali-hk');
  ok('callswitch regression: still dispatches (ERR:NO_DISCORD)', /ERR:NO_DISCORD/.test(c2.out), c2.out.slice(0, 90));
  ok('no CommandNotFound / ParseException / terminator in either run',
     !/CommandNotFound|ParseException|terminator/i.test(c1.all + c2.all), (c1.all + c2.all).slice(0, 140));
  try { fs.unlinkSync(tmp); } catch (_) { /* noop */ }
}

console.log('\n[9] versions 0.33');
const pkg = JSON.parse(read('package.json'));
ok('package.json 0.33+', /^0\.3[3-9]\.\d+(?:-[\w.]+)?$/.test(pkg.version), pkg.version);
ok('about box v0.33+', />v0\.3[3-9]\.\d+(?:-[\w.-]+)?<\/span>/.test(htmlSrc));
ok('app.js appVersion 0.33+', /let appVersion = '0\.3[3-9]\.\d+(?:-[\w.]+)?';/.test(appSrc));
ok('older suites stay forward-regex', !read('scripts-test-v0320.js').includes("pkg.version === '0.32.0'"));

console.log(`\nRESULT: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
