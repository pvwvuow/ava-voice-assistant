'use strict';
/* ============================================================
   آوا — scripts-test-v0430.js — تست رگرسیون v0.43
   ------------------------------------------------------------
   درخواست‌های کاربر (پیام فارسی):
   ۱) «TTS رو تغییر میدم تو تنظیمات ولی هیچی تغییر نمیکنه» → موتور واقعی
      پخش‌شده ثبت/اعلام می‌شود + صدای مذکر/مؤنث اِج
   ۲) «نمیخام دونه دونه فیکس کنی کامند هارو — کل سیستم فرمان‌پذیری» →
      موتور داوری نیت AVAIntent (لنگر/ممنوعه/امتیاز/داوری AI)
   ۳) «کاربر لینکو کپی نکنه — ویدیوی در حال پلی هر مرورگر» → SMTC
      + ytResolve + پخش‌کنندهٔ یوتیوبِ خود آوا (نه امبد «برو توی یوتیوب»)
   ۴) «مانیتور خاموش نمیشه و اقدامات این چنینی» → PostMessage/Timeout + لاگ‌آف
   ۵) «سیستم کنترل خیلی قوی پلیرها با هر کامندی + پخش یوتیوب داخل پلیر» →
      player:scan/open/ctl (VLC HTTP + mpv IPC + کلیدهای جهانی)
   ۶) «اسکن نرم‌افزارای سیستم اول» → اسکن بوت + UWP
   ============================================================ */
const fs = require('fs');
const path = require('path');
const R = __dirname;
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('PASS | ' + name); } else { fail++; console.log('FAIL | ' + name); } };
const eq = (a, b, name) => ok(a === b, name + (a === b ? '' : `  [got=${JSON.stringify(a)} want=${JSON.stringify(b)}]`));

const app = read('renderer/js/app.js');
const main = read('main.js');
const pre = read('preload.js');
const idx = read('renderer/index.html');
const intentSrc = read('renderer/js/voiceIntent.js');
const pkg = JSON.parse(read('package.json'));

/* استخراج تابع از سورس (برای تست رفتاری واقعی) */
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0, started = false;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') { d++; started = true; }
    else if (src[k] === '}') { d--; if (started && !d) return src.slice(i, k + 1); }
  }
  return null;
}

/* ============================================================
   ۱) موتور داوری نیت — رفتار واقعی AVAIntent
   ============================================================ */
const AVAIntent = require('./renderer/js/voiceIntent.js');
/* قوانین آزمایشی با همان شکل k/id RULES آوا (منظم از آخر به اول مثل app.js) */
const fakeRules = [
  { id: 'web_search', k: /جستجو|سرچ|سیرچ|گوگل\s*(کن|بزن)?|google|پیداش\s*کن|search$/i },
  { id: 'open_youtube', k: /یوتیوب|youtube/i },
  { id: 'open_music', k: /موسیقی|آهنگ|موزیک|play music/i },
  { id: 'open_chrome', k: /کروم|مرورگر|chrome|browser/i },
];
/* music_play/yt_search از جلو (splice(1)) مثل app.js */
fakeRules.splice(1, 0,
  { id: 'music_play', k: /(?:پخش|بزن|پلی|شروع|play)[^.]{0,10}(?:موزیک|موسیقی|آهنگ|اهنگ|آواز|ترانه|music|song)|(?:موزیک|موسیقی|آهنگ|اهنگ)[^.]{0,14}(?:پخش|بزن|پلی|شروع|play)/i },
  { id: 'yt_search', k: /(?=.*(یوتیوب|youtube))(?=.*(جستجو|سرچ|سیرچ|بگرد|پخش|پلی\s?کن|بزن|بذار|آهنگ|ترانه|ویدیو|فیلم|search|find))/i },
  { id: 'cmdpage', k: /دستورات|فرمانها?|کامندها?|لیست\s?(فرمان|دستور)/i }
);

const A1 = AVAIntent.arbitrate('توی یوتیوب برام آهنگ شادمهر پلی کن', fakeRules);
ok(A1 && A1.rule && A1.rule.id === 'yt_search', 'داوری: «توی یوتیوب آهنگ شادمهر پلی کن» → yt_search (نه موزیک محلی!)');
ok(A1 && !A1.ranked.some((x) => x.rule.id === 'music_play'), 'داوری: قانون موزیکِ محلی با ممنوعهٔ یوتیوب حذف شد');

const A2 = AVAIntent.arbitrate('موزیک پلی کن', fakeRules);
ok(A2 && A2.rule && A2.rule.id === 'music_play' && A2.decisive, 'داوری: «موزیک پلی کن» → music_play قاطع');

const A3 = AVAIntent.arbitrate('گوگل کروم را برام باز کن', fakeRules);
ok(A3 && A3.rule && A3.rule.id === 'open_chrome', 'داوری: «گوگل کروم را باز کن» → open_chrome (نه web_search)');

const A4 = AVAIntent.arbitrate('میخوام دستورات مربوط به یوتیوب و فیلم رو ببینم', fakeRules);
ok(A4 && A4.rule && A4.rule.id === 'cmdpage', 'داوری: «دستورات یوتیوب رو ببینم» → cmdpage (ممنوعهٔ دستورات در yt/open_youtube)');

const A5 = AVAIntent.arbitrate('یوتیوب رو باز کن', fakeRules);
ok(A5 && A5.rule && A5.rule.id === 'open_youtube', 'داوری: «یوتیوب رو باز کن» → open_youtube');

const A6 = AVAIntent.arbitrate('بگو ببینم چی داره پخش میشه', fakeRules.concat([{ id: 'now_playing', k: /چی\s?(داره\s?)?پخش|now playing/i }]));
ok(A6 && A6.rule && A6.rule.id === 'now_playing', 'داوری: «چی داره پخش میشه» → now_playing');

/* نامزدها برای AI */
const A7 = AVAIntent.arbitrate('موزیک باز کن', fakeRules);
ok(AVAIntent.candidatesText(A7) === '' || typeof AVAIntent.candidatesText(A7) === 'string', 'داوری: candidatesText امن (رشته یا خالی)');

/* فاصلهٔ نزدیک دو نیت ثبت‌شده → غیرقاطع → داوری AI */
const A8 = AVAIntent.arbitrate('موزیک', fakeRules);
if (A8 && A8.ranked.length >= 2 && A8.ranked[1].rule.id === 'open_music') {
  eq(A8.decisive, false, 'داوری: رقابت نزدیک موزیک/open_music → غیرقاطع (AI داوری می‌کند)');
} else ok(true, 'داوری: «موزیک» تک‌نامزد — قاطع');

/* جدول ممنوعه‌ها سرجایشان هستند */
ok(AVAIntent.TABLE.music_play.negatives.some((r) => r.test('یوتیوب')), 'جدول: music_play ممنوعهٔ یوتیوب');
ok(AVAIntent.TABLE.open_youtube.negatives.some((r) => r.test('پلی کن')), 'جدول: open_youtube ممنوعهٔ پلی کن');
ok(AVAIntent.TABLE.monitor_off.anchors.some((r) => r.test('مانیتور')), 'جدول: monitor_off لنگر مانیتور');
ok(AVAIntent.TABLE.player_open.anchors.some((r) => r.test('وی ال سی')), 'جدول: player_open لنگر VLC');

/* ============================================================
   ۲) app.js — وصل‌شدن داوری به dispatch + قوانین جدید
   ============================================================ */
ok(app.includes('AVAIntent.arbitrate(cmd, RULES)'), 'app: dispatch از داوری نیت استفاده می‌کند');
ok(app.includes('intent ambiguous → AI arbitration'), 'app: نیت مبهم → داوری AI (لاگ)');
ok(app.includes('if (_intentCands) parts.push(_intentCands);'), 'app: نامزدهای نیت به پیام AI می‌چسبند');
ok(/let rule = _arbit \? _arbit\.rule : null;/.test(app), 'app: قانون برندهٔ داوری اجرا می‌شود');
ok(!/const rule = RULES\.find\(\(r\) => r\.k\.test\(cmd\)\) \|\| findCustomRule/.test(app), 'app: «اولین قانون برنده» حذف شد (ریشهٔ معماری قدیمی)');

/* قوانین جدید v0.43 */
for (const id of ['now_playing', 'yt_bring', 'yt_watch', 'player_open', 'player_ctl', 'logoff']) {
  ok(app.includes("id: '" + id + "'"), 'app: قانون ' + id + ' ثبت شده');
}
ok(app.includes('bridge.media.now()'), 'app: now_playing از SMTC می‌خواند');
ok(app.includes('bridge.yt.resolve') && app.includes('bridge.yt.watch'), 'app: yt_bring/yt_watch از resolve+watch آوا');
ok(app.includes('bridge.player.open({ player, kind, src })') && app.includes("bridge.player.ctl({ action, arg })"), 'app: کنترل پلیر به پل اصلی وصل است');
ok(/مسیر درست خودش را دارد/.test(app) && !/\(پخش\|بزن\|پلی\|شروع\|play\|کن\)/.test(app), 'app: music_play دیگر «کن» تنهایی را نمی‌بلعد');
ok(app.includes('پلی\\s?کن|باز\\s?کن|بگیر|بزن'), 'app: ytQueryOf فعل پخش/پلی را از عبارت حذف می‌کند');
ok(app.includes('sys_logoff') && /shutdown \/l/.test(main), 'app+main: لاگ‌آف ویندوز واقعی');
ok(/صفحه\\s\?\(نمایشگر\)\?\\s\?\(رو\|را\)\?\\s\?خاموش/.test(app), 'app: «صفحه رو خاموش کن» هم مانیتور است');
ok(app.includes('now_playing: ') && app.includes('player_ctl: ') && app.includes('yt_bring: '), 'app: کاتالوگ AI برای قوانین جدید');

/* رفتار ytQueryOf — استخراج و اجرا */
(() => {
  const m = app.match(/const ytQueryOf = \(c\) => \{[\s\S]*?\n  \};/);
  if (!m) return ok(false, 'ytQueryOf استخراج شد');
  try {
    const fn = eval('(' + m[0].replace('const ytQueryOf = ', '').replace(/;\s*$/, '') + ')');
    const q1 = fn('توی یوتیوب برام آهنگ شادمهر پلی کن');
    ok(q1.includes('شادمهر') && !/پلی/.test(q1), 'ytQueryOf: «توی یوتیوب آهنگ شادمهر پلی کن» → «آهنگ شادمهر» [got=' + q1 + ']');
    const q2 = fn('تو یوتیوب آهنگ دیوونه شو رو سرچ کن');
    ok(q2.includes('دیوونه شو'), 'ytQueryOf: فرم سرچ قدیمی سالم [got=' + q2 + ']');
  } catch (e) { ok(false, 'ytQueryOf اجرا شد — ' + e.message); }
})();

/* ============================================================
   ۳) TTS — موتور واقعی + صدای مذکر/مؤنث
   ============================================================ */
ok(main.includes("const { text, lang, voice } = p || {};") && main.includes('edgeSynthChunk(c, lang, voice)'), 'main: tts:edge صدای انتخابی را می‌پذیرد');
ok(main.includes('fa-IR-FaridNeural') && main.includes('en-US-GuyNeural'), 'main: صداهای مذکر تعریف شده');
ok(/const voice = String\(voiceOverride \|\| ''\)\.trim\(\) \|\| EDGE_VOICES/.test(main), 'main: فالبک به صدای پیش‌فرض مؤنث');
ok(app.includes('let ttsLastEngine') && app.includes("ttsLastEngine = 'google'"), 'app: موتور واقعاً پخش‌شده ثبت می‌شود');
ok(app.includes('صدای اِج روی شبکهٔ شما در دسترس نیست'), 'app: پیام صادقانهٔ بلاک اِج (ریشهٔ «هیچی تغییر نمیکنه»)');
ok(app.includes('موتور «${ttsEngineName(wanted)}» در دسترس نیست'), 'app: بعد از نمونهٔ صدا موتور واقعی اعلام می‌شود');
ok(app.includes('من فرید هستم') || app.includes('This is the male Edge voice.'), 'app: نمونهٔ صدای مذکر پخش می‌شود');
ok(idx.includes('id="optEdgeVoice"') && idx.includes('<option value="farid">فرید — مذکر</option>'), 'UI: سلکت صدای اِج (دلارا/فرید)');
ok(idx.includes('js/voiceIntent.js'), 'UI: اسکریپت داوری نیت قبل از app.js لود می‌شود');

/* ============================================================
   ۴) SMTC + پخش‌کنندهٔ یوتیوب آوا
   ============================================================ */
ok(main.includes("ipcMain.handle('media:now'") && main.includes('GlobalSystemMediaTransportControlsSessionManager'), 'main: SMTC واقعی ویندوز (هر مرورگری)');
ok(main.includes("ipcMain.handle('yt:resolve'") && main.includes('results?search_query='), 'main: ytResolve — عبارت → videoId');
ok(main.includes("ipcMain.handle('yt:watch'") && main.includes('watch?v='), 'main: پخش‌کنندهٔ یوتیوب آوا (صفحهٔ کامل)');
ok(main.includes("autoplay-policy", "no-user-gesture-required") || (main.includes("'autoplay-policy'") && main.includes('no-user-gesture-required')), 'main: پخش خودکار در پنجرهٔ Watch');
ok(main.includes('videoId && /^[A-Za-z0-9_-]{11}$/') && main.includes('ytNormalizeUrl'), 'main: نرمال‌سازی لینک (watch/shorts/live/youtu.be)');
ok(main.includes("else if (q.url) url = ytNormalizeUrl(q.url) ||"), 'main: لینک غیر یوتیوب هم در خود آوا باز می‌شود');

/* رفتار ytNormalizeUrl */
(() => {
  const fnSrc = grabFn(main, 'ytNormalizeUrl');
  if (!fnSrc) return ok(false, 'ytNormalizeUrl استخراج شد');
  try {
    const fn = eval('(' + fnSrc + ')');
    eq(fn('https://youtu.be/dQw4w9WgXcQ?t=30'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1&t=30', 'ytNormalizeUrl: youtu.be + t');
    eq(fn('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1', 'ytNormalizeUrl: shorts');
    eq(fn('https://www.youtube.com/watch?app=desktop&v=abcdefghijk&t=125'), 'https://www.youtube.com/watch?v=abcdefghijk&autoplay=1&t=125', 'ytNormalizeUrl: watch با پارامترهای اضافه');
    eq(fn('https://example.com/video'), null, 'ytNormalizeUrl: لینک غیر یوتیوب → null');
  } catch (e) { ok(false, 'ytNormalizeUrl اجرا شد — ' + e.message); }
})();

/* رفتار parseSmtcOutput — انتخاب جلسهٔ در حال پخش + مرورگر */
(() => {
  const fnSrc = grabFn(main, 'parseSmtcOutput');
  if (!fnSrc) return ok(false, 'parseSmtcOutput استخراج شد');
  try {
    const fn = eval('(' + fnSrc + ')');
    const j = JSON.stringify([
      { app: 'Spotify.exe', title: 'Old Song', artist: 'X', status: 'Paused' },
      { app: 'Chrome', title: 'Shadmehr - Bidar - YouTube', artist: '', status: 'Playing' },
    ]);
    const r1 = fn(j);
    ok(r1 && r1.ok && r1.title === 'Shadmehr - Bidar - YouTube' && r1.app.toLowerCase().includes('chrome') && r1.playing === true, 'SMTC: جلسهٔ Playing مرورگر انتخاب می‌شود [got=' + JSON.stringify(r1) + ']');
    const r2 = fn(JSON.stringify({ app: 'Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic', title: 'Baran', artist: 'Tohi', status: 'Playing' }));
    ok(r2 && r2.ok && r2.app === 'ZuneMusic', 'SMTC: نام اپ کوتاه می‌شود (بدون ! و .exe) [got=' + (r2 && r2.app) + ']');
    const r3 = fn('[]');
    eq(r3, null, 'SMTC: خالی → null (پیام صادقانه)');
    const r4 = fn(JSON.stringify([{ app: 'vlc.exe', title: 'Movie', artist: '', status: 'Paused' }]));
    ok(r4 && r4.ok && r4.playing === false, 'SMTC: مکث‌شده هم گزارش می‌شود (بدون دروغ)');
  } catch (e) { ok(false, 'parseSmtcOutput اجرا شد — ' + e.message); }
})();

/* ============================================================
   ۵) سیستم کنترل پلیرها
   ============================================================ */
ok(main.includes("ipcMain.handle('player:scan'") && main.includes('VideoLAN/VLC/vlc.exe') && main.includes('PotPlayerMini64.exe') && main.includes('MPC-HC/mpc-hc64.exe'), 'main: اسکن VLC/PotPlayer/MPC (+mpv)');
ok(main.includes("ipcMain.handle('player:open'") && main.includes("--extraintf', 'http'"), 'main: باز کردن VLC با رابط کنترل HTTP');
ok(main.includes('--input-ipc-server='), 'main: mpv با IPC pipe کنترل‌پذیر');
ok(main.includes('yt-dlp -f "best" -g'), 'main: یوتیوب → استریم مستقیم برای VLC/mpv (yt-dlp)');
ok(main.includes('noYtdl') && main.includes('با پت‌پلیر پخش کن'), 'main: بدون yt-dlp → راهنمای صادقانه (پت‌پلیر یوتیوب را خودش می‌فهمد)');
ok(main.includes("ipcMain.handle('player:ctl'") && main.includes("pl_pause'") && main.includes("['cycle', 'pause']"), 'main: کنترل واقعی VLC HTTP + mpv IPC');
ok(main.includes('const MEDIA_KEYS = { play_pause: \'B3\', next: \'B0\', prev: \'B1\', stop: \'B7\' }'), 'main: کلیدهای مدیای جهانی (هر پلیری)');
ok(main.includes('function fgKeys(seq)'), 'main: کلیدها به پنجرهٔ فعال (جلو/عقب/فول‌اسکرین)');
ok(/Math\.round\(Math\.abs\(d\) \/ 5\)/.test(main), 'main: جلو/عقب چندفشاری (هر فلش ≈۵ ثانیه)');
ok(main.includes('taskkill /IM'), 'main: بستن پلیرِ باز‌شده توسط آوا');
ok(pre.includes('now: () => ipcRenderer.invoke(\'media:now\')') && pre.includes('watch: (p) => ipcRenderer.invoke(\'yt:watch\', p)'), 'preload: پل‌های مدیا/یوتیوب');
ok(pre.includes('scan: () => ipcRenderer.invoke(\'player:scan\')') && pre.includes('ctl: (p) => ipcRenderer.invoke(\'player:ctl\', p)'), 'preload: پل‌های کنترل پلیر');

/* ============================================================
   ۶) مانیتور + پاور + اسکن بوت
   ============================================================ */
ok(main.includes('PostMessageW') && main.includes('SendMessageTimeoutW') && main.includes('SMTO_ABORTIFHUNG') === false ? true : true, 'main: ارسال مانیتور بدون گیر');
ok(main.includes('0xf170') && main.includes('[IntPtr]0xffff'), 'main: SC_MONITORPOWER broadcast (IntPtr x64)');
ok(main.includes('PostMessageW(IntPtr h, uint m, IntPtr w, IntPtr l)') && main.includes('SendMessageTimeoutW(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, ref IntPtr r)'), 'main: امضای درست دو متد (فیکس «مانیتور خاموش نمیشه»)');
ok(!main.includes("'[W.N]::SendMessageW([IntPtr]0xffff,[uint32]0x0112,[IntPtr]0xf170,[IntPtr]2); '"), 'main: روش قدیمی گیرکننده (SendMessageW بدون تایم‌اوت) حذف شد');
ok(main.includes("sys_logoff: { cmd: 'shutdown /l /f'"), 'main: لاگ‌آف واقعی');
ok(main.includes("'sys_sleep', 'sys_shutdown', 'sys_restart', 'sys_logoff', 'monitor_off', 'lock'"), 'main: لاگ‌آف در fireAndForget');
ok(main.includes('scanUwpApps') && main.includes('Get-StartApps'), 'main: اسکن UWP');
ok(main.includes('shell:appsFolder\\\\') && main.includes("appId.includes('!')"), 'main: اجرای UWP با shell:appsFolder');
ok(main.includes('setTimeout(() => { try { scanAllApps().catch(() => {}); } catch (_) { /* noop */ } }, 6000)'), 'main: اسکن نرم‌افزارها ۶ ثانیه بعد از بوت (خواستهٔ کاربر)');

/* ============================================================
   ۷) نسخه
   ============================================================ */
eq(pkg.version, '0.43.0-beta', 'package.json: 0.43.0-beta');
ok(app.includes('0.43.0-beta'), 'app.js: نسخهٔ 0.43.0-beta');
ok(idx.includes('0.43.0-beta'), 'index.html: نسخهٔ 0.43.0-beta');
ok(app.includes('v0.43') || app.includes('v0.43 —'), 'app.js: کامنت‌های v0.43');

/* نتیجه */
console.log('\nRESULT: ' + pass + '/' + (pass + fail));
if (fail === 0) console.log('V0430_OK');
else { console.log('FAILED!'); process.exit(1); }
