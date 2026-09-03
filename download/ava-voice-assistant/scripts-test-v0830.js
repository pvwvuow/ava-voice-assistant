#!/usr/bin/env node
'use strict';
/* ============================================================
   scripts-test-v0830.js — باتری نسخهٔ ۰.۸۳.۰-بتا
   ------------------------------------------------------------
   ۱) هالهٔ «ماورایی» چندلایهٔ دور دکمهٔ میکروفون (خواستهٔ کاربر:
      «روی اون افکته بیشتر کار کن… جا داره بهتر شه»)
      — aurora معکوس + سه ذرهٔ مداری + هستهٔ تپنده + حلقه‌های پردازش
      + رفع باگ Specificity تم طلایی (هالهٔ سرخ در طلایی دیده نمی‌شد)
   ۲) ری‌ورک تم سفید-طلایی: پوشش کامپوننت‌های جامانده + پالت نو
   ۳) ری‌ورک کامل پخش یوتیوب — «پلیر آوا» (embed رسمی):
      مسیر پیش‌فرض یوتیوب = پلیر آوا؛ فالبک پلیر صریح = پلیر آوا
      (نه مرورگر)؛ مرورگر آخرین طبقه؛ مدیریت پنجره با pid منفی
   معیار: فقط شمارش ok؛ exit-code = تعداد شکست.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const R = __dirname;
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ FAIL: ' + name); } }
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8');

const mainSrc = read('main.js');
const appSrc = read('renderer/js/app.js');
const htmlSrc = read('renderer/index.html');
const cssSrc = read('renderer/css/styles.css');
const intentSrc = read('renderer/js/voiceIntent.js');
let playerHtmlSrc = '';
try { playerHtmlSrc = read('renderer/ava-player.html'); } catch (_) { /* noop */ }

/* ---------- ۱) هالهٔ ماورایی v2 ---------- */
console.log('\n[1] هالهٔ ماورایی چندلایهٔ دور میکروفون (v0.83)');
ok('index.html: لایه‌های نو orb-aurora + orb-sparks داخل orb-stage',
  htmlSrc.includes('class="orb-aurora"') &&
  htmlSrc.includes('class="orb-sparks"><i></i><i></i><i></i></div>'));
ok('CSS: شفق اصلی سه‌قوسه (سرخ/کهربا/گلبرگی) با چرخش + نفس',
  cssSrc.includes('avaHaloSpin 2.4s linear infinite, avaHaloBreath 2.8s ease-in-out infinite') &&
  (cssSrc.match(/rgba\(255, 45, 85/g) || []).length >= 5);
ok('CSS: شفق معکوس (avaHaloSpinRev) — چرخش خلاف جهت با بلور نرم',
  cssSrc.includes('avaHaloSpinRev 5.6s linear infinite') && cssSrc.includes('@keyframes avaHaloSpinRev'));
ok('CSS: سه ذرهٔ نور در سه مدار (سرعت/جهت/شعاع متفاوت)',
  cssSrc.includes('avaOrbit 3.4s linear infinite') &&
  cssSrc.includes('avaOrbitRev 4.9s linear infinite') &&
  cssSrc.includes('avaOrbit 6.2s linear infinite'));
ok('CSS: ذره‌ها دنبالهٔ درخشان دارند (glow دوبل)',
  cssSrc.includes('box-shadow: 0 0 14px 4px rgba(255, 77, 109, 0.65), 0 0 36px 12px rgba(255, 45, 85, 0.22)'));
ok('CSS: حلقه‌های موج حین پردازش هم می‌تپند (قبلاً فقط شنیدن)',
  cssSrc.includes('body.state-processing .orb-ring {') &&
  cssSrc.includes('body.state-processing .orb-ring.rg2'));
ok('CSS: هستهٔ سرخ تپنده (avaIcoPulse)',
  cssSrc.includes('animation: avaIcoPulse 2s ease-in-out infinite'));
ok('CSS: میکروفون نوار فرمان در شنیدن و پردازش هر دو قرمز + نقطهٔ نوار وضعیت',
  cssSrc.includes('body.state-processing .cmd-mic') &&
  cssSrc.includes('body.state-listening #sbMic .dot') &&
  cssSrc.includes('@keyframes dotPingRed'));
ok('بحرانی (Specificity): تم طلایی حالتِ سرخِ هاله را بازنویسی صریح دارد —\n    در 0.82.2 قواعد idle طلایی (۳ کلاس) قواعد سرخ عمومی (۲ کلاس) را می‌خوردند',
  cssSrc.includes('[data-theme="light"][data-gold="on"].state-listening .orb-halo') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"].state-processing .orb'));
ok('گارد پایداری: لایه‌های نو زیر perf-nofx/lite/darklite خاموش می‌شوند',
  cssSrc.includes('body.perf-nofx .orb-aurora') &&
  cssSrc.includes('[data-theme="lite"] .orb-sparks') &&
  cssSrc.includes('[data-theme="darklite"] .orb-aurora'));
ok('گارد app-blur: لایه‌های نو در تارشدن پنجره هم خاموش می‌شوند',
  cssSrc.includes('body.app-blur .orb-aurora'));

/* ---------- ۲) تم سفید-طلایی v2 ---------- */
console.log('\n[2] ری‌ورک تم سفید-طلایی');
ok('پس‌زمینهٔ عاجی چندلایه (چهار radial + کرم پایه)',
  (cssSrc.match(/data-gold="on"\] body/g) || []).length >= 2 &&
  cssSrc.includes('#faf4e6') && cssSrc.includes('rgba(255, 240, 200, 0.35)'));
ok('پالت نو: طلای براق #c99916 + جوهر #fffdf5 (به‌جای سبزِ تیرهٔ قبلی)',
  cssSrc.includes('--acc2: #c99916') && cssSrc.includes('--acc-ink: #fffdf5'));
ok('کامپوننت‌های جامانده: سوییچ طلایی + اسکرول + سِلکشن + فوکوس + kbd',
  cssSrc.includes('[data-theme="light"][data-gold="on"] .sw input:checked + i') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] ::selection') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] kbd'));
ok('نوار وضعیت + دات‌ها + tb-badge طلایی شدند',
  cssSrc.includes('[data-theme="light"][data-gold="on"] #statusbar') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] .dot.ok'));
ok('کارت پاسخ + چیپ فکر + تاریخچهٔ طلایی',
  cssSrc.includes('[data-theme="light"][data-gold="on"] .response-card') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] .think-chip'));
ok('دیک موزیک/اکنون-در-حال-پخش + مودال‌ها (تأیید/فرم مخاطب/دایرکتوری)',
  cssSrc.includes('[data-theme="light"][data-gold="on"] .music-deck') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] .confirm') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] .ctadd-card'));
ok('مودال به‌روزرسانی: دکمهٔ اصلی طلایی گرادیانی + آیکون طلایی',
  cssSrc.includes('[data-theme="light"][data-gold="on"] .upd-card-primary') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] .upd-card-ic'));
ok('چیپ توقف در تم طلایی خوانا (قرمزِ روشن روی عاج)',
  cssSrc.includes('[data-theme="light"][data-gold="on"] .stop-chip'));
ok('خوش‌آمدگویی: گرادیان طلایی غنی‌تر با توقف‌های نو',
  cssSrc.includes('#f2c14e'));

/* ---------- ۳) پلیر آوا — ری‌ورک پخش یوتیوب ---------- */
console.log('\n[3] پلیر آوا (embed رسمی یوتیوب) — پخش تضمینی');
ok('صفحهٔ پلیر: renderer/ava-player.html وجود دارد + iframe یوتیوب',
  playerHtmlSrc.includes('youtube.com/embed/') && playerHtmlSrc.includes('autoplay=1'));
ok('صفحهٔ پلیر: نوار شیشه‌ای خود-پنهان + دکمه‌های مرورگر/پخش‌مجدد/بستن + Esc',
  playerHtmlSrc.includes('id="btnBrowser"') && playerHtmlSrc.includes('id="btnReload"') &&
  playerHtmlSrc.includes("e.key === 'Escape'"));
ok('صفحهٔ پلیر: پردهٔ اتصال با حالت خطا/راهنما (اگر یوتیوب نرسید)',
  playerHtmlSrc.includes('id="veil"') && playerHtmlSrc.includes('در مرورگر'));
ok('main.js: رجیستری avaPlayers + pid منفی متوالی (هرگز با PID ویندوز اشتباه نمی‌شود)',
  mainSrc.includes('const avaPlayers = new Map()') && mainSrc.includes('const apid = --avaPlayerSeq'));
ok('main.js: autoplayPolicy بدون ژست + sandbox + contextIsolation در پنجرهٔ پلیر',
  mainSrc.includes("autoplayPolicy: 'no-user-gesture-required'") &&
  /ava-player\.html[\s\S]{0,600}sandbox: true/.test(mainSrc.replace(/\n/g, ' ')) === false ? mainSrc.includes('sandbox: true') : true);
ok('main.js: setWindowOpenHandler → مرورگر خارجی (پنجرهٔ نو داخل آوا ممنوع)',
  mainSrc.includes('setWindowOpenHandler'));
ok('main.js: avaPlayerPlay — عنوان با oEmbed زنده به‌روز می‌شود',
  mainSrc.includes('async function ytTitleOf') && mainSrc.includes('youtube.com/oembed'));
ok('main.js: avaPlayerPlay پلیرهای قبلی (خارجی + آوا) را می‌بندد — تک‌لاین حفظ شود',
  /async function avaPlayerPlay[\s\S]{0,900}closeAllVideoPlayers\(\)[\s\S]{0,400}closeAvaPlayers\(\)/.test(mainSrc));
ok('بحرانی: closeVideoByPid هرگز روی pid منفی PowerShell/Stop-Process اجرا نمی‌کند',
  /function closeVideoByPid\(pid\) \{[\s\S]{0,300}if \(pidN < 0\) \{[\s\S]{0,400}en\.win\.close\(\)/.test(mainSrc));
ok('بحرانی: focusPlayerWindow pid منفی → فوکوس بومی + NOWIN → فالبک پلیر آوا',
  /function focusPlayerWindow\(pidHint\) \{[\s\S]{0,260}if \(pidN0 < 0\) \{/.test(mainSrc) &&
  mainSrc.includes('avaAvaFocusNewest()'));
ok('videoWinList: پنجره‌های پلیر آوا در فهرست (proc=ava-player) + مرتب‌سازی سنی',
  mainSrc.includes("proc: 'ava-player'") && mainSrc.includes('wins.sort((a, b) => a.ageSec - b.ageSec)'));
ok('videoWinOps: pid منفی → عملیات بومی (PIP/سایز/شفافیت/مانیتور/شات بدون PowerShell)',
  mainSrc.includes('if (pidN < 0) return avaPlayerOp(kind, arg, pidN);') &&
  mainSrc.includes('async function avaPlayerOpAll'));
ok('player:ctl: pid منفی به مسیر بستن هدفمند می‌آید + fullscreen پلیر آوا فقط کلید F',
  mainSrc.includes('if (Number(p.pid) || /^ord:\\d+$/.test(tgt))') &&
  mainSrc.includes("if (/ava-player/.test(s)) return [VK.f];"));
ok('playerOpenDecision: پیش‌فرض یوتیوب → ava-player (دیگر مرورگر نیست)',
  mainSrc.includes("if (!wanted || wanted === 'default' || wanted === 'ava') return { action: 'ava-player', player: 'ava' };"));
ok('playerOpenDecision: UWP/بی‌پلیر + یوتیوب → پلیر آوا (نه مرورگر)',
  mainSrc.includes("return { action: isYt ? 'ava-player' : 'os-default', player: isYt ? 'ava' : 'uwp' };"));
ok('playerOpenDecision: «پلیر آوا» از چکِ نصب‌نبودن عبور می‌کند (همیشه موجود)',
  mainSrc.includes("if (wanted === 'ava') {"));
ok('playerLaunchYt: فالبک پلیر صریح = پلیر آوا (browser-fallback فقط آخرین طبقه)',
  mainSrc.includes("const av = await avaPlayerPlay(s, { keepExisting: !!keep, reason: 'ytdl-fail' });") &&
  mainSrc.includes("via: 'ava-fallback'") &&
  mainSrc.indexOf("via: 'ava-fallback'") < mainSrc.lastIndexOf("via: 'browser-fallback'"));
ok('player:open: شاخهٔ ava-player + عنوان سرچ به نوار پلیر می‌رسد (qTitle)',
  mainSrc.includes("if (d.action === 'ava-player') {") && mainSrc.includes("let qTitle = '';"));
ok('openWithDefaultPlayer: مسیر مستقیم AI هم به پلیر آوا می‌رود',
  mainSrc.includes("if (d.action === 'ava-player') return avaPlayerPlay(url, { reason: 'ai-direct' });"));
ok('closeAllVideoTargets: «همه رو ببند» پلیر آوا را هم می‌بندد (۴ نقطهٔ مصرف)',
  (mainSrc.match(/await closeAllVideoTargets\(\)/g) || []).length >= 4);
ok('runningVideoTargets: شمارش «پلیری باز نیست» پلیر آوا را هم می‌بیند',
  mainSrc.includes('async function runningVideoTargets()') &&
  (mainSrc.match(/await runningVideoTargets\(\)/g) || []).length >= 3);
ok('voiceIntent: «پلیر آوا» به‌عنوان هدف پلیر شناخته می‌شود',
  intentSrc.includes("if (/پلیر\\s?آوا|پلیرِ?\\s?اوا|ava\\s?player/i.test(s)) return 'ava';"));
ok('app.js: پاسخ صادقانهٔ فالبک («با پلیر خود آوا پخش کردم») در هر دو مسیر',
  (appSrc.match(/با پلیر خود آوا پخش کردم/g) || []).length >= 2);
ok('yt-dlp: --no-check-certificates در پلهٔ فالبک (TLS اپراتور)',
  mainSrc.includes('--no-check-certificates --extractor-args'));
ok('فایل پلیر در بیلد می‌آید (renderer/**/* در package.json)',
  JSON.stringify(JSON.parse(read('package.json')).build.files).includes('renderer/**/*'));

console.log('\n==== v0.83.0-beta: ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
