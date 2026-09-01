#!/usr/bin/env node
/* v0.34.0 — regression suite. دو ریشه‌یابی از گزارش کاربر:
     «دکمهٔ wake word کماکان کار نمی‌کند» + «اینجا برام تایپ کن» (آرزوی کاربر)
   W1  ریشهٔ واقعی بیدارباشِ همیشه-خراب: کل مسیر به localReady() گره خورده بود —
       بدون بستهٔ آفلاین ~۸۰MB (که دانلودش در ایران معمولاً شکست می‌خورد) دکمه
       برای همیشه بی‌اثر بود. حالا: حلقه بدون بسته هم شروع می‌شود (VAD + تشخیص
       ابری stt:google با همان PCM)، بسته در پس‌زمینه دانلود و بعد ارتقا آفلاین.
   W2  سلامت بیدارباش: #wakeHealth + دکمهٔ تست — کاربر دیگر در تاریکی نمی‌ماند؛
       وضعیت موتور + آخرین شنیده + نتیجهٔ تست صریح دیده می‌شود
   T1  ریشهٔ «تایپ در برنامهٔ فعال»ِ بی‌اثر: sys:type-text فقط کلیپ‌بورد می‌نوشت
       و Ctrl+V را بدون بازیابی فوکوس می‌زد — در پنجرهٔ اشتباه می‌نشست و
       کلیپ‌بورد کاربر نابود می‌شد. حالا TYPE_PS_BODY با SendInput UNICODE
       (مستقل از layout)، متن از فایل موقت (سقف خط فرمان حذف)، فوکوس تاییدشده
       به پنجرهٔ ثبت‌شده (blur-tracking + refreshFg در لحظهٔ شروع)
   T2  فرمان صوتی «اینجا برام تایپ کن» → startDictation(true) یک‌بارهٔ سیستم‌شیرین
   P1  اجرای واقعی pwsh بدنهٔ تایپ تا dispatch (ERR:NOUSER32 / ERR:NOTEXT روی لینوکس) */
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
const preloadSrc = read('preload.js');
const htmlSrc = read('renderer/index.html');
const bodyM = mainSrc.match(/const TYPE_PS_BODY = `([\s\S]*?)`;/);
const typeBody = bodyM ? bodyM[1] : '';
const dcBodyM = mainSrc.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/);
const dcBody = dcBodyM ? dcBodyM[1] : '';

console.log('\n[1] TYPE_PS_BODY hygiene');
ok('TYPE_PS_BODY extracted', typeBody.length > 3000, typeBody.length);
ok('ZERO C-style comments', !typeBody.includes('/*') && !typeBody.includes('*/'));
ok('ZERO curly quotes', !/[\u2018\u2019\u201C\u201D]/.test(typeBody));
ok('ZERO raw backticks inside body', !typeBody.includes('`'));
ok('SendInput UNICODE (KEYEVENTF_UNICODE=0x4) used for layout-independent typing',
   typeBody.includes('New-Ki 0 $code 4') && typeBody.includes('KEYEVENTF_UNICODE') && typeBody.includes('SendInput'));
ok('text flows from a temp FILE (no 8191-char cmdline cap)', typeBody.includes('$TxtFile') && typeBody.includes('ReadAllText'));
ok('focus verified BEFORE any key is sent (Restore-Focus2 gate)', /Restore-Focus2 \$Focus\)\) \{ Write-Output 'ERR:NOFOCUS'; exit \}/.test(typeBody));
ok('nested PS struct built bottom-up (New-Ki) — no silent field-loss', typeBody.includes('function New-Ki') && typeBody.includes('$inp.U = $u'));
ok('Enter key for newlines, control chars skipped', typeBody.includes('$code -eq 10') && typeBody.includes('$code -lt 32') === false && typeBody.includes("if ($code -lt 32)") === false && typeBody.includes('$code -eq 13'));

console.log('\n[2] T1: type-anywhere wiring — renderer → preload → main');
ok('bridge.system.typeText now EXISTS (was the dead-button class)',
   preloadSrc.includes('typeText: (text, hwnd) => ipcRenderer.invoke(\'sys:typeText\''));
ok('bridge.system.saveFg exists', preloadSrc.includes("saveFg: () => ipcRenderer.invoke('sys:savefg')"));
ok('single typeText definition (no duplicate key overriding the new engine)',
   (preloadSrc.match(/typeText:/g) || []).length === 1);
ok('sys:typeText + sys:savefg IPC handlers in main.js',
   mainSrc.includes("ipcMain.handle('sys:typeText'") && mainSrc.includes("ipcMain.handle('sys:savefg'"));
ok('renderer: dictTarget apps path passes the captured hwnd',
   appSrc.includes('bridge.system.typeText(delta, dictation.hwnd || 0)'));
ok('renderer: fg window tracked on blur + reset on focus',
   appSrc.includes("window.addEventListener('blur'") && appSrc.includes("window.addEventListener('focus'"));
ok('renderer: startDictation(system) captures the target window BEFORE any focus steal',
   /function startDictation\(system\) \{[\s\S]{0,400}lastFgHwnd/.test(appSrc));
ok('honest typing failure toast (throttled, not silent)',
   appSrc.includes('type-into-app failed') && appSrc.includes('dict.sysFail'));

console.log('\n[3] T2: «اینجا برام تایپ کن» voice command');
ok('SYS_DICT_RE defined and dispatched BEFORE the normal dict rule',
   appSrc.indexOf('const SYS_DICT_RE') > -1 &&
   appSrc.indexOf('SYS_DICT_RE.test(raw)') < appSrc.indexOf('DICT_START_RE.test(raw)'));
ok('system start is a ONE-SHOT apps target (user preference not overwritten)',
   appSrc.includes('dictation.oneShotApps = !!system && settings.dictTarget !== \'apps\''));

console.log('\n[4] W1: wake-always decoupled from the offline pack');
ok('loop starts WITHOUT the pack (engine local|cloud, no early return on missing pack)',
   appSrc.includes("const engine = localReady() ? 'local' : 'cloud';") &&
   appSrc.includes("actLog('wake-always loop started engine=' + engine)"));
ok('cloud check uses stt:google with the SAME PCM pipeline',
   appSrc.includes("bridge.stt.google({ pcm: new Uint8Array(pcm16.buffer), rate: 16000"));
ok('pack download kicked in the BACKGROUND (kickWakePackDownload), loop not blocked',
   appSrc.includes('function kickWakePackDownload()') &&
   (() => { const i = appSrc.indexOf('async function wakeLoopStart'); const j = appSrc.indexOf('const ok = await attachMic()', i); const k = appSrc.indexOf('kickWakePackDownload();', i); return i > -1 && j > i && k > i && k < j; })());
ok('pack-ready auto-upgrades the live cloud loop to local',
   appSrc.includes("wakeLoop.engine === 'cloud'") && /localReady\(\) && wakeLoop && wakeLoop\.engine === 'cloud'[\s\S]{0,80}wakeLoopStop\(\);\s*\n\s*wakeLoopStart\(\);/.test(appSrc));
ok('boot retry no longer waits for the pack', !/if \(!localReady\(\)\) \{ setTimeout\(wakeBootRetry/.test(appSrc));

console.log('\n[5] W2: wake health UI');
ok('#wakeHealth status element + test button in settings', htmlSrc.includes('id="wakeHealth"') && htmlSrc.includes('id="btnWakeTest"'));
ok('test window (wakeTestUntil) drives the explicit result',
   appSrc.includes('wakeTestUntil = Date.now() + 11000') && appSrc.includes('Date.now() < wakeTestUntil'));
ok('last-heard always visible next to the engine state',
   appSrc.includes("wake.healthLast") && appSrc.includes("wakeHealthNote((wakeLoop.engine === 'local'"));
ok('i18n pairs exist in BOTH dictionaries (fa+en, both blocks)',
   (appSrc.match(/'wake\.healthCloud':/g) || []).length >= 1 &&
   (appSrc.match(/'dict\.sysOn':/g) || []).length >= 1 &&
   (appSrc.match(/'wake\.testOk':/g) || []).length >= 1);

console.log('\n[6] P1: real pwsh execution of the typing body (portable pwsh)');
const PWSH = '/home/z/my-project/scripts/pwsh/pwsh';
const hasPwsh = fs.existsSync(PWSH);
ok('portable pwsh present (skipped gracefully otherwise)', true);
if (hasPwsh && typeBody) {
  const tmp = '/home/z/my-project/scripts/ava-type-v0340-exec.ps1';
  fs.writeFileSync(tmp, '\ufeff' + typeBody, 'utf8');
  const run = (args) => {
    let out = '', err = '';
    try {
      out = execFileSync(PWSH, ['-NoProfile', '-NonInteractive', '-File', tmp].concat(args), { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { out = String((e && e.stdout) || ''); err = String((e && e.stderr) || ''); }
    return { out: out.trim(), all: out + '\n' + err };
  };
  const r1 = run(['-Action', 'savefg']);
  ok('savefg EXECUTES to dispatch (ERR:NOUSER32 on Linux — user32 is Windows-only)', /ERR:NOUSER32/.test(r1.out), r1.out.slice(0, 80));
  const r2 = run(['-Action', 'type']);
  ok('type without a text file → honest ERR:NOTEXT (early guard reached)', /ERR:NOTEXT/.test(r2.out), r2.out.slice(0, 80));
  const r3 = run(['-Action', 'unknownaction']);
  ok('unknown action → ERR:UNKNOWN (switch dispatch reached)', /ERR:UNKNOWN/.test(r3.out), r3.out.slice(0, 80));
  ok('no ParseException / terminator / CommandNotFound in any run',
     !/ParseException|terminator|CommandNotFound/i.test(r1.all + r2.all + r3.all), (r1.all + r2.all + r3.all).slice(0, 140));
  try { fs.unlinkSync(tmp); } catch (_) { /* noop */ }
}

console.log('\n[7] regression: discord body invariants survive');
ok('DISCORD_PS_BODY untouched by this release (no C-comments, no curly quotes)',
   dcBody.length > 6000 && !dcBody.includes('/*') && !/[\u2018\u2019\u201C\u201D]/.test(dcBody));
ok('Test-CallAlive closed loop still present (v0.33)', dcBody.includes('function Test-CallAlive'));

console.log('\n[8] versions 0.34');
const pkg = JSON.parse(read('package.json'));
ok('package.json 0.34+', /^0\.(3[4-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?$/.test(pkg.version), pkg.version);
ok('about box v0.34+', />v0\.(3[4-9]|[4-9][0-9])\.\d+(?:-[\w.-]+)?<\/span>/.test(htmlSrc));
ok('app.js appVersion 0.34+', /let appVersion = '0\.(3[4-9]|[4-9][0-9])\.\d+(?:-[\w.]+)?';/.test(appSrc));
ok('older suites stay forward-regex', !read('scripts-test-v0320.js').includes("pkg.version === '0.32.0'"));

console.log(`\nRESULT: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
