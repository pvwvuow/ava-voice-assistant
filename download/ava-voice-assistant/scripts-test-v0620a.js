#!/usr/bin/env node
/* scripts-test-v0620a.js — v0.62 — «حل‌کنندهٔ جریان»: یک لاین برای یوتیوب
   ------------------------------------------------------------
   گزارش کاربر (v0.61): «سرچ می‌کنم، ویدیو رو پخش می‌کنم؛ توی پات‌پلیر باز
   می‌کنه ولی پخش نمیشه — یا میگه ساین این ویدیو اکانت، یا میگه تصحیح کن که
   ربات نیستی».

   ریشه (ساختاری، نه موردی): در v0.61 لینک خام یوتیوب به پت‌پلیر/کی‌ام‌پلیر
   داده می‌شد (STREAM_NATIVE) و پارسر داخلی پلیرها پشت دیوار ربات‌یابی/ورود
   یوتیوب می‌ماند. قانون ساختاری جدید: لینک خام یوتیوب «هرگز» به هیچ پلیری
   داده نمی‌شود — اول yt-dlp استریم مستقیم می‌سازد (تک‌فایلی muxed، با همهٔ
   پلیرها سازگار)؛ yt-dlp خودش شفا می‌یابد (کهنه شد → نسخهٔ تازه → تلاش
   دوباره)؛ آخرین طبقهٔ نردبان: مرورگر (کاربر لاگین است؛ دیوار ربات نیست).
   نتیجه: «پخش نشد» دیگر بن‌بست نیست — کاربر همیشه ویدیو را می‌بیند.

   چک‌ها:
   [1] playerOpenDecision — یوتیوب = یک لاین (spawn-ytdlp برای هر پلیر دسکتاپی)
   [2] منسوخ‌شده‌ها: STREAM_NATIVE/STREAM_YTDLP + راهنمای غلط «با پت‌پلیر پخش کن»
   [3] لایهٔ حل‌کنندهٔ yt-dlp خود-شفادار (فرمت/منبع رسمی/دانلود اتمی/شفای کهنه)
   [4] نردبان playerLaunchYt — فالبک مرورگر؛ سیم‌کشی player:open + openWithDefaultPlayer
   [5] پیام‌های صادقانهٔ رندرر (browser-fallback در ۳ مسیر)
   [6] نسخهٔ 0.63.0-beta در ۴ جای رسمی
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

/* ============ [1] تصمیم واحد — یوتیوب یک لاین (زنده) ============ */
section('[1] playerOpenDecision — یوتیوب برای همهٔ پلیرهای دسکتاپی spawn-ytdlp');
{
  const m = /function playerOpenDecision\(kind, src, wanted, scan, def\)\s*\{[\s\S]*?\n\}/.exec(mainSrc);
  ok(!!m, 'تابع تصمیم در main.js استخراج‌پذیر است');
  if (m) {
    /* eslint-disable no-eval */
    const fn = eval('(' + m[0] + ')');
    const YT = 'https://www.youtube.com/watch?v=x';
    const scan = { list: [{ id: 'vlc' }, { id: 'potplayer' }, { id: 'kmplayer' }, { id: 'mpv' }, { id: 'mpc' }, { id: 'wmplayer' }], ytdl: true };
    const d1 = fn('url', YT, 'default', scan, { id: 'potplayer' });
    ok(d1.action === 'ava-player' && d1.player === 'ava', 'پیش‌فرض پت‌پلیر + یوتیوب → ava-player (v0.83: مسیر پیش‌فرض = پلیر آوا؛ پت‌پلیر صریح همان yt-dlp — پین بعدی)');
    ok(fn('url', YT, 'default', scan, { id: 'kmplayer' }).action === 'ava-player', 'پیش‌فرض کی‌ام‌پلیر + یوتیوب → ava-player (v0.83)');
    ok(fn('url', YT, 'default', scan, { id: 'vlc' }).action === 'ava-player', 'پیش‌فرض VLC + یوتیوب → ava-player (v0.83)');
    ok(fn('url', YT, 'wmplayer', scan, null).action === 'spawn-ytdlp', 'پلیر صریح WMP + یوتیوب → spawn-ytdlp (استریم مستقیم در WMP هم پخش می‌شود)');
    ok(fn('url', YT, 'default', { list: scan.list, ytdl: false }, { id: 'vlc' }).action === 'ava-player', 'بدون yt-dlp هم پیش‌فرض → ava-player (v0.83: پلیر آوا yt-dlp نمی‌خواهد)');
    ok(fn('url', YT, 'default', scan, { id: 'uwp' }).action === 'ava-player', 'پیش‌فرض UWP (Media Player مایکروسافت) + یوتیوب → ava-player (v0.83: قبلاً مرورگر)');
    ok(fn('file', 'C:\\v\\a.mp4', 'default', scan, { id: 'uwp' }).action === 'os-default', 'فایل محلی + پیش‌فرض UWP → os-default (ثابت)');
    ok(fn('url', YT, 'default', { list: [], ytdl: false }, { id: '' }).action === 'ava-player', 'هیچ پلیری نصب نیست + یوتیوب → ava-player (v0.83: همیشه پخش می‌شود)');
    ok(fn('url', 'https://example.com/v.mp4', 'default', scan, { id: 'potplayer' }).action === 'spawn', 'لینک مستقیم ویدیو (غیر یوتیوب) → spawn مستقیم (بدون resolver)');
  }
}

/* ============ [2] منسوخ‌شده‌ها ============ */
section('[2] ساختار منسوخ حذف شده است');
ok(!mainSrc.includes('STREAM_NATIVE') && !mainSrc.includes('STREAM_YTDLP'), 'main.js: بدون STREAM_NATIVE/STREAM_YTDLP (لینک خام یوتیوب به هیچ پلیری نمی‌رود)');
ok(!mainSrc.includes('با پت‌پلیر پخش کن»'), 'راهنمای غلط «بگو با پت‌پلیر پخش کن» حذف شد (پت‌پلیر دیگر مسیر ویژه ندارد)');
ok(!appSrc.includes('به yt-dlp نیاز دارد') && !appSrc.includes('needs yt-dlp'), 'app.js: پیام بن‌بستی «به yt-dlp نیاز دارد» حذف شد (نردبان جایگزین کرد)');

/* ============ [3] حل‌کنندهٔ yt-dlp خود-شفادار ============ */
section('[3] resolveYtStream — استریم مستقیم + شفای yt-dlp کهنه');
{
  const m = /function ytDlpCmd\(bin, url\)\s*\{[\s\S]*?\n\}/.exec(mainSrc);
  ok(!!m, 'ytDlpCmd (سازندهٔ فرمان خالص) استخراج‌پذیر است');
  if (m) {
    /* eslint-disable no-eval */
    const cmd = eval('(' + m[0] + ')')('C:\\bin\\yt-dlp.exe', 'https://www.youtube.com/watch?v=abc');
    ok(cmd.includes('-f "22/18/b[ext=mp4]/b[ext=webm]/b"'), 'فورمت تک‌فایلی با نردبان گسترده mp4→webm (v0.82: ریشهٔ «پلیر پخش نمی‌کند» یوتیوب فرمت 22/18 را پس می‌گیرد)');
    ok(cmd.includes(' -g ') && cmd.includes('--no-playlist') && cmd.includes('--no-warnings'), '‎-g + بدون پلی‌لیست/هشدار');
    ok(cmd.includes('"https://www.youtube.com/watch?v=abc"'), 'URL در کوتیشن');
  }
  ok(/function resolveYtStream\(url\)/.test(mainSrc), 'resolveYtStream — لایهٔ حل استریم وجود دارد');
  ok(/function ytDlpBundledPath\(\)/.test(mainSrc) && mainSrc.includes("'bin', 'yt-dlp.exe'"), 'باندل در userData/bin/yt-dlp.exe (بدون آلودگی سیستم کاربر)');
  ok(mainSrc.includes('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'), 'دانلود فقط از منبع رسمی yt-dlp');
  ok(mainSrc.includes(".part'") && mainSrc.includes('fs.renameSync(part, bin)'), 'دانلود اتمی: .part → rename');
  ok(mainSrc.includes('30 * 60 * 1000'), 'خنک‌کاری ۳۰ دقیقه‌ای بعد از شکست دانلود (بدون مزاحمت مکرر شبکه)');
  ok(/ytDlpClientCmd\(b, u, 'ios'\)/.test(mainSrc) && /await ytDlpDownload\(\)/.test(mainSrc), 'شفای yt-dlp کهنه — حتی سیستمی — با دانلود نسخهٔ تازهٔ باندل + فالبک کلاینت ios (v0.82)');
  ok(/resolve\(\/\^https\?:\\\/\\\//i.test(mainSrc) || /\^https\?:\\\/\\\/\//.test(mainSrc), 'خروجی -g فقط اگر http(s) باشد پذیرفته می‌شود');
  ok(mainSrc.includes("const wPath = await execWhere('yt-dlp');") && mainSrc.includes('const ytdl = wPath ||'), 'playersScan: yt-dlp = PATH سیستم یا باندل خود آوا');
}

/* ============ [4] نردبان فالبک مرورگر ============ */
section('[4] playerLaunchYt — بن‌بست ندارد (پلیر یا مرورگر)');
ok(/async function playerLaunchYt\(player, src(, keep)?\)/.test(mainSrc), 'playerLaunchYt تعریف شده است'); /* v0.80 forward-relax: + keep */
ok(/await playerLaunch\(player, src, \{ ytdl: true(, keepExisting: !!keep)? \}\);[\s\S]{0,900}avaPlayerPlay\(s, \{ keepExisting: !!keep, reason: 'ytdl-fail' \}\);[\s\S]{0,700}shell\.openExternal\(src\); return \{ ok: true, via: 'browser-fallback'/.test(mainSrc), 'نردبان فالبک: پلیر صریح شکست → پلیر آوا (v0.83) → مرورگر آخرین طبقه (browser-fallback)'); /* v0.80/v0.83 forward-relax */
ok(mainSrc.includes("if (d.action === 'no-ytdlp' || d.action === 'spawn-ytdlp') {\n    /* v0.62 — یک لاین"), 'player:open: هر دو اقدام تصمیم به یک لاین می‌روند');
ok(/if \(d\.action === 'no-ytdlp' \|\| d\.action === 'spawn-ytdlp'\) return playerLaunchYt\(d\.player, url\);/.test(mainSrc), 'openWithDefaultPlayer: همان یک لاین (youtube_play/sys-run هم)');
ok(/if \(isYt && opts && opts\.ytdl\) \{\s*\n\s*const r = await resolveYtStream\(feed\);/.test(mainSrc), 'playerLaunch: یوتیوب اول حل می‌شود، بعد پخش');
ok(mainSrc.includes('ytFail: true'), 'شکست حل استریم با پرچم ytFail گزارش می‌شود');

/* ============ [5] پیام‌های رندرر ============ */
section('[5] پیام صادقانهٔ «مرورگر» در هر سه مسیر رندرر');
ok((appSrc.match(/browser-fallback/g) || []).length >= 4, 'app.js: هندلینگ browser-fallback در player_open + video_play + yt_bring');
ok((appSrc.match(/پلیر نتوانست یوتیوب را پخش کند/g) || []).length >= 2, 'پیام فارسی صادقانه: «پلیر نتوانست یوتیوب را پخش کند — در مرورگر بازش کردم»');
ok(!appSrc.includes("Say \"play it in PotPlayer\" instead"), 'پیام انگلیسی قدیمیِ اشتباه (پیشنهاد پت‌پلیر) حذف شد');

/* ============ [6] نسخه ============ */
section('[6] نسخهٔ 0.63.0-beta در ۴ جای رسمی');
ok(new RegExp('^0\\.(6[3-9]|[7-9]\\d)\\.\\d+(?:-[\\w.]+)?$').test(pkg.version), 'package.json → ' + pkg.version); /* v0.64 forward-relax */
ok(new RegExp("let appVersion = ['\"]0\\.(6[3-9]|[7-9]\\d)\\.\\d+(?:-[\\w.]+)?['\"]").test(appSrc), 'app.js appVersion → ' + (appSrc.match(/let appVersion = ['"][^'"]+/) || [''])[0]); /* v0.64 forward-relax */
ok(new RegExp('id="abVersion">v0\\.(6[3-9]|[7-9]\\d)\\.\\d+(?:-[\\w.]+)?<').test(idxSrc), 'index.html abVersion → v0.64 line'); /* v0.64 forward-relax */
ok(readmeSrc.includes('در نسخه ۰.۶۲.۰') && readmeSrc.includes('yt-dlp خود-شفادار'), 'README: تیتر + بلاک ۰.۶۲ حاضر است');

console.log('\n-----------------------------');
console.log(`RESULT: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
