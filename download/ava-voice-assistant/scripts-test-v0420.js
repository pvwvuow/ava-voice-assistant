'use strict';
/* ============================================================
   آوا — scripts-test-v0420.js — تست رگرسیون فیکس‌ها و قابلیت‌های v0.42
   ------------------------------------------------------------
   درخواست کاربر:
   ۱) «این (openai-edge-tts) به کار ما میاد؟ اگه خوبه و رایگانه برای
      صدای آوا استفاده کن» → موتور عصبی اِج بدون سرور + قطع‌کنٔ مدار
   ۲) «کاربر میگه سرچ کن انجام نده ولی بگه بگرد کار کنه، مسخرس» →
      «سرچ کن» خالی = باز شدن گوگل + پاسخ صادقانه
   ۳) «لوگو که دادم رو برای آیکون استفاده کن» → icon/ico/favicon
   ۴) «AI پس‌زمینه و ذخیره‌شده‌های کاربر رو بتونه ببینه — چند تا تایمر
      داره/فعاله؟ — اون فایل نوت رو دوباره باز کنه» → TIMERS چندتایمری +
      timer_report/timer_cancel/notes_open محلی + avaStateCtx + note_show
   ۵) «نرم‌افزار داره خیلی سنگین میشه — اگه اکستنشن اف بود فعال نباشه…
      اکستنشن‌های کاربردی مثل dns پویا باشن» → lazy موزیک + پیام خاموش +
      DNS پویا
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const R = path.join(__dirname);
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('PASS | ' + name); } else { fail++; console.log('FAIL | ' + name); } };
const eq = (a, b, name) => ok(a === b, name + (a === b ? '' : `  [got=${JSON.stringify(a)} want=${JSON.stringify(b)}]`));

const app = read('renderer/js/app.js');
const main = read('main.js');
const pre = read('preload.js');
const idx = read('renderer/index.html');
const pkg = JSON.parse(read('package.json'));
const readme = read('README.md');

/* ---------- ابزار استخراج ---------- */
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
function grabArrow(src, startMarker) {
  const i = src.indexOf(startMarker);
  if (i < 0) return null;
  const b = src.indexOf('{', i);
  let d = 0;
  for (let k = b; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(src.indexOf('(', i - 40) >= 0 && src.slice(i, src.indexOf('(', i - 40)).length ? src.indexOf('(' , Math.max(0, src.lastIndexOf('\n', i) + 1)) : k + 1 && src.indexOf('(' , Math.max(0, src.lastIndexOf('\n', i) + 1)), k + 1); }
  }
  return null;
}
/* استخراج k: regex از قانون با id مشخص (همان شکل RULES آوا) */
function ruleK(src, id) {
  const i = src.indexOf("id: '" + id + "'");
  if (i < 0) return null;
  const head = src.lastIndexOf('k: ', i);
  const line = src.slice(head, i);
  const m = line.match(/k:\s*\/((?:[^\/\\]|\\.)*)\/([a-z]*)/s);
  if (!m) return null;
  return new RegExp(m[1], m[2] || '');
}

/* ============================================================
   ۱) موتور عصبی اِج (main.js) — ساختار + رفتار واقعی
   ============================================================ */
{
  ok(main.includes("ipcMain.handle('tts:edge'"), 'main: هندلر tts:edge ثبت شده');
  ok(main.includes("require('ws')") || main.includes('require("ws")'), 'main: کلاینت ws برای endpoint اِج');
  ok(main.includes('Sec-MS-GEC'), 'main: توکن DRM Sec-MS-GEC');
  ok(main.includes('fa-IR-DilaraNeural'), 'main: صدای فارسی Dilara');
  ok(main.includes('en-US-AriaNeural'), 'main: صدای انگلیسی Aria');
  ok(main.includes('Path:turn.end'), 'main: پایان نوبت اِج (turn.end)');
  ok(main.includes('readUInt16BE(0)'), 'main: پارس فریم باینری (طول هدر ۲بایتی)');
  ok(main.includes('edgeHealth'), 'main: قطع‌کنٔ مدار (edgeHealth)');
  ok(main.includes("Date.now() + 90 * 1000"), 'main: سرد شدن ۹۰ ثانیه‌ای قطع‌کن (v0.47 B12: ۱۰دقیقه→۹۰ثانیه)');
  ok(pre.includes("edge: (payload) => ipcRenderer.invoke('tts:edge', payload)"), 'preload: پل tts.edge');

  /* گِج واقعی: SHA-256(تیک‌های ۱۰۰نانوثانیه‌ای رُندشده به ۵دقیقه + توکن) */
  const gecSrc = grabFn(main, 'edgeSecMsGec');
  ok(!!gecSrc, 'main: edgeSecMsGec استخراج شد');
  if (gecSrc) {
    const gec = new Function('crypto', 'EDGE_TRUSTED_TOKEN', gecSrc + '; return edgeSecMsGec;')(crypto, '6A5AA1D4EAFF4E9FB37E23D68491D6F4');
    const a = gec(), b = gec();
    ok(/^[0-9A-F]{64}$/.test(a), 'edgeSecMsGec: خروجی ۶۴هکسی بزرگ');
    eq(a, b, 'edgeSecMsGec: در همان بازهٔ ۵دقیقه‌ای پایدار');
    /* بازتولید مستقل با الگوریتم مرجع edge-tts */
    let t = Math.floor(Date.now() / 1000) + 11644473600; t -= t % 300; t *= 1e7;
    eq(a, crypto.createHash('sha256').update(String(t) + '6A5AA1D4EAFF4E9FB37E23D68491D6F4').digest('hex').toUpperCase(), 'edgeSecMsGec: مطابق الگوریتم مرجع edge-tts');
  }

  /* شکست تکه‌های بلند روی مرز جمله — سقف ۳۰۰۰ */
  const splitSrc = grabFn(main, 'splitEdgeChunks');
  ok(!!splitSrc, 'main: splitEdgeChunks استخراج شد');
  if (splitSrc) {
    const split = new Function(splitSrc + '; return splitEdgeChunks;')();
    eq(split('').length, 0, 'splitEdgeChunks: خالی → هیچ');
    eq(split('سلام').length, 1, 'splitEdgeChunks: کوتاه → یک تکه');
    const long = Array.from({ length: 90 }, (_, i) => `جملهٔ شمارهٔ ${i} که کمی طولانی هم نوشته شده تا متن بلند شود و از سقف ۳۰۰۰ نویسه بگذرد.`).join(' ');
    const parts = split(long);
    ok(parts.length > 1, 'splitEdgeChunks: متن بلند → چند تکه (' + parts.length + ')');
    ok(parts.every((p) => p.length <= 3000), 'splitEdgeChunks: همهٔ تکه‌ها ≤ ۳۰۰۰');
    eq(parts.join(' ').replace(/\s+/g, ' ').length, long.replace(/\s+/g, ' ').length, 'splitEdgeChunks: هیچ متنی گم نشد');
  }

  /* زنجیرهٔ صدا در رندرر: اِج → گوگل → ویندوز (v0.43: + ثبت موتور واقعی) */
  ok(app.includes('if (settings.ttsEngine === \'edge\')'), 'app: شاخهٔ موتور اِج در speak()');
  ok(/speakEdge\(txt\)[\s\S]{0,420}speakGoogle\(txt\)[\s\S]{0,900}speakWindows\(txt\)/.test(app), 'app: زنجیرهٔ اِج→گوگل→ویندوز (v0.47 +لاگ صداقت)');
  ok(app.includes('async function speakEdge('), 'app: speakEdge تعریف شده');
  ok(app.includes("bridge.tts.edge({ text: String(text).slice(0, 3000), lang, voice })"), 'app: speakEdge از پل preload با سقف ۳۰۰۰ + صدای انتخابی');
  ok(app.includes("ttsLastEngine = 'edge'") && app.includes("ttsLastEngine = 'google'") && app.includes("ttsLastEngine = 'windows'"), 'app: ثبت موتور واقعاً پخش‌شده (v0.43)');
  ok(app.includes('edgeVoice') && app.includes('fa-IR-FaridNeural'), 'app: صدای مذکر اِج (فرید) در دسترس است');

  /* مهاجرت یک‌بارهٔ موتور صدا */
  ok(app.includes("store.get('migV42')") && app.includes("migration v0.42 applied"), 'app: مهاجرت یک‌بارهٔ migV42');
  ok(app.includes("if (settings.ttsEngine !== 'windows') { settings.ttsEngine = 'edge';"), 'app: گوگل قبلی → اِج (ویندوز دست‌نخورده)');

  /* سه موتور در تنظیمات */
  ok(idx.includes('<option value="edge"'), 'index: گزینهٔ اِج در optTtsEngine');
  {
    /* ترتیب فقط داخل سلکت optTtsEngine سنجیده شود (گزینه‌های google در سلکت‌های دیگر هست) */
    const s = idx.indexOf('id="optTtsEngine"');
    const seg = idx.slice(s, s + 1200);
    const ie = seg.indexOf('<option value="edge"'), ig = seg.indexOf('<option value="google"'), iw = seg.indexOf('<option value="windows"');
    ok(ie >= 0 && ig >= 0 && iw >= 0 && ie < ig && ig < iw, 'index: اِج اولِ فهرست موتور صدا (پیشنهادی)');
  }
  ok(app.includes("['edge', 'google', 'windows'].includes(optTtsEngine.value)"), 'app: هندلر تنظیمات سه موتور را می‌پذیرد');
  ok(app.includes("'voice.eEng'") && app.includes("'set.voice.eEng'"), 'app: i18n صدای اِج');
  ok(app.includes("ttsEngine: store.get('ttsEngine', 'edge')"), 'app: پیش‌فرض موتور صدا = اِج');
}

/* ============================================================
   ۲) «سرچ کن» خالی → خود گوگل
   ============================================================ */
{
  /* استخراج cmd قانون web_search از main.js */
  const i = main.indexOf('web_search: { cmd:');
  ok(i > 0, 'main: قانون web_search پیدا شد');
  const b = main.indexOf('{', i + 'web_search: { cmd:'.length - 1);
  let d = 0, end = -1;
  for (let k = b; k < main.length; k++) {
    if (main[k] === '{') d++;
    else if (main[k] === '}') { d--; if (!d) { end = k + 1; break; } }
  }
  const arrow = main.slice(main.indexOf('(', i), end);
  /* v0.60 forward-relax (B8): بازکردن URL از `start ""` (cmd.exe) به shell.openExternal مهاجرت کرد —
     فراخوانی زندهٔ cmd حذف و به پین سورس‌سطح تبدیل شد (URL/سقف ۲۰۰/عبارت‌گذاری همان است) */
  ok(arrow.includes('shell.openExternal') && arrow.includes("else shell.openExternal('https://www.google.com')"),
    'web_search: عبارت خالی → صفحهٔ اصلی گوگل (shell.openExternal)');
  ok(arrow.includes('https://www.google.com/search?q='), 'web_search: عبارت‌دار → نتایج جستجو');
  ok(arrow.includes('encodeURIComponent(q.slice(0, 200))'), 'web_search: عبارت سالم داخل URL');
  /* پاسخ صادقانهٔ رندرر */
  ok(app.includes("'گوگل باز شد — بگو چی رو برات سرچ کنم.'"), 'app: پاسخ «سرچ کن» خالی صادقانه است');
}

/* ============================================================
   ۳) لوگوی کاربر = آیکون برنامه
   ============================================================ */
{
  const logo = fs.readFileSync(path.join(R, 'renderer/assets/ava-logo.png'));
  const icon = fs.readFileSync(path.join(R, 'assets/icon.png'));
  const fav = fs.readFileSync(path.join(R, 'renderer/favicon.png'));
  const ico = fs.readFileSync(path.join(R, 'assets/icon.ico'));
  eq(icon.equals(logo), true, 'icon.png دقیقاً همان لوگوی کاربر است');
  const pngs = ico.filter((_, i, a) => a[i] === 0x89 && a[i + 1] === 0x50 && a[i + 2] === 0x4e && a[i + 3] === 0x47).length;
  ok(pngs >= 7, 'icon.ico چندسایزی کامل (' + pngs + ' تصویر ≥ 7)');
  ok(fav.length > 2000 && fav.slice(1, 4).toString() === 'PNG', 'favicon.png بازسازی شده');
  ok(main.includes("icon: path.join(__dirname, 'assets', 'icon.png')"), 'main: آیکون پنجره از assets');
  ok(pkg.build && pkg.build.win && pkg.build.win.icon === 'assets/icon.ico', 'package: آیکون نصاب/تسک‌بار');
}

/* ============================================================
   ۴) وضعیت تایمرها/یادداشت‌ها — محلی + آگاهی AI
   ============================================================ */
{
  /* چندتایمری */
  ok(app.includes('let TIMERS = []'), 'app: آرایهٔ TIMERS');
  ok(app.includes('function armNextTimer()'), 'app: armNextTimer (نزدیک‌ترین تایمر مسلح می‌شود)');
  ok(app.includes('function fireTimer('), 'app: fireTimer با شناسه');
  ok(app.includes('TIMERS.push({ id: ++timerSeq, endsAt: Date.now() + mins * 60000, label, unit })'), 'app: startTimer تایمر را اضافه می‌کند (دیگر قبلی را نمی‌کشد)');
  ok(!/if \(timerId\) clearTimeout\(timerId\);\s*\n\s*timerId = setTimeout\(\(\) => \{\s*\n\s*beep\(\);/.test(app), 'app: رفتار قدیمیِ «هر تایمر قبلی را بکش» حذف شده');
  ok(app.includes("'timer.multi'"), 'app: پاسخ تعداد تایمرهای فعال');

  /* ترتیب قوانین: cancel/report قبل از ست‌کردن تایمر */
  const iT = app.indexOf("id: 'timer'");
  const iR = app.indexOf("id: 'timer_report'");
  const iC = app.indexOf("id: 'timer_cancel'");
  ok(iC > 0 && iR > 0 && iC < iR && iR < iT, 'app: ترتیب قوانین timer_cancel < timer_report < timer');

  /* رفتار واقعی regexها */
  const kRep = ruleK(app, 'timer_report');
  const kCan = ruleK(app, 'timer_cancel');
  ok(!!kRep && !!kCan, 'app: regexهای timer_report/timer_cancel استخراج شد');
  if (kRep) {
    ok(kRep.test('چند تا تایمر دارم'), 'report: «چند تا تایمر دارم»');
    ok(kRep.test('چندتا تایمر دارم آوا'), 'report: «چندتا تایمر دارم»');
    ok(kRep.test('تایمرام چیه'), 'report: «تایمرام چیه»');
    ok(kRep.test('تایمرها رو نشون بده'), 'report: «تایمرها رو نشون بده»');
    ok(kRep.test('تایمر فعاله؟'), 'report: «تایمر فعاله؟»');
    ok(kRep.test('تایمر باقی مونده؟'), 'report: «تایمر باقی مونده»');
    ok(kRep.test('how many timers'), 'report: how many timers');
    ok(!kRep.test('تایمر ۵ دقیقه بذار'), 'report: «تایمر ۵ دقیقه بذار» نمی‌خورد (ست‌کردن می‌ماند)');
    ok(!kRep.test('یه تایمر ۱۰ دقیقه‌ای بذار'), 'report: «یه تایمر ۱۰ دقیقه‌ای بذار» نمی‌خورد');
    ok(!kRep.test('تایمر چند دقیقه‌ای بذار'), 'report: «تایمر چند دقیقه‌ای بذار» نمی‌خورد');
  }
  if (kCan) {
    ok(kCan.test('تایمر رو بردار'), 'cancel: «تایمر رو بردار»');
    ok(kCan.test('لغو تایمر'), 'cancel: «لغو تایمر»');
    ok(kCan.test('تایمرها رو پاک کن'), 'cancel: «تایمرها رو پاک کن»');
    ok(!kCan.test('تایمر ۵ دقیقه بذار'), 'cancel: «تایمر ۵ دقیقه بذار» نمی‌خورد');
  }

  /* یادداشت: قانون open قبل از قانون عمومی + اکشن AI */
  const iNO = app.indexOf("id: 'notes_open'");
  const iN = app.indexOf("id: 'notes'");
  ok(iNO > 0 && iN > 0 && iNO < iN, 'app: قانون notes_open قبل از notes');
  const kNO = ruleK(app, 'notes_open');
  if (kNO) {
    ok(kNO.test('اون یادداشت رو باز کن'), 'notes_open: «اون یادداشت رو باز کن»');
    ok(kNO.test('همون نوت رو نشون بده'), 'notes_open: «همون نوت رو نشون بده»');
    ok(kNO.test('یادداشت آخر رو بخون'), 'notes_open: «یادداشت آخر رو بخون»');
    ok(kNO.test('open the last note'), 'notes_open: انگلیسی');
    ok(!kNO.test('یادداشت کن که فردا ساعت ۵ جلسه دارم'), 'notes_open: «یادداشت کن که…» ثبت می‌ماند');
  }
  ok(app.includes('async function openLastNote('), 'app: openLastNote (محلی)');
  ok(app.includes("case 'note_show':") && app.includes('outs.push(await openLastNote(a.value))'), 'app: اکشن note_show در executeDoActions');
  ok(app.includes("'note_show'") && app.indexOf("'note_show'", app.indexOf('const DO_ACTS')) > 0, 'app: note_show در DO_ACTS');
  ok(app.includes('note_show: value=بخشی از متن یک یادداشت'), 'app: راهنمای note_show در پرامپت فارسی');
  ok(app.includes('note_show(value=a fragment of a saved note'), 'app: راهنمای note_show در پرامپت انگلیسی');

  /* عکس وضعیت → هر دو مسیر فالبک AI */
  ok(app.includes('async function avaStateCtx()'), 'app: avaStateCtx تعریف شده');
  ok(app.includes('تایمرهای فعال: ') && app.includes('یادداشت‌های ذخیره‌شدهٔ کاربر: ') && app.includes('یادآوری‌های ثبت‌شده: '), 'app: وضعیت شامل تایمر/یادآوری/یادداشت');
  ok(app.includes('async function aiFallbackCtx('), 'app: aiFallbackCtx (کاتالوگ+وضعیت+extra — v0.50: نمونه‌های آموخته هم)');
  const nStateUses = (app.match(/await aiFallbackCtx\(/g) || []).length;
  ok(nStateUses >= 2, 'app: هر دو مسیر فالبک (فرمان ناشناخته + قانون ناتمام) وضعیت می‌چسبانند (' + nStateUses + ')');
  ok(app.includes('[وضعیت لحظه‌ای آوا]'), 'app: بلوک وضعیت برای AI');
}

/* ============================================================
   ۵) سبک‌سازی — lazy موزیک + پیام افزونهٔ خاموش + DNS پویا
   ============================================================ */
{
  /* اسکن پوشه در شروع فقط با افزونهٔ روشن */
  ok(/if \(settings\.extMusic && Array\.isArray\(settings\.musicDirs\) && settings\.musicDirs\.length\) \{\s*\n\s*setTimeout\(\(\) => \{ try \{ restoreMusicLibrary\(\);/.test(app), 'app: بازسازی پلی‌لیست در شروع فقط با افزونهٔ روشن');
  ok(app.includes('typeof restoreMusicLibrary === \'function\' && settings.extMusic'), 'app: مسیر بازیابی تنظیمات هم گیت extMusic دارد');
  /* فعال‌سازی افزونه → بازسازی همان لحظه (با گارد TDZ) */
  ok(/else \{\s*[\s\S]{0,220}?music\.restored && Array\.isArray\(settings\.musicDirs\)/.test(app), 'app: فعال‌سازی افزونه → بازسازی lazy (applyExtensions)');
  /* پیام «افزونه خاموشه» + باز شدن صفحهٔ افزونه‌ها */
  ok(app.includes('function musicExtOffReply()') && app.includes("return t('music.extOff');"), 'app: musicExtOffReply');
  ok(app.includes("'music.extOff'"), 'app: i18n music.extOff');
  const gates = (app.match(/if \(!settings\.extMusic\) return musicExtOffReply\(\);/g) || []).length;
  eq(gates, 4, 'app: هر ۴ فرمان صوتی موزیک گیت افزونه دارند (play/pause/next/prev)');
  ok(app.includes("if (!settings.extMusic || typeof playTrack !== 'function') { outs.push(musicExtOffReply()); break; }"), 'app: مسیر AI music_play هم پیام یکدست می‌دهد');
  /* DNS پویا */
  ok(app.includes("actLog('dns ext auto-enabled by voice command (dynamic extension)')"), 'app: DNS پویا — فعال شدن لحظه‌ای با فرمان');
}

/* ============================================================
   ۶) نسخه و README
   ============================================================ */
{
  ok(/^0\.[45][0-9]*\./.test(pkg.version), 'نسخه: package.json (0.4x به جلو)');
  ok(/let appVersion = '0\.[45][0-9]*\./.test(app), 'نسخه: app.js (0.4x به جلو)');
  ok(/v0\.[45][0-9]*\./.test(idx), 'نسخه: index.html (0.4x به جلو)');
  ok(readme.includes('v0.42-beta') && readme.includes('openai-edge-tts'), 'README: بلوک v0.42 + اشارهٔ openai-edge-tts');
  ok(pkg.dependencies && pkg.dependencies.ws, 'package: وابستگی ws ثبت شده');
}

/* ============================================================
   ۷) سینتکس سالم + سازگاری رو به جلو
   ============================================================ */
{
  for (const f of ['renderer/js/app.js', 'main.js', 'preload.js']) {
    try { new Function(read(f)); ok(true, 'سینتکس سالم: ' + f); }
    catch (e) { ok(false, 'سینتکس سالم: ' + f + ' — ' + e.message); }
  }
}

console.log('\nRESULT: ' + pass + '/' + (pass + fail));
if (fail === 0) console.log('V0420_OK'); else { console.log('FAILED!'); process.exit(1); }
