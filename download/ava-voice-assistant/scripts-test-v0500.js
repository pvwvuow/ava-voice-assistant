/* ============================================================
   scripts-test-v0500.js — v0.50.0-beta
   «هوشِ کامل‌تر تفسیر + یادگیریِ خودی» — ماتریس روی جملات واقعی
   activity.log کاربر (جلسهٔ v0.49.0-beta، boot=bmtipve1od5t1)
   ------------------------------------------------------------
   ریشه‌ها (لاگ واقعی):
   • خط ۱۶۲۵: «خوب همین آهنگ جدید شادمهر که چند لحظه پیش بهم گفتی چی بود
     را همون اسمو سرچ کن تو یوتیوب» → rule:yt_search در ۹۷ms — کل جمله در
     یوتیوب سرچ شد (کاربر: «فقط چون آخرش گفتم یوتیوب، کل جمله سرچ می‌شه»)
   • خط ۱۶۱۴: «آهنگ جدید شادمهر تو یوتیوب برام پلی کن» → فقط صفحهٔ نتایج
     باز شد؛ پلی یعنی پخش!
   • خط ۱۵۸۴: AI لینک توهمی divar.ir/s/bojnurd/mot ساخت (۴۰۴ واقعی) و
     همان یاد گرفته شد؛ قالب درست divar.ir/s/{شهر-لاتین}?q=… است (۲۰۰ OK)
   • مچ آفلاین فقط لوانشتین بود — «کمی فرق‌دار گفت» مچ نمی‌شد
   ============================================================ */
const path = require('path');
const fs = require('fs');
const AVAIntent = require(path.join(__dirname, 'renderer/js/voiceIntent.js'));
const AVASites = require(path.join(__dirname, 'renderer/js/voiceSites.js'));
const AVALearn = require(path.join(__dirname, 'renderer/js/voiceLearn.js'));
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } }

/* جدول قوانین حداقلی — همان idها/kهای واقعی app.js */
const RULES = [
  { k: /موسیقی|آهنگ|موزیک|play music/i, id: 'open_music' },
  { k: /(?=.*(یوتیوب|youtube))(?=.*(پلی\s?کن|پخش\s?کن|پخشش\s?کن|پلاش\s?کن|بذار\s?(پخش|بزن)))/i, id: 'yt_play' },
  { k: /(?=.*(یوتیوب|youtube))(?=.*(جستجو|سرچ|سیرچ|بگرد|پخش|پلی\s?کن|بزن|بذار|آهنگ|ترانه|ویدیو|فیلم|search|find))/i, id: 'yt_search' },
  { k: /یوتیوب|youtube/i, id: 'open_youtube' },
  { k: /جستجو|سرچ|سیرچ|گوگل/i, id: 'web_search' },
  { k: /پخش|پلی\s?کن|بزن|شروع|play/i, id: 'music_play' },
];

(function () {
  console.log('\n[1] استخراج عبارت — جملات واقعی لاگ کاربر (ytQueryOf v2)');
  ok(AVAIntent.ytQueryOf('آهنگ جدید شادمهر تو یوتیوب برام پلی کن') === 'آهنگ جدید شادمهر',
    '«آهنگ جدید شادمهر تو یوتیوب برام پلی کن» → «آهنگ جدید شادمهر» (لاگ ۱۶۱۴)');
  ok(AVAIntent.ytQueryOf('خوب همین آهنگ جدید شادمهر که چند لحظه پیش بهم گفتی چی بود را همون اسمو سرچ کن تو یوتیوب') === 'آهنگ جدید شادمهر',
    'جملهٔ ارجاعی لاگ ۱۶۲۵ → فقط «آهنگ جدید شادمهر» (نه کل جمله!)');
  ok(AVAIntent.ytQueryOf('تو یوتیوب برام سرچ کن شادمهر') === 'شادمهر', 'مسیر سریعِ درست حفظ شد');
  ok(AVAIntent.ytQueryOf('توی یوتیوب آهنگ جدید شادمهر رو برام پیدا کن') === 'آهنگ جدید شادمهر', '«پیدا کن» — لاگ v0.48');
  ok(AVAIntent.ytQueryOf('توی یوتیوب سرچ کن آهنگی که اسمش دیوونه شوه') === 'آهنگی که اسمش دیوونه شوه',
    '«که» در نامِ محتوا قربانی نمی‌شود');
  ok(AVAIntent.ytQueryOf('سرچ کن آهنگ دیوونه شو شادمهر') === 'آهنگ دیوونه شو شادمهر', 'عبارت با «که» بدون ارجاع دست‌نخورده');

  console.log('\n[2] گیت ارجاع (آنافور) — جمله‌های وابسته به گفتگوی قبل');
  const ctxSent = 'خوب همین آهنگ جدید شادمهر که چند لحظه پیش بهم گفتی چی بود را همون اسمو سرچ کن تو یوتیوب';
  ok(AVAIntent.gateType(ctxSent) === 'context', 'جملهٔ لاگ ۱۶۲۵ → context');
  ok(AVAIntent.blocksActionRule(ctxSent, 'yt_search') === true, '→ yt_search بلاک است؛ با تاریخچهٔ چت به AI می‌رود');
  ok(AVAIntent.gateType('همون قبلی رو پخش کن') === 'context', '«همون قبلی رو پخش کن» → context');
  ok(AVAIntent.gateType('همین که گفتی') === 'context', '«همین که گفتی» → context');
  ok(AVAIntent.gateType('یوتیوب رو ببند') === '', 'FP-guard: «یوتیوب رو ببند» بدون گیت');
  ok(AVAIntent.gateType('چند دقیقه تایمر بذار') === '', 'FP-guard: تایمر بدون گیت');
  ok(AVAIntent.gateType('اسم آهنگ جدید شادمهر چیه') === 'question', 'FP-guard: سوال همچنان question');
  ok(AVAIntent.gateType('تو یوتیوب برام سرچ کن شادمهر') === '', 'FP-guard: مسیر سریع درست بدون گیت');

  console.log('\n[3] پلی یعنی پخش — داوری yt_play بر yt_search (لاگ ۱۶۱۴)');
  const arbPlay = AVAIntent.arbitrate('آهنگ جدید شادمهر تو یوتیوب برام پلی کن', RULES);
  ok(arbPlay && arbPlay.rule.id === 'yt_play' && arbPlay.decisive, '«پلی کن» → yt_play قاطع (پخش واقعی اولین ویدیو)');
  ok(AVAIntent.ytPlayVerb('آهنگ جدید شادمهر تو یوتیوب برام پلی کن') === true, 'فعل پخش تشخیص داده می‌شود');
  const arbSearch = AVAIntent.arbitrate('تو یوتیوب برام سرچ کن شادمهر', RULES);
  ok(arbSearch && arbSearch.rule.id === 'yt_search', '«سرچ کن» صریح → صفحهٔ نتایج (yt_search)');
  ok(AVAIntent.blocksActionRule('توی یوتیوب آهنگ شادمهر پخش کن', 'yt_play') === false, 'yt_play هم در خانوادهٔ گیت است ولی جملهٔ سالم بلاک نمی‌شود');
  ok(AVAIntent.blocksActionRule('خوب همین آهنگ که دیروز گفتی رو تو یوتیوب پخش کن', 'yt_play') === true, 'گیت روی yt_play هم اعمال است');

  console.log('\n[4] دیوار شهر-محور — ریشهٔ ۴۰۴ و «بجنورد→تهران» (لاگ ۱۵۸۴)');
  ok(AVASites.siteUrlFix('https://divar.ir/s/bojnurd/mot') === 'https://divar.ir/s/bojnurd?q=mot',
    'لینک توهمی AI (۴۰۴ واقعی) → قالب واقعی با حفظ شهر');
  ok(AVASites.siteUrlFix('https://divar.ir/s/bojnurd') === 'https://divar.ir/s/bojnurd', 'صفحهٔ شهرِ خالص دست‌نخورده');
  ok(AVASites.siteUrlFix('https://divar.ir/s/tehran?q=%D8%A2%D9%87%D9%86%DA%AF') === 'https://divar.ir/s/tehran?q=%D8%A2%D9%87%D9%86%DA%AF', 'لینک دارای q دست‌نخورده');
  ok(AVASites.siteUrlFix('https://divar.ir/s/tehran/vehicles') === 'https://divar.ir/s/tehran/vehicles', 'دستهٔ واقعی دیوار دست‌نخورده');
  ok(AVASites.siteUrlFix('https://divar.ir/s/%D8%A8%D8%AC%D9%86%D9%88%D8%B1%D8%AF/%D9%85%D9%88%D8%AA%D9%88%D8%B1') === 'https://divar.ir/s/bojnurd?q=' + encodeURIComponent('موتور'),
    'شهرِ فارسی در مسیر → اسلاگ لاتین + بدون انکود دومرتبه');
  ok(AVASites.citySlug('بجنورد') === 'bojnurd' && AVASites.citySlug('bojnurd') === 'bojnurd', 'نقشهٔ شهر: فارسی و لاتین');
  ok(AVASites.citySlug('بجران') === 'bojnurd', 'غلط تایپی رایج STT (بجران/بجنورد) پوشیده شده');
  ok(AVASites.siteUrlFix('https://www.sheypoor.com/%D9%85%D9%88%D8%AA%D9%88%D8%B1') === 'https://www.sheypoor.com/search?q=' + encodeURIComponent('موتور'), 'شیپور: decode + انکود یک‌باره');
  ok(AVASites.siteUrlFix('https://example.com/x') === 'https://example.com/x', 'میزبان خارج از رجیستری → عبور');

  console.log('\n[5] یادگیری معنایی — بازپخش آفلاینِ «کمی فرق‌دار» + نمونه‌ها برای AI');
  const store = { v: 1, items: [] };
  AVALearn.learn(store, 'حالا توی دیوار برای شهر بجنورد سرچ کن موتور', [{ act: 'open_url', value: 'https://divar.ir/s/bojnurd?q=' + encodeURIComponent('موتور') }], '');
  const hit = AVALearn.match(store, 'تو دیوار شهر بجنورد موتور سرچ کن');
  ok(!!hit, '«تو دیوار شهر بجنورد موتور سرچ کن» → مچِ معنایی آفلاین (بدون Gemini)');
  ok(!AVALearn.match(store, 'چند دقیقه تایمر بذار'), 'بی‌ربط → بدون مچ (اقدام حدسی ممنوع)');
  ok(!AVALearn.match(store, 'یوتیوب رو باز کن'), 'بی‌ربط ۲ → بدون مچ');
  const ex = AVALearn.examplesForAi(store, 'توی دیوار شهر تبریز بگرد اتو بخار', 5);
  ok(ex.length >= 1 && ex[0].say.indexOf('دیوار') >= 0 && ex[0].do.indexOf('open_url') === 0,
    'examplesForAi: آیتم دیوار اولِ لیست نمونه‌ها برای AI');

  console.log('\n[6] سیم‌کشی سورس — نشانگرهای ساختاری');
  const appSrc = fs.readFileSync(path.join(__dirname, 'renderer/js/app.js'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  const idxSrc = fs.readFileSync(path.join(__dirname, 'renderer/index.html'), 'utf8');
  ok(appSrc.includes("id: 'yt_play'") && appSrc.includes("run: 'youtube_play'"), 'قانون yt_play در app.js');
  ok(appSrc.includes('learnedExamplesCtx') && appSrc.includes('examplesForAi'), 'نمونه‌های آموخته به ctx پرامپت AI می‌چسبد');
  ok(/safeActs\(acts\)\.map/.test(appSrc) && appSrc.includes('یادگیریِ URL «اصلاح‌شده»'), 'یادگیری از URL اصلاح‌شده (نه توهم AI)');
  ok(appSrc.includes('divar.ir/s/{شهر-با-حروف-انگلیسی}?q='), 'قانون ۵ فارسی: قالب شهری دیوار');
  ok(appSrc.includes('divar.ir/s/{city-in-english}?q='), 'قانون ۵ انگلیسی: قالب شهری دیوار');
  ok(appSrc.includes('AVAIntent.ytQueryOf') && appSrc.includes('AVASites.siteUrlFix'), 'پل به ماژول‌های تست‌پذیر');
  ok(appSrc.includes("interpret: گفت"), 'ردِ گفت/فهمید در لاگ');
  ok(mainSrc.includes('youtube_play') && mainSrc.includes('ytFirstVideoId') && mainSrc.includes('videoId'), 'main.js: youtube_play + resolver ویدیوی اول');
  ok(mainSrc.includes('asyncCmd'), 'sys:run از سازندهٔ ناهمگام پشتیبانی می‌کند');
  ok(idxSrc.includes('js/voiceSites.js'), 'index.html: voiceSites.js قبل از app.js بارگذاری می‌شود');
  ok(!/ghp_[A-Za-z0-9]{20,}/.test(appSrc + mainSrc), 'امنیت: هیچ توکنی در سورس نیست');

  console.log('\n==========================================');
  console.log('scripts-test-v0500: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
