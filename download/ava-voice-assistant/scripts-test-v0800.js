#!/usr/bin/env node
/* v0.80.0-beta — تطبیق معماری «Tool Executor» مرجع (پرامپت کنترل یوتیوب با
   Gemini Function Calling) روی ساختار خود آوا:
   - window_manager: PIP / شفافیت / مانیتور / چیدمان / سایز پریست / maz-min-restore / شات
   - multi_instance_manager: فهرست پلیرها، پنجرهٔ فعال، سوییچ، close:other، بستن با PID
   - state_manager: activePid / videoPipPrev / last_search_results
   - search_only + select_from_results: سرچ لیستی یوتیوب + «دومی رو پخش کن»
   - get_current_status / take_screenshot / set_playback_speed / set_video_quality
   - شفاف‌سازی ابهام (needs_clarification) به سبک صوتی آوا */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
function section(t) { console.log('— ' + t); }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

const VI = require('./renderer/js/voiceIntent.js');
const VB = require('./renderer/js/voiceBrain.js');
const CAP = require('./renderer/js/capabilities.js');
const appSrc = read('renderer/js/app.js');
const mainSrc = read('main.js');
const preSrc = read('preload.js');
const docsSrc = read('docs/COMMANDS-FA.md');

console.log('==== v0.80.0-beta: Tool Executor — پنجره/چند-ویدیو/سرچ لیستی/سرعت/کیفیت ====');

/* ---------- ۱) voiceIntent — گرامر رفتاری کامل ---------- */
section('videoCtlOf — گرامر خانواده‌های جدید (رفتاری)');
const CASES = [
  ['تصویر در تصویر کن', 'pip'], ['پیپ رو بردار', 'unpip'], ['ویدیو رو پیپ کن', 'pip'],
  ['ویدیو رو شفاف کن', 'opacity'], ['شفافیت 30 کن', 'opacity'],
  ['بروش مانیتور 2', 'monitor'], ['ببرش مانیتور دوم', 'monitor'], ['ببرش مانیتور سه', 'monitor'],
  ['کنار هم بچینشون', 'arrange'], ['شطرنجی بچین', 'arrange'], ['کاسکید بچین', 'arrange'],
  ['چند تا ویدیو بازه', 'players'], ['چی بازه', 'players'], ['لیست ویدیوهای باز', 'players'],
  ['برو سراغ اون یکی ویدیو', 'switch'], ['سوییچ کن', 'switch'],
  ['سرعتش کن 2 برابر', 'speed'], ['سرعت دو برابر', 'speed'], ['سرعت عادی', 'speed'],
  ['سریعترش کن', 'speed'], ['آهسته تر کن', 'speed'], ['سرعتش رو کم کن', 'speed'],
  ['کیفیتش کن 360', 'quality'], ['کیفیت 720', 'quality'], ['بهترین کیفیت', 'quality'],
  ['سایز کوچیک کن', 'resize'], ['اندازه ش متوسط کن', 'resize'], ['سایزش کن بزرگ', 'resize'],
  ['ویدیو رو مینیمایز کن', 'minimize'], ['ماکزیمایز کن', 'maximize'], ['پنجره رو برگردون', 'restore'],
  ['وضعیت ویدیو چیه', 'status'], ['از ویدیو عکس بگیر', 'shot'],
  ['اون یکی رو ببند', 'close'], ['ویدیو قبلی رو ببند', 'close'], ['همه رو ببند', 'close'],
  ['بزرگترش کن', 'grow'], ['کوچیکترش کن', 'shrink'], ['برو جلو 30 ثانیه', 'seek'],
  ['فول اسکرین کن', 'fullscreen'], ['ویدیو رو ببر بالا سمت راست', 'move'], ['پینش کن', 'pin'],
  ['سرعت اینترنت رو ببین', null], ['یوتیوب رو سرچ کن', null], ['کیفیت صدا رو ببر بالا', null],
];
let fCnt = 0;
for (const [c, exp] of CASES) {
  const r = VI.videoCtlOf(c);
  const act = r ? r.action : null;
  const good = act === exp || (exp === 'close' && act === 'close') || (exp === 'speed' && act === 'speed');
  if (!good) { fCnt++; console.log('    ✗ «' + c + '» → ' + JSON.stringify(r) + ' (expected ' + exp + ')'); }
}
ok(fCnt === 0, 'همهٔ ' + CASES.length + ' جملهٔ گرامر رفتاری درست');

section('videoCtlOf — آرگومان‌ها');
ok(VI.videoCtlOf('اون یکی رو ببند').arg === 'other', 'بستن «اون یکی» → arg=other');
ok(VI.videoCtlOf('ویدیو قبلی رو ببند').arg === 'oldest', 'بستن «قبلی» → arg=oldest (پین v0.78 حفظ)');
ok(VI.videoCtlOf('همه رو ببند').arg === 'all', 'بستن «همه» → arg=all (پین v0.78 حفظ)');
ok(VI.videoCtlOf('شفافیت 30 کن').arg === 30, 'شفافیت ۳۰ → arg=30');
ok(VI.videoCtlOf('ویدیو رو شفاف کن').arg === 50, 'شفافیتِ بی‌عدد → پیش‌فرض ۵۰');
ok(VI.videoCtlOf('ببرش مانیتور دوم').arg === 2, '«مانیتور دوم» → arg=2');
ok(VI.videoCtlOf('سرعت دو برابر').arg === 2, '«دو برابر» (عدد حرفی) → arg=2');
ok(VI.videoCtlOf('سرعتش کن 1.5 برابر').arg === 1.5, '«۱.۵ برابر» → arg=1.5');
ok(VI.videoCtlOf('شطرنجی بچین').arg === 'grid', 'شطرنجی → grid');
ok(VI.videoCtlOf('کاسکید بچین').arg === 'cascade', 'کاسکید → cascade');
ok(VI.videoCtlOf('کنار هم بچینشون').arg === 'side', 'کنار هم → side');
ok(VI.videoCtlOf('کیفیتش کن 360').arg === '360', 'کیفیت ۳۶۰ → 360');
ok(VI.videoCtlOf('کیفیتش کن 1080').arg === 'best', 'کیفیت ۱۰۸۰ → best');

/* ---------- ۲) app.js — videoCtlParse (توکن‌های مغز) ---------- */
section('videoCtlParse — توکن‌های جدید کاتالوگ مغز (eval از سورس)');
const vpStart = appSrc.indexOf('function videoCtlParse(value) {');
const vpEnd = appSrc.indexOf('/* v0.66 — هلپر مشترک پخش ویدیو');
ok(vpStart >= 0 && vpEnd > vpStart, 'سورس videoCtlParse پیدا شد');
let videoCtlParse = null;
if (vpStart >= 0 && vpEnd > vpStart) {
  try {
    const vpSrc = appSrc.slice(vpStart, vpEnd);
    videoCtlParse = new Function('AVAIntent', vpSrc + '; return videoCtlParse;')(VI);
  } catch (e) { ok(false, 'eval videoCtlParse شکست: ' + e.message); }
}
if (videoCtlParse) {
  const P = (v) => videoCtlParse(v) || {};
  ok(P('pip').action === 'pip' && P('unpip').action === 'unpip', 'توکن pip/unpip');
  ok(P('close:other').action === 'close' && P('close:other').arg === 'other', 'توکن close:other');
  ok(P('close:oldest').arg === 'oldest' && P('close:newest').arg === 'newest' && P('close:all').arg === 'all', 'توکن‌های بستن هدفمند حفظ (پین v0.78)');
  ok(P('resize:small').arg === 'small' && P('resize:large').arg === 'large', 'توکن resize پریست');
  ok(P('resize:640x360').arg && P('resize:640x360').arg.w === 640 && P('resize:640x360').arg.h === 360, 'توکن resize سفارشی WxH');
  ok(P('opacity:30').arg === 30, 'توکن opacity:N');
  ok(P('monitor:2').arg === 2, 'توکن monitor:N');
  ok(P('arrange:grid').arg === 'grid' && P('arrange:cascade').arg === 'cascade' && P('arrange:side').arg === 'side', 'توکن arrange:mode');
  ok(P('switch:other').arg === 'other' && P('switch:oldest').arg === 'oldest', 'توکن switch');
  ok(P('speed:1.5').arg === 1.5 && P('speed:up').arg === 'up' && P('speed:reset').arg === 'reset', 'توکن speed');
  ok(P('quality:720').arg === '720' && P('quality:best').arg === 'best', 'توکن quality');
  ok(P('players').action === 'players' && P('status').action === 'status' && P('shot').action === 'shot', 'توکن players/status/shot');
  ok(P('maximize').action === 'maximize' && P('minimize').action === 'minimize' && P('restore').action === 'restore', 'توکن maz/min/restore');
  ok(P('تصویر در تصویر کن').action === 'pip', 'جملهٔ فارسی از videoCtlOf (پشتیبان مغز)');
  ok(P('سرعتش کن دو برابر').action === 'speed', 'سرعت فارسی از videoCtlOf');
} else {
  ok(false, 'videoCtlParse زنده نشد');
}

/* ---------- ۳) app.js — لاین‌های سرچ لیستی + همزمان‌پخشی ---------- */
section('لاین‌های renderer — yt_list / yt_pick / keepExisting');
ok(appSrc.includes("id: 'yt_list'"), 'لاین سرچ لیستی یوتیوب (search_only)');
ok(appSrc.includes("id: 'yt_pick'"), 'لاین پخش از نتایج (select_from_results)');
ok(appSrc.includes('_lastYtResults = res.items;'), 'ذخیرهٔ نتایج سرچ (last_search_results)');
ok(appSrc.includes('Date.now() - _lastYtAt > 10 * 60 * 1000'), 'اعتبار ۱۰ دقیقه‌ای نتایج');
ok(appSrc.indexOf("id: 'yt_list'") < appSrc.indexOf("id: 'player_ctl'"), 'yt_list قبل از player_ctl (اولویت مچ)');
ok(appSrc.includes('const _keepP = /کنارش|کنارشون|همزمان|با\\s?هم|کنار\\s?هم/i.test(String(origCmd || \'\'));'), 'مسیر مغز video_play: keepExisting از جمله');
ok(appSrc.includes('async function videoPlayReply(vq, playerWanted, origCmdForLog, keepExisting)'), 'videoPlayReply پارامتر keepExisting دارد');
ok(appSrc.includes('keepExisting: !!keepExisting'), 'keepExisting به player:open پاس داده می‌شود');
ok(appSrc.includes('keepExisting: _keep'), 'player_open: keepExisting از جمله (کنارش پخش کن)');
ok(appSrc.includes('شفاف|مانیتور|چیدمان|بچین|سرعت|سایز|اندازه|مینیمایز'), 'کاتالوگ player_ctl: کلیدواژه‌های PIP/شفاف/مانیتور/چیدمان/سرعت');
ok(appSrc.includes("ویدیو رو تصویر در تصویر کن") || appSrc.includes('تصویر در تصویر کن'), 'CMD_PAGE_DECK: مثال PIP');
ok(appSrc.includes('دومی رو پخش کن'), 'CMD_PAGE_DECK: مثال «دومی رو پخش کن»');

/* ---------- ۴) main.js — window_manager + multi_instance_manager ---------- */
section('main.js — videoWinOps / videoWinList / arrange / shot');
ok(/const VWIN_CFG = \{[\s\S]{0,200}small: \[480, 270\], medium: \[854, 480\], large: \[1280, 720\]/.test(mainSrc), 'VWIN_CFG — پریست‌های WINDOW_SIZES معماری مرجع');
ok(/pip: \[320, 180\], pipMargin: 15, cascade: \[30, 30\]/.test(mainSrc), 'VWIN_CFG — PIP_SIZE/PIP_MARGIN/CASCADE_OFFSET');
ok(/function videoWinOps\(op, arg, opts\)/.test(mainSrc), 'videoWinOps تعریف شده');
ok(/function videoWinList\(\)/.test(mainSrc), 'videoWinList تعریف شده (list_open_players)');
ok(/function videoWinArrange\(mode\)/.test(mainSrc), 'videoWinArrange تعریف شده (arrange_windows)');
ok(/function closeVideoByPid\(pid\)/.test(mainSrc), 'closeVideoByPid تعریف شده (close_window specific)');
ok(/async function closeVideoOther\(\)/.test(mainSrc), 'closeVideoOther تعریف شده (needs_clarification)');
ok(/async function videoSwitchTarget\(which\)/.test(mainSrc), 'videoSwitchTarget تعریف شده (switch_active_window)');
ok(/SetLayeredWindowAttributes/.test(mainSrc) && /0x80000/.test(mainSrc), 'شفافیت: WS_EX_LAYERED + SetLayeredWindowAttributes');
ok(/Screen\]::AllScreens/.test(mainSrc) && /NOMON/.test(mainSrc), 'مانیتور: AllScreens + رنج‌چک NOMON (move_to_monitor)');
ok(/PrintWindow/.test(mainSrc) && /SHOT /.test(mainSrc), 'اسکرین‌شات: PrintWindow → SHOT مسیر (take_screenshot)');
ok(/PIPPREV\|/.test(mainSrc), 'PIP: اندازهٔ قبل ذخیره می‌شود (خروج درست از PIP — state_manager)');
ok(/let videoPipPrev = null/.test(mainSrc), 'state: videoPipPrev');
ok(/OK arr /.test(mainSrc), 'چیدمان: خروجی OK arr');
ok(mainSrc.includes("kind === 'unpip'") && mainSrc.includes('videoPipPrev = null;'), 'unpip: پاکسازی state');
ok(/MyPictures/.test(mainSrc), 'مسیر ذخیرهٔ عکس: Pictures\\Ava');

section('main.js — player:ctl شاخه‌های جدید');
ok(/a === 'resize' \|\| a === 'maximize' \|\| a === 'minimize' \|\| a === 'restore' \|\| a === 'pip' \|\| a === 'unpip' \|\| a === 'opacity' \|\| a === 'monitor' \|\| a === 'arrange' \|\| a === 'shot'/.test(mainSrc), 'شاخهٔ عملیات پنجره');
ok(/if \(a === 'players'\)/.test(mainSrc) && /wins: l\.wins/.test(mainSrc), 'شاخهٔ players (فهرست با wins)');
ok(/if \(a === 'status'\)/.test(mainSrc) && /smtcNowPlaying\(\)/.test(mainSrc), 'شاخهٔ status: SMTC + پنجره‌ها (get_current_status)');
ok(/if \(a === 'switch'\)/.test(mainSrc) && /videoSwitchTarget\(/.test(mainSrc), 'شاخهٔ switch (switch_active_window)');
ok(/if \(a === 'speed'\)/.test(mainSrc) && /rate&val=/.test(mainSrc) && /'set', 'speed', sp\]/.test(mainSrc), 'شاخهٔ speed: VLC rate + mpv set-speed (set_playback_speed)');
ok(/Math\.max\(0\.25, Math\.min\(3,/.test(mainSrc), 'speed: گیرهٔ 0.25..3.0 (پرامپت مرجع)');
ok(/if \(a === 'quality'\)/.test(mainSrc) && /ytDlpQualityCmd\(bin, yurl, q\)/.test(mainSrc), 'شاخهٔ quality: استریم تازهٔ yt-dlp (set_video_quality)');
ok(/const F = \{ '360': '18\/b\[ext=mp4\]\/b\[ext=webm\]\/b'/.test(mainSrc), 'ytDlpQualityCmd: نردبان گسترده (v0.82)');
ok(mainSrc.includes("if (tgt === 'other')") && mainSrc.includes('closeVideoOther()'), 'close:other در player:ctl');
ok(/ambiguous: true, wins: or\.wins/.test(mainSrc), 'سه+ ویدیو → شفاف‌سازی با لیست (needs_clarification)');

section('main.js — پنجرهٔ فعال + کلیدها + keepExisting');
ok(/activePid: 0, activeProc: '', speed: 1/.test(mainSrc), 'playerCtl: فیلدهای پنجرهٔ فعال (state_manager)');
ok(/function focusPlayerWindow\(pidHint\)/.test(mainSrc) && /Get-Process -Id \+ pidN \+/.test(mainSrc.replace(/\s+/g, ' ')) === false ? /function focusPlayerWindow\(pidHint\)/.test(mainSrc) : true, 'focusPlayerWindow: پارامتر pidHint');
ok(/Get-Process -Id " \+ pidN/.test(mainSrc), 'focusPlayerWindow: انتخاب با PID پنجرهٔ فعال');
ok(/if \(a === 'play_pause' && !playerCtl\.player\)/.test(mainSrc) && /fgKeys\(\['0x20'\]\)/.test(mainSrc), 'چند-ویدیو: play_pause فقط پنجرهٔ فعال (Space بعد از فوکوس)');
ok(/if \(a === 'seek' && !playerCtl\.player\)/.test(mainSrc), 'چند-ویدیو: seek هدفمند');
ok(/playerCtl\.activePid = \(ch && ch\.pid\) \|\| 0/.test(mainSrc), 'پنجرهٔ فعال بعد از هر اجرای پلیر ثبت می‌شود');
ok(/playerLaunchYt\(player, src, !!q\.keepExisting\)/.test(mainSrc), 'player:open → playerLaunchYt: keepExisting');
ok(/playerLaunch\(player, src, \{ keepExisting: !!q\.keepExisting \}\)/.test(mainSrc), 'player:open → playerLaunch: keepExisting');
ok(/if \(!keep\) \{ try \{ const cr = await closeAllVideoPlayers\(\)/.test(mainSrc), 'فالبک مرورگر با keepExisting چیزی نمی‌بندد');

section('main.js — سرچ لیستی یوتیوب');
ok(/async function ytSearchMany\(query, n\)/.test(mainSrc), 'ytSearchMany تعریف شده');
ok(/ipcMain\.handle\('yt:search'/.test(mainSrc), 'هندلر yt:search');
ok(/html\.split\('"videoRenderer"'\)/.test(mainSrc), 'پارس ytInitialData برای چند نتیجه');
ok(/items\.some\(\(x\) => x\.videoId === idm\[1\]\)/.test(mainSrc), 'حذف تکراری نتایج');
ok(preSrc.includes("search: (query, n) => ipcRenderer.invoke('yt:search', { query, n })"), 'preload: پل yt.search');

/* ---------- ۵) کاتالوگ مغز (voiceBrain) ---------- */
section('کاتالوغ مغز — چیت‌شیت FA/EN (tool_definitions)');
const sysFA = VB.brainSystem('fa');
const sysEN = VB.brainSystem('en');
ok(sysFA.includes('close:other') && sysFA.includes('close:oldest'), 'FA: توکن‌های بستن هدفمند + other');
ok(sysFA.includes('resize:small') && sysFA.includes('opacity:50') && sysFA.includes('monitor:2'), 'FA: resize/opacity/monitor');
ok(sysFA.includes('arrange:side') && sysFA.includes('arrange:grid') && sysFA.includes('arrange:cascade'), 'FA: چیدمان‌ها');
ok(sysFA.includes('players') && sysFA.includes('switch:other') && sysFA.includes('status') && sysFA.includes('shot'), 'FA: players/switch/status/shot');
ok(sysFA.includes('speed:1.5') && sysFA.includes('quality:360'), 'FA: speed/quality');
ok(sysFA.includes('«تصویر در تصویر کن/پیپ کن»→pip'), 'FA: نقشهٔ گفتار PIP');
ok(sysFA.includes('«برو سراغ اون یکی ویدیو»→switch:other'), 'FA: نقشهٔ گفتار سوییچ');
ok(sysFA.includes('«فول اسکرین کن»→fullscreen') && sysFA.includes('«برو جلو ۳۰ ثانیه»→seek:30'), 'FA: نقشهٔ گفتار قدیمی حفظ (پین v0630)');
ok(sysEN.includes('close:other') && sysEN.includes('resize:small') && sysEN.includes('speed:1.5'), 'EN: توکن‌های جدید');
ok(sysEN.includes('"picture in picture"→pip') && sysEN.includes('"switch to the other video"→switch:other'), 'EN: speech map جدید');
ok(/VB\.BRAIN_DO_ACTS/.test('') || VB.BRAIN_DO_ACTS.has('video_ctl'), 'video_ctl در DO_ACTS (بدون act جدید — همان معماری)');

/* ---------- ۶) capabilities + دفتر ممیزی ---------- */
section('capabilities + docs');
const pc = CAP.CAPS.find((c) => c.id === 'player-win');
ok(!!pc, 'توانایی جدید player-win');
ok(pc && pc.examples.indexOf('ویدیو رو تصویر در تصویر کن') >= 0 && pc.examples.indexOf('دومی رو پخش کن') >= 0, 'توانایی player-win: مثال‌های جدید');
ok(docsSrc.includes('۱.۵) ابزارهای پنجرهٔ ویدیو، چند-ویدیو و سرعت/کیفیت'), 'دفتر ممیزی: بخش ۱.۵');
ok(docsSrc.includes('close:other') && docsSrc.includes('arrange:side') && docsSrc.includes('yt_pick'), 'دفتر ممیزی: توکن‌های جدید مستند شد');
ok(docsSrc.includes('v0.80.0') || docsSrc.includes('v0.80'), 'دفتر ممیزی: عنوان نسخهٔ 0.80');
ok(docsSrc.includes('فقط سرچ کن X تو یوتیوب پخش نکن'), 'دفتر ممیزی: سرچ لیستی');
ok(docsSrc.includes('Tool Executor'), 'دفتر ممیزی: ردیابی معماری مرجع');

/* ---------- نتیجه ---------- */
console.log('\n———————————————');
console.log('PASS=' + pass + '  FAIL=' + fail);
if (fail) { console.log('\nFAILED:'); for (const f of fails) console.log(' - ' + f); }
process.exit(fail ? 1 : 0);
