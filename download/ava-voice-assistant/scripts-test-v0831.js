#!/usr/bin/env node
'use strict';
/* ============================================================
   scripts-test-v0831.js — باتری نسخهٔ ۰.۸۳.۱-بتا
   ------------------------------------------------------------
   ۱) فیکس بحرانی «پلیر آوا درجا بسته میشه» (گزارش کاربر):
      تایمر destroy در closeAvaPlayers روی «نقشهٔ زنده» می‌چرخید —
      چون avaPlayerPlay اول می‌بندد و بعد پنجرهٔ نو را باز می‌کند،
      بمبِ ۱.۵ثانیه‌ای پنجرهٔ تازه‌بازشده را نابود می‌کرد (بازتولید
      ۱۰۰٪: هر پخش ≈۱.۵ ثانیه بعد می‌مرد).
      فیکس: فقط اسنپ‌شاتِ لحظهٔ بستن نابود می‌شود؛ نقشهٔ خالی =
      بدون تایمر؛ گارد isDestroyed روی همهٔ destroyها.
   ۲) ساده‌سازی افکت میکروفون (بازخورد کاربر: «خیلی شلوغه و
      متناسب هر تم نیست») → حذف کامل aurora/sparks + افکتِ آرام
      هم‌رنگِ هر تم با متغیر --acc-rgb؛ قرمز فقط کارکردی (میک/نقطه).
   ۳) ری‌ورک تم سفید-طلایی (بازخورد کاربر: «سفید قالب باشه یه
      ذره هم زرد توش باشه») → سطوح سفید #fdfdfb، متن خنثی، طلایی
      فقط اکسنت (دکمهٔ فعال/سوییچ/فوکوس/انتخاب/نشانگرها).
   معیار: فقط شمارش ok؛ exit-code = تعداد شکست.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const R = __dirname;
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ FAIL: ' + name); } }
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8');

const mainSrc = read('main.js');
const htmlSrc = read('renderer/index.html');
const cssSrc = read('renderer/css/styles.css');
const pkgSrc = read('package.json');
const appSrc = read('renderer/js/app.js');
let playerHtmlSrc = '';
try { playerHtmlSrc = read('renderer/ava-player.html'); } catch (_) { /* noop */ }

/* ---------- ۱) فیکس بحرانی پلیر آوا ---------- */
console.log('\n[1] فیکس «پلیر آوا درجا بسته میشه» — closeAvaPlayers');
ok('main.js: closeAvaPlayers اسنپ‌شات می‌گیرد (const olds = [...avaPlayers.values()])',
  mainSrc.includes('const olds = [...avaPlayers.values()];'));
ok('main.js: destroy فقط روی اسنپ‌شات است، نه نقشهٔ زنده (فرم باگ حذف شد)',
  !mainSrc.includes('setTimeout(() => { for (const [, en] of avaPlayers) { try { en.win.destroy()'));
ok('main.js: نقشهٔ خالی تایمر نمی‌سازد (if (olds.length) دور setTimeout)',
  /if \(olds\.length\) \{\s*\n\s*setTimeout/.test(mainSrc));
ok('main.js: گارد isDestroyed روی close/destroy اسنپ‌شات',
  (mainSrc.match(/!en\.win\.isDestroyed\(\)/g) || []).length >= 3);
ok('main.js: closeVideoByPid هم گارد isDestroyed گرفت',
  mainSrc.includes('if (avaPlayers.has(pidN) && !en.win.isDestroyed()) en.win.destroy()'));
ok('main.js: ترتیب تک‌لاین حفظ است — اول بستنِ قبلی‌ها بعد باز کردنِ نو (avaPlayerPlay)',
  /await closeAllVideoPlayers\(\)[\s\S]{0,120}await closeAvaPlayers\(\);[\s\S]{0,200}avaPlayerOpen\(/.test(mainSrc));
ok('main.js: closeAllVideoTargets پنجره‌های آوا + پلیرهای خارجی را پوشش می‌دهد',
  mainSrc.includes('async function closeAllVideoTargets()') &&
  /closeAllVideoTargets\(\)[\s\S]{0,400}closeAvaPlayers\(\)/.test(mainSrc.slice(mainSrc.indexOf('async function closeAllVideoTargets()'))));

/* ---------- ۲) ساده‌سازی افکت میکروفون ---------- */
console.log('\n[2] افکت آرام هم‌رنگِ هر تم — حذف شلوغی');
ok('index.html: لایه‌های شلوغ aurora/sparks حذف شدند',
  !htmlSrc.includes('orb-aurora') && !htmlSrc.includes('orb-sparks'));
ok('index.html: ستون فقرات افکت سالم ماند — halo + سه حلقهٔ موج',
  htmlSrc.includes('class="orb-halo"') &&
  htmlSrc.includes('class="orb-ring rg1"') &&
  htmlSrc.includes('class="orb-ring rg2"') &&
  htmlSrc.includes('class="orb-ring rg3"'));
ok('CSS: همهٔ ردپاهای aurora/sparks/keyframes چرخان حذف شدند',
  !cssSrc.includes('orb-aurora') && !cssSrc.includes('orb-sparks') &&
  !cssSrc.includes('avaHaloSpin') && !cssSrc.includes('avaOrbit') &&
  !cssSrc.includes('avaHaloBreath'));
ok('CSS: درخشش حالتِ فعال با رنگِ اکسنتِ تم (--acc-rgb) — هم‌رنگِ هر تم',
  cssSrc.includes('body.state-listening .orb-halo,\nbody.state-processing .orb-halo') &&
  cssSrc.includes('rgba(var(--acc-rgb), 0.3)'));
ok('CSS: حلقه‌های موج حین پردازش هم می‌تپند (رنگِ تم)',
  cssSrc.includes('body.state-processing .orb-ring {') &&
  cssSrc.includes('rgba(var(--acc-rgb), 0.5)'));
ok('CSS: بدنهٔ اورب حین فعالیت — هالهٔ نرم اکسنت، بدون قوس/ذرهٔ اضافه',
  /body\.state-listening \.orb,\nbody\.state-processing \.orb \{[\s\S]{0,300}rgba\(var\(--acc-rgb\), 0\.25\)/.test(cssSrc));
ok('CSS: تپش ملایم آیکون + قوس پردازش هم‌رنگ تم',
  cssSrc.includes('animation: avaIcoPulse 2.4s ease-in-out infinite') &&
  cssSrc.includes('body.state-processing .orb::after { border-top-color: rgba(var(--acc-rgb), 0.9); }'));
ok('CSS: قرمز فقط کارکردی ماند — میکروفون نوار فرمان + نقطهٔ وضعیت (کلیک = توقف)',
  cssSrc.includes('@keyframes dotPingRed') &&
  cssSrc.includes('[data-theme="light"] body.state-processing .cmd-mic') &&
  cssSrc.includes('body.state-processing #sbMic .dot'));
ok('CSS: گارد perf-nofx برای تپش آیکون حفظ شد',
  cssSrc.includes('body.perf-nofx .orb-core .ic { animation: none !important; }'));
ok('CSS: هر ۵ تم متغیر --acc-rgb دارند (افکت در همه هم‌خانواده است)',
  (cssSrc.match(/--acc-rgb:/g) || []).length >= 5);

/* ---------- ۳) تم سفید-طلایی: سفید قالب، زرد فقط اکسنت ---------- */
console.log('\n[3] ری‌ورک تم سفید-طلایی');
ok('CSS: پس‌زمینهٔ قالب سفید #fdfdfb در هر دو بلوک (0.82 + 0.83.1)',
  (cssSrc.match(/#fdfdfb/g) || []).length >= 2);
ok('CSS: عاجِ زردِ سنگین حذف شد (#faf4e6 / #fbf6ea وجود ندارد)',
  !cssSrc.includes('#faf4e6') && !cssSrc.includes('#fbf6ea'));
ok('CSS: متن‌های قالب خنثی شدند (#2a2620 به‌جای قهوه‌ای #33260a)',
  cssSrc.includes('--text: #2a2620') && cssSrc.includes('--bg: #fdfdfb') &&
  !cssSrc.includes('#33260a') && !cssSrc.includes('#6b5a2c'));
ok('CSS: پنل‌ها/کارت‌ها سفید — متغیرهای سطح تم',
  cssSrc.includes('--panel: rgba(255, 255, 255, 0.74)') &&
  cssSrc.includes('--panel-strong: rgba(255, 255, 255, 0.92)') &&
  cssSrc.includes('--input-bg: rgba(255, 255, 255, 0.94)'));
ok('CSS: نوار وضعیت/گروه تنظیمات/کارت پاسخ/مودال‌ها سفید شدند',
  cssSrc.includes('[data-theme="light"][data-gold="on"] #statusbar {\n  background: rgba(255, 255, 255, 0.82);') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] .set-group {\n  background: rgba(255, 255, 255, 0.75);') &&
  cssSrc.includes('rgba(255, 255, 255, 0.92), rgba(255, 254, 250, 0.8)') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] .confirm,\n[data-theme="light"][data-gold="on"] .ctadd-card'));
ok('CSS: برقِ درخشانِ خوش‌آمدِ طلایی حذف شد (گرادیان #f2c14e)',
  !cssSrc.includes('#f2c14e'));
ok('CSS: طلایی فقط اکسنت ماند — دکمهٔ ارسال، ریلِ فعال، سوییچ، اسکرول، سِلکشن',
  cssSrc.includes('[data-theme="light"][data-gold="on"] .cmd-send { background: linear-gradient(135deg, #d4a017, #a1720a)') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] .rail-item.active {\n  color: #fff;\n  background: linear-gradient(135deg, #d4a017, #a1720a)') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] .sw input:checked + i') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] ::selection'));

/* ---------- ۴) پین نسخه ---------- */
console.log('\n[4] پین نسخه 0.83.1-beta');
ok('package.json: 0.84.0-beta (forward-relax)', pkgSrc.includes('"version": "0.84.0-beta"'));
ok('app.js: appVersion = 0.84.0-beta (forward-relax)', appSrc.includes("let appVersion = '0.84.0-beta';"));
ok('index.html: abVersion = v0.84.0-beta (forward-relax)', htmlSrc.includes('>v0.84.0-beta<'));
ok('ava-player.html: برند پلیر v0.84 (forward-relax)', playerHtmlSrc.includes('آوا پلیر v0.84'));

/* ---------- ۵) رفتارِ زمان‌بندی — شبیه‌سازی واقعیِ سناریوی باگ ---------- */
(async () => {
  console.log('\n[5] شبیه‌سازی: پنجرهٔ نو که بعد از close باز می‌شود باید زنده بماند');
  const fnMatch = mainSrc.match(/function closeAvaPlayers\(\) \{[\s\S]*?\n\}/);
  ok('main.js: بدنهٔ closeAvaPlayers برای شبیه‌سازی استخراج شد', !!fnMatch);
  if (fnMatch) {
    try {
      const makeCloseAvaPlayers = new Function('avaPlayers', 'setTimeout',
        fnMatch[0] + '\n; return closeAvaPlayers;');
      const map = new Map();
      const mkWin = () => ({ _closed: false, _dead: false,
        close() { this._closed = true; }, isDestroyed() { return this._dead; }, destroy() { this._dead = true; } });
      const realSetTimeout = setTimeout;
      const closeAvaPlayers = makeCloseAvaPlayers(map, realSetTimeout);
      const oldWin = mkWin();
      map.set(-1, { win: oldWin });
      closeAvaPlayers();                 /* بستنِ پنجرهٔ قدیمی */
      const newWin = mkWin();
      map.set(-2, { win: newWin });      /* «بعد» از close، پنجرهٔ نو باز می‌شود */
      await new Promise((r) => realSetTimeout(r, 1700)); /* بمبِ ۱.۵ثانیه‌ای */
      ok('پنجرهٔ قدیمی destroy شد (حلقهٔ اطمینان کار می‌کند)', oldWin._dead === true);
      ok('بحرانی: پنجرهٔ تازه‌بازشده زنده ماند — باگ «درجا بسته میشه» ریشه‌کن شد',
        newWin._dead === false && newWin._closed === false);
      map.delete(-1); map.delete(-2);    /* رویداد closed در اپ واقعی پاک می‌کند */
      const n = await closeAvaPlayers(); /* نقشهٔ خالی: نباید تایمر بسازد/خطا بدهد */
      ok('نقشهٔ خالی: بدون تایمر، count=0 و بدون خطا', n && n.count === 0);
    } catch (e) {
      ok('شبیه‌سازی اجرا شد (' + String(e && e.message || e).slice(0, 60) + ')', false);
    }
  }

  console.log('\n==== v0.83.1-beta (relaxed 0.84): ' + pass + ' passed, ' + fail + ' failed ====');
  process.exit(fail ? 1 : 0);
})();
