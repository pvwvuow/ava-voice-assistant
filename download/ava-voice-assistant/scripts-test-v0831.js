#!/usr/bin/env node
'use strict';
/* ============================================================
   scripts-test-v0831.js — باتری نسخهٔ ۰.۸۳.۱-بتا (نگهبانِ بازساختِ v0.85)
   ------------------------------------------------------------
   ۱) فیکس بحرانی «پلیر آوا درجا بسته میشه» — در v0.85 ساختاراً
      فراتر رفت: تک‌پنجرهٔ بازاستفاده با ناوبری درجا (aplayer:navigate)
      و «هیچ تایمرِ destroy» روی مسیرهای عادی؛ پاک‌سازی فقط از رویداد
      'closed'. این سوئیت همان تضمین‌ها را روی معماری نو نگه می‌دارد.
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
const { spawnSync } = require('child_process');
const R = __dirname;
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ FAIL: ' + name); } }
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8');

const mainSrc = read('main.js');
const htmlSrc = read('renderer/index.html');
const cssSrc = read('renderer/css/styles.css');
const pkgSrc = read('package.json');
const appSrc = read('renderer/js/app.js');
const modSrc = read('lib/ava-player.js');
let playerHtmlSrc = '';
try { playerHtmlSrc = read('renderer/ava-player.html'); } catch (_) { /* noop */ }

/* ---------- ۱) فیکس ساختاری «پلیر آوا درجا بسته میشه» (معماری v0.85) ---------- */
console.log('\n[1] ریشه‌کنی «درجا بسته میشه» — تک‌پنجرهٔ بازاستفاده + بدون تایمر destroy');
ok('main.js: پلیر آوا ماژولِ مستقل lib/ava-player.js است (require با دیپ‌ها)',
  mainSrc.includes("require('./lib/ava-player.js')") &&
  mainSrc.includes('closeAllExternalVideoPlayers: closeAllVideoPlayers'));
ok('main.js: نام‌های قدیمی به ماژول وصل‌اند (قرارداد لایهٔ صوتی دست‌نخورده)',
  mainSrc.includes('const avaPlayerPlay = (src, opts) => AP.play(src, opts);') &&
  mainSrc.includes('const closeAvaPlayers = () => AP.closeAll();') &&
  mainSrc.includes('const avaAvaFocusNewest = () => AP.focusNewest();'));
ok('ماژول: پاک‌سازی فقط از رویداد closed — win.on(\'closed\', ...) → forget',
  modSrc.includes("win.on('closed', () => forget(apid));"));
ok('ماژول: هیچ تایمر destroy روی مسیر عادی وجود ندارد (setsetTimeout+destroy ممنوع)',
  !/setTimeout\(\s*\(\)\s*=>\s*\{[^}]*destroy/.test(modSrc) && !/setTimeout\([^)]*\)\s*;[\s\S]{0,40}destroy/.test(modSrc));
ok('ماژول: ناوبری درجا — aplayer:navigate (الگوی «بستن-بعد-بازکردن» حذف شد)',
  modSrc.includes("send('aplayer:navigate'") && modSrc.includes('function navigateEntry'));
ok('ماژول: play بدون keepExisting پنجرهٔ موجود را «همان» navigate می‌کند، نه بستن/بازکردن',
  /const reuse = o\.keepExisting \? null : newest\(\);[\s\S]{0,120}apid = reuse\.apid; navigateEntry\(reuse, payload\)/.test(modSrc));
ok('ماژول: کرشِ رندرر = ریلود نه مرگ (render-process-gone → reload)',
  modSrc.includes("on('render-process-gone'") && modSrc.includes('.reload()'));
ok('ماژول: closeAll بدون تایمر — بستن عادی، پاک‌سازی با closed',
  /function closeAll\(\) \{[\s\S]{0,300}closeEntry\(en\)[\s\S]{0,120}return Promise\.resolve\(\{ count: olds\.length \}\);/.test(modSrc));
ok('main.js: closeVideoByPid pid منفی → ماژول (بدون تایمر destroy، بدون Stop-Process)',
  mainSrc.includes('if (pidN < 0) return avaCloseByPid(pidN);') &&
  !mainSrc.includes('en.win.destroy()'));
ok('main.js: closeAllVideoTargets پنجره‌های آوا + پلیرهای خارجی را پوشش می‌دهد',
  mainSrc.includes('async function closeAllVideoTargets()') &&
  /closeAllVideoTargets\(\)[\s\S]{0,400}AP\.closeAll\(\)/.test(mainSrc.slice(mainSrc.indexOf('async function closeAllVideoTargets()'))));

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
console.log('\n[4] پین نسخه 0.85.0-beta (forward-relax)');
ok('package.json: 0.85.0-beta (forward-relax)', pkgSrc.includes('"version": "0.85.0-beta"'));
ok('app.js: appVersion = 0.85.0-beta (forward-relax)', appSrc.includes("let appVersion = '0.85.0-beta';"));
ok('index.html: abVersion = v0.85.0-beta (forward-relax)', htmlSrc.includes('>v0.85.0-beta<'));
ok('ava-player.html: برند پلیر v0.85 (forward-relax)', playerHtmlSrc.includes('آوا پلیر v0.85'));

/* ---------- ۵) نحو ---------- */
console.log('\n[5] نحو سورس‌های بازساخته');
let syn = spawnSync(process.execPath, ['--check', path.join(R, 'lib', 'ava-player.js')]);
ok('node --check lib/ava-player.js', !syn.status);
syn = spawnSync(process.execPath, ['--check', path.join(R, 'main.js')]);
ok('node --check main.js', !syn.status);
syn = spawnSync(process.execPath, ['--check', path.join(R, 'renderer', 'ava-player-preload.js')]);
ok('node --check ava-player-preload.js', !syn.status);

console.log('\n==== v0.83.1-beta (guards on v0.85 architecture): ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
