#!/usr/bin/env node
/* scripts-test-v0610b.js — v0.61 — پلیرهای سیستم v2 + برچیدن پلیر خودساختهٔ آوا
   ------------------------------------------------------------
   خواستهٔ صریح کاربر:
   «معروف‌ترین پلیرهای ویدیوی جهان رو کامل در بیار و کنترل صوتیشون رو
    داشته باشیم: KMPlayer / PotPlayer / VLC / ویدیو پلیر خود ویندوز.
    ویدیو پلیر خود آوا که ساختی حذف بشه؛ به‌جاش آوا ببینه ویدیو پلیر
    پیش‌فرض کاربر چیه، با همون ویدیو/یوتیوب رو پلی کنه.»

   چک‌ها:
   [1] KMPlayer در PLAYER_DEFS + الگوهای صوتی کی‌ام‌پلیر در player_open
   [2] playerProgIdToId — نگاشت ProgId رجیستری → پلیر (آزمون زنده)
   [3] playerOpenDecision — تصمیم واحد «چه چیزی با چه پلیری» (آزمون زنده)
   [4] player:default + player:open v2 + openWithDefaultPlayer در main.js
   [5] yt_play → youtube_play → پلیر پیش‌فرض (نه پنجرهٔ آوا)؛ player_ctl
       «ویدیو رو پلی کن» را می‌گیرد (ریشهٔ ۶ثانیه معطلی لاگ v0.48)
   [6] برچیدن کامل PiP: فایل‌ها حذف، main/preload/app پاک، build.files تمیز
   [7] ytWin حذف: yt:watch/yt:status/yt:close نیست؛ yt:resolve می‌ماند
   [8] DO_ACTS: video_play/video_ctl + هستهٔ فهم سیم‌کشی شده
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
const preSrc = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const idxSrc = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');

/* ============ [1] KMPlayer ============ */
section('[1] KMPlayer — شناسایی + الگوهای صوتی');
ok(/id:\s*'kmplayer'/.test(mainSrc) && /KMPlayer64\.exe/.test(mainSrc), 'PLAYER_DEFS شامل کی‌ام‌پلیر (مسیرهای ۶۴/۳۲بیتی)');
ok(/کی\s?ام\s?پلیر|kmplayer/i.test(appSrc), 'app.js: الگوی صوتی «کی‌ام‌پلیر» در player_open');

/* ============ [2] نگاشت ProgId (زنده) ============ */
section('[2] playerProgIdToId — ProgId رجیستری → شناسهٔ پلیر');
{
  const m = /function playerProgIdToId\(progId\)\s*\{[\s\S]*?\n\}/.exec(mainSrc);
  ok(!!m, 'تابع خالص در main.js استخراج‌پذیر است');
  /* eslint-disable no-eval */
  const fn = eval('(' + m[0] + ')');
  ok(fn('VLC.vlc') === 'vlc', 'VLC.vlc → vlc');
  ok(fn('PotPlayer64.HTML........') === 'potplayer' || fn('PotPlayer64.MP4') === 'potplayer', 'PotPlayer64.* → potplayer');
  ok(fn('KMPlayer.mp4') === 'kmplayer', 'KMPlayer.* → kmplayer');
  ok(fn('MPC.MP4') === 'mpc', 'MPC.* → mpc');
  ok(fn('WMP11.AssocFile.MP4') === 'wmplayer', 'WMP11.* → wmplayer');
  ok(fn('mpv.mp4') === 'mpv', 'mpv → mpv');
  ok(fn('AppXk0g4vb8g32t4...') === 'uwp', 'AppX* (Media Player/Films&TV مایکروسافت) → uwp');
  ok(fn('') === '' && fn('Some.Random.Prog') === '', 'ProgId ناشناخته → "" (فالبک به اسکن)');
}

/* ============ [3] تصمیم واحد (زنده) ============ */
section('[3] playerOpenDecision — تصمیم واحد برای همهٔ حالت‌ها');
{
  const m = /function playerOpenDecision\(kind, src, wanted, scan, def\)\s*\{[\s\S]*?\n\}/.exec(mainSrc);
  ok(!!m, 'تابع تصمیم در main.js استخراج‌پذیر است');
  const fn = eval('(' + m[0] + ')');
  const scan = { list: [{ id: 'vlc' }, { id: 'potplayer' }, { id: 'kmplayer' }, { id: 'mpv' }, { id: 'mpc' }, { id: 'wmplayer' }], ytdl: true };
  /* v0.62 — یوتیوب یک لاین شد: لینک خام به هیچ پلیری نمی‌رود (دیوار ربات/ورود) —
     جزئیات نردبان جدید در scripts-test-v0620a.js */
  /* v0.83 — ری‌ورک: مسیر «پیش‌فرض» یوتیوب = پلیر آوا (embed رسمی — پخش تضمینی)؛
     پلیرِ صریحِ نام‌برده همان مسیر yt-dlp خودش را می‌رود (پین‌های پایین) */
  ok(fn('url', 'https://www.youtube.com/watch?v=x', 'default', scan, { id: 'potplayer' }).action === 'ava-player' && fn('url', 'https://www.youtube.com/watch?v=x', 'default', scan, { id: 'potplayer' }).player === 'ava', 'پیش‌فرض پت‌پلیر + یوتیوب → ava-player (v0.83: مسیر پیش‌فرض = پلیر آوا؛ پت‌پلیر صریح همچنان yt-dlp)');
  ok(fn('url', 'https://www.youtube.com/watch?v=x', 'default', scan, { id: 'kmplayer' }).action === 'ava-player', 'پیش‌فرض کی‌ام‌پلیر + یوتیوب → ava-player (v0.83)');
  ok(fn('url', 'https://www.youtube.com/watch?v=x', 'default', scan, { id: 'vlc' }).action === 'ava-player', 'پیش‌فرض VLC + یوتیوب + yt-dlp → ava-player (v0.83: پیش‌فرض = پلیر آوا)');
  ok(fn('url', 'https://www.youtube.com/watch?v=x', 'default', { list: scan.list, ytdl: false }, { id: 'vlc' }).action === 'ava-player', 'بدون yt-dlp هم پیش‌فرض → ava-player (v0.83: پلیر آوا اصلاً yt-dlp نمی‌خواهد)');
  ok(fn('url', 'https://www.youtube.com/watch?v=x', 'default', scan, { id: 'uwp' }).action === 'ava-player', 'پیش‌فرض Media Player ویندوز (UWP) + یوتیوب → ava-player (v0.83: قبلاً مرورگر)');
  ok(fn('file', 'C:\\v\\a.mp4', 'default', scan, { id: 'uwp' }).action === 'os-default', 'فایل محلی + پیش‌فرض UWP → os-default (خود ویندوز با همان پلیر باز می‌کند)');
  ok(fn('url', 'https://youtu.be/x', 'vlc', scan, null).action === 'spawn-ytdlp', 'پلیر صریح («با وی‌ال‌سی») مسیر خودش را می‌رود');
  ok(fn('url', 'https://www.youtube.com/watch?v=x', 'wmplayer', scan, null).action === 'spawn-ytdlp', 'پلیر صریح WMP + یوتیوب → spawn-ytdlp (v0.62: استریم مستقیم در WMP هم پخش می‌شود)');
  const noScan = { list: [], ytdl: false };
  ok(fn('url', 'https://www.youtube.com/watch?v=x', 'default', noScan, { id: '' }).action === 'ava-player', 'هیچ پلیری نصب نیست + یوتیوب → ava-player (v0.83: پلیر آوا همیشه هست — کاربر بی‌جواب نمی‌ماند)');
}

/* ============ [4] سیم‌کشی main.js ============ */
section('[4] player:default + player:open v2 + openWithDefaultPlayer');
ok(mainSrc.includes("ipcMain.handle('player:default'"), 'هندلر player:default (پلیر پیش‌فرض کاربر)');
ok(/FileExts/.test(mainSrc) && /UserChoice/.test(mainSrc), 'خواندن UserChoice رجیستری (.mp4/.mkv/.avi)');
ok(/function openWithDefaultPlayer\(url\)/.test(mainSrc), 'openWithDefaultPlayer — مسیر واحد برای sys-run و IPC');
ok(mainSrc.includes('asyncCmd') && mainSrc.includes('openWithDefaultPlayer(watch)'), 'youtube_play asyncCmd از مسیر پلیر پیش‌فرض می‌رود');
ok(/async function playerLaunch\(player, src, opts\)/.test(mainSrc), 'playerLaunch — اجرای واحد (player:open و openWithDefaultPlayer)');
ok(/shell\.openPath\(src\)/.test(mainSrc), 'فایل محلی با shell.openPath (انتخاب خود ویندوز = پلیر پیش‌فرض کاربر)');

/* ============ [5] قواعد صوتی ============ */
section('[5] yt_play → پلیر پیش‌فرض؛ player_ctl پلی/پاز ویدیو را می‌گیرد');
ok(appSrc.includes("id: 'yt_play'") && appSrc.includes("run: 'youtube_play'"), 'قانون yt_play سر جایش است (پین v0500 حفظ شد)');
ok(appSrc.includes("«${q}» را با پلیر پیش‌فرض سیستم پخش می‌کنم"), 'پاسخ yt_play: «پلیر پیش‌فرض سیستم» (دیگر «پلیر خود آوا» نیست)');
{
  /* آزمون زندهٔ الگوی player_ctl: «ویدیو رو پلی کن/پاز کن» باید بگیرد */
  const ix = appSrc.indexOf("id: 'player_ctl'");
  ok(ix > 0, 'قانون player_ctl پیدا شد');
  if (ix > 0) {
    const head = appSrc.slice(Math.max(0, ix - 1600), ix + 40);
    const km = /k:\s*\/(.*?)\/i,\s*\n\s*id: 'player_ctl'/s.exec(head);
    ok(!!km, 'الگوی k قانون player_ctl استخراج شد');
    if (km) {
      const re = new RegExp(km[1], 'i');
      ok(re.test('ویدیو رو پلی کن') && re.test('ویدیو رو پاز کن') && re.test('پلیر رو پاز کن'), '«ویدیو رو پلی/پاز کن» با الگوی واقعی می‌گیرد (ریشهٔ لاگ: ۶ ثانیه معطلی pip)');
      ok(!re.test('هوا چطوره') && !re.test('سلام خوبی'), 'جملهٔ بی‌ربط بیراه نمی‌رود');
    }
  }
}
ok(appSrc.includes("player: 'default'") && appSrc.includes('با پلیر پیش‌فرض'), 'player_open: «با پلیر پیش‌فرض پخش کن» → player:default');
ok(appSrc.includes('bridge.sys.clipboard'), 'کلیپ‌بورد از sys.clipboard (جایگزین pip:clip)');

/* ============ [6] برچیدن PiP ============ */
section('[6] پلیر خودساختهٔ آوا (PiP) کامل حذف شده');
for (const f of ['pipWindowManager.js', 'pipCore.js', 'pipPreload.js', 'renderer/pip.html', 'renderer/js/pipRenderer.js', 'scripts-pip-test.js']) {
  ok(!fs.existsSync(path.join(ROOT, f)), 'حذف شد: ' + f);
}
ok(!pkg.build.files.some((f) => /pip/i.test(f)), 'build.files دیگر هیچ فایل pip ندارد');
ok(!mainSrc.includes('pipManager') && !mainSrc.includes('pip_youtube'), 'main.js: بدون pipManager/pip_youtube');
ok(!preSrc.includes('pipAPI'), 'preload.js: بدون pipAPI');
ok(!appSrc.includes('PIP_SIZE_KEY') && !appSrc.includes('PIP_POS_FA'), 'app.js: ثابت‌های PiP حذف شدند');
ok(!appSrc.includes('pip_youtube') && !appSrc.includes('yt_watch'), 'app.js: قواعد pip_youtube/yt_watch حذف شدند');
ok(fs.existsSync(path.join(ROOT, 'renderer/js/voiceCore.js')) && idxSrc.includes('js/voiceCore.js'), 'هستهٔ فهم (voiceCore.js) در index.html سیم‌کشی شده');

/* ============ [7] ytWin حذف ============ */
section('[7] پنجرهٔ یوتیوب آوا (ytWin) حذف؛ yt:resolve می‌ماند');
ok(!mainSrc.includes('ytWin') && !mainSrc.includes("yt:watch") && !mainSrc.includes("yt:status") && !mainSrc.includes("yt:close"), 'main.js: بدون ytWin/yt:watch/yt:status/yt:close');
ok(mainSrc.includes("yt:resolve") && /function ytNormalizeUrl/.test(mainSrc), 'yt:resolve + نرمال‌سازی لینک حفظ شدند (برای پخش با پلیر پیش‌فرض)');
ok(!preSrc.includes('yt:watch') && !preSrc.includes('yt:status'), 'preload.js: بدون yt.watch/status');
ok(appSrc.includes('bridge.player.open({ player: \'default\''), 'yt_bring: پخش با پلیر پیش‌فرض (قبلاً yt.watch بود)');

/* ============ [8] هستهٔ فهم + DO acts ============ */
section('[8] DO_ACTS + هستهٔ فهم');
ok(appSrc.includes("'video_play', 'video_ctl'"), 'DO_ACTS: video_play/video_ctl (خواستهٔ کاربر: پخش با پلیر پیش‌فرض)');
ok(appSrc.includes("case 'video_play':") && appSrc.includes("case 'video_ctl':"), 'اجراکنندهٔ video_play/video_ctl در executeDoActions');
ok(appSrc.includes('video_play(value=the exact title or URL to play'), 'پرامپت AI: video_play با توضیح «پلیر پیش‌فرض کاربر»');
ok(appSrc.includes('async function aiBrainCtx') && /turnsCtx\(6|10\)/.test(appSrc), 'aiBrainCtx: تاریخچهٔ گفتگو واقعاً به AI می‌چسبد (ریشهٔ «همون مدل که گفتیم»)');
ok(appSrc.includes('lane=brain (direct-AI'), 'لَین مغز در هندلر فرمان سیم‌کشی شده');
ok(appSrc.includes('ctx-resolve:'), 'حل‌گر ارجاع در هندلر فرمان لاگ می‌شود');
ok(appSrc.includes('AVACore.recordTurn'), 'حافظهٔ گفتگو بعد از اجرا تغذیه می‌شود');

console.log('\n-----------------------------');
console.log(`RESULT: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
