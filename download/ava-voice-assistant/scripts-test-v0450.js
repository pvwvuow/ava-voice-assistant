'use strict';
/* ============================================================
   آوا — scripts-test-v0450.js
   بازنگری کامل منطق پاسخ‌دهی و فرمان‌پذیری (v0.45):
   ۱) نیت «بستن» — «یوتیوب رو ببند» دیگر یوتیوب را باز نمی‌کند
   ۲) پاسخ صادق در شکست — دیگر «باز شد» دروغ گفته نمی‌شود
   ۳) موزیک آگاه‌به‌آهنگ + فیکس ریشه‌ای \s در رشته‌های JS
   ۴) دروازهٔ فهم-اول وبی (هدفِ برنامه‌ای برای قوانین وب کافی نیست)
   ۵) سبک‌سازی RAM دور ۲ — وب‌ویو GLM تنبل
   ============================================================ */
const fs = require('fs');
const path = require('path');
const R = __dirname;
let pass = 0, fail = 0;
const ok = (c, name) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + name); } };
const I = require(path.join(R, 'renderer', 'js', 'voiceIntent.js'));
const V = require(path.join(R, 'renderer', 'js', 'voiceCommandParser.js'));
const U = require(path.join(R, 'renderer', 'js', 'voiceUnderstand.js'));

const appSrc = fs.readFileSync(path.join(R, 'renderer', 'js', 'app.js'), 'utf8');
const mainSrc = fs.readFileSync(path.join(R, 'main.js'), 'utf8');
const preSrc = fs.readFileSync(path.join(R, 'preload.js'), 'utf8');
const idxSrc = fs.readFileSync(path.join(R, 'renderer', 'index.html'), 'utf8');

/* ---------- ۱) نیت «بستن» — داوری با قوانین واقعیِ استخراجی از app.js ---------- */
/* ساخت دقیق MUSIC_FA و k موزیک از خود سورس (تا فیکس \s واقعاً تست شود) */
const mfaM = appSrc.match(/const MUSIC_FA = '([^']+)';/);
ok(!!mfaM, 'MUSIC_FA در app.js پیدا شد');
const MUSIC_FA = mfaM ? mfaM[1] : '';
ok(MUSIC_FA.includes('[\\\\s'), 'MUSIC_FA فیکس \\s را دارد (سورس: [\\s\u200C] نه \s?): ' + MUSIC_FA.slice(0, 60));
ok(!MUSIC_FA.includes('\\s?['), 'MUSIC_FA الگوی شکستهٔ قدیمی ندارد');

const RULES = [
  { k: new RegExp(`(?:${MUSIC_FA})[^.]{0,16}(پاز|توقف|نگه[\\s\u200C]?دار|قطع|استاپ|استپ|ساکت|ببند|stop|pause)|(پاز|stop|pause|ببند)[^.]{0,10}(?:${MUSIC_FA})`, 'i'), id: 'music_pause' },
  { k: new RegExp(`(?:پخش|بزن|پلی|شروع|play)[^.]{0,10}(?:${MUSIC_FA})|(?:${MUSIC_FA})[^.]{0,14}(پخش|بزن|پلی|شروع|play)`, 'i'), id: 'music_play' },
  { k: /(یوتیوب|youtube)[^.]{0,24}(شناور|فیپ)|شناور[^.]{0,14}(یوتیوب|youtube)|floating\s+youtube|youtube\s+pip/i, id: 'pip_youtube' },
  { k: /(?=.*(یوتیوب|youtube))(?=.*(جستجو|سرچ|سیرچ|بگرد|پخش|پلی\s?کن|بزن|بذار|آهنگ|ترانه|ویدیو|فیلم|search|find))/i, id: 'yt_search' },
  { k: /(یوتیوب|youtube|پخش|استریم)[^.]{0,12}(ببند|بس\s?بند|بس\s?کن|خاموش\s?کن|قطع\s?کن|استاپ|استوپ|پایان)|(ببندش?|خاموشش?\s?کن|قطعش?\s?کن|استاپش?|استوپش?)[^.]{0,12}(یوتیوب|youtube|پخش)|(از\s*)?(یوتیوب|youtube)[^.]{0,10}(بیرون|کافی)|close (the )?(youtube|player|stream)/i, id: 'yt_close' },
  { k: V.PIP_COMMAND_RE, id: 'pip' },
  { k: /کروم|مرورگر|chrome|browser/i, id: 'open_chrome' },
  { k: /یوتیوب|youtube/i, id: 'open_youtube' },
  { k: /موسیقی|آهنگ|موزیک|play music|play some music/i, id: 'open_music' },
  { k: /جستجو|سرچ|سیرچ|گوگل\s*(کن|بزن)?|google|پیداش\s*کن|search( for)?( the)? web|search$/i, id: 'web_search' },
  { k: /(سایت|وب\s?سایت)|https?:\/\//i, id: 'web_open' },
];
const win = (c) => { const a = I.arbitrate(c, RULES); return a ? a.rule.id : null; };

console.log('— ۱) نیت «بستن» —');
ok(win('یوتیوب رو ببند') === 'yt_close', '«یوتیوب رو ببند» → yt_close (قبلاً open_youtube بود!)');
ok(win('یوتیوب رو خاموش کن') === 'yt_close', '«یوتیوب رو خاموش کن» → yt_close');
ok(win('پخش رو ببند') === 'yt_close', '«پخش رو ببند» → yt_close');
ok(win('از یوتیوب بیا بیرون') === 'yt_close', '«از یوتیوب بیا بیرون» → yt_close');
ok(win('ببند یوتیوب رو') === 'yt_close', '«ببند یوتیوب رو» → yt_close');
ok(win('close the youtube player') === 'yt_close', 'انگلیسی: close the youtube player → yt_close');
ok(win('یوتیوب رو باز کن') === 'open_youtube', '«یوتیوب رو باز کن» → open_youtube (باز سالم)');
ok(win('برو یوتیوب') === 'open_youtube', '«برو یوتیوب» → open_youtube');
ok(win('موزیک رو باز کن') === 'open_music', '«موزیک رو باز کن» → open_music');
ok(win('ویدیو رو ببند') === 'pip', '«ویدیو رو ببند» → pip (فیکس v0.40 سالم — UNPIN شناور)');
ok(win('فیلم یا ویدیو رو ببند') === 'pip', '«فیلم یا ویدیو رو ببند» → pip');

console.log('— ۲) بستن/توقف موزیک —');
ok(win('موزیک رو قطع کن') === 'music_pause', '«موزیک رو قطع کن» → music_pause');
ok(win('موزیک رو ببند') === 'music_pause', '«موزیک رو ببند» → music_pause (منفی‌های open_music)');
ok(win('آهنگ رو نگه دار') === 'music_pause', '«آهنگ رو نگه دار» → music_pause (فیکس \\s — قبلاً هیچ!)');
ok(win('آهنگ رو پاز کن') === 'music_pause', '«آهنگ رو پاز کن» → music_pause');
ok(win('آهنگ شادمهر رو پخش کن') === 'music_play', '«آهنگ شادمهر رو پخش کن» → music_play');

console.log('— ۳) رگرسیون داوری v0.43/0.44 —');
ok(win('توی یوتیوب برام آهنگ شادمهر پلی کن') === 'yt_search', 'رگرسیون: yt_search یوتیوب+آهنگ');
ok(win('گوگل کروم رو برام باز کن') === 'open_chrome', 'رگرسیون: open_chrome');
ok(win('یوتیوب شناور آهنگ دیوونه شو بذار') === 'pip_youtube', 'رگرسیون: pip_youtube');
ok(win('میخوام دستورات مربوط به یوتیوب رو ببینم') !== 'open_youtube', 'رگرسیون: ممنوعهٔ دستورات');
ok(win('توی یوتیوب آهنگ شادمهر پلی کن') === 'yt_search', 'رگرسیون v0.43: پخش یوتیوب نه موزیک محلی');

/* ---------- ۴) موزیک آگاه‌به‌آهنگ — استخراج musicReqOf از سورس ---------- */
const mrqM = appSrc.match(/function musicReqOf\(c\) \{[\s\S]*?\n  \}/);
ok(!!mrqM, 'musicReqOf در app.js هست');
if (mrqM) {
  const musicReqOf = new Function('return (' + mrqM[0].replace(/^function musicReqOf/, 'function') + ')')();
  ok(musicReqOf('آهنگ شادمهر رو پخش کن') === 'شادمهر', 'musicReqOf: «آهنگ شادمهر رو پخش کن» → «شادمهر» (گرفت: ' + musicReqOf('آهنگ شادمهر رو پخش کن') + ')');
  ok(musicReqOf('پخش کن دیوونه شو از شادمهر') === 'دیوونه شو از شادمهر', 'musicReqOf: فعل اول جمله');
  ok(musicReqOf('ترانه تبریز رو بزن') === 'تبریز', 'musicReqOf: «ترانه تبریز رو بزن» → «تبریز»');
  ok(musicReqOf('آهنگ رو پخش کن') === '', 'musicReqOf: بدون اسم → «» (رفتار فعلی: پخش همان)');
  ok(musicReqOf('موزیک') === '', 'musicReqOf: تک‌واژهٔ شیء → «»');
  ok(musicReqOf('تو یوتیوب آهنگ شادمهر رو پخش کن') === 'شادمهر', 'musicReqOf: یوتیوب حذف می‌شود');
}
ok(appSrc.includes('function voiceMusicPlay(cmd)'), 'voiceMusicPlay جمله را می‌گیرد');
ok(appSrc.includes('r: (c) => voiceMusicPlay(c)'), 'قانون music_play جمله را پاس می‌دهد');
ok(appSrc.includes('if (aiConnected()) return AI_FALLBACK;') && appSrc.includes('توی کتابخانهٔ موزیک محلی نیست'), 'موزیک: آهنگِ نیست → AI یا پاسخ صادق');

/* ---------- ۵) فیکس ریشه‌ای \s در رشته‌های JS ---------- */
ok(appSrc.includes('نگه[\\\\s') || appSrc.includes("نگه[\\\\s\\u200C]?دار"), 'music_pause k: نگه[\\s‌]?دار در سورس (نه نگهs?دار)');

/* ---------- ۶) پاسخ صادق در شکست ---------- */
ok(appSrc.includes("«${rule.t || 'این درخواست'}» انجام نشد"), 'resolveReply: متن شکست صادق با نام کار');
ok(appSrc.includes("Couldn't do it: ${rule.t || 'the request'}"), 'resolveReply EN: honest fail');
ok(/catch \(_\) \{\s*\n\s*rcTag\.textContent = t\('tag\.fail'\);\s*\n\s*\/\* v0\.45 — پاسخ صادق در خطای اجرا/.test(appSrc), 'resolveReply: خطای پرتاب هم پاسخ صادق دارد');
ok(appSrc.includes("ai map cache dropped (failed run)") && appSrc.includes("!/انجام نشد|Couldn't/.test(out)"), 'نگاشت کش‌شدهٔ AI: شکست صادق + نگاشت خراب حذف می‌شود');
ok(!appSrc.includes("const fin = (typeof out === 'string' && out) ? out : (LANG === 'en' ? 'Done.' : 'انجام شد.');"), 'نگاشت کش‌شده: دروغ قدیمی حذف شد');

/* ---------- ۷) دروازهٔ فهم-اول وبی ---------- */
ok(appSrc.includes('AVAUnderstand.blocksBlindAction(_und, rule.id, targetResolvableWebSync)'), 'گیت v0.45: رزول‌شدنی وبی وصل است');
ok(appSrc.includes('function targetResolvableWebSync'), 'targetResolvableWebSync تعریف شده');
/* شبیه‌سازی: تلگرام فقط اپ است (وبی نیست) — برای قانون وب باید بلاک شود */
const webOnly = (t) => /دیجی کالا|گوگل/.test(t);
const uTel = U.analyze('توی تلگرام دنبال پیام بگرد');
ok(uTel && uTel.target && uTel.target.clean === 'تلگرام', 'هدف: «توی تلگرام دنبال پیام بگرد» → تلگرام');
ok(U.blocksBlindAction(uTel, 'web_search', webOnly) === true, 'تلگرام (فقط-اپ) + web_search → بلاک → AI');
const uDig = U.analyze('توی دیجی کالا دنبال ساعت بگرد');
ok(U.blocksBlindAction(uDig, 'site_search', webOnly) === false, 'دیجی‌کالا (سایت) → مسیر بومی، بلاک نمی‌شود');
ok(appSrc.includes("if (/^(www\\.)?google\\./.test(host)) return 'https://www.google.com/search?q=' + enc;"), 'siteSearchUrlFor: گوگل = جستجوی گوگل (نه site:google.com)');

/* ---------- ۸) IPC بستن یوتیوب ---------- */
ok(mainSrc.includes("ipcMain.handle('yt:close'"), 'main.js: yt:close');
ok(mainSrc.includes("ipcMain.handle('yt:status'"), 'main.js: yt:status');
ok(mainSrc.includes('function ytWatchClose') && mainSrc.includes('function ytWatchStatus'), 'main.js: توابع بستن/وضعیت');
ok(preSrc.includes("close: () => ipcRenderer.invoke('yt:close')"), 'preload: yt.close');
ok(preSrc.includes("status: () => ipcRenderer.invoke('yt:status')"), 'preload: yt.status');
ok(appSrc.includes('async function ytCloseReply'), 'app.js: ytCloseReply');
ok(appSrc.includes("bridge.yt.close()") && appSrc.includes("bridge.yt.status()"), 'app.js: ترتیب بستن (یوتیوب → PiP → صادق)');
ok(/id: 'yt_close', t: 'بستن پخش'/.test(appSrc), 'app.js: قانون yt_close ثبت شده');

/* ---------- ۹) سبک‌سازی RAM دور ۲ — وب‌ویو GLM تنبل ---------- */
ok(idxSrc.includes('data-src="https://chat.z.ai/"'), 'index.html: webview با data-src (تنبل)');
ok(!idxSrc.match(/<webview[^>]*\ssrc="https:\/\/chat\.z\.ai/), 'index.html: وب‌ویو دیگر در بوت لود نمی‌شود');
ok(appSrc.includes('function ensureZaiWebLoaded'), 'app.js: ensureZaiWebLoaded');
ok(appSrc.includes("if (zai) { ensureZaiWebLoaded(); setTimeout(() => checkZaiToken(), 1200); }"), 'app.js: تب GLM → لود تنبل + خواندن توکن');
ok(appSrc.includes("let zaiToken = store.get('zaiToken', '')"), 'app.js: توکن کش‌شده در بوت');
ok(appSrc.includes("store.set('zaiToken', zaiToken)"), 'app.js: ذخیرهٔ توکن موفق');
ok(mainSrc.includes("--max-old-space-size=512") && mainSrc.includes('lastLocalSttAt > 10 * 60 * 1000'), 'RAM دور ۱ سالم (هیپ + تخلیهٔ whisper)');

/* ---------- ۱۰) نسخه ---------- */
const pkg = JSON.parse(fs.readFileSync(path.join(R, 'package.json'), 'utf8'));
ok(/^0\.4[5-9]/.test(pkg.version), 'package.json version = 0.45+ (forward-relaxed)');
ok(/^0\.4[5-9]/.test((appSrc.match(/let appVersion = '([^']+)';/) || [])[1] || ''), 'app.js appVersion = 0.45+ (forward-relaxed)');
ok(idxSrc.includes('voiceUnderstand.js') && /voiceIntent\.js[\s\S]*?voiceUnderstand\.js[\s\S]*?app\.js/.test(idxSrc), 'index.html: ترتیب ماژول‌ها');

console.log(`\nv0.45 logic overhaul: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
