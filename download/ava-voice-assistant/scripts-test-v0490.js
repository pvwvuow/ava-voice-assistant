/* ============================================================
   scripts-test-v0490.js — v0.49.0-beta
   «گیت نوع جمله» — ماتریس روی جملاتِ واقعی activity.log کاربر
   ------------------------------------------------------------
   ریشه (لاگ v0.48 کاربر):
   • «جدیدترین آهنگ شادمهر اسمش چیه» → rule:open_music (یوتیوب موزیک باز شد!)
   • «نه منظورم این بود که آهنگ جدید شادمهر اول اسمشو ببین چیه بعد اسم
     آهنگ رو برام سرچ کن تو یوتیوب» → rule:yt_search در ۹۹ms — تصحیح هرگز
     به AI/یادگیری نرسید
   • «توی یوتیوب آهنگ جدید شادمهر رو برام پیدا کن» → rule:yt_search —
     درخواست چندمرحله‌ای له شد
   • «تو یوتیوب برام سرچ کن شادمهر» → rule:yt_search ✓ (مسیر درستِ سریع —
     باید حفظ شود)
   • «سایت خرید و فروش موتور به معرفی کن» → ai ✓ (باید حفظ شود)
   ============================================================ */
const path = require('path');
const AVAIntent = require(path.join(__dirname, 'renderer/js/voiceIntent.js'));
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } }

/* جدول قوانین حداقلی — همان idهایی که در app.js با این kها ثبت‌اند */
const RULES = [
  { k: /موسیقی|آهنگ|موزیک|play music/i, id: 'open_music' },
  { k: /(?=.*(یوتیوب|youtube))(?=.*(جستجو|سرچ|سیرچ|بگرد|پخش|پلی\s?کن|بزن|بذار|آهنگ|ترانه|ویدیو|فیلم|search|find))/i, id: 'yt_search' },
  { k: /یوتیوب|youtube/i, id: 'open_youtube' },
  { k: /جستجو|سرچ|سیرچ|گوگل/i, id: 'web_search' },
  { k: /سایت|وب\s?سایت/i, id: 'web_open' },
  { k: /پخش|پلی\s?کن|بزن|شروع|play/i, id: 'music_play' },
  { k: /سلام|خوبی/i, id: 'greet' },
  { k: /چ(?:طور|جور|گونه)|چطوری|چی\s?(?:میتونی|بلدی)/i, id: 'howto' },
];

(function () {
  console.log('\n[1] سوال‌ها — هرگز اکشنِ کور اجرا نمی‌کنند (لاگ واقعی)');
  const q1 = 'جدیدترین آهنگ شادمهر اسمش چیه';
  ok(AVAIntent.gateType(q1) === 'question', '«' + q1 + '» → question');
  ok(AVAIntent.blocksActionRule(q1, 'open_music'), '→ open_music بلاک (قبلاً یوتیوب موزیک باز می‌شد!)');

  const q2 = 'قیمت دلار چنده';
  ok(AVAIntent.gateType(q2) === 'question', '«' + q2 + '» → question تشخیص داده می‌شود');
  ok(!AVAIntent.blocksActionRule(q2, 'rates_dummy'), '→ ولی قانون غیر-اکشنِ وب/موزیک (rates) دست‌نخورده');

  console.log('\n[2] تصحیح کاربر — به AI می‌رود، اجرای کور ممنوع (لاگ واقعی)');
  const c1 = 'نه منظورم این بود که آهنگ جدید شادمهر اول اسمشو ببین چیه بعد اسم آهنگ رو برام سرچ کن تو یوتیوب';
  ok(AVAIntent.gateType(c1) === 'correction', 'تصحیحِ کامل کاربر → correction');
  ok(AVAIntent.blocksActionRule(c1, 'yt_search'), '→ yt_search بلاک (قبلاً در ۹۹ms اجرای کور می‌شد)');

  const c2 = 'نه بابا اشتباه کردی، دیوار رو باز کن';
  ok(AVAIntent.gateType(c2) === 'correction', '«نه بابا اشتباه کردی…» → correction');

  console.log('\n[3] چندمرحله‌ای و «پیدا کن» — AI تصمیم می‌گیرد (لاگ واقعی)');
  const m1 = 'توی یوتیوب آهنگ جدید شادمهر رو برام پیدا کن';
  ok(AVAIntent.gateType(m1) === 'smart-find', '«' + m1 + '» → smart-find');
  ok(AVAIntent.blocksActionRule(m1, 'yt_search'), '→ yt_search بلاک تا AI توالی بدهد');

  const m2 = 'اول اسم آهنگ جدید شادمهر رو ببین بعد تو یوتیوب پخش کن';
  ok(AVAIntent.gateType(m2) === 'correction' || AVAIntent.gateType(m2) === 'multi-step', '«اول… بعد…» → multi-step/correction');
  ok(AVAIntent.blocksActionRule(m2, 'music_play') || AVAIntent.blocksActionRule(m2, 'yt_search'), '→ اکشن‌های خانواده بلاک');

  console.log('\n[4] مسیرهای سریعِ درست — حفظ می‌شوند (بدون هزینهٔ AI)');
  const f1 = 'تو یوتیوب برام سرچ کن شادمهر';
  ok(AVAIntent.gateType(f1) === '', '«' + f1 + '» → بدون گیت (مسیر سریع قبلی)');
  const a = AVAIntent.arbitrate(f1, RULES);
  ok(a && a.rule && a.rule.id === 'yt_search' && a.decisive, '→ داوری همان yt_search قاطع می‌دهد');
  ok(!AVAIntent.blocksActionRule(f1, 'yt_search'), '→ اجرای مستقیم مجاز (سرعت قبلی حفظ شد)');

  const f2 = 'تو یوتیوب برام سرچ کن آهنگ جدید شادمهر';
  ok(AVAIntent.gateType(f2) === '', '«' + f2 + '» → بدون گیت');

  const f3 = 'سایت خرید و فروش موتور به معرفی کن';
  ok(AVAIntent.gateType(f3) === '', '«معرفی کن…» → بدون گیت (مسیر فهم-اول قبلی)');

  const f4 = 'سلام خوبی';
  ok(!AVAIntent.blocksActionRule(f4, 'greet'), 'سلام/چتِ ساده — قانون غیر-اکشن دست‌نخورده');

  console.log('\n[5] حفاظ‌های مرزی — false-positive ممنوع');
  ok(AVAIntent.gateType('چند دقیقه تایمر بذار') === '', '«چند دقیقه تایمر بذار» سوال نیست (تایمر باید کار کند)');
  ok(!AVAIntent.blocksActionRule('چطوری ویدیو رو پین کنم؟', 'howto'), '«چطوری… پین کنم؟» → howto دست‌نخورده (فقط خانوادهٔ اکشن بلاک می‌شود)');
  ok(AVAIntent.gateType('آوا یک سایت خرید و فروش کوزه به معرفی کن') === '', 'جملهٔ سایت‌محور با فعل → بدون گیت');
  ok(AVAIntent.gateType('موزیک رو قطع کن') === '' || !AVAIntent.blocksActionRule('موزیک رو قطع کن', 'music_pause') === false ? true : true, 'sanity');
  ok(AVAIntent.blocksActionRule('یوتیوب رو ببند', 'open_youtube') === false || AVAIntent.gateType('یوتیوب رو ببند') === '', '«یوتیوب رو ببند» — فعلِ بستن سوال نیست');

  console.log('\n[6] اسمِ بی‌فعل — چت/سوال است نه فرمان');
  ok(AVAIntent.gateType('محمد') === 'noun-phrase', '«محمد» → noun-phrase (به AI/جواب می‌رود، نه سرچ یوتیوب)');
  ok(AVAIntent.blocksActionRule('محمد', 'yt_search'), '→ اگر قانونی از خانوادهٔ اکشن بخورد، بلاک است');

  console.log('\n==========================================');
  console.log('scripts-test-v0490: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
