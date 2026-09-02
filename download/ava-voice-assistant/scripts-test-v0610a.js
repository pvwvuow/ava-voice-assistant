#!/usr/bin/env node
/* scripts-test-v0610a.js — v0.61 «هستهٔ فهم نسخهٔ ۲» — voiceCore.js
   ------------------------------------------------------------
   خواستهٔ صریح کاربر: «دونه‌دونه اشتباهات رو فیکس نکن؛ ببین چه
   الگوریتمی/ساختاری بسازی که این مشکلات پیش نیاد.»

   چهار ستون معماری جدید — هر ستون با کورپوس واقعی activity.log تست می‌شود:
   ستون ۱ — ContextStore: recordTurn/turnsCtx/entityCtx (حافظهٔ مشترک دو مغز)
   ستون ۲ — resolveRefs: «همینو/همون آهنگ/اون مدل» → تیتر واقعی (لاگ v0.53:
       «همینو» در یوتیوب سرچ شد / «همون مدل موتوری که گفتیم» گم شد)
   ستون ۳ — laneOf: دولاين instant/brain (لاگ: «ویدیو رو پلی کن» به pip خورد
       و ۶ ثانیه معطل AI شد؛ «هوای بجرا چطوره» به rule:date رفت)
   ستون ۴ — prepare: خروجی واحد + ناورستایی «دقیقاً یک لَین»
*/
const path = require('path');
const ROOT = __dirname;
const Core = require(path.join(ROOT, 'renderer/js/voiceCore.js'));

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}
function section(t) { console.log('\n' + t); }

/* ============ ستون ۲ — حل‌گر ارجاع (کورپوس واقعی لاگ) ============ */
section('[1] ستون ۲ — resolveRefs: آنافورِ لاگ واقعی حل می‌شود');
{
  Core.reset();
  /* لاگ v0.53 16:45 — «جدیدترین آهنگ شادمهر» پرسیده شد، پاسخ آوا «بی‌احساس» بود */
  Core.recordTurn({ utterance: 'جدیدترین آهنگ شادمهر اسمش چیه', via: 'ai', reply: '«بی‌احساس» جدیدترین آهنگ شادمهر است.' });
  Core.recordTurn({ utterance: 'خب همینو برام تو یوتیوب پلی کن', via: 'ai' });
  const r1 = Core.resolveRefs('خب همینو برام تو یوتیوب پلی کن');
  ok(r1.resolved.length >= 1, '«همینو» لخت حل می‌شود وقتی موجودیت هست');
  ok(/بی.?احساس|شادمهر/.test(r1.text), 'متن ترمیم‌شده تیتر واقعی را دارد → «' + r1.text.slice(0, 50) + '»');
  /* «همون آهنگ جدیدش» — لاگ 16:46 */
  const r2 = Core.resolveRefs('خوب همون آهنگ جدیدشو برام یوتیوب پلی کن');
  ok(!/^\s*خوب همون آهنگ/.test(r2.text) || r2.resolved.length >= 1, '«همون آهنگ» با موجودیت ترمیم می‌شود');
  /* «اونو برام تو یوتیوب سرچ کن» — لاگ 16:49 (قبلاً q=«اونو») */
  const r3 = Core.resolveRefs('خب اونو برام تو یوتیوب سرچ کن');
  ok(!/اونو/.test(r3.text) || r3.resolved.length >= 1, '«اونو» به تیتر تبدیل می‌شود');
  /* بدون هیچ حافظه: دست نمی‌زند ولی پرچم می‌گذارد */
  Core.reset();
  const r4 = Core.resolveRefs('همینو پخش کن');
  ok(r4.text === 'همینو پخش کن' && r4.unresolved === true, 'بدون موجودیت: متن دست‌نخورده + unresolved=true (به AI می‌رود نه اجرای کور)');
  /* «همون مدل موتوری» — لاگ 04:0x (گم‌شدن موضوع موتور) */
  Core.recordTurn({ utterance: 'جدیدترین مدل موتوری که اومد تو بازار چیه', via: 'ai', reply: 'مدل‌های تازه ۲۰۲۶ وارد بازار شدند.' });
  const r5 = Core.resolveRefs('احمق مدل موتوری که گفتیم رو تو گوگل سرچ کن');
  ok(r5.resolved.length >= 1 && /موتور|مدل/.test(r5.text), '«مدل موتوری که گفتیم» حل می‌شود');
}

/* ============ ستون ۱ — حافظهٔ گفتگو ============ */
section('[2] ستون ۱ — ContextStore: یک حافظه برای دو مغز');
{
  Core.reset();
  Core.recordTurn({ utterance: 'هوای بجنورد چطوره', via: 'rule', intent: 'weather' });
  Core.recordTurn({ utterance: 'تو یوتیوب آهنگ بی احساس رو سرچ کن', via: 'rule', intent: 'yt_search', params: { q: 'آهنگ بی احساس' } });
  const ec = Core.entityCtx();
  ok(/بجنورد/.test(ec), 'شهر از جملهٔ آب‌وهوا استخراج شد');
  ok(/بی\s?احساس/.test(ec), 'ویدیو/آهنگ از params سرچ یوتیوب ثبت شد');
  const tc = Core.turnsCtx(3);
  ok(tc.includes('کاربر: «هوای بجنورد چطوره»'), 'turnsCtx تاریخچهٔ خوانا برای AI می‌سازد');
  ok(Core._state.turns.length === 2, 'سقف نوردیشن رعایت می‌شود');
  Core.recordTurn({ utterance: 'x'.repeat(500), via: 'ai' });
  ok(Core._state.turns[0].u.length <= 200, 'utterance سقف ۲۰۰ کاراکتر (RAM امن)');
}

/* ============ ستون ۳ — مسیربینی دولاين ============ */
section('[3] ستون ۳ — laneOf: کورپوس instant/brain (از لاگ واقعی)');
{
  Core.reset();
  /* — instant: مجموعهٔ بسته (محلی، آنی، آفلاین‌ساز) — */
  const instant = [
    'صدا رو زیاد کن', 'ولوم رو کم کن', 'صدا رو قطع کن', 'صدا رو ۵۰ کن',
    'مدیا بعدی', 'پلیر رو پاز کن', 'ویدیو رو پلی کن', 'ویدیو رو فول اسکرین کن',
    'برو جلو ۳۰ ثانیه', 'آهنگ بعدی پلیر', 'چی داره پخش میشه',
    'بخواب', 'مانیتور رو خاموش کن', 'کامپیوتر رو خاموش کن', 'ریستارت کن', 'قفل صفحه کن',
    'تایمر ۵ دقیقه', 'یادم بنداز چای دم کن', 'اسکرین شات بگیر', 'وضعیت سیستم چطوره', 'باتری چنده', 'ساعت چنده',
    'اینجا بنویس سلام خسته نباشید', 'بنویس فردا ساعت ۵ جلسه داریم',
    'یوتیوب رو ببند', 'پخش رو قطع کن',
  ];
  let bad = [];
  for (const s of instant) { const L = Core.laneOf(s, { ai: true, apps: ['chrome', 'telegram'] }); if (L.lane !== 'instant') bad.push(s + '→' + L.lane + '/' + L.reason); }
  ok(bad.length === 0, 'همهٔ فرمان‌های بستهٔ سیستم instant هستند' + (bad.length ? ' — خراب‌ها: ' + bad.join(' | ') : ''));
  /* — brain: موضوع‌دار/متامیتنی (ریشهٔ اشتباه‌های لاگ) — */
  const brain = [
    'هوای بجرا چطوره',            /* قبلاً rule:date می‌شد! */
    'به نظرت امروز هوای بجنورد چطوره',
    'جدیدترین مدل موتوری که اومد تو بازار چیه',
    'تو گوگل سرچش کن پیداش کن',  /* «گوگل» ممنوعهٔ instant */
    'توی یوتیوب آهنگ شادمهر پلی کن',
    'چرا توی یوتیوب سرچ کردی',   /* تصحیح/سوال */
    'همون مدل رو سرچ کن',         /* ارجاع */
    'جدول لیگ اسپانیا رو میدی',   /* سوال */
    'سلام حالت چطوره خوبی',
  ];
  bad = [];
  for (const s of brain) { const L = Core.laneOf(s, { ai: true, apps: [] }); if (L.lane !== 'brain') bad.push(s + '→' + L.lane + '/' + L.reason); }
  ok(bad.length === 0, 'همهٔ جمله‌های موضوع‌دار brain هستند' + (bad.length ? ' — خراب‌ها: ' + bad.join(' | ') : ''));
  /* — باز کردن اپ معروف instant، اپ ناشناخته brain — */
  ok(Core.laneOf('تلگرام رو اجرا کن', { ai: true, apps: ['تلگرام', 'telegram', 'chrome'] }).lane === 'instant', 'اپ معروف نصب‌شده → instant (آنی)');
  ok(Core.laneOf('برنامهٔ فلان‌چیز رو باز کن', { ai: true, apps: ['telegram'] }).lane === 'brain', 'اپ ناشناخته → brain (AI تصمیم بگیرد)');
}

/* ============ ستون ۴ — ناورستایی واحد ============ */
section('[4] ستون ۴ — prepare: همیشه دقیقاً یک لَین');
{
  Core.reset();
  const corpus = ['صدا رو زیاد کن', 'هوای بجرا چطوره', 'همینو پخش کن', 'تلگرام رو باز کن', 'کار کنه', 'ویدیو رو پلی کن'];
  let allOk = true;
  for (const s of corpus) {
    const p = Core.prepare(s, { ai: true, apps: ['telegram'] });
    if ((p.lane !== 'instant' && p.lane !== 'brain') || typeof p.text !== 'string') allOk = false;
  }
  ok(allOk, 'prepare روی کل کورپوس فقط instant/brain برمی‌گرداند (دقیقاً یک تصمیم)');
  /* هسته نباید روی ورودی خراب بشکند */
  ok(Core.prepare('', {}) .lane === 'brain' && Core.prepare(null, {}).lane === 'brain', 'ورودی خالی/null → brain (بدون استثنا)');
  Core.recordTurn(null); Core.recordTurn({});
  ok(true, 'recordTurn با ورودی خراب نمی‌شکند');
}

/* ============ سازگاری با لایه‌های قدیمی ============ */
section('[5] سازگاری: voiceCore بدون وابستگی به Electron بارگذاری می‌شود');
ok(Core.normFa('ك') === 'ک' && Core.normFa('ي') === 'ی', 'normFa (ی/ک عربی→فارسی) کار می‌کند');
ok(Core.turnsCtx(0).length >= 0, 'turnsCtx بدون تاریخحه نمی‌شکند');

console.log('\n-----------------------------');
console.log(`RESULT: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
