#!/usr/bin/env node
/* v0.77.0-beta — «کامندهای قدیمی هیچ کدوم کار نمی‌کنند» — ممیزی بحرانی فرمان‌های سفارشی
   شکایت کاربر: «ما کلی کامند قدیم داشتیم که الان با این نسخه جدید هیچ کدومشون کار نمی کنند».
   ریشه (اثبات با git — 1d78d53 در برابر ce47f1a):
   • باگ C1: در v0.60 چکِ فرمان سفارشی قبل از aiHandleCommand بود؛ بازنویسیِ brain-first
     v0.61 آن را به بعدِ مسیرِ بازگشتِ مغز برد → با AIِ وصل هیچ فرمان سفارشی اجرا نمی‌شد.
   • باگ C2: کاتالوگ AI فقط RULES داشت؛ مغز فرمان‌های سفارشی را نمی‌دید → run_custom هرگز. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

const appSrc = read('renderer/js/app.js');
const docsSrc = read('docs/COMMANDS-FA.md');

/* همان normFaِ فرمان سفارشی app.js (کپی با همین معنا برای محیط تست) */
function normFa(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\u064A/g, '\u06CC')
    .replace(/\u0643/g, '\u06A9')
    .replace(/[\s\u200C]+/g, ' ')
    .trim();
}
const WAKE = (s) => String(s || '').replace(/^\s*(?:[اآا]وا|ava|awa)\s*[،,:\-!]?\s*/i, '').trim();

function extractFn(re, label) {
  const m = appSrc.match(re);
  ok(!!m, label + ' در app.js پیدا شد');
  return m ? m[0] : null;
}
function evalFn(src, argNames, args) {
  try { return new Function(...argNames, 'return (' + src.replace(/^function [A-Za-z]+/, 'function') + ')')(...args); }
  catch (e) { ok(false, 'eval ' + argNames[0] + ': ' + e.message); return null; }
}

console.log('— ۱) باگ C1 — مچر سخت‌گیرانهٔ customMatchOf (رفتاری)');
const cmoSrc = extractFn(/function customMatchOf\(cmd\) \{[\s\S]*?\n  \}/, 'customMatchOf');
const CMO_CMDS = [
  { id: 1, title: 'گوگل', phrases: ['گوگل رو باز کن'], action: { type: 'open_url', value: 'https://google.com' } },
  { id: 2, title: 'اخبار هکروید', phrases: [], action: { type: 'open_url', value: 'https://hackroid.com' } },
  { id: 3, title: 'شاد', phrases: ['آهنگ شادمهر'], action: { type: 'run', value: 'shad.m3u' } },
  { id: 4, title: 'شادمهر کامل', phrases: ['آهنگ شادمهر رو پخش کن'], action: { type: 'run', value: 'shad-full.m3u' } },
];
if (cmoSrc) {
  const cmo = evalFn(cmoSrc, ['normFa', 'customCmds', 'AVALearn'], [normFa, CMO_CMDS, { wakeStrip: WAKE }]);
  if (cmo) {
    ok(cmo('گوگل رو باز کن') && cmo('گوگل رو باز کن').id === 1, 'عین عبارت → فرمان ۱ → ' + JSON.stringify(cmo('گوگل رو باز کن') || {}));
    ok(cmo('آوا گوگل رو باز کن') && cmo('آوا گوگل رو باز کن').id === 1, 'پیشوند بیدارباش «آوا،» بریده می‌شود');
    ok(cmo('خب گوگل رو باز کن دیگه') && cmo('خب گوگل رو باز کن دیگه').id === 1, 'عبارت ≥۲واژه داخل جمله → قطعی');
    ok(cmo('اخبار هکروید') && cmo('اخبار هکروید').id === 2, 'فرمان بدون phrases با عنوانِ عین → مچ (قبلاً هرگز مچ نمی‌شد)');
    ok(cmo('گوگل رو باز کن؟') === null, 'گارد پرسش: جملهٔ پرسشی هرگز فرمان سفارشی نیست');
    ok(cmo('فرمان گوگل رو حذف کن') === null, 'گارد متا: «حذف کن» هرگز فرمان سفارشی نیست');
    ok(cmo('لیست فرمان‌ها رو نشون بده') === null, 'گارد متا: «لیست/نشون بده» هرگز فرمان سفارشی نیست');
    ok(cmo('وقتی داشتم با گوگل دربارهٔ تاریخ ایران کار می‌کردم به نتیجهٔ عجیبی رسیدم') === null, 'ضدربایش: عبارتِ تکی در جملهٔ بلند هرگز نمی‌رباید');
    const hitLong = cmo('آهنگ شادمهر رو پخش کن');
    ok(hitLong && hitLong.id === 4, 'بلندترین عبارت برنده است (۳↔۴) → ' + JSON.stringify(hitLong || {}));
    ok(cmo('آهنگ شادمهر') && cmo('آهنگ شادمهر').id === 3, 'عبارتِ کوتاه‌تر هنوز سر جایش است');
    ok(cmo('') === null && cmo('   ') === null, 'گارد ورودی خالی');
  }
}
console.log('— ۲) باگ C1 — لاین قطعی پیش از مغز (ترتیب در runCommand)');
{
  const laneIx = appSrc.indexOf('lane=custom (deterministic, pre-brain)');
  const vcIx = appSrc.indexOf('let vcText = cmd;');
  ok(laneIx > 0, 'لاگ لاین فرمان سفارشی در app.js هست');
  ok(vcIx > laneIx, 'لاین فرمان سفارشی قبل از بلوک AVACore.prepare/مغز است (ریشهٔ C1)');
  ok(appSrc.indexOf("_dispatchOutcome = 'custom';") > 0, 'اوتکام custom برای گزارش ثبت می‌شود');
  ok(/customMatchOf\(cmd\)/.test(appSrc), 'مچر در مسیر dispatch سیم‌کشی شده');
  ok(appSrc.indexOf("rcTag.textContent = LANG === 'en' ? 'CUSTOM' : 'سفارشی';") > 0, 'کارت پاسخ تگ سفارشی دارد');
  ok(/recordTurn\(\{ utterance: cmd, via: 'custom', intent: 'run_custom'/.test(appSrc), 'حافظهٔ گفتگو بعد از لاین سفارشی تغذیه می‌شود');
  ok(appSrc.indexOf('handsFreeRearm();', appSrc.indexOf('lane=custom')) < appSrc.indexOf('let vcText = cmd;'), 'حالت بی‌دست بعد از لاین سفارشی مسلح می‌شود');
}
console.log('— ۳) باگ C1 — مسیر آفلاین findCustomRule دست‌نخورده + نامزدِ عنوان');
{
  const fcrSrc = extractFn(/function findCustomRule\(cmd\) \{[\s\S]*?\n  \}/, 'findCustomRule');
  if (fcrSrc) {
    const fcr = evalFn(fcrSrc, ['normFa', 'customCmds', 'runCustom'], [normFa, CMO_CMDS, async () => 'x']);
    if (fcr) {
      const r1 = fcr('سلام گوگل رو باز کن لطفا');
      ok(!!r1 && r1.custom === true && r1.t === 'گوگل', 'مسیر آفلاین: فرمان سفارشی پیدا می‌شود → ' + JSON.stringify(r1 && r1.t));
      const r2 = fcr('اخبار هکروید');
      ok(!!r2 && r2.t === 'اخبار هکروید', 'مسیر آفلاین: فرمانِ فقط-عنوانی حالا مچ می‌شود (قبلاً نمی‌شد)');
      const r3 = fcr('هیچ ربطی ندارد');
      ok(r3 === null, 'مسیر آفلاین: جملهٔ بی‌ربط مچ نمی‌شود');
    }
  }
  ok(/if \(!rule\) rule = findCustomRule\(vcText\);/.test(appSrc), 'ترتیب قدیمی داوری→سفارشی در مسیر آفلاین حفظ شده');
}
console.log('— ۴) باگ C2 — فهرست فرمان‌های سفارشی در بستهٔ مغز');
{
  const cctxSrc = extractFn(/function customCmdsCtx\(\) \{[\s\S]*?\n  \}/, 'customCmdsCtx');
  if (cctxSrc) {
    const cctxFaF = evalFn(cctxSrc, ['LANG', 'customCmds'], ['fa', CMO_CMDS]);
    const cctxEnF = evalFn(cctxSrc, ['LANG', 'customCmds'], ['en', CMO_CMDS]);
    const cctxNoneF = evalFn(cctxSrc, ['LANG', 'customCmds'], ['fa', []]);
    const cctxFa = (typeof cctxFaF === 'function') ? cctxFaF() : cctxFaF;
    const cctxEn = (typeof cctxEnF === 'function') ? cctxEnF() : cctxEnF;
    const cctxNone = (typeof cctxNoneF === 'function') ? cctxNoneF() : cctxNoneF;
    if (cctxFa) {
      ok(cctxFa.indexOf('run_custom') > 0, 'راهنمای act=run_custom در بستهٔ فارسی');
      ok(cctxFa.indexOf('گوگل رو باز کن') > 0 && cctxFa.indexOf('اخبار هکروید') > 0, 'عنوان/عبارت‌های فرمان‌ها در فهرست');
      ok(cctxEn.indexOf('run_custom') > 0, 'بستهٔ انگلیسی هم دارد');
      ok(cctxNone === '', 'بدون فرمان سفارشی → هیچ توکنی هدر نمی‌رود');
    }
  }
  const fbIx = appSrc.indexOf('async function aiFallbackCtx(');
  const brIx = appSrc.indexOf('async function aiBrainCtx(');
  ok(fbIx > 0 && appSrc.indexOf('customCmdsCtx()', fbIx) > 0 && appSrc.indexOf('customCmdsCtx()', fbIx) < brIx, 'customCmdsCtx در aiFallbackCtx تزریق می‌شود');
  ok(brIx > 0 && appSrc.indexOf('customCmdsCtx()', brIx) > 0, 'customCmdsCtx در aiBrainCtx تزریق می‌شود');
}
console.log('— ۵) باگ C2 — پرامپت مغز (قانون ۴، FA+EN) و اکشن run_custom');
{
  ok(/قانون مهم ۴:[^\n]*run_custom[^\n]*value=عنوانِ همان فرمان/.test(appSrc), 'قانون ۴ فارسی: run_custom با عنوانِ عین فرمان');
  ok(/Important rule 4:[^\n]*run_custom[^\n]*exact title/.test(appSrc), 'قانون ۴ انگلیسی: run_custom با exact title');
  ok(/'run_custom', 'run_cmd'/.test(appSrc), 'run_custom در DO_ACTS هست (از v0.42 — دست‌نخورده)');
  ok(/case 'run_custom': \{/.test(appSrc), 'اجراکُنندهٔ run_custom سر جایش است');
  ok(/normFaFull\(a\.value\)\) \|\| customCmds\.find\(\(c\) => \(c\.phrases \|\| \[\]\)/.test(appSrc), 'مچِ value مغز در اجراکُننده (عنوان یا عبارت)');
}
console.log('— ۶) دفتر ممیزی docs/COMMANDS-FA.md به‌روز است');
{
  ok(docsSrc.indexOf('v0.80.0') > 0 || docsSrc.indexOf('v0.78.0') > 0 || docsSrc.indexOf('v0.77.0') > 0, 'تیتر سند (forward-relax v0.80)'); /* v0.80 forward-relax */
  ok(docsSrc.indexOf('فرمان‌های سفارشی کاربر') > 0 && docsSrc.indexOf('customMatchOf') > 0, 'بخش جدید فرمان‌های سفارشی با معماری جدید');
  ok(docsSrc.indexOf('هیچ کدومشون کار نمی‌کنند') > 0, 'شکایت کاربر + ریشهٔ مرگ در سند ثبت شده');
  ok(docsSrc.indexOf('customCmdsCtx') > 0 && docsSrc.indexOf('act=run_custom') > 0, 'فهرست مغز + اکشن در سند');
}

console.log('\n====== v0.77.0: ' + pass + ' passed, ' + fail + ' failed ======');
if (fail) { process.exit(1); }
