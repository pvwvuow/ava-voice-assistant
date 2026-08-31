'use strict';
/* ============================================================
   آوا v0.38.0-beta — تست‌های رگرسیون «یوتیوب شناور + جستجوی یوتیوب»
   ------------------------------------------------------------
   چه چیزی تست می‌شود:
   ۱) نگهبان سینتکس زیپ: «modelsodels» هرگز برنگردد (باگ کشندهٔ نسخهٔ
      آپلودی — main.js اصلاً بوت نمی‌شد) + node --check همهٔ فایل‌ها
   ۲) فرمان‌های youtube_search/pip_youtube — cmd تابعی + پل PiP
   ۳) openUrl + جستجوی داخل PiP (لینک/ID → پخش؛ متن → مرورگر + note)
   ۴) کنترل پلیر PiP: enablejsapi + بدون bind تکراری btnClose/btnLock
      (باگ toggle دوبل نسخهٔ آپلودی) + emptyDefault
   ۵) ytQueryOf — استخراج عبارت جستجو (رفتار واقعی با eval از سورس)
   ۶) قوانین صوتی: اولویت HOW > یوتیوب شناور > جستجوی یوتیوب > پین
      + NEG: «یوتیوب رو باز کن» و «هوا چطوره» نباید ربوده شوند
   ۷) خطاها: پیام ۴۲۹ محترمانه + فیلور بی‌صدا + مدل‌ها فقط در activity.log
   ۸) نسخهٔ 0.38.0-beta در هر سه نقطه
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let pass = 0, fail = 0; const fails = [];
function ok(name, cond) { if (cond) { pass++; console.log('PASS | ' + name); } else { fail++; fails.push(name); console.log('FAIL | ' + name); } }
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

const mSrc = read('main.js');
const pmSrc = read('pipWindowManager.js');
const plSrc = read('pipPreload.js');
const prSrc = read('renderer/js/pipRenderer.js');
const phSrc = read('renderer/pip.html');
const aSrc = read('renderer/js/app.js');
const ihSrc = read('renderer/index.html');

/* ---------- ۱) نگهبان سینتکس (باگ زیپ) ---------- */
ok('نگهبان: «modelsodels» (باگ تایپی زیپ) در هیچ فایلی نیست', !mSrc.includes('modelsodels') && !aSrc.includes('modelsodels'));
let syn = true; const synFiles = ['main.js', 'pipWindowManager.js', 'pipPreload.js', 'renderer/js/pipRenderer.js', 'renderer/js/app.js'];
for (const f of synFiles) { try { execFileSync(process.execPath, ['--check', path.join(__dirname, f)], { stdio: 'pipe' }); } catch (_) { syn = false; } }
ok('node --check روی هر ۵ فایل تغییر یافته', syn);

/* ---------- ۲) فرمان‌های یوتیوب در main.js ---------- */
ok('youtube_search: cmd تابعی با encodeURIComponent و سقف ۱۲۰ کاراکتر', /youtube_search:\s*\{ cmd: \(a\) => `start "" "https:\/\/www\.youtube\.com\/results\?search_query=\$\{encodeURIComponent\(String\(a \|\| ''\)\.trim\(\)\.slice\(0, 120\)\)\}"`/.test(mSrc));
ok('pip_youtube: از pipManager.openUrl استفاده می‌کند وقتی موجود است', mSrc.includes('typeof pipManager.openUrl') && mSrc.includes('pipManager.openUrl(q)') && mSrc.includes("Write-Output pip_started"));
ok('pip_youtube: فالبک مرورگر برای عبارت/بدون عبارت (نتایج یا صفحهٔ اصلی)', mSrc.includes("results?search_query=${encodeURIComponent(q.slice(0, 120))}") && mSrc.includes("'start \"\" \"https://www.youtube.com\"'"));
ok('sys:run پشتیبانی cmd تابعی را حفظ کرده', mSrc.includes("typeof c.cmd === 'function' ? c.cmd(arg) : c.cmd"));

/* ---------- ۳) openUrl + جستجوی داخل PiP ---------- */
ok('openUrl: شناسهٔ ۱۱ حرفی و ytIdFromUrl → showPiP youtube', pmSrc.includes('core.ytIdFromUrl(s)') && pmSrc.includes('looksLikeVideoId(s)') && pmSrc.includes("showPiP({ kind: 'youtube', videoId: id, start })") && pmSrc.includes('function openUrl(u)'));
ok('openUrl در module.exports هست', /\bopenUrl,/.test(pmSrc.split('module.exports')[1] || ''));
ok('pip:host:search: لینک → پخش، متن → مرورگر + پیام note صادقانه', pmSrc.includes("ipcMain.on('pip:host:search'") && pmSrc.includes('results?search_query=${encodeURIComponent(s)}') && pmSrc.includes("showPiP({ kind: 'note'") && pmSrc.includes('X-Frame-Options'));
ok('جستجوی PiP سقف ۲۰۰ کاراکتر دارد', pmSrc.includes('slice(0, 200)'));
ok('pipPreload: پل search exposed', plSrc.includes("search: (q) => ipcRenderer.send('pip:host:search'"));
ok('pipRenderer: kind note → showEmpty با پیام', prSrc.includes("if (src.kind === 'note')") && prSrc.includes('showEmpty(src.message'));
ok('pipRenderer: emptyDefault — پیام قبلی نمی‌ماند', prSrc.includes('const emptyDefault') && prSrc.includes('msg || emptyDefault'));

/* ---------- ۴) کنترل پلیر ---------- */
ok('embed یوتیوب enablejsapi=1 دارد (وگرنه postMessage کار نمی‌کند)', prSrc.includes("'?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1'"));
ok('بدون bind تکراری btnClose/btnLock (باگ toggle دوبل زیپ)', (prSrc.match(/btnClose\.addEventListener/g) || []).length === 1 && (prSrc.match(/btnLock\.addEventListener/g) || []).length === 1);
ok('togglePlay/toggleMute: یوتیوب postMessage، ویدیوی مستقیم vid (v0.38.1: sync با وضعیت واقعی پلیر)', prSrc.includes("'pauseVideo' : 'playVideo'") && prSrc.includes("'mute' : 'unMute'") && prSrc.includes('vid.muted = wantMute') && prSrc.includes('playerState'));
ok('pip.html: دکمه‌های ⏸ 🔊 و input pip-search با data-ui', phSrc.includes('id="btnPlay"') && phSrc.includes('id="btnMute"') && phSrc.includes('id="pipSearch"') && /id="pipSearch"[^>]*data-ui="1"/.test(phSrc));
ok('pip.html: استایل .pip-search با راست‌چین', phSrc.includes('.bar .pip-search') && phSrc.includes('direction: rtl'));
ok('tooltipهای فارسی حفظ شده‌اند (حذف نشده‌اند مثل زیپ)', phSrc.includes('بستن (بگو: بردارش)') && phSrc.includes('قفل کلیک'));

/* ---------- ۵) ytQueryOf — رفتار واقعی ---------- */
const yqMatch = aSrc.match(/const ytQueryOf = (\(c\) => \{[\s\S]*?\n  \};)/);
ok('ytQueryOf در app.js تعریف شده و قابل استخراج است', !!yqMatch);
if (yqMatch) {
  const ytQ = eval('(' + yqMatch[1].replace(/;\s*$/, '') + ')');
  const T = [
    ['تو یوتیوب آهنگ دیوونه شو رو سرچ کن', 'آهنگ دیوونه شو'],
    ['یوتیوب شناور آهنگ باران بذار', 'آهنگ باران'],
    ['سرچ یوتیوب گربه', 'گربه'],
    ['تو یوتیوب ویدیو سگ و گربه پیدا کن', 'ویدیو سگ و گربه'],
    ['youtube search lofi beats', 'lofi beats'],
    ['یوتیوب شناور رو باز کن', ''],
    ['یوتیوب', ''],
    ['', ''],
  ];
  let allOk = true; const bad = [];
  for (const [inp, want] of T) { const got = ytQ(inp); if (got !== want) { allOk = false; bad.push(`«${inp}» → «${got}» (انتظار «${want}»)`); } }
  ok('ytQueryOf: جدول رفتار (۷ حالت استخراج + ۲ حالت خالی)', allOk);
  if (!allOk) console.log('   جزئیات:', bad.join(' | '));
}

/* ---------- ۶) قوانین صوتی — ترتیب و ضد-ربایش ----------
   استخراج موقعیتی: سه regex literal داخل بلوک pipRules به‌ترتیب =
   [HOW، یوتیوب شناور، جستجوی یوتیوب] (چهارمی AVAVoice.PIP_COMMAND_RE است) */
const pipStart = aSrc.indexOf('const pipRules = [');
const prBlock = aSrc.slice(pipStart, aSrc.indexOf('RULES.splice', pipStart));
const ruleRes = [...prBlock.matchAll(/k: \/(.*?)\/i[,\n]/g)].map((m) => m[1]);
ok('بلوک pipRules: سه regex literal (HOW + ۲ قانون جدید) پیدا شد', ruleRes.length === 3);
if (ruleRes.length === 3) {
  const pipYt = new RegExp(ruleRes[1], 'i');
  const ytSearch = new RegExp(ruleRes[2], 'i');
  const T1 = [
    ['یوتیوب شناور آهنگ باران', true], ['بذار یوتیوب شناور بشه', true],
    ['youtube pip lofi', true], ['floating youtube', true],
    /* NEG — نبود: باید جریان پینِ قبلی بماند */
    ['یوتیوب رو پین کن', false], ['ویدیو رو پین کن', false],
    ['ببرش حالت شناور', false], ['ویدیو رو شناور کن', false],
    ['هوا چطوره', false], ['قیمت دلار چنده', false],
  ];
  let t1 = true; const b1 = [];
  for (const [s, want] of T1) { if (pipYt.test(s) !== want) { t1 = false; b1.push(s); } }
  ok('قانون pip_youtube (موقعیت ۲): مثبت‌ها + NEG (پین/باز کن/آب‌وهوا ربوده نمی‌شوند)', t1);
  if (!t1) console.log('   خطاها:', b1.join(' | '));
  const T2 = [
    ['تو یوتیوب آهنگ دیوونه شو رو سرچ کن', true], ['جستجوی یوتیوب', true],
    ['سرچ یوتیوب گربه', true], ['youtube search lofi', true], ['search youtube cats', true],
    /* NEG */
    ['یوتیوب رو باز کن', false], ['هوا چطوره', false], ['گوگل رو باز کن', false],
    ['قیمت دلار چنده', false],
  ];
  let t2 = true; const b2 = [];
  for (const [s, want] of T2) { if (ytSearch.test(s) !== want) { t2 = false; b2.push(s); } }
  ok('قانون youtube_search (موقعیت ۳): مثبت‌ها + NEG', t2);
  if (!t2) console.log('   خطاها:', b2.join(' | '));
}
const iHow = aSrc.indexOf('howToReply(c)');
const iPipYt = aSrc.indexOf("run: 'pip_youtube'");
const iYtS = aSrc.indexOf("run: 'youtube_search'");
const iPipRe = aSrc.indexOf('AVAVoice.PIP_COMMAND_RE');
ok('ترتیب قوانین: HOW < یوتیوب شناور < جستجوی یوتیوب < پین عمومی', iHow > -1 && iHow < iPipYt && iPipYt < iYtS && iYtS < iPipRe);
ok('پارسر PiP: «یوتیوب رو پین کن» هنوز PIN می‌دهد (جریان قبلی دست نخورده)', (() => {
  const vp = require('./renderer/js/voiceCommandParser.js');
  return vp.parseVoiceCommand('یوتیوب رو پین کن', { pipOpen: false }).intent === 'PIN_VIDEO';
})());

/* ---------- ۷) خطاها ---------- */
ok('پیام ۴۲۹ محترمانه و راهنما', mSrc.includes('سرویس هوش مصنوعی موقتاً شلوغ است یا سهمیهٔ این کلید به سقف مجاز رسیده'));
ok('فیلور بی‌صدا: 401/403/429 → continue (نه break کل زنجیره)', /401, 403, 429\]\.includes\(r\.status\)\) \{ lastErr = gemErrHuman\(r\.status, msg\) \|\| lastErr; continue; \}/.test(mSrc));
ok('لیست مدل‌های امتحان‌شده فقط در activity.log می‌رود، نه پیام کاربر', mSrc.includes("actLog('gemini-chat fail: tried models ") && !mSrc.includes('مدل‌های امتحان‌شده: ') && !mSrc.includes('هیچ کلید Gemini جواب نداد'));
ok('پاسخ نهایی چت بدون جزئیات فنی است', mSrc.includes('سرویس Gemini در حال حاضر پاسخگو نیست'));

/* ---------- ۸) نسخه ---------- */
ok('نسخهٔ beta در package.json / app.js / index.html (forward-relaxed)', (() => {
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version;
  return /^0\.38\.\d+-beta$/.test(v) && new RegExp("let appVersion = '" + v + "';").test(aSrc) && new RegExp('v' + v + '</span>').test(ihSrc);
})());
ok('پارسر v0370 سالم مانده (رگرسیون رفتاری سریع)', (() => {
  const vp = require('./renderer/js/voiceCommandParser.js');
  return vp.parseVoiceCommand('ویدیو رو پین کن', { pipOpen: false }).intent === 'PIN_VIDEO'
    && vp.parseVoiceCommand('ببندش', { pipOpen: true }).intent === 'UNPIN_VIDEO'
    && vp.parseVoiceCommand('شفافیت هفتاد درصد', { pipOpen: true }).entities.opacity === 0.7
    && vp.parseVoiceCommand('کلیک روش رو ببند', { pipOpen: true }).intent === 'CLICK_THROUGH_ON';
})());

console.log('\nRESULT: ' + pass + '/' + (pass + fail));
if (fail) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
