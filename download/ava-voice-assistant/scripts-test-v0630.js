#!/usr/bin/env node
/* scripts-test-v0630.js — v0.63 — «مغز اجرایی»: هر فرمانِ فهمیده‌شده باید اجرا شود
   ------------------------------------------------------------
   گزارش کاربر (لاگ activity v0.62 — ۱۳ نسخه لاگ، ۷٬۰۰۰+ خط):
   «نرم‌افزار خیلی از کارهایی که می‌گم رو انجام نمیده — خیلی از چیزها
   کاربر خواسته انجام نشده»

   ریشه‌ها (سه‌گانه، از لاگ واقعی استخراج شد):
   [الف] واژگانِ مغز ناقص بود: video_play/video_ctl اصلاً در پرامپت «فارسی»
        نبودند (فقط انگلیسی) → AI فرمت value را حدس می‌زد
        (video_play(https://www.youtube.com/) سه بار در لاگ).
   [ب] فرمان‌های «پین کن/ببند/ببر بالا سمت راست/بزرگتر کن» یا فهمیده می‌شدند
        ولی بلوک DO ندادند (سکوت مطلق — ۴ بار «پین کن» پشت‌سرهم!) یا
        نزدیک‌ترین اکشنِ اشتباه زده می‌شد («یه ذره بزرگتر کن» → fullscreen).
   [پ] پلیرِ دستیِ کاربر (خودش پات‌پلیر را باز کرده بود) زیر کنترل آوا نبود
        و «لینکی که کپی کردم» هرگز از کلیپ‌بورد خوانده نمی‌شد.

   فیکس ساختاری v0.63:
   • پرامپت فارسی: بولت‌های video_play/video_ctl + قانون مهم ۱۱ (نگاشت کامل
     کنترل پخش) — انگلیسی هم با rule 10 هم‌تراز شد
   • حکم اجرا (DO-repair): فکر=فرمان ولی بلوک DO نبود → یک دور ترمیم
   • گرامر گستردهٔ video_ctl: pin/unpin و move و grow/shrink و seek:±sec
     با videoCtlParse (تابع مستقل از DOM — همین سوئیت زنده eval می‌کند)
   • موتور کنترل پنجره (main): پنجرهٔ پلیر با اسکن پروسس + user32 یافت
     می‌شود — pin/unpin (TOPMOST)، move، grow/shrink، closeِ پلیر بیگانه
   • لینک کپی‌شده: video_play با __clipboard__/اشارهٔ «کپی کردم»/دامنهٔ خام
     یوتیوب → لینک واقعی از کلیپ‌بورد؛ لینک بی‌شناسه دیگر به پلیر/مرورگر نمی‌رود

   چک‌ها:
   [1] videoCtlParse — ماتریس زنده (گرامر + مستعار + فارسی + خطا=null)
   [2] دیسپچر video_ctl از videoCtlParse استفاده می‌کند + برچسب‌های فارسی
   [3] video_play — کلیپ‌بورد (mentionsCopy/bareYt/__clipboard__) + noVideoId
   [4] main — موتور پنجره (topmost/notopmost/move/grow/shrink/close بیگانه)
       + فول‌اسکرین پلیر-آگاه (پات‌پلیر=Enter) + YT_NOVIDEO_RE
   [5] پرامپت فارسی (زنده): بولت‌های video_play/video_ctl + قانون مهم ۱۱
   [6] پرامپت انگلیسی (زنده): rule 10 + Allowed acts گسترده
   [7] حکم اجرا: DO-repair در جریان مغز + _rEff
   [8] نسخهٔ 0.63.0-beta در ۴ جای رسمی
*/
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}
function section(t) { console.log('\n' + t); }

const mainSrc = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/app.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const idxSrc = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
const readmeSrc = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

/* ---------- استخراج زندهٔ توابع/رشته‌ها از سورس واقعی ---------- */
function extractBetween(src, startMark, endMark) {
  const i = src.indexOf(startMark);
  if (i < 0) return null;
  const j = src.indexOf(endMark, i + startMark.length);
  if (j < 0) return null;
  return src.slice(i, j);
}
function evalFn(src, fnName) {
  try {
    return eval('(function(){ ' + src + ' ; return ' + fnName + '; })()');
  } catch (e) { return null; }
}
const vcSrc = extractBetween(appSrc, 'function videoCtlParse(value) {', 'return null;\n  }');
const videoCtlParse = vcSrc ? evalFn(vcSrc + '\n  return null;\n  }', 'videoCtlParse') : null;

/* ---------- [1] ماتریس زندهٔ videoCtlParse ---------- */
section('[1] videoCtlParse — ماتریس زنده');
ok(typeof videoCtlParse === 'function', 'videoCtlParse از سورس استخراج و eval شد');
if (videoCtlParse) {
  const M = [
    ['pin', 'pin', 0], ['unpin', 'unpin', 0],
    ['move:top-right', 'move', 'top-right'], ['move top right', 'move', 'top-right'],
    ['move:top_right', 'move', 'top-right'], ['move:bottom-left', 'move', 'bottom-left'],
    ['move:center', 'move', 'center'], ['move', 'move', 'center'],
    ['move:top', 'move', 'top'], ['move:right', 'move', 'right'],
    ['grow', 'grow', 0], ['shrink', 'shrink', 0], ['bigger', 'grow', 0], ['smaller', 'shrink', 0],
    ['seek:-10', 'seek', -10], ['seek:30', 'seek', 30], ['seek:90', 'seek', 90],
    ['close', 'close', 0], ['stop', 'stop', 0], ['fullscreen', 'fullscreen', 0],
    ['play_pause', 'play_pause', 0], ['pause', 'play_pause', 0], ['resume', 'play_pause', 0],
    ['next', 'next', 0], ['volume_up', 'volume_up', 0], ['volume_down', 'volume_down', 0],
    ['ببند', 'close', 0], ['پین', 'pin', 0], ['رویر', 'pin', 0],
    ['بزرگتر', 'grow', 0], ['کوچکتر', 'shrink', 0], ['فول اسکرین', 'fullscreen', 0],
  ];
  let mOK = 0;
  for (const [inp, act, arg] of M) {
    const r = videoCtlParse(inp);
    const good = r && r.action === act && JSON.stringify(r.arg) === JSON.stringify(arg);
    if (good) mOK++; else console.log('    ✗ matrix:', inp, '→', JSON.stringify(r));
  }
  ok(mOK === M.length, 'ماتریس گرامر ' + mOK + '/' + M.length);
  ok(videoCtlParse('xyz نامفهوم') === null, 'ورودی نامفهوم → null (پیام صادقانه)');
  ok(videoCtlParse('') === null, 'ورودی خالی → null');
  ok(videoCtlParse('move:top-right').arg === 'top-right', 'move با خط تیره حفظ می‌شود');
}

/* ---------- [2] دیسپچر video_ctl ---------- */
section('[2] دیسپچر video_ctl — گرامر گسترده');
ok(/case 'video_ctl': \{[\s\S]*?videoCtlParse\(a\.value\)/.test(appSrc), 'دیسپچر از videoCtlParse استفاده می‌کند');
ok(/pin: 'پلیر همیشه رویر شد\.'/.test(appSrc), 'برچسب فارسی pin');
ok(/grow: 'پنجرهٔ ویدیو بزرگتر شد\.'/.test(appSrc), 'برچسب فارسی grow');
ok(/move: 'پنجرهٔ ویدیو جابه‌جا شد\.'/.test(appSrc), 'برچسب فارسی move');
ok(!/const okSet = new Set\(\['play_pause', 'next', 'prev', 'stop', 'close', 'fullscreen', 'volume_up', 'volume_down'\]\)/.test(appSrc), 'okSet قدیمی (فقط ۸ اکشن) حذف شد');

/* ---------- [3] video_play — کلیپ‌بورد ---------- */
section('[3] video_play — لینک کپی‌شده از کلیپ‌بورد');
ok(appSrc.indexOf("const mentionsCopy = /(کپی\\s*(کردم|شده))|کلیپ\\s?بورد|clipboard/i.test(String(origCmd || ''))") >= 0, 'تشخیص «کپی کردم/کلیپ‌بورد» در فرمان کاربر');
ok(appSrc.indexOf('const bareYt = /^(https?:\\/\\/)?(www\\.)?(youtube\\.com\\/?(?:[?#].*)?|youtu\\.be\\/?)(\\s|$)/i.test(vq0)') >= 0, 'تشخیص دامنهٔ خام یوتیوب');
ok(appSrc.indexOf('vq0.replace(/__clipboard__/gi, \'\')') >= 0, 'حذف مارکر __clipboard__ از value');
ok(appSrc.indexOf('const cb = (bridge && bridge.sys && bridge.sys.clipboard) ? await bridge.sys.clipboard() : null;') >= 0, 'خواندن کلیپ‌بورد از مسیر bridge.sys.clipboard');
ok(appSrc.indexOf('.match(/https?:') >= 0 && appSrc.indexOf('cbUrl = mt[0]') >= 0, 'استخراج URL از متن کلیپ‌بورد');
ok(appSrc.indexOf('لینک ویدیویی در کلیپ‌بورد نبود') >= 0, 'پیام صادقانه: کلیپ‌بورد خالی');
ok(appSrc.indexOf('res.noVideoId') >= 0 && appSrc.indexOf('این آدرس یوتیوب ویدیوی مشخصی ندارد') >= 0, 'پیام صادقانه: لینک بی‌شناسه');

/* ---------- [4] main — موتور کنترل پنجره ---------- */
section('[4] main — موتور کنترل پنجرهٔ پلیر');
ok(/const PLAYER_PROC_RE = 'potplayer\|mpv\|mpc\|wmplayer\|vlc\|kmplayer\|gom\|bsplayer\|smplayer'/.test(mainSrc), 'PLAYER_PROC_RE — پلیرهای شناخته‌شده');
ok(/function playerWindowCtl\(kind, arg\)/.test(mainSrc), 'playerWindowCtl تعریف شده');
ok(/'topmost'\) act = "\[W\.N\]::SetWindowPos\(\$h,\[IntPtr\]\(-1\)/.test(mainSrc), 'pin = HWND_TOPMOST (-1)');
ok(/'notopmost'\) act = "\[W\.N\]::SetWindowPos\(\$h,\[IntPtr\]\(-2\)/.test(mainSrc), 'unpin = HWND_NOTOPMOST (-2)');
ok(/PostMessage\(\$h,0x0010/.test(mainSrc), 'close = WM_CLOSE (0x0010) + خاتمهٔ پشتیبان');
ok(/\$nw=\[int\]\[Math\]::Min\(\$wa\.Width-16/.test(mainSrc) && /\[int\]\(\$w\*1\.15\)/.test(mainSrc), 'grow = بزرگنمایی ۱۵٪ با مهار به محیط کار');
ok(/\[Math\]::Max\(260,\[int\]\(\$w\*0\.85\)\)/.test(mainSrc), 'shrink = کوچک‌سازی ۱۵٪ با کف اندازه');
ok(/\$wa=\[System\.Windows\.Forms\.Screen\]::PrimaryScreen\.WorkingArea/.test(mainSrc), 'move — محاسبه از WorkingArea');
ok(/playerCtl\.lastWinProc = String\(toks\.slice\(2\)/.test(mainSrc), 'کش پروسس پلیر یافت‌شده (lastWinProc)');
ok(/if \(a === 'pin' \|\| a === 'unpin' \|\| a === 'move' \|\| a === 'grow' \|\| a === 'shrink'\)/.test(mainSrc), 'سیم‌کشی ۵ اکشن پنجره در player:ctl');
ok(/const wr = await playerWindowCtl\('close'\)/.test(mainSrc), 'closeِ پلیر بیگانه (خودِ کاربر باز کرده)');
ok(/const VK = \{ left: 0x25, right: 0x27, up: 0x26, down: 0x28, esc: 0x1B, f: 0x46, f11: 0x7A, enter: 0x0D \}/.test(mainSrc), 'VK.enter اضافه شد');
ok(/\/potplayer\/\.test\(nm\)\) \{ fgKeys\(\[VK\.enter\]\)/.test(mainSrc), 'فول‌اسکرین پلیر-آگاه: پات‌پلیر=Enter');
ok(/\/mpv\|vlc\|mpc\/\.test\(nm\)\) \{ fgKeys\(\[\VK\.f\]\)/.test(mainSrc.replace('\\', '\\')), 'فول‌اسکرین پلیر-آگاه: mpv/vlc/mpc=F');
ok(mainSrc.indexOf('const YT_NOVIDEO_RE = /') >= 0 && mainSrc.indexOf('noVideoId: true') >= 0, 'YT_NOVIDEO_RE — دامنهٔ خام + ردِ لینک بی‌شناسه');
ok(/noVideoId: true, error: 'این آدرس یوتیوب ویدیوی مشخصی ندارد'/.test(mainSrc), 'ردِ لینک بی‌شناسه با خطای شفاف (playerLaunchYt)');

/* ---------- [5] پرامپت فارسی (زنده) ---------- */
section('[5] پرامپت فارسی — بولت‌ها + قانون مهم ۱۱');
const faSrc = extractBetween(appSrc, 'const AI_SYSTEM_FA =', 'const AI_SYSTEM_EN =');
let FA = null;
try { FA = eval('(function(){ ' + faSrc + ' return AI_SYSTEM_FA; })()'); } catch (e) { FA = null; }
ok(!!FA && FA.length > 3000, 'AI_SYSTEM_FA از سورس ساخته شد (' + (FA ? FA.length : 0) + ' کاراکتر)');
if (FA) {
  ok(FA.indexOf('- video_play: value=عنوانِ دقیقِ ویدیو/فیلم') >= 0, 'بولت video_play در پرامپت فارسی');
  ok(FA.indexOf('__clipboard__') >= 0, 'قرارداد __clipboard__ در پرامپت فارسی');
  ok(FA.indexOf('- video_ctl: کنترل پلیر/پنجرهٔ ویدیو') >= 0, 'بولت video_ctl در پرامپت فارسی');
  ok(FA.indexOf('pin|unpin|grow|shrink|move:top-left|move:top-right') >= 0, 'واژگان گستردهٔ video_ctl در پرامپت');
  ok(FA.indexOf('«بزرگتر/کوچکتر کردنِ» ویدیو هرگز fullscreen نیست') >= 0, 'ممنوعیت fullscreen برای بزرگ/کوچک');
  ok(FA.indexOf('قانون مهم ۱۱ (بسیار مهم): هر درخواستِ کنترلِ ویدیو/پلیر = بلوک DO با act=video_ctl') >= 0, 'قانون مهم ۱۱');
  ok(FA.indexOf('«ببر بالا سمت راست»=move:top-right') >= 0, 'نگاشت «ببر بالا سمت راست»');
  ok(FA.indexOf('«بزرگتر کن/ابعادشو زیاد کن»=grow') >= 0, 'نگاشت «بزرگتر کن»');
  ok(FA.indexOf('«بعدی/پاس کن»=next') >= 0, 'نگاشت «پاس کن»');
  ok(FA.indexOf('فرمانِ اجرایی هرگز بدونِ بلوک DO نمی‌ماند') >= 0, 'قانون عدمِ سکوت');
}

/* ---------- [6] پرامپت انگلیسی (زنده) ---------- */
section('[6] پرامپت انگلیسی — rule 10 + Allowed acts گسترده');
const enSrc = extractBetween(appSrc, 'const AI_SYSTEM_EN =', 'const aiSystem = () =>');
let EN = null;
try { EN = eval('(function(){ ' + enSrc + ' return AI_SYSTEM_EN; })()'); } catch (e) { EN = null; }
ok(!!EN && EN.length > 3000, 'AI_SYSTEM_EN از سورس ساخته شد');
if (EN) {
  ok(EN.indexOf('Important rule 10 (critical): EVERY video/player control request = a DO block with act=video_ctl') >= 0, 'rule 10 انگلیسی');
  ok(EN.indexOf('"make it bigger"=grow') >= 0 && EN.indexOf('"make it smaller"=shrink') >= 0, 'نگاشت bigger/smaller در EN');
  ok(EN.indexOf('Making the video bigger/smaller is NEVER fullscreen') >= 0, 'ممنوعیت fullscreen در EN');
  ok(EN.indexOf('value=__clipboard__ so AVA reads the clipboard') >= 0, '__clipboard__ در Allowed acts');
  ok(EN.indexOf('pin|unpin|grow|shrink|move:top-left') >= 0, 'واژگان گسترده در Allowed acts');
}

/* ---------- [7] حکم اجرا (DO-repair) ---------- */
section('[7] حکم اجرا — فرمانِ فهمیده‌شده هرگز بی‌اجرا نمی‌ماند');
ok(/let doRes = parseDo\(r\.text\)/.test(appSrc), 'doRes حالا let است (قابل ترمیم)');
ok(/ai DO-repair: فکر=فرمان ولی بلوک DO نبود — دور ترمیم/.test(appSrc), 'لاگ دور ترمیم');
ok(/\/\(command\|فرمان\)\/i\.test\(String\(_bt\.think\)\.slice\(0, 60\)\)/.test(appSrc), 'شرط: فکر=فرمان/command');
ok(/\[دور ترمیم — قانون مهم: در فکرِ قبلی خودت این درخواست را «فرمان\/command» خواندی/.test(appSrc), 'پرامپت ترمیم');
ok(/doRes = _rd; _rEff = _rp;/.test(appSrc), 'جایگزینی نتیجهٔ ترمیم');
ok(/rcTag\.textContent = t\('tag\.aiDo'\) \+ \(_rEff\.via \? ' · ' \+ _rEff\.via : ''\)/.test(appSrc), 'نشان via از پاسخِ ترمیم‌شده');

/* ---------- [8] نسخه ---------- */
section('[8] نسخهٔ 0.63.0-beta در ۴ جای رسمی');
ok(pkg.version === '0.63.0-beta', 'package.json → ' + pkg.version);
ok(/appVersion\s*=\s*'0\.63\.0-beta'/.test(appSrc), 'app.js appVersion');
ok(/abVersion[^0-9]*0\.63\.0-beta/.test(idxSrc), 'index.html abVersion');
ok(readmeSrc.indexOf('۰.۶۳.۰-بتا') >= 0, 'README تیتر/بلاک ۰.۶۳.۰-بتا');

/* ---------- نتیجه ---------- */
console.log('\n———————————————');
console.log('PASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
