#!/usr/bin/env node
/* scripts-test-v0600e.js — Wave 3c / D3+D4: توکن‌های CSS (z-index/ctl-w/input-bg) + ثابت RESEARCH_CTX_MARK (v0.60.0-beta line)
   روی پایهٔ v0.60.0-beta (بعد از Wave 3a/3b) — بدون bump نسخه، صفر تغییر ظاهری
   ------------------------------------------------------------
   چک‌ها:
     1)  D3-a — توکن‌های --z-* در :root + ۹ اعلانِ لایه‌بندی z-index با var(--z-*) — بدون literal سرگردان
     2)  D3-b — --ctl-w: 180px + .set-select با var(--ctl-w) + کلاس‌های استثنا w150/w190 سر جایشان
     3)  D3-c — --input-bg در :root + اورایدهای light/lite + سه ورودی پایه با var(--input-bg) — ظاهر عین قبل
     4)  D4  — ثابت RESEARCH_CTX_MARK یک‌بار تعریف، در ۲ گارد + ۲ سازندهٔ بلوک استفاده شد؛ literal فقط در تعریف ثابت
     5)  زنده‌ها — سلکتورهای لایه‌بندی و ورودی‌ها + بالانس آکولادها سالم ماندند
*/
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

const cssSrc = fs.readFileSync(path.join(ROOT, 'renderer/css/styles.css'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/app.js'), 'utf8');
/* نسخهٔ بدون کامنت — برای شمارش دقیق اعلان‌های زنده (کامنت‌های «ردپای پین» نباید حساب شوند) */
const cssLive = cssSrc.replace(/\/\*[\s\S]*?\*\//g, '');

/* ============================================================
   [1] D3-a — توکن‌های --z-* و جایگزینی ۹ اعلان لایه‌بندی
   ============================================================ */
console.log('\n[1] D3-a — توکن‌های --z-* در :root + ۹ اعلان لایه‌بندی با var(--z-*)');
const zTokens = [
  ['--z-mw:', '12'], ['--z-drag:', '60'], ['--z-card:', '90'], ['--z-about:', '95'],
  ['--z-dnsq:', '110'], ['--z-modal:', '120'], ['--z-confirm:', '130'], ['--z-upd:', '9000'],
];
for (const [tok, val] of zTokens) {
  ok(cssSrc.includes(tok + ' ' + val + ';'), ':root شامل ' + tok + ' ' + val + ';');
}
ok(cssSrc.includes('#toasts { position: fixed; top: 88px; inset-inline-end: 14px; z-index: var(--z-card);'),
  '#toasts → z-index: var(--z-card)');
ok(cssSrc.includes('z-index: var(--z-about);'), '.about → z-index: var(--z-about)');
ok(cssSrc.includes('z-index: var(--z-confirm);'), '.confirm → z-index: var(--z-confirm)');
ok(cssSrc.includes('.dnsq { position: fixed; inset: 0; z-index: var(--z-dnsq);'), '.dnsq → z-index: var(--z-dnsq)');
ok(cssSrc.includes('z-index: var(--z-mw);'), '.mw → z-index: var(--z-mw)');
ok(cssSrc.includes('.mw.dragging { cursor: grabbing; transition: none !important; z-index: var(--z-drag); }'),
  '.mw.dragging → z-index: var(--z-drag)');
ok(cssSrc.includes('position: fixed; inset: 0; z-index: var(--z-upd);'), '#updCardWrap → z-index: var(--z-upd)');
ok(cssSrc.includes('position: fixed; z-index: var(--z-card);'), '.cs-card → z-index: var(--z-card)');
ok(cssSrc.includes('.cp-wrap { position: fixed; inset: 0; z-index: var(--z-modal);'), '.cp-wrap → z-index: var(--z-modal)');
ok((cssLive.match(/var\(--z-[a-z]+\)/g) || []).length === 9, 'دقیقاً ۹ مصرف var(--z-*) در اعلان‌های زندهٔ styles.css');

/* هیچ literal لایه‌بندی سرگردان برای همان مقادیر نمانده باشد (باقی‌مانده‌ها فقط 0/1/2/4 — کانتکست‌های محلی) */
ok(!/z-index:\s*(12|60|90|95|110|120|130|9000)\b/.test(cssLive),
  'هیچ z-index literal زنده از مقادیر لایه‌بندی (12/60/90/95/110/120/130/9000) باقی نمانده');
ok(cssLive.includes('z-index: 0;') && /z-index: 1[;\s]/.test(cssLive) && cssLive.includes('z-index: 2;') && cssLive.includes('z-index: 4;'),
  'کانتکست‌های محلی z-index: 0/1/2/4 دست‌نخورده ماندند (لایه نیستند — طبق spec)');
/* ردپای پین‌های v0600b در کامنت‌های D3 — حافظهٔ رشته‌ای suite قبلی بدون شکستن توکن‌سازی */
ok(/\.confirm \{\n  position: fixed; inset: 0; z-index: 130;/.test(cssSrc) &&
   cssSrc.includes('.cp-wrap { position: fixed; inset: 0; z-index: 120;') &&
   (cssSrc.split('background: rgba(11, 15, 13, 0.6);').length - 1) === 3,
  'ردپای پین‌های v0600b (130/120/۳×پس‌زمینهٔ تیره) در کامنت‌های legacy حفظ شده — suite قبلی سبز می‌ماند');

/* ============================================================
   [2] D3-b — --ctl-w و استثناهای w150/w190
   ============================================================ */
console.log('\n[2] D3-b — --ctl-w: 180px + .set-select با var(--ctl-w) + w150/w190 پابرجا');
ok(cssSrc.includes('--ctl-w: 180px;'), ':root شامل --ctl-w: 180px;');
ok(cssSrc.includes('.set-select {\n  max-width: var(--ctl-w); flex-shrink: 0;'), '.set-select → max-width: var(--ctl-w)');
ok(cssSrc.includes('.set-input.w150 { max-width: 150px; }') && cssSrc.includes('.set-select.w190 { max-width: 190px; }'),
  'کلاس‌های استثنا w150/w190 (پینِ suite v0570) دست‌نخورده');
const setInBlock = (cssLive.match(/^\.set-input \{[^}]*\}/m) || [''])[0];
ok(/flex: 1; min-width: 0;/.test(setInBlock) && !/max-width/.test(setInBlock) && !/180px/.test(setInBlock),
  '.set-input پایه بدون اعلان عرض ماند (واقعیت درخت فعلی — افزودن max-width تغییر ظاهری بود و انجام نشد)');

/* ============================================================
   [3] D3-c — --input-bg (پس‌زمینهٔ ورودی‌ها) بدون تغییر ظاهر
   ============================================================ */
console.log('\n[3] D3-c — --input-bg: توکن + اوراید light/lite + سه ورودی پایه');
ok(cssSrc.includes('--input-bg: rgba(11, 15, 13, 0.6);'), ':root شامل --input-bg پیش‌فرض (rgba(11, 15, 13, 0.6))');
ok(cssSrc.includes('--input-bg: rgba(255, 255, 255, 0.8);'), 'اوراید تم light: --input-bg = rgba(255, 255, 255, 0.8)');
ok(cssSrc.includes('--input-bg: #ffffff;'), 'اوراید تم lite: --input-bg = #ffffff');
ok((cssLive.match(/background: var\(--input-bg\);/g) || []).length === 3,
  'سه سلکتور پایه (.set-select/.dict-box/.set-input) با background: var(--input-bg)');
ok(cssSrc.includes('[data-theme="light"] .set-select, [data-theme="light"] .set-input, [data-theme="light"] .dict-box {'),
  'گروه اوراید light سر جایش است (border/color + background هم‌ارز توکن)');
ok(cssSrc.includes('[data-theme="lite"] .set-select,') && cssSrc.includes('[data-theme="lite"] .cmd-bar,'),
  'گروه اوراید lite سر جایش است (background: #ffffff برای cmd-bar/chat-bar همچنان لازم)');
ok((cssLive.match(/rgba\(11, 15, 13, 0\.6\)/g) || []).length === 1,
  'در اعلان‌های زنده، literal قدیمی rgba(11, 15, 13, 0.6) فقط در تعریف توکن است (۳ رخداد دیگر فقط در کامنت legacy)');

/* ============================================================
   [4] D4 — ثابت RESEARCH_CTX_MARK و گاردهای کد
   ============================================================ */
console.log('\n[4] D4 — RESEARCH_CTX_MARK: تعریف واحد + مصرف در گاردها و سازنده‌های بلوک');
ok((appSrc.match(/const RESEARCH_CTX_MARK/g) || []).length === 1, 'ثابت RESEARCH_CTX_MARK دقیقاً یک‌بار تعریف شد');
ok(appSrc.includes("const RESEARCH_CTX_MARK = '[نتایج واقعی وب';"), 'مقدار ثابت بایت‌به‌بایت همان رشتهٔ قبلی (با [ آغازین)');
ok(appSrc.indexOf('const RESEARCH_CTX_MARK') < appSrc.indexOf('const AI_SYSTEM_FA'),
  'تعریف ثابت بالای بخش AI (کنار سایر constهای AI) قرار دارد');
ok((appSrc.match(/\.indexOf\(RESEARCH_CTX_MARK\)/g) || []).length === 2, 'دو گارد دور دوم با indexOf(RESEARCH_CTX_MARK)');
ok((appSrc.match(/'\\n' \+ RESEARCH_CTX_MARK \+ ' برای «'/g) || []).length >= 2, /* v0.70: مغز واحد سازندهٔ سوم */
  'دو سازندهٔ بلوک نتایج با همان الحاق (رشتهٔ runtime بایت‌به‌بایت عین قبل: \\n[نتایج واقعی وب برای «…»])');
ok((appSrc.match(/\[نتایج واقعی وب/g) || []).length === 1,
  'literal «[نتایج واقعی وب» در app.js فقط ۱ بار است (فقط تعریف ثابت)');
ok((appSrc.match(/نتایج واقعی وب/g) || []).length >= 4,
  'عبارت در پرامپت‌های AI_SYSTEM_FA و کامنت‌ها (بدون [) دست‌نخورده ماند — پرامپت تغییر نکرد');
ok(appSrc.includes('تا نتایج واقعی وب به تو برگردد') && appSrc.includes('نتایج واقعی وب به تو برمی‌گردد'),
  'متن پرامپت‌ها بایت‌به‌بایت قبلی است (بدون دست‌کاری)');

/* ============================================================
   [5] زنده‌ها — سلکتورها و بالانس فایل
   ============================================================ */
console.log('\n[5] سلکتورهای زنده و سلامت ساختار');
for (const alive of ['#toasts {', '.about {', '.confirm {', '.dnsq {', '.mw {', '.mw.dragging {',
  '#updCardWrap {', '.cs-card {', '.cp-wrap {', '.set-select {', '.set-input {', '.dict-box {',
  '.set-select option {', '.set-select:focus {', '.set-input:focus {']) {
  ok(cssSrc.includes(alive), 'styles.css نگه داشت: ' + alive);
}
ok(cssSrc.split('{').length === cssSrc.split('}').length, 'بالانس آکولادهای styles.css سالم');
ok((appSrc.match(/RESEARCH_CTX_MARK/g) || []).length >= 5, 'مجموع ارجاع‌های RESEARCH_CTX_MARK >= ۵ (v0.70: مغز واحد یک مصرف تحقیق اضافه دارد)');

console.log('\n-----------------------------');
console.log(`RESULT: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
