#!/usr/bin/env node
/* scripts-test-v0570.js — doctest v0.62.0-beta
   درخواست کاربر: «تنظیمات رو تمیز کن فقط — کل صفحه تنظیمات یکم نا مرتبه حس میکنم — با دقت»
   (روی پایهٔ v0.54.0-beta — بدون هیچ ویژگی v0.55/0.56)
   چک‌ها:
     1) ناوبری گروهی — ۴ گروه (گفتار / صدا و هوش / اتصال‌ها / سیستم) + ۱۱ آیتم + آیکون درست دیسکورد
     2) جداکنندهٔ یکنواخت — کلاس first روی ردیف اولِ هر پنل/بخش پیشرفته + حذف first-of-type + فالبک تم روشن
     3) زیرتیترهای پنل برنامه (۴ زیرتیتر + ترتیب) + جابه‌جایی گزارش خطاها کنار پیوندها
     4) صفر استایل inline در صفحهٔ تنظیمات + کلاس‌های ptt-controls/w150/w190 + تولتیپ دوزبانه PTT
     5) i18n — ۹ کلید تازه هر یک بار (دیکشنری ادغام‌شدهٔ D1 — بلوک مرده حذف شد) با جفت فارسی/انگلیسی
     6) نگهبان‌های ساختاری — ترتیب پنل‌ها، تگ‌های دقیق، یکتایی idهای حیاتی، گارد showSettingsPane
     7) نسخه 0.62.0-beta چهارگانه
*/
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

const appSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/app.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(ROOT, 'renderer/css/styles.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

/* برش صفحهٔ تنظیمات (از settingsPage تا historyPage) */
const spA = htmlSrc.indexOf('id="settingsPage"');
const spB = htmlSrc.indexOf('id="historyPage"');
const setSrc = (spA > -1 && spB > spA) ? htmlSrc.slice(spA, spB) : '';
ok(setSrc.length > 1000, 'برش صفحهٔ تنظیمات استخراج شد');

console.log('\n[1] ناوبری گروهی — چهار گروه + ۱۱ آیتم');
ok((setSrc.match(/<div class="set-nav-group" data-i18n="/g) || []).length === 4, 'دقیقاً ۴ برچسب گروه در ناوبری');
ok(setSrc.includes('data-i18n="set.navg.speak"') && setSrc.includes('data-i18n="set.navg.voice"') &&
   setSrc.includes('data-i18n="set.navg.connect"') && setSrc.includes('data-i18n="set.navg.system"'),
   'کلیدهای گروه: speak/voice/connect/system');
ok((setSrc.match(/<button class="set-nav-item/g) || []).length === 11, 'هر ۱۱ آیتم ناوبری سر جایش است');
ok(setSrc.includes('<button class="set-nav-item active" data-pane="mic"'), 'آیتم پیش‌فرض = میکروفون (active)');
ok(setSrc.lastIndexOf('set.navg.speak') < setSrc.lastIndexOf('data-pane="mic"') &&
   setSrc.lastIndexOf('set.navg.voice') < setSrc.lastIndexOf('data-pane="voice"') &&
   setSrc.lastIndexOf('set.navg.connect') < setSrc.lastIndexOf('data-pane="discord"') &&
   setSrc.lastIndexOf('set.navg.system') < setSrc.lastIndexOf('data-pane="perf"'),
   'هر برچسب گروه دقیقاً قبل از اولین آیتم گروهش (در ناوبری — آخرین رخداد)');
ok(/data-pane="discord"[^>]*><svg class="ic"><use href="#i-disc"\/>/.test(setSrc), 'دیسکورد آیکون واقعی i-disc گرفت');
ok(!/<button class="set-nav-item[^"]*" data-pane="dns"/.test(setSrc), 'آیتم dns همچنان وجود ندارد (پین smoke)');
ok(/<button class="set-nav-item" data-pane="stt"/.test(setSrc), 'کلاس‌های ناوبری بدون فاصلهٔ اضافی (تمیز)');

console.log('\n[2] جداکنندهٔ یکنواخت — first صریح به‌جای first-of-type');
ok(cssSrc.includes('.set-row.first { border-top: none; }'), 'CSS: قانون .set-row.first اضافه شد');
ok(!cssSrc.includes('.set-row:first-of-type'), 'CSS: قانون شکنندهٔ first-of-type حذف شد');
ok(cssSrc.includes('[data-theme="light"] .set-row.first { border-top: none; }') &&
   cssSrc.includes('[data-theme="light"] .set-subhead + .set-row { border-top: none; }'),
   'فالبک تم روشن برای first و زیرتیتر');
const rowFirst = (setSrc.match(/class="set-row( col)? first"/g) || []).length;
ok(rowFirst === 14, 'دقیقاً ۱۴ ردیفِ اول (۱۱ پنل + ۲ بخش پیشرفته + پنل برنامه با زیرتیتر) — یافت‌شده: ' + rowFirst);
const paneIds = ['mic', 'stt', 'wake', 'dict', 'voice', 'ai', 'discord', 'ext', 'perf', 'app', 'update'];
let paneFirstOk = true;
for (const p of paneIds) {
  const a = setSrc.indexOf('<div class="set-pane' + (p === 'mic' ? ' active' : '') + '" data-pane="' + p + '">');
  const b = setSrc.indexOf('<div class="set-pane', a + 10);
  const slice = setSrc.slice(a, b > a ? b : undefined);
  const m = slice.match(/<(?:div|label) class="set-row( col)?"/);
  const mFirst = slice.match(/<(?:div|label) class="set-row( col)? first"/);
  if (!mFirst || (m && m.index < mFirst.index)) { paneFirstOk = false; console.log('    ✗ پنل ' + p); }
}
ok(paneFirstOk, 'در همهٔ ۱۱ پنل، اولین ردیف کلاس first دارد و هیچ ردیفی قبلش نیست');
let advFirstOk = true;
for (const mAdv of setSrc.matchAll(/<details class="set-adv">/g)) {
  const end = setSrc.indexOf('</details>', mAdv.index);
  const slice = setSrc.slice(mAdv.index, end);
  if (!/<(?:div|label) class="set-row( col)? first"/.test(slice)) advFirstOk = false;
}
ok(advFirstOk && (setSrc.match(/<details class="set-adv">/g) || []).length >= 3,
   'در هر ۳ بخش «پیشرفته»، اولین ردیف هم first دارد');

console.log('\n[3] زیرتیترهای پنل برنامه + جابه‌جایی گزارش خطاها');
ok((setSrc.match(/<div class="set-subhead" data-i18n="/g) || []).length === 4, 'دقیقاً ۴ زیرتیتر');
ok(setSrc.includes('data-i18n="set.sub.appLook"') && setSrc.includes('data-i18n="set.sub.appRun"') &&
   setSrc.includes('data-i18n="set.sub.appMem"') && setSrc.includes('data-i18n="set.sub.appMisc"'),
   'کلیدهای زیرتیتر: appLook/appRun/appMem/appMisc');
ok(setSrc.indexOf('set.sub.appLook') < setSrc.indexOf('set.app.lang') &&
   setSrc.indexOf('set.sub.appRun') < setSrc.indexOf('set.app.top') &&
   setSrc.indexOf('set.sub.appMem') < setSrc.indexOf('rem.uiTitle') &&
   setSrc.indexOf('set.sub.appMisc') < setSrc.indexOf('set.app.errCopy') &&
   setSrc.indexOf('set.app.errCopy') < setSrc.indexOf('set.app.links'),
   'ترتیب گروه‌های پنل برنامه درست است');
ok(setSrc.indexOf('id="btnCopyErrors"') > setSrc.indexOf('id="learnList"'),
   '«گزارش خطاها» حالا بعد از یادگیری‌ها (کنار پیوندها) است');
ok(setSrc.indexOf('id="btnCopyErrors"') > setSrc.indexOf('id="optSafeMode"'),
   'موقعیت قدیمی گزارش خطاها (وسط گروه پنجره و شروع) خالی شد');

console.log('\n[4] صفر استایل inline + کلاس‌های تمیز در تنظیمات');
ok(!/ style="/.test(setSrc), 'هیچ style= داخل صفحهٔ تنظیمات نیست (۵ استایل inline حذف شد)');
ok(setSrc.includes('class="ptt-controls"'), 'کارت PTT از کلاس ptt-controls استفاده می‌کند');
ok(setSrc.includes('class="set-select w190"') && setSrc.includes('class="set-input w150"'),
   'عرض‌های ثابت با کلاس w190/w150 (بدون استایل inline)');
ok(setSrc.includes('data-i18n-tip="set.ptt.onoff"'), 'تولتیپ سوییچ PTT دوزبانه شد');
ok(cssSrc.includes('.ptt-controls {') && cssSrc.includes('.set-input.w150 {') && cssSrc.includes('.set-select.w190 {') &&
   cssSrc.includes('.set-subhead {') && cssSrc.includes('.set-nav-group {'),
   'همهٔ کلاس‌های تازه در CSS تعریف شده‌اند');
ok(cssSrc.includes('.set-nav-group { display: none; }'), 'برچسب گروه‌ها در ناوبری افقی موبایل مخفی می‌شود');
ok(cssSrc.includes('width: 172px'), 'عرض ناوبری برای برچسب گروه‌ها کمی باز شد');

console.log('\n[5] i18n — ۹ کلید تازه (دیکشنری ادغام‌شدهٔ D1 — تعریف یکتا)');
const newKeys = ['set.navg.speak', 'set.navg.voice', 'set.navg.connect', 'set.navg.system',
  'set.sub.appLook', 'set.sub.appRun', 'set.sub.appMem', 'set.sub.appMisc', 'set.ptt.onoff'];
let i18nOk = true;
for (const k of newKeys) {
  const n = appSrc.split("'" + k + "'").length - 1;
  if (n < 1) { i18nOk = false; console.log('    ✗ ' + k + ' → ' + n + ' بار'); }
}
ok(i18nOk, 'هر ۹ کلید حداقل ۱ بار در دیکشنری (D1: بلوک مرده ادغام شد — semantics تک‌بلوکی)');
ok(appSrc.includes("'set.navg.speak': ['گفتار', 'Speech']") &&
   appSrc.includes("'set.sub.appMem': ['یادآوری و یادگیری', 'Reminders & learning']") &&
   appSrc.includes("'set.ptt.onoff': ['روشن/خاموش', 'On/off']"),
   'جفت‌های فارسی/انگلیسی نمونه سالم‌اند');

console.log('\n[6] نگهبان‌های ساختاری — هیچ رفتاری عوض نشده');
const order = [...htmlSrc.matchAll(/<div class="set-pane[^"]*" data-pane="(\w+)"/g)].map((m) => m[1]);
ok(JSON.stringify(order) === JSON.stringify(['mic', 'stt', 'wake', 'dict', 'voice', 'ai', 'discord', 'ext', 'perf', 'app', 'update']),
   'ترتیب ۱۱ پنل دقیقاً همان v0.36 ماند');
ok((htmlSrc.match(/<div class="set-pane" data-pane="perf">/g) || []).length === 1, 'تگ دقیق پنل perf دست‌نخورده (پین v0350)');
ok(htmlSrc.indexOf('id="settingsPage"') < htmlSrc.indexOf('id="extDiscordOpt"') &&
   htmlSrc.indexOf('id="extDiscordOpt"') < htmlSrc.indexOf('data-pane="perf"') &&
   htmlSrc.indexOf('id="dcActions"') < htmlSrc.indexOf('id="extPage"'),
   'قیدهای ترتیبی smoke (settingsPage/discord/perf/extPage) برقرار');
ok(htmlSrc.includes('<div class="set-pane" data-pane="wake">') &&
   htmlSrc.indexOf('id="btnWakeTest"') > htmlSrc.indexOf('data-pane="wake"') &&
   htmlSrc.indexOf('id="btnWakeTest"') < htmlSrc.indexOf('<div class="set-pane" data-pane="dict">'),
   'btnWakeTest همچنان داخل پنل wake است (پین smoke/v0360)');
const critIds = ['id="optMic"', 'id="optSttEngine"', 'id="offCard"', 'id="optGeminiKey"', 'id="btnDcCall"',
  'id="optAutoUpdate"', 'id="dcContactsList"', 'id="optPtt"', 'id="btnPttKey"', 'id="optPttMode"',
  'id="optWakeWordText"', 'id="remList"', 'id="learnList"', 'id="setNav"'];
let uniqOk = true;
for (const id of critIds) { if (htmlSrc.split(id).length !== 2) { uniqOk = false; console.log('    ✗ ' + id); } }
ok(uniqOk, 'همهٔ idهای حیاتی تنظیمات یکتا ماندند (' + critIds.length + ' عدد)');
ok(appSrc.includes("if (!setPanes.some((p) => p.dataset.pane === id)) id = 'mic';"),
   'گارد showSettingsPane سر جایش است');
ok(!htmlSrc.includes('data-i18n="disc.hint"'), 'کلید یتیم disc.hint همچنان غایب (پین v0360)');

console.log('\n[7] نسخه 0.62.0-beta');
ok(appSrc.includes("let appVersion = '0.62.0-beta';"), 'app.js: 0.62.0-beta');
ok(pkg.version === '0.62.0-beta', 'package.json: 0.62.0-beta');
ok(htmlSrc.includes('<span id="abVersion">v0.62.0-beta</span>'), 'index.html: v0.62.0-beta');
ok(readme.includes('۰.۶۲.۰-بتا') && readme.includes('هستهٔ فهم'), 'README: ۰.۶۲.۰-بتا');
ok(pkg.description.includes('۰.۶۲') && pkg.description.includes('پلیر'),
   'description: ۰.۶۲ (forward-relax v0.61)');

console.log('\n-----------------------------');
console.log(`RESULT: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
