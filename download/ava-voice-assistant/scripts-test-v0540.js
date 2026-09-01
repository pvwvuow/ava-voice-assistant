#!/usr/bin/env node
/* scripts-test-v0540.js — doctest v0.57.0-beta
   بازخورد کاربر: «منطقش داشت خوب کار می‌کرد (قشنگترین گناه واقعاً بود و جمینای
   تحقیق کرد و عمل کرد) — ولی هنوز بعضی جاها مشکل داریم»
   سند لاگ v0.53 (bmtiwdla0nqyz):
     16:45:15 «خب همینو برام تو یوتیوب پلی کن»        → yt_play q=«همینو» (زباله!)
     16:46:30 «خوب همون آهنگ جدیدشو برام یوتیوب پلی کن» → yt_play q=«همون آهنگ جدیدشو»
     16:49:21 «خب اونو برام تو یوتیوب سرچ کن»          → yt_search q=«اونو»
     16:48:17/16:49:48 «…همین آهنگو…» / «…مگم همینو…» → learn set زباله open_url(youtube.com/result)
   چک‌ها:
     1) گیت — کلاس «مفعولِ ارجاعی» (رفتار واقعی voiceIntent.js در vm)
     2) ytQueryOf هرگز ارجاعِ لخت برنمی‌گرداند
     3) DO جدید yt_search (واژگان + اجراکننده + قانون FA/EN)
     4) قانون ۱۰ بازنویسی‌شده (اول تاریخچه، بعد اکشن؛ مجوزِ رد کردن نیست)
     5) گارد یادگیری بازشده (همین/این/اون هم — رفتار واقعی regex)
     6) نسخه 0.57.0-beta
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

const intentSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/voiceIntent.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/app.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

/* voiceIntent.js را در vm واقعاً اجرا کن (module.exports مسیر node) */
const sb = { module: { exports: {} }, console };
vm.createContext(sb);
vm.runInContext(intentSrc, sb);
const VI = sb.module.exports;
ok(!!VI && typeof VI.gateReason === 'function', 'voiceIntent در vm بارگذاری شد (gateReason موجود)');

console.log('\n[1] گیت — کلاس «مفعولِ ارجاعی» (سه نشت واقعی لاگ v0.53 باید بسته باشند)');
ok(VI.gateReason('خب همینو برام تو یوتیوب پلی کن', 'yt_play') === 'ref-obj', '«خب همینو… پلی کن» → yt_play بلاک (ref-obj)');
ok(VI.gateReason('خوب همون آهنگ جدیدشو برام یوتیوب پلی کن', 'yt_play') === 'ref-obj', '«همون آهنگ جدیدشو…» → yt_play بلاک');
ok(VI.gateReason('خب اونو برام تو یوتیوب سرچ کن', 'yt_search') === 'ref-obj', '«خب اونو… سرچ کن» → yt_search بلاک');
ok(VI.gateReason('اینو برام تو گوگل سرچ کن', 'web_search') === 'ref-obj', '«اینو… سرچ کن» → web_search بلاک');
ok(VI.gateReason('همین آهنگو برام پخش کن', 'music_play') === 'ref-obj', '«همین آهنگو… پخش کن» → music_play بلاک');
ok(VI.gateReason('همینو تو یوتیوب باز کن', 'open_youtube') === 'ref-obj', '«همینو تو یوتیوب باز کن» → open_youtube بلاک');
ok(VI.blocksActionRule('خب همینو برام تو یوتیوب پلی کن', 'yt_play') === true, 'blocksActionRule=true (مسیر AI نه اجرای کور)');

console.log('\n[2] گذرنامه‌ها سالم‌اند (رجرسی نکنیم!)');
ok(VI.gateReason('آهنگ دیوونه از شادمهر رو تو یوتیوب پلی کن', 'yt_play') === '', '«آهنگ دیوونه از شادمهر… پلی کن» → اجرای سریع مجاز');
ok(VI.gateReason('بی احساس از شادمهر رو پلی کن', 'yt_play') === '', '«بی احساس از شادمهر…» → مجاز');
ok(VI.gateReason('یوتیوب باز کن', 'open_youtube') === '', '«یوتیوب باز کن» → مجاز');
ok(VI.gateReason('همینو پاز کن', 'music_pause') === '', '«همینو پاز کن» → قانون بی‌مفعول exempt (مجاز)');
ok(VI.gateReason('موزیک بعدی', 'music_next') === '', '«موزیک بعدی» → مجاز (رجرسی نه)');
ok(VI.gateType('مطمئنی اسم آهنگ جدید شادمهر نازنین') === 'certainty', 'رجرسی: certainty سرجایش');
ok(VI.gateType('نه ببین از بی احساس جدیدترم خونده') === 'correction', 'رجرسی: تصحیح سرجایش');

console.log('\n[3] ytQueryOf — ارجاعِ لخت هرگز عبارت جستجو نیست');
ok(VI.ytQueryOf('خب همینو برام تو یوتیوب پلی کن') === '', 'ytQueryOf(«خب همینو… پلی کن») → \'\'');
ok(VI.ytQueryOf('همینو پلی کن') === '', 'ytQueryOf(«همینو پلی کن») → \'\'');
ok((VI.ytQueryOf('تو یوتیوب دیوونه شادمهر رو سرچ کن') || '').includes('دیوونه'), 'کنترل مثبت: عنوان واقعی استخراج می‌شود');

console.log('\n[4] DO جدید yt_search — واژگان + اجراکننده + قانون');
ok(appSrc.includes("const DO_ACTS = ['open_app', 'open_url', 'web_search', 'yt_search', 'vol_up',"), 'DO_ACTS +yt_search');
ok(appSrc.includes("case 'yt_search': {") && appSrc.includes("bridge.system.run('youtube_search', yq)"), 'اجراکننده: کانال بومی youtube_search');
ok(appSrc.includes("'- yt_search: value=عنوانِ دقیق برای جستجو در یوتیوب"), 'FA: توضیح act در پرامپت');
ok(appSrc.includes('yt_search(value=the exact title to search on YouTube'), 'EN: توضیح act در پرامپت');
ok(appSrc.includes('هرگز open_url با آدرسِ دست‌ساز مثل youtube.com/result نده'), 'FA: ممنوعیت open_url دست‌ساز');

console.log('\n[5] قانون ۱۰ بازنویسی‌شده (اول تاریخچه → بعد اکشن؛ مجوزِ رد کردن نیست)');
ok(appSrc.includes('مرجع را اول از «تاریخچهٔ همین گفتگو» بردار'), 'FA: اول تاریخچه');
ok(appSrc.includes('بعد از حلِ مرجع حتماً اکشن بده'), 'FA: بعد از حل، حتماً اکشن (نه رد کردن)');
ok(appSrc.includes('این قانون هرگز مجوزِ رد کردن یا بی‌جواب گذاشتنِ خواستهٔ کاربر نیست'), 'FA: مجوزِ رد کردن نیست');
ok(appSrc.includes('resolve the reference FIRST from the chat history'), 'EN: history first');
ok(appSrc.includes('This rule never justifies refusing or ignoring the user request'), 'EN: never refuses');

console.log('\n[6] گارد یادگیری بازشده — رفتار واقعی regex (vm)');
const g1 = appSrc.indexOf('if (/(همون|همین');
ok(g1 > 0, 'regex گارد پیدا شد');
let LEARN_RE = null;
if (g1 > 0) {
  const start = appSrc.indexOf('/', g1);
  LEARN_RE = eval(appSrc.slice(start, appSrc.indexOf('/', appSrc.indexOf('/', start) + 1) + 1));
}
if (LEARN_RE) {
  ok(LEARN_RE.test('تو یوتیوب همین آهنگو سرچ کن') === true, '«تو یوتیوب همین آهنگو سرچ کن» → learn skip (لاگ 16:48:17)');
  ok(LEARN_RE.test('خوب میگه میگم همینو برام تو یوتیوب سرچ کن') === true, '«…مگم همینو برام…» → learn skip (لاگ 16:49:48)');
  ok(LEARN_RE.test('خوب همون آهنگ شادمهری که آخرین بار برای من سرچ کردی اگه میشه') === true, 'جملهٔ ارجاعی v0.52 → learn skip');
  ok(LEARN_RE.test('آخرین اخبار فارس‌نیک رو نشون بده') === false, '«آخرین اخبار…» فرمان پایدار است — یادگیری مجاز');
  ok(LEARN_RE.test('پلی کن آهنگ دیوونه از شادمهر') === false, 'فرمان عادی با عنوان واقعی — یادگیری مجاز');
} else {
  ok(false, 'regex گارد استخراج نشد');
}
ok(appSrc.includes("actLog('learn skip: جملهٔ ارجاعی به تاریخچه — قابل بازپخش آفلاین نیست: '"), 'لاگ صادقانهٔ learn skip');

console.log('\n[7] نسخه 0.57.0-beta');
ok(appSrc.includes("let appVersion = '0.57.0-beta';"), 'app.js: 0.57.0-beta');
ok(pkg.version === '0.57.0-beta', 'package.json: 0.57.0-beta');
ok(htmlSrc.includes('<span id="abVersion">v0.57.0-beta</span>'), 'index.html: v0.57.0-beta');
ok(readme.includes('۰.۵۷.۰-بتا') && readme.includes('مفعولِ ارجاعی'), 'README: ۰.۵۷.۰-بتا (بلوک ۰.۵۴ در تاریخچه مانده)');

console.log('\n-----------------------------');
console.log(`RESULT: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
