#!/usr/bin/env node
'use strict';
/* ============================================================
   scripts/bump-version.js — بامپِ چهارگانهٔ نسخهٔ آوا (موج ۱۷-e / C3)
   ------------------------------------------------------------
   استفاده:  node scripts/bump-version.js 0.60.0-beta
   (برای تست: node scripts/bump-version.js X --root=/tmp/copy)

   چه چیزی را آپدیت می‌کند:
     ۱) package.json  → فیلد version + توکن نسخهٔ قدیم داخل description
        (فرم فارسی ۰.۵۷.۰-بتا / ۰.۵۷ → ۰.۶۰.۰-بتا / ۰.۶۰)
     ۲) renderer/js/app.js  → let appVersion = '…';
     ۳) renderer/index.html → <span id="abVersion">v…</span>
     ۴) README.md → هر رخدادِ نسخهٔ قدیم (ASCII + فارسی)

   ایمنی: اگر نسخهٔ قدیم جایی که انتظار می‌رود پیدا نشود، «بدون هیچ
   نوشتنی» با خطا خارج می‌شود (idempotent-safe). ارقام به فارسی درست
   تبدیل می‌شوند (0→۰ … 9→۹، نقطه حفظ، -beta→-بتا) و نسخه‌های دیگر
   (مثل پایهٔ v0.54.0-beta) دست‌نخورده می‌مانند — فقط توکنِ نسخهٔ قدیم.
   ============================================================ */
const fs = require('fs');
const path = require('path');

/* ---------- args ---------- */
const argv = process.argv.slice(2);
let NEW = null, ROOT = null;
for (const a of argv) {
  if (a.startsWith('--root=')) ROOT = path.resolve(a.slice('--root='.length));
  else if (NEW == null) NEW = a;
  else { console.error('✗ آرگومان اضافی: ' + a); process.exit(2); }
}
if (!NEW) {
  console.error('استفاده: node scripts/bump-version.js <نسخهٔ جدید>   مثال: 0.60.0-beta');
  process.exit(2);
}
if (!ROOT) ROOT = path.resolve(__dirname, '..');

/* ---------- اعتبارسنجی نسخه ---------- */
const M_RE = /^(\d+\.\d+\.\d+)(?:-([\w.]+))?$/;
const mNew = NEW.match(M_RE);
if (!mNew) {
  console.error("✗ نسخهٔ نامعتبر: '" + NEW + "' — فرمت مورد انتظار X.Y.Z یا X.Y.Z-پسوند (مثل 0.60.0-beta)");
  process.exit(2);
}

/* ---------- تبدیل ارقام به فارسی ---------- */
const FA = '۰۱۲۳۴۵۶۷۸۹';
const toFaDigits = (s) => String(s).replace(/[0-9]/g, (d) => FA[+d]);
const toFaVer = (ver) => {
  const m = String(ver).match(M_RE);
  if (!m) return toFaDigits(ver);
  const pre = m[2] ? '-' + ({ beta: 'بتا' }[m[2]] || m[2]) : '';
  return toFaDigits(m[1]) + pre;               // 0.60.0-beta → ۰.۶۰.۰-بتا
};
const shortFa = (ver) => {                     // 0.60.0-beta → ۰.۶۰ (دو جزء اول)
  const m = String(ver).match(M_RE);
  return m ? toFaDigits(m[1].split('.').slice(0, 2).join('.')) : null;
};

/* ---------- خواندن نسخهٔ قدیم از package.json ---------- */
const pkgPath = path.join(ROOT, 'package.json');
const pkgRaw = fs.readFileSync(pkgPath, 'utf8');
let pkg;
try { pkg = JSON.parse(pkgRaw); } catch (e) { console.error('✗ package.json قابل پارس نیست: ' + e.message); process.exit(1); }
const OLD = pkg.version;

if (!OLD || !M_RE.test(OLD)) { console.error("✗ نسخهٔ فعلی package.json نامعتبر است: '" + OLD + "'"); process.exit(1); }
if (OLD === NEW) {
  console.error('✗ رد شد — نسخهٔ فعلی package.json همین ' + OLD + ' است (بامپی برای انجام نیست؛ ' +
    'اگر فایل‌ها ناهم‌گام‌اند، اول آن‌ها را دستی درست کن).');
  process.exit(1);
}

const newFaFull = toFaVer(NEW);            // ۰.۶۰.۰-بتا
const newFaShort = shortFa(NEW);           // ۰.۶۰
const oldFaFull = toFaVer(OLD);            // ۰.۵۷.۰-بتا
const oldFaShort = shortFa(OLD);           // ۰.۵۷

/* ---------- توکن‌های جایگزینی (ترتیب مهم است: بلند قبل از کوتاه) ---------- */
/* گارد (?!\d): ۰.۵۷ را داخل ۰.۵۷۱ نمی‌گیرد؛ فرم‌های بلندتر اول جایگزین می‌شوند. */
function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function replacementsFor(kind) {
  /* kind: 'fa' | 'ascii'  → آرایه‌ای از [regex, جانشین] */
  if (kind === 'ascii') {
    const [o3, n3] = [OLD.split('-')[0], NEW.split('-')[0]];                 // 0.57.0 / 0.60.0
    const o2 = o3.split('.').slice(0, 2).join('.');                          // 0.57
    const n2 = n3.split('.').slice(0, 2).join('.');                          // 0.60
    return [
      [new RegExp(esc(OLD) + '(?!\\d)', 'g'), NEW],      // 0.57.0-beta
      [new RegExp(esc(o3) + '(?!\\d)', 'g'), n3],        // 0.57.0
      [new RegExp(esc(o2) + '(?!\\d)', 'g'), n2],        // 0.57 (تکی/پیشوند)
    ];
  }
  return [
    [new RegExp(esc(oldFaFull) + '(?!\\d)', 'g'), newFaFull],   // ۰.۵۷.۰-بتا
    [new RegExp(esc(oldFaShort) + '(?!\\d)', 'g'), newFaShort], // ۰.۵۷
  ];
}
function applyTokens(src, kind) {
  let count = 0, out = src;
  for (const [re, rep] of replacementsFor(kind)) {
    out = out.replace(re, () => { count++; return rep; });
  }
  return { out, count };
}

/* ---------- آماده‌سازی همهٔ جایگزینی‌ها در حافظه (اَتمیک: بدون نوشتن تا پیش از تأیید) ---------- */
const report = [];
function plan(file, fn) {
  const p = path.join(ROOT, file);
  const src = fs.readFileSync(p, 'utf8');
  const { out, count, expected } = fn(src);
  return { file, p, src, out, count, expected };
}

/* ۱) package.json — version + description */
let planPkg;
{
  let verCount = 0, descCount = 0;
  let out = pkgRaw.replace(new RegExp('("version"\\s*:\\s*")' + esc(OLD) + '(")'), (mm, a, b) => { verCount++; return a + NEW + b; });
  if (pkg.description) {
    const rFa = applyTokens(pkg.description, 'fa');
    const rAs = applyTokens(rFa.out, 'ascii');
    descCount = rFa.count + rAs.count;
    if (descCount > 0 && out.includes(pkg.description)) {
      out = out.replace(pkg.description, () => rAs.out);   // جستجوی عین رشته (نه esc — متن دارای | و …)
    }
  }
  planPkg = { file: 'package.json', p: pkgPath, src: pkgRaw, out, count: verCount + descCount, expected: true,
    detail: 'version×' + verCount + ' + description×' + descCount };
  planPkg.ok = verCount === 1;
}

/* ۲) app.js — let appVersion = '…'; */
const appRel = path.join('renderer', 'js', 'app.js');
const planApp = (() => {
  const p = path.join(ROOT, appRel);
  const src = fs.readFileSync(p, 'utf8');
  const re = new RegExp("let appVersion = '" + esc(OLD) + "';");
  const found = re.test(src);
  const out = src.replace(re, () => "let appVersion = '" + NEW + "';");
  return { file: appRel, p, src, out, count: found ? 1 : 0, expected: true, ok: found, detail: 'appVersion×' + (found ? 1 : 0) };
})();

/* ۳) index.html — <span id="abVersion">v…</span> */
const htmlRel = path.join('renderer', 'index.html');
const planHtml = (() => {
  const p = path.join(ROOT, htmlRel);
  const src = fs.readFileSync(p, 'utf8');
  const needle = '<span id="abVersion">v' + OLD + '</span>';
  const found = src.includes(needle);
  const out = found ? src.split(needle).join('<span id="abVersion">v' + NEW + '</span>') : src;
  return { file: htmlRel, p, src, out, count: found ? 1 : 0, expected: true, ok: found, detail: 'abVersion×' + (found ? 1 : 0) };
})();

/* ۴) README.md — همهٔ رخدادهای نسخهٔ قدیم (فارسی + ASCII) */
const planReadme = (() => {
  const p = path.join(ROOT, 'README.md');
  const src = fs.readFileSync(p, 'utf8');
  const rFa = applyTokens(src, 'fa');
  const rAs = applyTokens(rFa.out, 'ascii');
  const count = rFa.count + rAs.count;
  return { file: 'README.md', p, src, out: rAs.out, count, expected: true, ok: count > 0, detail: 'fa×' + rFa.count + ' + ascii×' + rAs.count };
})();

const plans = [planPkg, planApp, planHtml, planReadme];
const missing = plans.filter((pl) => pl.expected && !pl.ok);

if (missing.length) {
  console.error('✗ بامپ انجام نشد — نسخهٔ قدیم (' + OLD + ') در این‌جاها پیدا نشد و هیچ فایلی نوشته نشد:');
  for (const pl of missing) console.error('    - ' + pl.file + ' (' + pl.detail + ')');
  console.error('  اول نسخه‌ها را هم‌گام کن (یا مطمئن شو دوباره اجرا نکرده‌ای) و بعد بامپ کن.');
  process.exit(1);
}

/* ---------- نوشتن + گزارش ---------- */
console.log('بامپ نسخه: ' + OLD + '  →  ' + NEW + '   (' + oldFaFull + ' → ' + newFaFull + ')');
for (const pl of plans) {
  fs.writeFileSync(pl.p, pl.out);
  report.push(pl.file + ': ' + pl.detail);
  console.log('  ✓ ' + pl.file + ' — ' + pl.detail);
}
console.log('\nخلاصه: ' + report.length + ' فایل آپدیت شد. حالا باتری را بگیر: node scripts/run-battery.js');
