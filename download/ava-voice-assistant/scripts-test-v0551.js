#!/usr/bin/env node
'use strict';
/* ============================================================
   scripts-test-v0551.js — گاردِ بسته‌بندی (احیا از archive/v0.55-56-line)
   ------------------------------------------------------------
   درسِ تاریخی v0.55.1 (هات‌فیکسِ «باز نشدن برنامه بعد از نصب»):
   «برنامه نصب شد ولی خرابه باز نمیشه جاوا اسکریپت ارور»
   ریشه: widgetManager.js در build.files نبود ولی main.js بالای فایل آن را
   require می‌کرد → داخل asarِ نصاب ویندوز فایل وجود نداشت → Cannot find
   module هنگام استارتاپ. تست‌های قبلی از درختِ کار اجرا می‌شدند (فایل روی
   دیسک بود) و CI فقط بیلد می‌کند — هیچ‌کس بستهٔ واقعی را نمی‌دید.
   این سوئیت (دوباره زنده‌شده در موج ۱۷-e برای v0.60.0-beta) نگهبانِ خودکارِ
   همان درس است: «فایلِ جاافتاده از build.files = اپ مرده».
     [A] گاردِ بسته‌بندی: هر require نسبی در فایل‌های ریشهٔ main-process باید
         (۱) روی دیسک موجود باشد و (۲) با حداقل یک glob از build.files پوشیده شود
         + فایل‌های حیاتی ریشه باید صریحاً داخل build.files باشند.
     [B]/[D] (سخت‌سازی main.js ویجت + سلامت widgetManager.js) مخصوص خطِ
         v0.55/0.56 بودند؛ درختِ فعلی (روی پایهٔ v0.54، بدون v0.55/0.56) نه
         widgetManager.js دارد و نه require آن را — حذف شدند (relax، خارج از
         شغلِ گارد).
     [C] پین نسخهٔ 0.56.0-beta به «سازگاری نسخه بین چهار فایل» relax شد تا با
         هر bump سبز بماند (پینِ عددی نسخه شغل سوئیت‌های نسخه‌دار است، نه گارد).
   mini-glob این تست فقط الگوهای همین ریپو را پوشش می‌دهد: نام ساده + الگوی dir با گلب‌ستاره (دابل‌ستاره/ستاره).
   ============================================================ */
const fs = require('fs'), path = require('path');
const ROOT = __dirname;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }

/* mini-glob: نام ساده + الگوی dir با گلب‌ستاره (کافی برای build.files همین ریپو) */
function globToRe(g) {
  let r = String(g).split('**/*').join('@@DBL@@');
  r = r.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  r = r.replace(/\*/g, '[^/]*');
  r = r.split('@@DBL@@').join('.+');
  return new RegExp('^' + r + '$');
}
function resolveRequire(rel) {
  const base = path.normalize(path.join(ROOT, rel));
  const cands = path.extname(base) ? [base]
    : [base + '.js', path.join(base, 'index.js')];
  for (const c of cands) { try { if (fs.statSync(c).isFile()) return c; } catch (_) {} }
  return null;
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const globs = (pkg.build && Array.isArray(pkg.build.files)) ? pkg.build.files : [];
const globRes = globs.map(globToRe);
const covered = (rel) => globRes.some((re) => re.test(rel));

console.log('\n[A] گارد بسته‌بندی — build.files');
ok(globs.length > 0, 'build.files آرایهٔ غیرخالی است');
ok(globs.includes('lib/dns-bypass.js') || globs.includes('lib/**/*'), 'lib/dns-bypass.js داخل build.files (require مستقیم main.js)');
ok(new Set(globs).size === globs.length, 'بدون تکرار در build.files');
for (const f of ['main.js', 'preload.js', 'pipPreload.js', 'pipCore.js', 'pipWindowManager.js']) {
  ok(globs.includes(f), 'فایل ریشهٔ بسته‌بندی‌شده: ' + f);
}

/* اسکن require نسبی در همهٔ .jsهای ریشه (به‌جز اسکریپت‌های تست) */
const rootJs = fs.readdirSync(ROOT).filter((f) => f.endsWith('.js') && !/^scripts-/.test(f));
const RE_Q = /require\((['"])(\.[^'"]+)\1\)/g;
let relTotal = 0; const bad = []; const relSeen = new Set();
for (const f of rootJs) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  let m; RE_Q.lastIndex = 0;
  while ((m = RE_Q.exec(src))) {
    relTotal++; relSeen.add(m[2]);
    const resolved = resolveRequire(m[2]);
    if (!resolved) { bad.push(f + ' → ' + m[2] + ' (فایل روی دیسک نیست)'); continue; }
    const relPath = path.relative(ROOT, resolved).split(path.sep).join('/');
    if (!covered(relPath)) bad.push(f + ' → ' + m[2] + ' (خارج از build.files!)');
  }
}
ok(relTotal >= 3, 'اسکن require نسبی انجام شد (' + relTotal + ' مورد، ' + rootJs.length + ' فایل ریشه)');
ok(relSeen.has('./pipWindowManager') && relSeen.has('./lib/dns-bypass') && relSeen.has('./pipCore'), 'اسکن به requireهای حیاتی رسیده (pipWindowManager/dns-bypass/pipCore)');
ok(bad.length === 0, 'همهٔ requireهای نسبی موجود و پوشیده با build.files' + (bad.length ? ' — ' + bad.join(' | ') : ''));

/* [C] سازگاری نسخه (relax از پین 0.56.0-beta — پین عددی شغل سوئیت‌های نسخه‌دار است) */
const toFa = (s) => String(s).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]).replace('-beta', '-بتا');
const VER = pkg.version;
console.log('\n[C] سازگاری نسخه (' + VER + ')');
const appSrc = fs.readFileSync(path.join(ROOT, 'renderer', 'js', 'app.js'), 'utf8');
ok(appSrc.includes("let appVersion = '" + VER + "';"), 'app.js appVersion با package.json هم‌خوان است');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'renderer', 'index.html'), 'utf8');
ok(htmlSrc.includes('<span id="abVersion">v' + VER + '</span>'), 'index.html abVersion با package.json هم‌خوان است');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
ok(readme.includes(toFa(VER)), 'README فرم فارسی نسخهٔ package.json را دارد (' + toFa(VER) + ')');

console.log('\n===== scripts-test-v0551.js: ' + pass + '/' + (pass + fail) + ' =====');
process.exit(fail ? 1 : 0);
