#!/usr/bin/env node
/* scripts-test-v0600f.js — Wave 4: PACKAGE A (A19–A22) + PACKAGE B (B1–B8) — main.js + lib/dns-bypass.js (v0.60.0-beta line)
   ------------------------------------------------------------
   چک‌ها:
     [1] A19 — نصّاب آپدیتر: .part + rename + پاکسازی لغو/خطا + گارد complete/size در updater:install
     [2] B1  — گارد will-attach-webview پنجرهٔ اصلی (فقط ava:// و z.ai؛ بدون nodeIntegration/preload مهمان)
     [3] B2  — allowlist پاپ‌آپ با hostname دقیق (new URL + dot-boundary) و حذف regex پیشوندی + آزمون زندهٔ دورزدن‌ها
     [4] B3  — custom:run: فهرست سیاه (آزمون زنده) + سقف نرخ ۶/۶۰s + لاگ طول/سرِ اسکریپت + بدون ConstrainedLanguage
     [5] B4  — media/audioCapture فقط برای ava://app (request + check) + لاگ رد؛ پارتیشن persist:ai مثل قبل
     [6] B5  — music:readHead محدود به allowlist مشترک mediaDirAllowed + MUSIC_EXT_RE + لاگ رد
     [7] B6  — dns-bypass: ددلاین AbortController + یک retry + فالبک سیستم در CLI؛ rejectUnauthorized:false دست‌نخورده
     [8] A21 — regex فید اتم نسخهٔ -beta را می‌گیرد (آزمون زندهٔ regex واقعی main.js)
     [9] B8  — صفرِ `start` لختِ URL؛ بازکردن https با shell.openExternal؛ پوشه/فایل/برنامه‌ها دست‌نخورده
     [10] A22 — هندلر مردهٔ sys:type-text (خط‌تیره) حذف؛ sys:typeText زنده؛ try/catch خالی حذف
     [11] A20 — بستن پنجرهٔ اصلی: destroy zaiWin/ytWin + خروج وقتی PiP باز نیست
     [12] B7  — حلقهٔ PS نگهبان PTT: چک زنده‌بودن پدر هر ~۵ ثانیه با PID واقعی
*/
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

const mainSrc = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const dnsSrc = fs.readFileSync(path.join(ROOT, 'lib/dns-bypass.js'), 'utf8');
/* v0.61 — پنجرهٔ شناور (pipWindowManager.js) حذف شد؛ پین‌های مربوط به آن منقضی‌اند */

/* ============================================================
   [1] A19 — نصّاب ناقص بعد از لغو/خطا
   ============================================================ */
console.log('\n[1] A19 — .part + rename + پاکسازی + گارد complete/size');
ok(mainSrc.includes("const partFile = file + '.part';"), 'مسیر موقت .part ساخته می‌شود (نه نوشتن روی مسیر نهایی)');
ok(mainSrc.includes('ghDownloadToFile(url, partFile,'), 'ghDownloadToFile داخل .part می‌نویسد');
ok(mainSrc.includes('fs.renameSync(partFile, file);'), 'بعد از موفقیت → rename به مسیر نهایی');
ok(mainSrc.includes("manualDl = { file, partFile, version: meta.version, url, size: meta.size || 0, active: true, cancel: false, complete: false }"),
  'manualDl سایزِ رسمی (meta.size) و پرچم complete را نگه می‌دارد');
ok(mainSrc.includes('if (manualDl.size && st.size !== manualDl.size) throw') && mainSrc.includes("if (!manualDl.size && st.size < 1024) throw"),
  'صحت‌سنجی سایز بعد از دانلود (سایز رسمی یا حداقل ۱KB)');
ok(mainSrc.includes('fs.unlinkSync(manualDl.partFile)'), 'لغو/خطا/timeout → فایل نیمه‌کاره حذف می‌شود');
ok((mainSrc.match(/manualDl\.file = null;/g) || []).length >= 2, 'manualDl.file در پاکسازی خالی می‌شود (×۲: خطا + ردِ سایز)');
ok(mainSrc.includes('manualDl.file && manualDl.complete && fs.existsSync(manualDl.file)'), 'updater:install فقط نصّابِ complete را می‌پذیرد');
ok(mainSrc.includes('fs.statSync(manualDl.file).size === manualDl.size'), 'updater:install سایز نصّاب را با سایز ثبت‌شده می‌سنجد');
ok(mainSrc.includes('shell.openPath(manualDl.file)'), 'مسیر بازکردن نصّاب (پین smoke v14) حفظ شده');
ok(mainSrc.includes('partial file removed') && mainSrc.includes('failed size verification'), 'لاگ‌های صادقانهٔ پاکسازی/رد');

/* ============================================================
   [2] B1 — will-attach-webview پنجرهٔ اصلی
   ============================================================ */
console.log('\n[2] B1 — گارد will-attach-webview پنجرهٔ اصلی');
const b1 = /win\.webContents\.on\('will-attach-webview'[\s\S]*?\}\);/.exec(mainSrc);
ok(!!b1, 'پنجرهٔ اصلی هندلر will-attach-webview دارد');
const b1Body = b1 ? b1[0] : '';
ok(b1Body.includes('webPreferences.nodeIntegration = false') && b1Body.includes('webPreferences.contextIsolation = true'),
  'پارامترهای مهمان: nodeIntegration=false + contextIsolation=true');
ok(b1Body.includes('delete webPreferences.preload'), 'preload مهمان حذف می‌شود');
ok(b1Body.includes("h === 'chat.z.ai'") && b1Body.includes("h.endsWith('.z.ai')") && b1Body.includes("u.protocol === 'ava:'"),
  'allowlist: فقط ava:// و chat.z.ai (مرز نقطه‌ای)');
ok(b1Body.includes('e.preventDefault()') && b1Body.includes('webview attach BLOCKED'), 'بقیه preventDefault + لاگ صادقانه');
/* v0.61 — گارد PiP حذف شد (پنجرهٔ شناور برچیده شد)؛ گارد پنجرهٔ اصلی می‌ماند */
ok(!fs.existsSync(path.join(ROOT, 'pipWindowManager.js')), 'v0.61: پنجرهٔ شناور حذف شده (فایل نیست)');
ok((mainSrc.match(/\.on\('will-attach-webview'/g) || []).length === 1, 'دقیقاً یک گارد webview فعال: پنجرهٔ اصلی (PiP حذف شده)');

/* ============================================================
   [3] B2 — allowlist پاپ‌آپ: hostname دقیق
   ============================================================ */
console.log('\n[3] B2 — پاپ‌آپ: new URL + dot-boundary (بدون regex پیشوندی)');
ok(!mainSrc.includes('([^\\/]*\\.)?(z\\.ai'), 'regex پیشوندی قدیمی حذف شده (مسیر دورزدن بسته)');
ok(mainSrc.includes('new URL(u).hostname.toLowerCase()'), 'hostname با new URL پارس می‌شود');
ok(mainSrc.includes("host === h || host.endsWith('.' + h)"), 'مقایسهٔ دقیق یا زیردامنه با مرز نقطه');
ok(mainSrc.includes('/^accounts\\.google\\.[a-z.]+$/'), 'الگوی accounts.google.* حفظ شده');
const arrM = /const POPUP_HOSTS = \[([^\]]+)\]/.exec(mainSrc);
ok(!!arrM, 'POPUP_HOSTS تعریف شده');
if (arrM) {
  const POPUP_HOSTS = new Function('return [' + arrM[1] + ']')();
  const hostOk = (u) => {
    let host = '';
    try { host = new URL(u).hostname.toLowerCase(); } catch (_) { host = ''; }
    return POPUP_HOSTS.some((h) => host === h || host.endsWith('.' + h)) || /^accounts\.google\.[a-z.]+$/.test(host);
  };
  ok(hostOk('https://accounts.google.com/o/oauth2/auth?x=1'), 'زیردامنهٔ واقعی گوگل می‌گذرد (OAuth)');
  ok(hostOk('https://chat.z.ai/'), 'chat.z.ai می‌گذرد');
  ok(hostOk('https://bigmodel.cn/x') && hostOk('https://a.b.googleusercontent.com/y'), 'bigmodel.cn و زیردامنهٔ googleusercontent می‌گذرند');
  ok(!hostOk('https://google.com.evil.com'), 'دورزدن ۱ رد شد: google.com.evil.com');
  ok(!hostOk('https://google.com@evil.com'), 'دورزدن ۲ رد شد: google.com@evil.com (hostname واقعی evil.com)');
  ok(!hostOk('https://evil-z.ai/'), 'دامنهٔ جعلیِ پسونددار رد شد: evil-z.ai');
  ok(!hostOk('https://notgoogle.com/'), 'دامنهٔ ناآزاد رد شد');
}
ok(mainSrc.includes("const opts = wc.hostWebContents ? { webPreferences: { partition: 'persist:ai' } } : {};"),
  'رفتار پاپ‌آپ مجاز عین قبل: پنجرهٔ درون‌برنامه‌ای با persist:ai');
ok(mainSrc.includes("if (/^https?:\\/\\//i.test(u)) shell.openExternal(u);"), 'بقیهٔ لینک‌ها مثل قبل به مرورگر سیستم می‌روند');

/* ============================================================
   [4] B3 — custom:run: فهرست سیاه + سقف نرخ + لاگ
   ============================================================ */
console.log('\n[4] B3 — custom:run: deny-list (زنده) + rate cap + لاگ کامل');
ok(/custom:run[\s\S]{0,400}-EncodedCommand/.test(mainSrc), 'پین v0381: -EncodedCommand نزدیک custom:run سالم');
const denyArrM = /const CUSTOM_RUN_DENY_RE = new RegExp\(\[([\s\S]*?)\]\.join\('\|'\), 'i'\)/.exec(mainSrc);
ok(!!denyArrM, 'CUSTOM_RUN_DENY_RE با فهرست ویرانگری تعریف شده (case-insensitive)');
if (denyArrM) {
  /* رشته‌های استخراج‌شده «متن سورس» لیترال‌های JS هستند — مثل خود main.js ارزیابی می‌شوند */
  const parts = [...denyArrM[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => new Function("return '" + x[1] + "'")());
  const RE = new RegExp(parts.join('|'), 'i');
  const mustMatch = ['format c:', 'FORMAT /q C:', 'diskpart', 'Remove-Item -Recurse -Force C:\\x', 'rd /s C:\\tmp', 'del /s *.*',
    'reg delete HKLM', 'vssadmin delete shadows', 'bcdedit /set', 'cipher /w:C', 'Invoke-WebRequest http://x -OutFile a.exe',
    '[Net.WebClient]::DownloadFile("http://x","y")', 'certutil -urlcache -f http://x a.exe', 'bitsadmin /transfer b http://x c:y'];
  const mustNot = ['Get-Process | Format-Table', 'Format-List', 'Remove-Item -Recurse -Force ./build', 'del x.txt',
    'Invoke-WebRequest http://x', 'reg query HKLM', 'Get-ChildItem | Format-Table -AutoSize'];
  ok(mustMatch.every((s) => RE.test(s)) && !mustNot.some((s) => RE.test(s)),
    'آزمون زندهٔ فهرست سیاه: ' + mustMatch.length + ' دستور خطرناک رد، ' + mustNot.length + ' اسکریپت سالم پاس (بدون FP روی Format-Table)');
}
ok(mainSrc.includes('const customRunTimes = [];') && mainSrc.includes('customRunTimes.length >= 6') && mainSrc.includes('> 60000'),
  'سقف نرخ: ۶ اجر در پنجرهٔ ۶۰ ثانیه‌ای غلتان (حافظهٔ درون‌پردازشی)');
ok(mainSrc.includes('custom:run REFUSED (deny-list:') && mainSrc.includes('custom:run REFUSED (rate cap 6/60s)'),
  'ردشدن‌ها با لاگ صادقانه + علت');
ok((mainSrc.match(/custom:run len=\$\{s\.length\}/g) || []).length === 1 && (mainSrc.match(/s\.slice\(0, 120\)\.replace\(\/\[\\x00-\\x1f\\x22\]\/g, ' '\)/g) || []).length >= 3,
  'لاگ کامل هر اجر: طول + ۱۲۰ نویسهٔ اول پاک‌سازی‌شده');
ok(!/powershell[^\n]*-ConstrainedLanguage/.test(mainSrc) && !/`powershell[^\n]*ConstrainedLanguage/.test(mainSrc),
  '-ConstrainedLanguage در هیچ فرمان PowerShell استفاده نشد (فقط در کامنت فیوچر — قابلیت کاربر آزاد می‌ماند)');

/* ============================================================
   [5] B4 — مجوز میکروفون فقط برای مببع برنامه
   ============================================================ */
console.log('\n[5] B4 — media/audioCapture فقط برای ava://app + پارتیشن z.ai');
ok((mainSrc.match(/permission === 'media' \|\| permission === 'audioCapture'/g) || []).length >= 2,
  'گارد origin هم در setPermissionRequestHandler هم در setPermissionCheckHandler');
ok(mainSrc.includes("requestOrigin") && mainSrc.includes('requestingUrl'), 'مببع از requestOrigin/requestingUrl خوانده می‌شود');
ok(mainSrc.includes("/^ava:\\/\\//i.test(originOf(wc, details, requestingOrigin))"), 'فقط ava:// مجاز است');
ok(mainSrc.includes('permission DENIED') , 'ردشدن با لاگ صادقانه ثبت می‌شود');
ok(mainSrc.includes('aiSes.setPermissionRequestHandler'), 'هندلر اختصاصی پارتیشن persist:ai (صفحات z.ai) مثل قبل مجاز');
ok(mainSrc.includes("callback(allow.includes(permission))"), 'بقیهٔ مجوزها (fullscreen/notifications/…) رفتار قبلی');

/* ============================================================
   [6] B5 — music:readHead محدود به allowlist مشترک
   ============================================================ */
console.log('\n[6] B5 — music:readHead فقط داخل allowlist مدیا + پسوند موزیک');
ok((mainSrc.match(/mediaDirAllowed/g) || []).length >= 4, 'allowlist مشترک mediaDirAllowed (تعریف + ava-media + readHead + کامنت)');
ok(mainSrc.includes('if (!mediaDirAllowed(f)) {'), 'readHead مسیر خارج از allowlist را رد می‌کند');
ok(mainSrc.includes('MUSIC_EXT_RE.test(path.basename(f))'), 'readHead فقط پسوند موزیک را می‌پذیرد');
ok(mainSrc.includes('music:readHead DENIED'), 'ردشدن با لاگ صادقانه');
ok(!mainSrc.includes('_allowed'), 'بلوک allowlist درون‌خطی قدیمی (B21) به تابع مشترک منتقل شد');
ok(mainSrc.includes("ipcMain.handle('music:readHead'"), 'هندلر (پین smoke v-music) سر جایش');

/* ============================================================
   [7] B6 — dns-bypass: ددلاین + retry + فالبک سیستم؛ TLS دست‌نخورده
   ============================================================ */
console.log('\n[7] B6 — DoH: AbortController + یک retry + فالبک سیستم (CLI)');
ok(dnsSrc.includes('new AbortController()') && dnsSrc.includes('signal: ac ? ac.signal : undefined') && dnsSrc.includes('deadlineMs'),
  'سقف زمانی مطلق DoH با AbortController (~۳ ثانیه)');
ok(dnsSrc.includes('retryBudgetMs') && dnsSrc.includes('فقط یک تلاش دوباره'), 'یک retry روی شکست DoH — با بودجهٔ زمانی');
ok(dnsSrc.includes('dnsMod.lookup') && dnsSrc.includes('systemLookup') && dnsSrc.includes('require(\'dns\')'),
  'فالبک رزولوشن سیستم (dns.lookup) در مسیر CLI');
ok(dnsSrc.includes('rejectUnauthorized: false'), 'rejectUnauthorized:false عمداً دست‌نخورده (rationale تقویت‌شده — TLS همین‌طور)');
ok(/rationale عمدی/.test(dnsSrc) && dnsSrc.includes('نمی‌تواند ترافیک برنامه را MITM کند'), 'کامنت rationale تقویت‌شده');
ok(dnsSrc.includes("'https://free.shecan.ir/dns-query'"), 'DOH_ENDPOINTS سر جایش');
ok(mainSrc.includes('dohTimeoutMs: 1500'), 'بودجهٔ DoH بوت با retry سازگار (۱۵۰۰ms — زیر سقف ۴s کل CLI)');

/* ============================================================
   [8] A21 — regex فید اتم نسخه‌های -beta را می‌گیرد (زنده)
   ============================================================ */
console.log('\n[8] A21 — regex اتم: v0.57.0-beta هم می‌افتد');
const atomM = /const m = (\/.*\/)\.exec\(xml\);/.exec(mainSrc);
ok(!!atomM, 'regex اتم استخراج شد');
if (atomM) {
  const literal = atomM[1];
  const lastSlash = literal.lastIndexOf('/');
  const re = new RegExp(literal.slice(1, lastSlash), literal.slice(lastSlash + 1));
  ok(re.exec('<id>tag:github.com,2008:https://github.com/x/y/releases/tag/v0.57.0-beta</id>')[1] === 'v0.57.0-beta',
    'ورژن بتا (v0.57.0-beta) از فید اتم می‌افتد');
  ok(re.exec('<id>https://github.com/x/y/releases/tag/v0.60.0-beta.1</id>')[1] === 'v0.60.0-beta.1',
    'پیش‌ریلیز با نقطهٔ پسوند (v0.60.0-beta.1) هم می‌افتد');
  ok(re.exec('<id>https://github.com/x/y/releases/tag/v1.2.3</id>')[1] === 'v1.2.3', 'ورژن ساده (v1.2.3) مثل قبل');
  ok(/\/tag\/(v?\d+\.\d+\.\d+)</.exec('<id>https://github.com/x/y/releases/tag/v0.57.0-beta</id>') === null,
    'regex قدیمی همین نمونه را از دست می‌داد (ریشهٔ باگ A21)');

}

/* ============================================================
   [9] B8 — صفرِ `start` لختِ URL؛ openExternal جایگزین
   ============================================================ */
console.log('\n[9] B8 — بازکردن URL از shell.openExternal (بدون cmd.exe)');
ok((mainSrc.match(/start "" "https|'start https|start https:\//g) || []).length === 0, 'صفر `start` لختِ https در main.js');
ok((mainSrc.match(/URL_OPEN_MARKER/g) || []).length >= 9, 'URL_OPEN_MARKER قرارداد خروجی sys:run را نگه می‌دارد (≥۹ مصرف؛ v0.61: مصرف pip_youtube حذف شد)');
ok((mainSrc.match(/shell\.openExternal/g) || []).length >= 10, 'بازکردن‌های https از shell.openExternal (الگوی sys:open-url)');
ok(mainSrc.includes("cmd: 'start chrome'") && mainSrc.includes("'start \"\" \"shell:Downloads\"'") && mainSrc.includes('start "" "${hit.exe}"'),
  'بازکردن برنامه/پوشه/فایل عمداً روی `start` ماند (خارج از دامنهٔ B8)');
ok(mainSrc.includes('openWithDefaultPlayer(watch)') && mainSrc.includes('ava_player'), 'پین v0610 (پلی کن → پلیر پیش‌فرض کاربر) سالم');
ok(mainSrc.includes('youtube_search: { cmd: (a) => { try { shell.openExternal'), 'youtube_search مهاجرت شد');
ok(mainSrc.includes("if (q) shell.openExternal(`https://www.google.com/search?q="), 'web_search مهاجرت شد');

/* ============================================================
   [10] A22 — هندلر مرده + try/catch خالی
   ============================================================ */
console.log('\n[10] A22 — حذف sys:type-text مرده + try/catch خالی');
ok(!mainSrc.includes("ipcMain.handle('sys:type-text'"), "هندلر مردهٔ 'sys:type-text' (خط‌تیره) حذف شد");
ok(mainSrc.includes("ipcMain.handle('sys:typeText'"), "کانال زندهٔ 'sys:typeText' سر جایش (preload/renderer وابسته به آن)");
ok(!/try \{\s*\} catch/.test(mainSrc), 'try{}catch خالی حذف شد');

/* ============================================================
   [11] A20 — بستن پنجرهٔ اصلی: helperها destroy + خروج
   ============================================================ */
console.log('\n[11] A20 — شبح‌شدن اپ: بستن پنجرهٔ اصلی helperها را جمع می‌کند');
const closedM = /win\.on\('closed'[\s\S]*?\n  \}\);/.exec(mainSrc);
ok(!!closedM, 'بلوک win.on(closed) گسترش یافته');
const closedBody = closedM ? closedM[0] : '';
/* v0.61 — ytWin/PiP حذف شدند؛ فقط zaiWin destroy می‌شود و اپ خروج می‌کند */
ok(closedBody.includes('zaiWin.destroy()') && closedBody.includes('app.quit()'), 'zaiWin destroy می‌شود و اپ خروج می‌کند (ytWin/PiP حذف)');
ok(!closedBody.includes('ytWin.destroy()'), 'v0.61: ytWin دیگر وجود ندارد');
ok(!mainSrc.includes('pipManager'), 'v0.61: هیچ ارجاعی به pipManager در main.js نیست');
ok(/app\.on\('window-all-closed'[\s\S]{0,80}app\.quit\(\)/.test(mainSrc), 'window-all-closed → app.quit() (رفتار ویندوز) حفظ شد');

/* ============================================================
   [12] B7 — نگهبان PTT: چک زنده‌بودن پدر
   ============================================================ */
console.log('\n[12] B7 — watcher PTT: هر ~۵ ثانیه چک پدر با PID واقعی');
ok(mainSrc.includes("'$pp=' + Number(process.pid || 0)"), 'PID واقعی پدر داخل اسکریپت PS تزریق می‌شود');
ok(mainSrc.includes('Get-Process -Id $pp') && mainSrc.includes('if($t -ge 143)'), 'هر ~۵ ثانیه (۱۴۳×۳۵ms) چک پدر — نبود → exit');
ok(mainSrc.indexOf('Add-Type -TypeDefinition $s') < mainSrc.indexOf('while($true)'), 'پین v0530: Add-Type قبل از حلقه');
ok(mainSrc.includes('$prev=$false') && mainSrc.includes('Start-Sleep -Milliseconds 35') && mainSrc.includes("spawn('powershell.exe'"),
  'پین‌های v0530 (لبه‌ها/پول ۳۵ms/spawn) سالم');
ok(mainSrc.includes('GetAsyncKeyState'), 'پین v0510: GetAsyncKeyState سالم');

console.log('\n-----------------------------');
console.log(`RESULT: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
