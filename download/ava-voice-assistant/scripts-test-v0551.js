#!/usr/bin/env node
'use strict';
/* ============================================================
   scripts-test-v0551.js — doctest v0.55.1-beta — هات‌فیکسِ «باز نشدن برنامه بعد از نصب»
   ------------------------------------------------------------
   گزارش کاربر: «برنامه نصب شد ولی خرابه باز نمیشه جاوا اسکریپت ارور»
   ریشه: widgetManager.js در build.files نبود ولی main.js بالای فایل آن را
   require می‌کرد → داخل asarِ نصاب ویندوز فایل وجود نداشت → Cannot find
   module './widgetManager' هنگام استارتاپ. تست‌های قبلی از درختِ کار اجرا
   می‌شدند (فایل روی دیسک بود) و CI فقط بیلد می‌کند — هیچ‌کس بستهٔ واقعی را
   نمی‌دید. این نسخه سه لایهٔ دفاعی می‌سازد:
     [A] گاردِ بسته‌بندی: هر require نسبی در فایل‌های ریشهٔ main-process باید
         (۱) روی دیسک موجود باشد و (۲) با حداقل یک glob از build.files پوشیده شود.
     [B] مقاوم‌سازی main.js: require ویجت با try/catch + استابِ بی‌خطر؛
         تولتیپ ترِی از app.getVersion می‌خواند (نه نسخهٔ دست‌نویس).
     [C] پین نسخه 0.55.1-beta در package.json / app.js / index.html / README.
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
ok(globs.includes('widgetManager.js'), 'widgetManager.js داخل build.files (ریشهٔ همین هات‌فیکس)');
ok(new Set(globs).size === globs.length, 'بدون تکرار در build.files');
for (const f of ['main.js', 'preload.js', 'pipPreload.js', 'pipCore.js', 'pipWindowManager.js', 'widgetManager.js']) {
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
ok(relTotal >= 4, 'اسکن require نسبی انجام شد (' + relTotal + ' مورد، ' + rootJs.length + ' فایل ریشه)');
ok(relSeen.has('./widgetManager') && relSeen.has('./lib/dns-bypass'), 'اسکن به requireهای حیاتی main.js رسیده (widgetManager/dns-bypass)');
ok(bad.length === 0, 'همهٔ requireهای نسبی موجود و پوشیده با build.files' + (bad.length ? ' — ' + bad.join(' | ') : ''));

const mainSrc = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
console.log('\n[B] مقاوم‌سازی main.js');
ok(mainSrc.includes("try { widgetManager = require('./widgetManager'); }"), 'require ویجت با گارد try/catch');
ok(mainSrc.includes('widget require failed (degraded'), 'کرشِ require ویجت → لاگ صادقانه (degraded)');
ok(mainSrc.includes('getState() { return null; }'), 'استابِ بی‌خطر ویجت (هر ۵ متد API)');
ok(mainSrc.includes("app.getVersion() + ')'"), 'تولتیپ ترِی از app.getVersion می‌خواند');
ok(!/setToolTip\([^)]*v0\.55\.0/.test(mainSrc), 'دیگر نسخهٔ دست‌نویس v0.55 در setToolTip نیست');
ok(mainSrc.includes('try { createTray(); }'), 'createTray در call-site هم گارد دارد');

console.log('\n[C] پین نسخه 0.55.1-beta');
ok(pkg.version === '0.55.1-beta', 'package.json 0.55.1-beta');
const appSrc = fs.readFileSync(path.join(ROOT, 'renderer', 'js', 'app.js'), 'utf8');
ok(appSrc.includes("let appVersion = '0.55.1-beta';"), 'app.js appVersion');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'renderer', 'index.html'), 'utf8');
ok(htmlSrc.includes('<span id="abVersion">v0.55.1-beta</span>'), 'index.html abVersion');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
ok(readme.includes('۰.۵۵.۱-بتا') && readme.includes('ویجت شناور + ترِی'), 'README بلاک ۰.۵۵.۱ + سازگاری سوئیت‌های قدیمی');

console.log('\n[D] سلامت widgetManager.js');
const wmSrc = fs.readFileSync(path.join(ROOT, 'widgetManager.js'), 'utf8');
ok(/module\.exports = \{ init, configure, update, getState, flushState \}/.test(wmSrc), 'API کامل export شده (استابِ main.js همین ۵ متد را دارد)');
ok(wmSrc.includes("statePath + '.tmp'") && wmSrc.includes('renameSync(tmp, statePath)'), 'نوشتن اتمیک widget-state.json (tmp+rename)');
ok(/function loadState\(\)[\s\S]{0,200}catch \(_\)/.test(wmSrc), 'loadState با گارد catch (اولین اجرا/خرابی فایل → مقدار پیش‌فرض)');

console.log('\n===== scripts-test-v0551.js: ' + pass + '/' + (pass + fail) + ' =====');
process.exit(fail ? 1 : 0);
