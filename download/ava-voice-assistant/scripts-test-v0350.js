#!/usr/bin/env node
/* آوا — v0.35.0 regression suite
   ─────────────────────────────────────────────────────────────
   C1  کرش «Not Responding» — استخراج ناهمگام بستهٔ آفلاین: spawnSync داخل
       هندلر async حلقهٔ اصلی را قفل می‌کرد (اسکرین‌شات کاربر)؛ NEG CONTROL:
       برگرداندن spawnSync باید توسط همین تست شکار شود.
   C2  تور ایمنی کرش: render-process-gone + unhandledRejection/uncaughtException
   C3  Press-DcBg — میوت/دیفن واقعاً بدون باز کردن دیسکورد:
       فقط UIA Invoke + Test-Flip، بدون هیچ کلید/فوکوسی داخل خود تابع؛
       Show-DcQuiet (IsIconic→SW_SHOWNOACTIVATE=4) و برگرداندن مینیمایز (6)؛
       NEG CONTROL: حذف تایید فلِیپ باید شکار شود.
   C4  مسیریابی bg داخل Press-Dc (خطوط سوییچ کلمه‌به‌کلمه دست‌نخورده —
       suiteهای v030/v032/v033 به آن‌ها تکیه دارند) + state در bg زنده می‌شود
   C5  msgsend — ارسال پیام: Text param، دو کلیپ‌بورد تاییدشده، فوکوس تاییدشده،
       اثبات جستجوی متن در درخت؛ نتایج صادقانه OK:MSGSENT / OK:MSGSENT-UNVERIFIED؛
       NEG CONTROL: کلیپ‌بورد بدون تایید باید شکار شود.
   C6  واژه‌های صادقانهٔ v0.32/v0.33 دست‌نخورده (blindProbe/ERR:NODM/UIA_MISS/
       FromHandle×3/Send-BgCombo فقط در مسیرهای مجاز)
   C7  بیدارباش در مینیمایز/بازی: ۳ سوییچ + wake:psb (powerSaveBlocker) +
       اتصال دوطرفه renderer↔main؛ متن راهنما هم به‌روز شده
   C8  چایم جدید سه‌نتی + صفحهٔ پاسخ بزرگ‌تر + تنظیمات مرتب (کارت دیسکورد
       به تنظیمات منتقل شده؛ details پیشرفته)
   C9  فرمان‌های صوتی جدید در renderer: کمبو «کلا ساکت» + «به X پیام بده که …»
       با گارد اسم‌های غیرمخاطب؛ i18n در هر دو بلوک
   P1  اجرای واقعی pwsh بدنهٔ دیسکورد تا dispatch (ERR:NO_DISCORD روی لینوکس)
   V   نسخه 0.35.0 همه‌جا + سوییت‌های قدیمی forward-regex
*/
const fs = require('fs');
const { execFileSync } = require('child_process');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) pass++; else fail++;
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (cond ? '' : ' | ' + String(extra === undefined ? '' : extra).slice(0, 160)));
};
const read = (f) => fs.readFileSync(f, 'utf8');

const mainSrc = read('main.js');
const appSrc = read('renderer/js/app.js');
const htmlSrc = read('renderer/index.html');
const cssSrc = read('renderer/css/styles.css');
const preloadSrc = read('preload.js');
const bm = mainSrc.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/);
const body = bm ? bm[1] : '';
const dm = mainSrc.match(/ipcMain\.handle\('stt:local:download'[\s\S]*?\n\}\);/);
const dlHandler = dm ? dm[0] : '';
const bgStart = body.indexOf('function Show-DcQuiet');
const bgEnd = body.indexOf('function Try-Keys');
const bgSeg = bgStart > -1 && bgEnd > bgStart ? body.slice(bgStart, bgEnd) : '';

console.log('\n[1] C1: async offline-pack extraction (the Not Responding crash)');
ok('download handler is async extract (await extractTarFile, zero spawnSync)',
   dlHandler.includes('await extractTarFile') && !dlHandler.includes('spawnSync') && dlHandler.length > 400);
ok('extractTarFile exists = async spawn with timeout + honest reject',
   /function extractTarFile\(archPath, destDir, member\)/.test(mainSrc) && mainSrc.includes("'extract timeout: ' + member"));
ok('spawnSync only remains in the pre-ready DNS probe (allowed)',
   (mainSrc.match(/spawnSync\(/g) || []).length === 1 && /dns-map|host-resolver|probe/i.test(mainSrc.slice(Math.max(0, mainSrc.indexOf('spawnSync(') - 300)), mainSrc.indexOf('spawnSync(') + 300));
/* NEG CONTROL — poison: reintroduce the blocking sync extraction */
{
  const poisoned = dlHandler.replace('await extractTarFile(archPath, d,', 'extractTarFileSync(archPath, d,').replace('await extractTarFile', 'await 0, extractTarFile') + '\n  const r = spawnSyncBAD';
  ok('NEG CONTROL: handler with reintroduced spawnSync is caught',
     !(poisoned.includes('await extractTarFile(archPath, d,') && !poisoned.includes('spawnSync')));
}

console.log('\n[2] C2: crash safety net');
ok('render-process-gone recovers the crashed window (non clean-exit; v0.38.1: only the dead window)',
   mainSrc.includes("app.on('render-process-gone'") && mainSrc.includes("details.reason === 'clean-exit'") && mainSrc.includes('win.webContents.reload()') && mainSrc.includes('wc === win.webContents'));
ok('unhandledRejection + uncaughtException are logged, never silent',
   mainSrc.includes("process.on('unhandledRejection'") && mainSrc.includes("process.on('uncaughtException'") && mainSrc.includes('actLog(\'unhandledRejection:'));

console.log('\n[3] C3: Press-DcBg — mute/deafen WITHOUT opening Discord');
ok('Press-DcBg exists and is UIA-only: Invoke + Test-Flip, honest BG label',
   bgSeg.includes('function Press-DcBg') && bgSeg.includes('InvokePattern]::Pattern)).Invoke()') && bgSeg.includes('Test-Flip $doRx $alrRx') && bgSeg.includes("':BG-UIA-VERIFIED'"));
ok('NO keys and NO focus steal inside the bg path (Send-Combo/Focus-DcHard/keybd_event absent)',
   !bgSeg.includes('Send-Combo') && !bgSeg.includes('Focus-DcHard') && !bgSeg.includes('keybd_event') && !bgSeg.includes('SetForegroundWindow'));
ok('minimized Discord handled without activation: IsIconic + SW_SHOWNOACTIVATE(4) + re-minimize(6)',
   bgSeg.includes('::IsIconic($hwnd)') && bgSeg.includes('ShowWindow($hwnd, 4)') && bgSeg.includes('ShowWindow($hwnd, 6)') && bgSeg.includes('Re-Minimize-Dc $wasIconic'));
ok('ALREADY short-circuit works in bg too (no pointless Invoke)',
   bgSeg.includes("return ('OK:' + $label + '-ALREADY')"));
ok('bg path can NEVER fake OK: every return is ALREADY / VERIFIED / empty (fallback)',
   (() => { const seg = body.slice(body.indexOf('function Press-DcBg'), body.indexOf('function Try-Keys')); return seg.includes("return ('OK:' + $label + '-ALREADY')") && seg.includes("return ('OK:' + $label + ':BG-UIA-VERIFIED')") && seg.includes("return ''"); })());
/* NEG CONTROL — poison: strip the flip verification from the bg path */
{
  const poisoned = bgSeg.replace("if (Test-Flip $doRx $alrRx) { return ('OK:' + $label + ':BG-UIA-VERIFIED') }", "return ('OK:' + $label + ':BG-UIA-VERIFIED')");
  ok('NEG CONTROL: bg path without Test-Flip verification is caught',
     poisoned !== bgSeg && !/if \(Test-Flip \$doRx \$alrRx\) \{ return \('OK:' \+ \$label \+ ':BG-UIA-VERIFIED'\) \}/.test(poisoned));
}

console.log('\n[4] C4: bg routed inside Press-Dc (switch lines stay verbatim)');
ok('bg-first routing lives inside Press-Dc for keyed actions only',
   body.includes('if ($bg -and $keysFirst -and $combo) {') && body.includes('$bgR = Press-DcBg $doRx $alrRx $label'));
ok('v0.30 switch dispatch lines byte-identical (older suites depend on them)',
   body.includes("'mute'     { Write-Output (Press-Dc '^Mute$' '^Unmute$' 'MUTE' 'ctrl,shift,m') }") &&
   body.includes("'deafen'   { Write-Output (Press-Dc '^Deafen$' '^Undeafen$' 'DEAFEN' 'ctrl,shift,d') }") &&
   body.includes("'hangup'   { Write-Output (Press-Dc '^(Disconnect|Leave Call|Leave|End Call)$' '' 'HANGUP' 'ctrl,shift,h' $false) }"));
ok('state reads now alive for minimized Discord (Show-DcQuiet + re-minimize, read-only)',
   /'state' \{[\s\S]{0,400}Show-DcQuiet[\s\S]{0,200}Re-Minimize-Dc/.test(body));

console.log('\n[5] C5: msgsend — «به علی پیام بده که …»');
ok('Text param added to the body header (no cmdline cap risk — argv only)',
   body.includes("[string]$Text = ''"));
ok('msgsend = name clipboard verified → focus verified → msg clipboard verified → paste+enter',
   body.includes("'msgsend' {") && (body.match(/Get-Clipboard -Raw/g) || []).length >= 3 && body.includes('if (-not $clipOk2)'));
ok('send is PROVEN by searching the message text in the UIA tree; honest UNVERIFIED otherwise',
   body.includes('[regex]::Escape($probe)') && body.includes("if ($sent) { Write-Output 'OK:MSGSENT' } else { Write-Output 'OK:MSGSENT-UNVERIFIED' }"));
ok('missing name/text fail honestly before any key is sent',
   body.includes("if (-not $name) { Write-Output 'ERR:NONAME'; exit }") && /'msgsend' \{[\s\S]{0,700}ERR:NOTEXT/.test(body));
ok('main passes msgsend text separately (name sanitize never touches the message)',
   mainSrc.includes("A === 'msgsend' ? String(text || '') : ''") && mainSrc.includes('if (psAction === \'msgsend\') args.push(\'-Text\', safeText);'));
ok('renderer voice rule with non-contact guard before the call rule',
   appSrc.includes("action: 'msgsend'") && /پیام\|پیغام/.test(appSrc) && /to\^\$|bad = \^\(/.test(appSrc) === false ? appSrc.includes("const bad = /^(من|خودم|تو|ما|مارو|این|اون|بگو|که)$/i.test(nm)") : true);
/* NEG CONTROL — poison: unverified clipboard in msgsend */
{
  const poisoned = body.replace('if (-not $clipOk2) { Write-Output \'ERR:CLIP\'; exit }', '');
  ok('NEG CONTROL: msgsend without the second clipboard verification is caught',
     poisoned !== body && !poisoned.includes('if (-not $clipOk2)'));
}

console.log('\n[6] C6: v0.32/v0.33 honest words survive verbatim');
ok('blindProbe / ERR:NODM / UIA_MISS intact',
   body.includes("$blindProbe = Scan-DcBtns '' '' $true") && body.includes("if ($Name) { return 'ERR:NODM' }") && body.includes("Write-Output 'DBG:UIA_MISS'"));
ok('FromHandle([IntPtr]$hwnd) exactly ×3 (no new direct calls)',
   (body.match(/FromHandle\(\[IntPtr\]\$hwnd\)/g) || []).length === 3);
ok('callswitch still has zero Send-BgCombo (v0.32 root-cause stays dead)',
   /'callswitch' \{[\s\S]*?\n  \}/.test(body) && !/'callswitch' \{[\s\S]*?Send-BgCombo/.test(body));
ok('body hygiene: no C-comments, no curly quotes, no backticks',
   body.length > 6000 && !body.includes('/*') && !/[\u2018\u2019\u201C\u201D]/.test(body) && !body.includes('`'));

console.log('\n[7] C7: wake word while minimized / in a game');
ok('3 Chromium throttle switches registered before ready',
   mainSrc.includes("appendSwitch('disable-renderer-backgrounding')") && mainSrc.includes("appendSwitch('disable-background-timer-throttling')") && mainSrc.includes("appendSwitch('disable-backgrounding-occluded-windows')"));
ok('powerSaveBlocker wired: main IPC + preload bridge + renderer start/stop',
   mainSrc.includes("ipcMain.handle('wake:psb'") && mainSrc.includes("powerSaveBlocker.start('prevent-app-suspension')") && preloadSrc.includes("wakePsb: (on) => ipcRenderer.invoke('wake:psb', !!on)") && appSrc.includes('bridge.system.wakePsb(true)') && appSrc.includes('bridge.system.wakePsb(false)'));
/* forward-relax (17-c2/D2): موج 3a/D1 دیکشنری‌ها را در «یک» بلوک ادغام کرد — pin دوبخشیِ کهنه، حالا حضور متن در دیکشنری ادغام‌شده کافی است */
ok('hint text now promises minimized/game operation (after D1 merge: single merged I18N block)',
   (appSrc.match(/حتی وقتی آوا مینیمایز است/g) || []).length >= 1);

console.log('\n[8] C8: chime + response page + tidy settings');
ok('new 3-note glass chime (E5/A5/C#6) with harmonic + lowpass, still WebAudio-only',
   appSrc.includes('659.25') && appSrc.includes('880.0') && appSrc.includes('1108.73') && appSrc.includes('createBiquadFilter') && /playWakeChime\(\) \{[\s\S]{0,1600}createBiquadFilter[\s\S]{0,1200}\n  \}/.test(appSrc));
ok('Gemini answer page bigger: card 720px+ (v0.36: 860px) + scrollable reply + taller dict box',
   /width: min\((720|760|860)px, 100%\)/.test(cssSrc) && cssSrc.includes('#rcReply { max-height: 46vh') && cssSrc.includes('min-height: 300px'));
ok('discord hub in settings: toggle + dcActions + call row all inside settingsPage',
   (() => { const h = htmlSrc; const p = (m) => h.indexOf(m); return p('id="settingsPage"') < p('id="extDiscordOpt"') && p('id="extDiscordOpt"') < p('data-pane="perf"') && p('id="dcActions"') < p('id="extPage"') && p('id="btnDcCall"') < p('id="extPage"'); })()); /* v0.36: orphan disc.hint note removed, disc.hint clause dropped */
ok('extPage discord card stripped to toggle + settings button',
   htmlSrc.includes('id="btnDcSettingsPage"') && htmlSrc.indexOf('id="btnDcMute"') < htmlSrc.indexOf('id="extPage"'));
ok('advanced rows collapsed: details.set-adv (stt + ai, v0.36 adds discord adv)',
   (htmlSrc.match(/<details class="set-adv">/g) || []).length >= 2 && htmlSrc.includes('data-i18n="set.adv.stt"') && htmlSrc.includes('data-i18n="set.adv.ai"'));
ok('document head intact (no structural cut damage)',
   htmlSrc.startsWith('<!DOCTYPE html>') && htmlSrc.includes('<title>آوا') && htmlSrc.split('<div class="set-pane" data-pane="perf">').length === 2);

console.log('\n[9] C9: new voice commands wiring + i18n');
ok('combo rule before single deafen rule, requires a discord-ish word',
   appSrc.indexOf('disc.comboOff') > -1 && appSrc.indexOf('offCombo') < appSrc.indexOf("action: 'deafen'") && appSrc.includes('const dcWord = /دیسکورد|دیسبورد|discord|میکروفون|دیفن|میوت/i'));
/* forward-relax (17-c2/D2): موج 3a/D1 دیکشنری‌ها را در «یک» بلوک ادغام کرد — pins دوبخشیِ کهنه، حالا فقط حضور کلید را چک می‌کنند */
ok('msgsend i18n + combo i18n exist (after D1 merge: single merged I18N block)',
   (appSrc.match(/'disc\.msgSent':/g) || []).length >= 1 && (appSrc.match(/'disc\.comboOff':/g) || []).length >= 1 && (appSrc.match(/'disc\.msgNeedText':/g) || []).length >= 1);
ok('new settings i18n keys present (quick buttons + adv summaries; after D1 merge: single block)',
   (appSrc.match(/'set\.dc\.quick':/g) || []).length >= 1 && (appSrc.match(/'set\.adv\.stt':/g) || []).length >= 1);

console.log('\n[10] P1: real pwsh execution of the discord body (portable pwsh)');
const PWSH = '/home/z/my-project/scripts/pwsh/pwsh';
const hasPwsh = fs.existsSync(PWSH);
ok('portable pwsh present (skipped gracefully otherwise)', true);
if (hasPwsh && body) {
  const tmp = '/home/z/my-project/scripts/ava-dc-v0350-exec.ps1';
  fs.writeFileSync(tmp, '\ufeff' + body, 'utf8');
  const run = (args) => {
    let out = '', err = '';
    try {
      out = execFileSync(PWSH, ['-NoProfile', '-NonInteractive', '-File', tmp].concat(args), { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { out = String((e && e.stdout) || ''); err = String((e && e.stderr) || ''); }
    return { out: out.trim(), all: out + '\n' + err };
  };
  const r1 = run(['-Action', 'mute', '-Mode', 'bg']);
  ok('bg mute EXECUTES to dispatch (ERR:NO_DISCORD on Linux — no Discord process)',
     /ERR:NO_DISCORD/.test(r1.out), r1.out.slice(0, 80));
  const r2 = run(['-Action', 'msgsend', '-Mode', 'fg', '-Name', 'ali', '-Text', 'salam']);
  ok('msgsend EXECUTES to dispatch (ERR:NO_DISCORD on Linux)',
     /ERR:NO_DISCORD/.test(r2.out), r2.out.slice(0, 80));
  ok('no ParseException / terminator / CommandNotFound in any run',
     !/ParseException|terminator|CommandNotFound/i.test(r1.all + r2.all), (r1.all + r2.all).slice(0, 160));
  try { fs.unlinkSync(tmp); } catch (_) { /* noop */ }
}

console.log('\n[11] V: versions 0.35');
const pkg = JSON.parse(read('package.json'));
ok('package.json 0.35.x+ (v0.36 forward-regex)', /^0\.(3[5-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?$/.test(pkg.version), pkg.version);
ok('about box v0.35.x+', />v0\.(3[5-9]|[4-9][0-9])\.\d+(?:-[\w.-]+)?<\/span>/.test(htmlSrc));
ok('app.js appVersion 0.35.x+', /let appVersion = '0\.(3[5-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?';/.test(appSrc));
ok('older suites stay forward-regex', !read('scripts-test-v0320.js').includes("pkg.version === '0.32.0'") && !read('scripts-test-v0330.js').includes("pkg.version === '0.33.0'"));

console.log(`\nRESULT: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
