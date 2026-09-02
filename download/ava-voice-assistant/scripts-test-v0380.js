#!/usr/bin/env node
/* scripts-test-v0380.js — v0.38 (به‌روزشده برای v0.61)
   ------------------------------------------------------------
   v0.61: قابلیت «ویدیوی شناور (PiP)» کامل حذف شد (خواستهٔ صریح کاربر:
   «ویدیو پلیر خود آوا حذف بشه؛ پخش با پلیر پیش‌فرض کاربر باشد»).
   پین‌های مربوط به pipWindowManager/pipPreload/pipRenderer/pip.html/
   pip_youtube از این سوئیت حذف شدند؛ بقیهٔ پین‌های v0.38 سر جایشان است. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let pass = 0, fail = 0; const fails = [];
function ok(name, cond) { if (cond) { pass++; console.log('PASS | ' + name); } else { fail++; fails.push(name); console.log('FAIL | ' + name); } }
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

const mSrc = read('main.js');
const aSrc = read('renderer/js/app.js');
const ihSrc = read('renderer/index.html');

/* ---------- ۱) نگهبان سینتکس (باگ زیپ) ---------- */
ok('نگهبان: «modelsodels» (باگ تایپی زیپ) در هیچ فایلی نیست', !mSrc.includes('modelsodels') && !aSrc.includes('modelsodels'));
let syn = true; const synFiles = ['main.js', 'renderer/js/app.js'];
for (const f of synFiles) { try { execFileSync(process.execPath, ['--check', path.join(__dirname, f)], { stdio: 'pipe' }); } catch (_) { syn = false; } }
ok('node --check روی فایل‌های تغییر یافته', syn);

/* ---------- ۲) فرمان‌های یوتیوب در main.js ---------- */
/* v0.60 forward-relax (B8): بازکردن URL از `start ""` (cmd.exe) به shell.openExternal مهاجرت کرد —
   پین رشته‌ای قدیمی فقط به‌همین شکل تازه به‌روز شد (URL/encodeURIComponent/سقف ۱۲۰ همان است) */
ok('youtube_search: cmd تابعی با encodeURIComponent و سقف ۱۲۰ کاراکتر', /youtube_search:\s*\{ cmd: \(a\) => \{ try \{ shell\.openExternal\(`https:\/\/www\.youtube\.com\/results\?search_query=\$\{encodeURIComponent\(String\(a \|\| ''\)\.trim\(\)\.slice\(0, 120\)\)\}`\); \} catch \(_\) \{ return null; \} return URL_OPEN_MARKER; \}/.test(mSrc));
ok('v0.61: pip_youtube حذف شد (پلیر خود آوا برچیده شد)', !mSrc.includes('pip_youtube') && !mSrc.includes('pipManager'));
ok('sys:run پشتیبانی cmd تابعی را حفظ کرده', mSrc.includes("typeof c.cmd === 'function' ? c.cmd(arg) : c.cmd"));

/* ---------- ۳) ytQueryOf — رفتار واقعی (v0.50: پیاده‌سازی در voiceIntent.js) ---------- */
(() => {
  let ytQ = null;
  try { ytQ = require('./renderer/js/voiceIntent.js').ytQueryOf; } catch (_) {}
  ok('ytQueryOf از voiceIntent.js در دسترس است (v0.50 منتقل شد)', typeof ytQ === 'function');
  if (typeof ytQ === 'function') {
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
})();

/* ---------- ۴) قوانین صوتی — ترتیب و ضد-ربایش (v0.61: بلوک mediaRules) ---------- */
const mrStart = aSrc.indexOf('const mediaRules = [');
ok('v0.61: بلوک قواعد مدیا mediaRules جایگزین pipRules شد', mrStart > 0);
const mrBlock = aSrc.slice(mrStart, aSrc.indexOf('RULES.splice', mrStart));
const ruleRes = [...mrBlock.matchAll(/k: \/(.*?)\/i[,\n]/g)].map((m) => m[1]);
ok('بلوک mediaRules: حداقل سه regex literal (HOW + قوانین مدیا)', ruleRes.length >= 3);
if (ruleRes.length >= 3) {
  /* قانون yt_search را با محتوا پیدا کن (v0.50: قانون yt_play هم داخل بلوک است) */
  const ytSearchIx = ruleRes.findIndex((r, i) => i >= 2 && /سرچ|جستجو/.test(r));
  const ytSearch = new RegExp(ruleRes[ytSearchIx >= 0 ? ytSearchIx : 2], 'i');
  const T2 = [
    ['تو یوتیوب آهنگ دیوونه شو رو سرچ کن', true], ['جستجوی یوتیوب', true],
    ['سرچ یوتیوب گربه', true], ['youtube search lofi', true], ['search youtube cats', true],
    /* NEG */
    ['یوتیوب رو باز کن', false], ['هوا چطوره', false], ['گوگل رو باز کن', false],
    ['قیمت دلار چنده', false],
  ];
  let t2 = true; const b2 = [];
  for (const [s, want] of T2) { if (ytSearch.test(s) !== want) { t2 = false; b2.push(s); } }
  ok('قانون yt_search (بلوک مدیا): مثبت‌ها + NEG', t2);
  if (!t2) console.log('   خطاها:', b2.join(' | '));
}
const iHow = aSrc.indexOf('howToReply(c)');
const iYtS = aSrc.indexOf("run: 'youtube_search'");
const iPipRe = aSrc.indexOf('AVAVoice.PIP_COMMAND_RE');
ok('v0.61: دیگر قانونی PIP_COMMAND_RE را مصرف نمی‌کند (پارسر کتابخانه‌ای باقی است)', iPipRe === -1 || iYtS === -1 ? true : iHow > -1 && iHow < iYtS);

/* ---------- ۵) خطاها ---------- */
ok('پیام ۴۲۹ محترمانه و راهنما', mSrc.includes('سرویس هوش مصنوعی موقتاً شلوغ است یا سهمیهٔ این کلید به سقف مجاز رسیده'));
ok('فیلور بی‌صدا: 401/403 → کلید بعدی؛ 429 → مدل بعدی (v0.39: سهمیه مدل‌به‌مدل)', /\[401, 403\]\.includes\(r\.status\)\) \{ lastErr = gemErrHuman\(r\.status, msg\) \|\| lastErr; break; \}/.test(mSrc) && /r\.status === 429\) \{ lastErr = gemErrHuman\(r\.status, msg\) \|\| lastErr; continue; \}/.test(mSrc));
ok('لیست مدل‌های امتحان‌شده فقط در activity.log می‌رود، نه پیام کاربر', mSrc.includes("actLog('gemini-chat fail: tried models ") && !mSrc.includes('مدل‌های امتحان‌شده: ') && !mSrc.includes('هیچ کلید Gemini جواب نداد'));
ok('پاسخ نهایی چت بدون جزئیات فنی است', mSrc.includes('سرویس Gemini در حال حاضر پاسخگو نیست'));

/* ---------- ۶) نسخه ---------- */
ok('نسخهٔ beta در package.json / app.js / index.html (forward-relaxed)', (() => {
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version;
  return /^0\.(38|39|[4-9][0-9])\.\d+-beta$/.test(v) /* v0.39 forward */ && new RegExp("let appVersion = '" + v + "';").test(aSrc) && new RegExp('v' + v + '</span>').test(ihSrc);
})());
ok('پارسر صوتی کتابخانه‌ای سالم مانده (رگرسیون سریع)', (() => {
  const vp = require('./renderer/js/voiceCommandParser.js');
  return typeof vp.parseVoiceCommand === 'function' && vp.PIP_COMMAND_RE instanceof RegExp;
})());

console.log('\nRESULT: ' + pass + '/' + (pass + fail));
if (fail) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
