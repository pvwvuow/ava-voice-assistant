#!/usr/bin/env node
/* scripts-test-v0600c.js — Wave 3a / D1: ادغام دیکشنری i18n (v0.60.0-beta line)
   روی پایهٔ v0.57.0-beta — بدون bump نسخه
   ------------------------------------------------------------
   چک‌ها:
     1)  D1-a — دیکشنری I18N: هر کلید دقیقاً یک‌بار (صفر کلید تکراری — بلوک مردهٔ ۹۵..۳۹۳ قبلی حذف شد)
     2)  D1-b — تک‌تک attrهای data-i18n / data-i18n-ph / data-i18n-tip / data-i18n-title در index.html
         کلیدی معتبر در دیکشنری دارند (صفر یتیم)
     3)  D1-c — tb.title (تنها کلید یتیم بلوک مرده) به بلوک زنده منتقل شد — دقیقاً یک تعریف
     4)  D1-d — مقادیر برنده پین شدند: dnsp.title=«پینگ DNSها»، toast.copied=«متن کپی شد ✓»،
         dnsp.pageTitle=«تغییرگر DNS» + حذف تعریف‌های قدیمی (رفتار عیناً مثل قبل: برندهٔ بعدی می‌برد)
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

/* استخراج دیکشنری I18N از سورس (نه eval — تحلیل متنی خط‌به‌خط) */
const appLines = appSrc.split('\n');
let dA = -1, dB = -1;
for (let i = 0; i < appLines.length; i++) { if (/^\s*const I18N = \{/.test(appLines[i])) { dA = i; break; } }
if (dA > -1) { for (let i = dA + 1; i < appLines.length; i++) { if (/^\s*\};\s*$/.test(appLines[i])) { dB = i; break; } } }
const dictLines = (dA > -1 && dB > dA) ? appLines.slice(dA + 1, dB) : [];
const entries = [];
for (let i = 0; i < dictLines.length; i++) {
  let m; const re = /'([A-Za-z0-9_.]+)'\s*:/g;
  while ((m = re.exec(dictLines[i]))) entries.push({ key: m[1], line: dA + i + 2 });
}
const counts = {};
for (const e of entries) counts[e.key] = (counts[e.key] || 0) + 1;
const dupKeys = Object.entries(counts).filter(([k, c]) => c > 1);
const keySet = new Set(Object.keys(counts));

/* ============================================================
   [1] D1-a — یکتایی کلیدها در دیکشنری
   ============================================================ */
console.log('\n[1] D1-a — دیکشنری I18N: صفر کلید تکراری');
ok(dA > -1 && dB > dA, 'بلوک دیکشنری I18N در app.js پیدا شد (خط ' + (dA + 1) + ' تا ' + (dB + 1) + ')');
ok(entries.length === Object.keys(counts).length && dupKeys.length === 0,
   'هر ' + entries.length + ' تعریفِ کلید یکتاست — صفر تکرار (قبلاً ۳۳۸ تعریف اضافی در بلوک مرده/دوقلوها)');
if (dupKeys.length) { for (const [k, c] of dupKeys) console.log('    ✗ تکرار: ' + k + ' ×' + c); }
ok(entries.length >= 700, 'حجم دیکشنری سالم ماند (' + entries.length + ' کلید — چیزی جز بلوک مرده حذف نشده)');
ok(!appLines.slice(dA + 1, dB).some((l) => l.includes("'about.desc': ['نسخه ۰.۲۵")),
   'بلوک مرده واقعاً حذف شده (about.desc قدیمی v0.25 — ساکن بلوک مرده — غایب است)');

/* ============================================================
   [2] D1-b — همهٔ مصرف‌های استاتیک index.html در دیکشنری هستند
   ============================================================ */
console.log('\n[2] D1-b — data-i18n* در index.html همه کلید معتبر دارند');
const attrKinds = { 'data-i18n': 0, 'data-i18n-ph': 0, 'data-i18n-tip': 0, 'data-i18n-title': 0 };
const orphans = [];
let attrTotal = 0;
for (const m of htmlSrc.matchAll(/(data-i18n(?:-ph|-tip|-title)?)="([^"]+)"/g)) {
  attrTotal++; attrKinds[m[1]]++;
  if (!keySet.has(m[2])) orphans.push(m[1] + '="' + m[2] + '"');
}
ok(attrTotal >= 300, 'همهٔ attrهای i18n استخراج شدند (' + attrTotal + ' مورد: ' +
   JSON.stringify(attrKinds) + ')');
ok(orphans.length === 0, 'صفر کلید یتیم — هر ' + attrTotal + ' مصرفِ استاتیک در دیکشنری ادغام‌شده موجود است' +
   (orphans.length ? ' — گم‌شده: ' + orphans.slice(0, 8).join(' ، ') : ''));

/* ============================================================
   [3] D1-c — tb.title منتقل شد
   ============================================================ */
console.log('\n[3] D1-c — tb.title (یتیمِ بلوک مرده) حالا در دیکشنری زنده است');
ok((appSrc.match(/'tb\.title':/g) || []).length === 1, 'tb.title دقیقاً یک تعریف دارد');
ok(appSrc.includes("'tb.title': ['دستیار صوتی ویندوز', 'Windows Voice Assistant'],"),
   'مقدار برندهٔ tb.title عیناً همان مقدار بلوک مرده است (صفر تغییر متن)');
ok(!!entries[0] && entries[0].key === 'tb.title' && entries[1] && entries[1].key === 'tb.theme',
   'tb.title اولین کلید دیکشنری ادغام‌شده است (جای طبیعی، پیش از tb.theme)');

/* ============================================================
   [4] D1-d — پین مقادیر برندهٔ سه کلید دریفت‌کرده
   ============================================================ */
console.log('\n[4] D1-d — مقادیر برنده (همان متن‌های قابل‌مشاهدهٔ امروز) پین شدند');
ok((appSrc.match(/'dnsp\.title':/g) || []).length === 1 &&
   appSrc.includes("'dnsp.title': ['پینگ DNSها', 'Ping DNS servers'],") &&
   !appSrc.includes("'dnsp.title': ['DNS Changer'"),
   'dnsp.title دقیقاً یک‌بار = «پینگ DNSها» / Ping DNS servers (برندهٔ پاپ‌آپ — تعریف‌های قدیمی حذف)');
ok((appSrc.match(/'toast\.copied':/g) || []).length === 1 &&
   appSrc.includes("'toast.copied': ['متن کپی شد ✓', 'Text copied ✓'],") &&
   !appSrc.includes("'toast.copied': ['گزارش کپی شد"),
   'toast.copied دقیقاً یک‌بار = «متن کپی شد ✓» / Text copied ✓ (برندهٔ قبلی حفظ شد)');
ok((appSrc.match(/'toast\.copyFail':/g) || []).length === 1 &&
   appSrc.includes("'toast.copyFail': ['کپی ممکن نشد — خودت انتخاب و کپی کن', 'Copy failed — select and copy manually'],") &&
   !appSrc.includes("'toast.copyFail': ['کپی نشد — از پنل خطا استفاده کن"),
   'toast.copyFail دقیقاً یک‌بار = «کپی ممکن نشد — خودت انتخاب و کپی کن» (برندهٔ قبلی حفظ شد)');
ok((appSrc.match(/'dnsp\.pageTitle':/g) || []).length === 1 &&
   appSrc.includes("'dnsp.pageTitle': ['تغییرگر DNS', 'DNS Changer'],"),
   'dnsp.pageTitle دقیقاً یک‌بار = «تغییرگر DNS» / DNS Changer (فیکس موج ۲ دست‌نخورده)');
ok(keySet.has('status.idle') && keySet.has('upd.cardTitle') && keySet.has('set.key.escHint') &&
   keySet.has('set.key.latin') && keySet.has('toast.electronOnly') && keySet.has('about.desc'),
   'کلیدهای موج‌های قبلی (A17/A18 + v0600b) همه در دیکشنری ادغام‌شده حاضرند');

console.log('\n-----------------------------');
console.log(`RESULT: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
