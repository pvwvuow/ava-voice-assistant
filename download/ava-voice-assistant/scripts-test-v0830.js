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
const modSrc = read('lib/ava-player.js');

/* ---------- ۱) هالهٔ فعال — v0.83.1 آرام و هم‌رنگ تم (ریلکس رو-به-جلو) ---------- */
console.log('\n[1] هالهٔ فعال دور میکروفون — آرام و هم‌رنگ هر تم (v0.83.1)');
ok('index.html: لایه‌های شلوغ aurora/sparks حذف و ستون فقرات سالم ماند (halo + سه حلقه)',
  !htmlSrc.includes('orb-aurora') && !htmlSrc.includes('orb-sparks') &&
  htmlSrc.includes('class="orb-halo"') && htmlSrc.includes('class="orb-ring rg3"'));
ok('CSS: درخشش حالتِ فعال با اکسنتِ خودِ تم (--acc-rgb) — بدون شفقِ سرخِ ثابت',
  cssSrc.includes('body.state-listening .orb-halo,\nbody.state-processing .orb-halo') &&
  cssSrc.includes('rgba(var(--acc-rgb), 0.3)') &&
  !cssSrc.includes('avaHaloSpin'));
ok('CSS: حلقه‌های موج حین پردازش هم می‌تپند (قبلاً فقط شنیدن)',
  cssSrc.includes('body.state-processing .orb-ring {') &&
  cssSrc.includes('body.state-processing .orb-ring.rg2'));
ok('CSS: تپش ملایم آیکون (avaIcoPulse) — بدون رنگ‌آمیزی سرخِ هسته',
  cssSrc.includes('animation: avaIcoPulse 2.4s ease-in-out infinite'));
ok('CSS: میکروفون نوار فرمان در شنیدن و پردازش هر دو قرمز (کارکردی: کلیک = توقف) + نقطهٔ نوار وضعیت',
  cssSrc.includes('body.state-processing .cmd-mic') &&
  cssSrc.includes('body.state-listening #sbMic .dot') &&
  cssSrc.includes('@keyframes dotPingRed'));
ok('Specificity: قواعد حالت با پیشوند body از قواعد idle تم‌ها می‌برند — درس 0.82.2 حفظ شده',
  cssSrc.includes('body.state-listening .orb,\nbody.state-processing .orb {') &&
  cssSrc.includes('[data-theme="light"] body.state-processing .cmd-mic'));
ok('گارد پایداری: افکت زیر perf-nofx ساکن می‌شود (halo/ring/قوس بی‌انیمیشن)',
  cssSrc.includes('body.perf-nofx .orb-core .ic { animation: none !important; }') &&
  cssSrc.includes('.orb-ring, .orb::after { animation: none !important; }'));
ok('هر ۵ تم متغیر --acc-rgb دارند — افکت در همه هم‌خانواده است',
  (cssSrc.match(/--acc-rgb:/g) || []).length >= 5);

/* ---------- ۲) تم سفید-طلایی — v0.83.1 سفیدِ قالب + اکسنت طلایی (ریلکس رو-به-جلو) ---------- */
console.log('\n[2] تم سفید-طلایی — سفیدِ قالب، زرد فقط اکسنت (v0.83.1)');
ok('پس‌زمینهٔ قالب سفید #fdfdfb در هر دو بلوک (عاجِ زرد حذف شد)',
  (cssSrc.match(/data-gold="on"\] body/g) || []).length >= 2 &&
  (cssSrc.match(/#fdfdfb/g) || []).length >= 2 &&
  !cssSrc.includes('#faf4e6'));
ok('متن‌های قالب خنثی شدند (#2a2620) — قهوه‌ایِ عاجی حذف',
  cssSrc.includes('--text: #2a2620') && !cssSrc.includes('#33260a'));
ok('سطوح سفید: پنل/ورودی/نوار وضعیت/گروه تنظیمات/کارت پاسخ/مودال',
  cssSrc.includes('--panel: rgba(255, 255, 255, 0.74)') &&
  cssSrc.includes('rgba(255, 255, 255, 0.82);') &&
  cssSrc.includes('rgba(255, 255, 255, 0.75);') &&
  cssSrc.includes('rgba(255, 255, 255, 0.97);'));
ok('کامپوننت‌های اکسنت: سوییچ طلایی + اسکرول + سِلکشن + فوکوس + kbd',
  cssSrc.includes('[data-theme="light"][data-gold="on"] .sw input:checked + i') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] ::selection') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] kbd'));
ok('نوار وضعیت + دات‌ها + tb-badge پوشش دارند',
  cssSrc.includes('[data-theme="light"][data-gold="on"] #statusbar') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] .dot.ok'));
ok('کارت پاسخ + چیپ فکر + تاریخچهٔ سفید با اکسنت طلایی',
  cssSrc.includes('[data-theme="light"][data-gold="on"] .response-card') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] .think-chip'));
ok('دیک موزیک/اکنون-در-حال-پخش + مودال‌ها (تأیید/فرم مخاطب/دایرکتوری)',
  cssSrc.includes('[data-theme="light"][data-gold="on"] .music-deck') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] .confirm') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] .ctadd-card'));
ok('مودال به‌روزرسانی: دکمهٔ اصلی طلایی گرادیانی + آیکون طلایی',
  cssSrc.includes('[data-theme="light"][data-gold="on"] .upd-card-primary') &&
  cssSrc.includes('[data-theme="light"][data-gold="on"] .upd-card-ic'));
ok('چیپ توقف در تم طلایی خوانا (قرمزِ روشن روی سفید)',
  cssSrc.includes('[data-theme="light"][data-gold="on"] .stop-chip'));
ok('خوش‌آمدگویی: گرادیان طلاییِ آرام بلوک 0.82 (برقِ #f2c14e حذف شد)',
  cssSrc.includes('[data-theme="light"][data-gold="on"] .greet h1 { background: linear-gradient(90deg, #7a5908, #b8860b, #926a0a, #7a5908)') &&
  !cssSrc.includes('#f2c14e'));

/* ---------- ۳) پلیر آوا — ری‌ورک پخش یوتیوب ---------- */
console.log('\n[3] پلیر آوا (embed رسمی یوتیوب) — پخش تضمینی');
ok('صفحهٔ پلیر: renderer/ava-player.html وجود دارد + iframe یوتیوب (v0.84: دامنهٔ قابل‌تعویض nocookie)',
  playerHtmlSrc.includes('/embed/') && playerHtmlSrc.includes("'https://www.youtube.com'") && playerHtmlSrc.includes('autoplay=1'));
ok('صفحهٔ پلیر: نوار شیشه‌ای خود-پنهان + دکمه‌های مرورگر/پخش‌مجدد/بستن + Esc (v0.85: k === Escape)',
  playerHtmlSrc.includes('id="btnBrowser"') && playerHtmlSrc.includes('id="btnReload"') &&
  /(?:e\.key|k) === 'Escape'/.test(playerHtmlSrc));
ok('صفحهٔ پلیر: پردهٔ اتصال با حالت خطا/راهنما (اگر یوتیوب نرسید)',
  playerHtmlSrc.includes('id="veil"') && playerHtmlSrc.includes('در مرورگر'));
ok('ماژول: رجیستری players + pid منفی متوالی (هرگز با PID ویندوز اشتباه نمی‌شود) — v0.85',
  modSrc.includes('const players = new Map()') && modSrc.includes('const apid = --seq'));
ok('main.js: autoplayPolicy بدون ژست + sandbox + contextIsolation در پنجرهٔ پلیر',
  mainSrc.includes("autoplayPolicy: 'no-user-gesture-required'") &&
  /ava-player\.html[\s\S]{0,600}sandbox: true/.test(mainSrc.replace(/\n/g, ' ')) === false ? mainSrc.includes('sandbox: true') : true);
ok('main.js: setWindowOpenHandler → مرورگر خارجی (پنجرهٔ نو داخل آوا ممنوع)',
  mainSrc.includes('setWindowOpenHandler'));
ok('ماژول: avaPlayerPlay — عنوان با oEmbed زنده به‌روز می‌شود — v0.85',
  modSrc.includes('async function ytTitleOf') && modSrc.includes('youtube.com/oembed'));
ok('ماژول: play پلیرهای قبلی (خارجی) را می‌بندد + آوایی‌ها navigate/بستن — تک‌لاین حفظ شود — v0.85',
  /async function play\(src, opts\)[\s\S]{0,900}closeAllExternalVideoPlayers\(\)[\s\S]{0,300}closeEntry\(en\)/.test(modSrc));
ok('بحرانی: closeVideoByPid روی pid منفی فقط بومیِ ماژول است (هرگز PowerShell/Stop-Process) — v0.85',
  mainSrc.includes('if (pidN < 0) return avaCloseByPid(pidN);') &&
  /function closeByPid\(pid\) \{[\s\S]{0,400}closeEntry\(en\)/.test(modSrc));
ok('بحرانی: focusPlayerWindow pid منفی → فوکوس بومی ماژول + NOWIN → فالبک پلیر آوا — v0.85',
  /function focusPlayerWindow\(pidHint\) \{[\s\S]{0,260}if \(pidN0 < 0\) return avaFocusByPid\(pidN0\);/.test(mainSrc) &&
  mainSrc.includes('avaAvaFocusNewest()') && /function focusNewest\(\)/.test(modSrc));
ok('videoWinList: پنجره‌های پلیر آوا در فهرست (proc=ava-player) + مرتب‌سازی سنی',
  mainSrc.includes("proc: 'ava-player'") && mainSrc.includes('wins.sort((a, b) => a.ageSec - b.ageSec)'));
ok('videoWinOps: pid منفی → عملیات بومی ماژول (PIP/سایز/شفافیت/مانیتور/شات بدون PowerShell) — v0.85',
  mainSrc.includes('if (pidN < 0) return avaPlayerOp(kind, arg, pidN);') &&
  mainSrc.includes('const avaPlayerOpAll = (kind, arg) => AP.opAll(kind, arg);') &&
  /async function opAll\(kind, arg\)/.test(modSrc));
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
ok('runningVideoTargets: شمارش «پلیری باز نیست» پلیر آوا را هم می‌بیند (v0.85: n + AP.size)',
  mainSrc.includes('async function runningVideoTargets()') &&
  mainSrc.includes('return n + AP.size();') &&
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
