/* ============================================================
   scripts-test-v0480.js — v0.49.0-beta (forward-relaxed)
   «حذف کامل تله‌متری + گیت نوع جمله + رجیستری درون‌سایتی»
   ------------------------------------------------------------
   v0.48 تله‌متری داشت؛ v0.49 طبق تصمیم کاربر («ارسال لاگ با گیت‌هاب
   رو کلاً فراموش کن، خودم دستی برات ارسال می‌کنم») کلاً حذف شد.
   این سوئیت حالا «حذفِ درست» را اثبات می‌کند:
   1) telemetry.js موجود نیست + هیچ اثری از آن در main/preload/app/html
   2) مسیر دستی جدید: log:openFolder + «آوا گزارش بفرست» → پوشهٔ لاگ‌ها
   3) نشانه‌های لاگ JSONL (bootId/session/actLog extra) سر جایشان
   4) گیت نوع جمله + رجیستری درون‌سایتی + قانون ۷ + لاگ دایت wake
   5) امنیت — هیچ توکنی در کد نیست
   6) نسخه 0.49.0-beta همه‌جا
   ============================================================ */
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } }

const ROOT = __dirname;
const appSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/app.js'), 'utf8');
const mainSrc = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
const dnsSrc = fs.readFileSync(path.join(ROOT, 'lib/dns-bypass.js'), 'utf8');
const sitesSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/voiceSites.js'), 'utf8'); /* v0.50 */
const intentSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/voiceIntent.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

(async () => {

  /* ---------- 1) حذف کامل تله‌متری ---------- */
  console.log('\n[1] telemetry — حذف کامل');
  ok(!fs.existsSync(path.join(ROOT, 'lib', 'telemetry.js')), 'lib/telemetry.js حذف شده است');
  ok(!mainSrc.includes("require('./lib/telemetry')"), 'main: require تله‌متری نیست');
  ok(!mainSrc.includes('TELE') && !mainSrc.includes('ghFetchFull'), 'main: هیچ اثری از TELE/ghFetchFull');
  ok(!mainSrc.includes("ipcMain.handle('logs:status'") && !mainSrc.includes("ipcMain.handle('logs:sendNow'"), 'main: IPCهای تله‌متری نیست');
  ok(!preloadSrc.includes('logs:status') && !preloadSrc.includes('logs:sendNow'), 'preload: bridge.logs.status/sendNow نیست');
  ok(!appSrc.includes("'tele.") && !appSrc.includes('refreshTeleStatus'), 'app: i18n/وضعیت تله‌متری نیست');
  ok(!htmlSrc.includes('tele.uiTitle') && !htmlSrc.includes('id="optAutoLog"') && !htmlSrc.includes('id="optLogToken"') && !htmlSrc.includes('id="btnLogSend"'), 'index: کارت گزارش خودکار نیست');
  ok(htmlSrc.indexOf('<div') !== -1 && (htmlSrc.split('<div').length === htmlSrc.split('</div>').length), 'index: توازن div سالم');

  /* ---------- 2) مسیر دستی جدید ---------- */
  console.log('\n[2] مسیر دستی — log:openFolder + «گزارش بفرست»');
  ok(mainSrc.includes("ipcMain.handle('log:openFolder'") && mainSrc.includes('shell.openPath(d)'), 'main: IPC باز کردن پوشهٔ لاگ‌ها');
  ok(preloadSrc.includes("openFolder: () => ipcRenderer.invoke('log:openFolder')"), 'preload: bridge.logs.openFolder');
  ok(appSrc.includes('bridge.logs.openFolder') && appSrc.includes("t('report.folder')"), 'app: گزارش صوتی → پوشهٔ لاگ‌ها باز می‌شود');
  ok(!appSrc.includes("'report.sent'") && appSrc.includes("'report.folder'"), 'app: i18n جدید جایگزین report.sent');

  /* ---------- 3) لاگ JSONL سر جایش ---------- */
  console.log('\n[3] لاگ ساخت‌یافته — JSONL، bootId، session');
  ok(mainSrc.includes("const AVA_BOOT_ID = 'b'"), 'main: شناسهٔ نشست AVA_BOOT_ID');
  ok(mainSrc.includes("function actLog(line, tag = 'app', extra = null)"), 'main: actLog با extra');
  ok(mainSrc.includes("fs.appendFileSync(jf, JSON.stringify(rec) + '\\n')"), 'main: نوشتن JSONL خط‌به‌خط');
  ok(mainSrc.includes("ch: 'session', ev") && mainSrc.includes("logSessionMarker('boot'") && mainSrc.includes("logSessionMarker('quit'") && mainSrc.includes("logSessionMarker('crash'"), 'main: مارکرهای boot/quit/crash');
  ok(appSrc.includes("{ ev: 'utterance', ms: Date.now() - h0, res: _dispatchOutcome || 'done' }"), 'app: لاگ نهایی utterance ساخت‌یافته');
  ok(dnsSrc.includes("'api.github.com'") && dnsSrc.includes("'github.com'"), 'dns-bypass: پین گیت‌هاب (آپدیتر)');

  /* ---------- 4) گیت نوع جمله + رجیستری + لاگ دایت ---------- */
  console.log('\n[4] v0.49 — گیت + رجیستری + دایت');
  ok(intentSrc.includes('function gateType(cmd)') && intentSrc.includes('function blocksActionRule(cmd, ruleId)'), 'voiceIntent: گیت نوع جمله');
  ok(intentSrc.includes("'correction'") && intentSrc.includes("'multi-step'") && intentSrc.includes("'question'") && intentSrc.includes("'smart-find'") && intentSrc.includes("'noun-phrase'"), 'voiceIntent: پنج نوع جمله');
  ok(/AVAIntent\.blocksActionRule\((?:cmd|vcText), rule\.id\)/.test(appSrc) && appSrc.includes("ev: 'gate'"), 'app: گیت در runCommand وصل است + لاگ ساخت‌یافته gate (v0.61: روی vcText)');
  ok(sitesSrc.includes('SITE_QUERY_REGISTRY') && sitesSrc.includes("'https://divar.ir/s/' + (city || 'tehran') + '?q=' + encodeURIComponent(q)"), 'voiceSites: رجیستری درون‌سایتی شهر-محور (v0.50 — ریشهٔ ۴۰۴ دیوار)');
  ok(appSrc.includes('function siteUrlFix(url)') && appSrc.includes('siteUrlFix(x.value)'), 'app: بازسازی URL پس از AI (executeDoActions)');
  ok(appSrc.includes('دیوار=divar.ir/s/{شهر-با-حروف-انگلیسی}?q='), 'app: قانون ۵ با قالب شهری دیوار (v0.50 — بجنورد→bojnurd)');
  ok(appSrc.includes('قانون مهم ۷ (بسیار مهم)'), 'app: قانون ۷ — درخواست چندمرحله‌ای/پیدا کن');
  ok(appSrc.includes('لاگ دایت: نویز محض'), 'app: نویز wake از لاگ حذف شد (فقط آمار)');

  /* ---------- 5) امنیت ---------- */
  console.log('\n[5] امنیت');
  ok(!/ghp_[A-Za-z0-9]{20,}/.test(mainSrc + appSrc + preloadSrc + htmlSrc + dnsSrc + intentSrc), 'هیچ ghp_… واقعی در سورس نیست');

  /* ---------- 6) نسخه ---------- */
  console.log('\n[6] نسخه 0.61.0-beta');
  ok(pkg.version === '0.61.0-beta', 'package.json 0.60.0-beta');
  ok(htmlSrc.includes('<span id="abVersion">v0.61.0-beta</span>'), 'index.html abVersion');
  ok(appSrc.includes("let appVersion = '0.61.0-beta';"), 'app.js appVersion');
  ok(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').includes('۰.۶۱.۰-بتا'), 'README بلاک ۰.۵۳ (ارقام فارسی)');

  console.log('\n==========================================');
  console.log('scripts-test-v0480(relaxed): ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);

})().catch((e) => { console.error('SUITE ERROR:', e); process.exit(1); });
