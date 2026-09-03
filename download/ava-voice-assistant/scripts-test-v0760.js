#!/usr/bin/env node
/* v0.76.0-beta — «دونه‌دونه باگ‌های لاگ میدانی جدید» — عین صحنه‌های لاگ v0.72→v0.75:
   صحنهٔ 04:58:07 — آموزش مخاطب «ببین اسم مخاطبم تو دیسکورد mmd هست من محمد صداش میکنم
   هر موقع گفتم محمد باید به این ایدی پیام بدی اوکی؟» توسط لاین پیام‌رسانی ربوده شد
   (target=ایدی text=) و مخاطب هرگز ذخیره نشد.
   صحنهٔ 04:58:24 — «بگو سلام» → مغز confirm با name= و text= خالی صف کرد.
   صحنهٔ 04:58:38 — ارسالِ تأییدشده فقط [محمد] داشت → ERR:NOMATCH (mmd در واریانت‌ها نبود).
   صحنهٔ 04:59:00 — «خب چون باید mmd سرچ کنی تو دیسکورد احمق.یک بار دیگ تلاش کن» →
   هیچ اتفاقی نیفتاد و open_app(Discord) یاد گرفته شد (مسمومیت یادگیری ادامه داشت).
   صحنهٔ 19:34/21:10 — normFaFull شناسهٔ case-sensitive یوتیوب را خراب می‌کرد. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

const appSrc = read('renderer/js/app.js');
const msgSrc = read('renderer/js/voiceMessaging.js');
const coreSrc = read('renderer/js/voiceCore.js');
const brainSrc = read('renderer/js/voiceBrain.js');
const memSrc = read('renderer/js/voiceMemory.js');
const MS = require('./renderer/js/voiceMessaging.js');
const C = require('./renderer/js/voiceCore.js');
const B = require('./renderer/js/voiceBrain.js');
const M = require('./renderer/js/voiceMemory.js');

console.log('— ۱) باگ A — آموزش «اسم مخاطبم تو دیسکورد mmd هست من محمد صداش میکنم» (لاگ 04:58:07)');
{
  const s1 = 'ببین اسم مخاطبم تو دیسکورد mmd هست من محمد صداش میکنم هر موقع گفتم محمد باید به این ایدی پیام بدی اوکی؟';
  const t1 = MS.ctCmdParse(s1);
  ok(!!t1 && t1.op === 'save', 'جملهٔ mmd اکنون آموزشِ قطعی است → ' + JSON.stringify(t1));
  ok(!!t1 && t1.app === 'discord', 'اپ عیناً از جمله = discord → ' + JSON.stringify(t1 && t1.app));
  ok(!!t1 && t1.handle === 'mmd', 'هندل = mmd → ' + JSON.stringify(t1 && t1.handle));
  ok(!!t1 && t1.name === 'محمد', 'نامِ قبل از «صداش میکنم» = محمد → ' + JSON.stringify(t1 && t1.name));
  const t2 = MS.ctCmdParse('اسم مخاطبم تو دیسکورد ali_hk هست من علی صداش میکنم');
  ok(!!t2 && t2.op === 'save' && t2.handle === 'ali_hk' && t2.name === 'علی' && t2.app === 'discord', 'شکل دوم بدون جملهٔ هر موقع هم کار می‌کند → ' + JSON.stringify(t2));
  const t3 = MS.ctCmdParse('اسمش تو تلگرام pourya rahmani هست هر وقت گفتم پوریا اینو سرچ کن');
  ok(!!t3 && t3.op === 'save' && t3.name === 'پوریا' && t3.handle === 'pourya rahmani', 'بدون نام مستقل، مستعار نام می‌شود: پوریا → pourya rahmani → ' + JSON.stringify(t3));
  const d1 = MS.ctCmdParse('اسم مخاطبم رو حذف کن');
  ok(!d1 || d1.op !== 'save', 'گارد: «اسم مخاطبم رو حذف کن» ذخیره نیست → ' + JSON.stringify(d1));
  const g1 = MS.ctCmdParse('علی رو تو تلگرام با یوزر ali_gh ذخیره کن');
  ok(!!g1 && g1.op === 'save' && g1.handle === 'ali_gh', 'رگرسیون: شکل کلاسیک ذخیره سر جایش است');
}
console.log('— ۲) باگ A — گارد لَین آموزش «هر موقع گفتم» (TEACH_PATTERNS)');
{
  const s1 = 'ببین اسم مخاطبم تو دیسکورد mmd هست من محمد صداش میکنم هر موقع گفتم محمد باید به این ایدی پیام بدی اوکی؟';
  ok(B.isTeach(s1) === true, '«هر موقع گفتم محمد» → isTeach=true (قبلاً false بود)');
  ok(B.isTeach('از این به بعد هر وقت گفتم به میلاد پیام بده') === true, 'رگرسیون: «هر وقت گفتم» همچنان آموزش است');
  ok(B.isTeach('اسم مخاطبم تو دیسکورد هست') === true, '«اسم مخاطبم تو …» هم گارد آموزش را روشن می‌کند');
}
console.log('— ۳) باگ B — صفِ تأییدِ ناقص ممنوع (لاگ 04:58:24 «بگو سلام»)');
{
  ok(/v0\.76 — باگ لاگ 0\.75 \(04:58:24\)[\s\S]{0,600}contact_send incomplete/.test(appSrc), 'brainExecute گارد خالی contact_send دارد (کامنت v0.76)');
  ok(appSrc.indexOf("kind: 'clarify'") > 0 && appSrc.indexOf('به کی بفرستم؟') > 0, 'پاسخ صادقانهٔ «به کی بفرستم؟» در گارد هست');
  ok(appSrc.indexOf('_pendingConfirm = { action: c, at: Date.now(), cmd };') > appSrc.indexOf('contact_send incomplete'), 'صفِ confirm بعد از گارد خالی است (ترتیب درست)');
}
console.log('— ۴) باگ C — واریانت‌های brainSendResolved از بافت/حافظه (لاگ 04:58:38)');
{
  ok(/v0\.76 — باگ لاگ 0\.75 \(04:58:38\)[\s\S]{0,2000}brain-send variants/.test(appSrc), 'غنی‌سازی واریانت مغز در brainSendResolved هست');
  ok(/findFacts\(name, 4\)/.test(appSrc), 'فکت‌های حافظه در واریانت‌های مغز خوانده می‌شوند');
  ok(/entities\.note \|\| ''/.test(appSrc) && /entities\.person \|\| ''/.test(appSrc), 'موجودیت‌های مکالمه (note/person) در واریانت‌های مغز');
  ok(/faToLatin\(name\)/.test(appSrc), 'آوانگاری حدسی faToLatin در واریانت‌های مغز');
  ok(/msgRetryNote\(app, _appFa, name, text, name, _vs\)/.test(appSrc), 'NOMATCH مغز هم ریتری را مسلح می‌کند');
}
console.log('— ۵) باگ D — مسمومیت یادگیری (LEARN_COMPLAIN_RE ترمیم شد)');
{
  ok(C.LEARN_COMPLAIN_RE.test('دهن منو سرویس کردی ..وقتی میگم علی تو باید یوزرش رو سرچ کنی توی دیسکورد چرا نمیفهمی'), 'regex معیوب «دهن منو» حالا گیر می‌آید (لاگ 21:23)');
  ok(C.LEARN_COMPLAIN_RE.test('خب چون باید mmd سرچ کنی تو دیسکورد احمق.یک بار دیگ تلاش کن'), '«احمق/یک بار دیگ تلاش کن» گیر می‌آید (لاگ 04:59)');
  ok(C.LEARN_COMPLAIN_RE.test('نگفتم برام گوگل رو باز کنم گفتم خودت اسمشو بگو'), '«نگفتم…» (سرودنِ نفی) گیر می‌آید (لاگ 19:31)');
  ok(C.LEARN_COMPLAIN_RE.test('قرار بود diyko سرچ کنی تو دیسکورد'), '«قرار بود…» گیر می‌آید (لاگ 22:06)');
  ok(C.LEARN_COMPLAIN_RE.test('نمیخوام برام سرچ کنی خودت تحقیق کن'), '«نمیخوام…» گیر می‌آید (لاگ 20:27)');
  ok(!C.LEARN_COMPLAIN_RE.test('به علی تو دیسکورد پیام بده سلام'), 'رگرسیون: فرمان سالم گله نیست');
  ok(!C.LEARN_COMPLAIN_RE.test('آهنگ جدید شادمهر اسمش چیه'), 'رگرسیون: پرسش ساده گله نیست');
}
console.log('— ۶) باگ E — ریتری بعد از NOMATCH (لاگ 04:59)');
{
  ok(appSrc.indexOf('let _pendingMsgRetry') > 0 && appSrc.indexOf('MSG_RETRY_TTL') > 0, 'حالت ریتری + TTL تعریف شده');
  ok(appSrc.indexOf('function msgRetryNote') > 0 && appSrc.indexOf('async function msgRetryTry') > 0, 'msgRetryNote/msgRetryTry وجود دارند');
  ok(appSrc.indexOf('msgRetryNote(_mp.app, _mp.appFa, _mp.target, _mp.text, _name, _vs)') > 0, 'NOMATCH لاین قطعی ریتری را مسلح می‌کند');
  ok(appSrc.indexOf('if (_pendingMsgRetry) {') > 0 && appSrc.indexOf('const _rr = await msgRetryTry(raw);') > 0, 'لاین ریتری در runCommand سیم‌کشی شده');
  ok(appSrc.indexOf('if (_pendingMsgRetry) {') < appSrc.indexOf('lane=video-url'), 'لاین ریتری قبل از لاین‌های اجرایی است');
  ok(/msg-retry/.test(appSrc), 'تله‌متری via=msg-retry برای گزارش');
  ok(appSrc.indexOf('و «' + "' + pr.target + '" + '» رو با') > 0 || /ذخیره کردم/.test(appSrc), 'ذخیرهٔ خودکار مخاطب بعد از ریتری موفق');
}
console.log('— ۷) باگ F — حفظ case لینک در normFaFull (لاگ 19:34/21:10)');
{
  const m = appSrc.match(/function normFaFull\(s\) \{[\s\S]*?\n  \}/);
  ok(!!m, 'normFaFull در app.js پیدا شد');
  if (m) {
    let fn = null;
    try { fn = new Function('return (' + m[0].replace(/^function normFaFull/, 'function') + ')')(); } catch (e) { ok(false, 'eval normFaFull: ' + e.message); }
    if (fn) {
      const out1 = fn('https://www.youtube.com/watch?v=ulF0Tkqr7Q4 اینو برام پلی کن');
      ok(out1.indexOf('ulF0Tkqr7Q4') >= 0, 'شناسهٔ یوتیوب case خودش را نگه می‌دارد → ' + out1.slice(0, 60));
      ok(out1.indexOf('اینو برام پلی کن') >= 0, 'بخش فارسی همچنان نرمال می‌شود');
      const out2 = fn('چت با https://example.com/PATH?a=B رو باز کن');
      ok(out2.indexOf('/PATH?a=B') >= 0, 'URL دلخواه هم دست‌نخورده → ' + out2.slice(0, 60));
      const out3 = fn('سلام  علی');
      ok(out3 === 'سلام علی', 'رگرسیون: نرمالایز عادی سر جایش → ' + JSON.stringify(out3));
    }
  }
}
console.log('— ۸) باگ G — ددیپِ نزدیک فکت (لاگ 19:07 f3/f4 تکراری)');
{
  const mem = M.createMemory();
  mem.data.facts.length = 0; mem.data.seq = 1;
  const id1 = mem.addFact('نام انگلیسی پوریا، Pouria Rahmani است.');
  const id2 = mem.addFact('نام انگلیسی پوریا Pouria Rahmani است');
  ok(id1 && id2 === id1, 'فکتِ تقریباً یکسان دوباره ذخیره نمی‌شود → ' + String(id2));
  ok(mem.data.facts.length === 1, 'فقط یک فکت ماند → ' + mem.data.facts.length);
  const id3 = mem.addFact('رنگ ماشین من سفید است و مدل ۱۴۰۲ است');
  ok(id3 && id3 !== id1 && mem.data.facts.length === 2, 'رگرسیون: فکتِ متفاوت عادی ذخیره می‌شود');
  const id4 = mem.addFact('علی رفیق من');
  ok(id4 && id4 !== id1 && id4 !== id3, 'رگرسیون: متنِ زیر آستانه از ددیپِ نزدیک معاف است');
}
console.log('— ۹) باگ H — پرسشِ recall مخاطب (لاگ 04:50:56 «اسم علی تو دیسکورد یادته چی بود»)');
{
  ok(brainSrc.indexOf('اسم علی تو دیسکورد چی بود یادت میاد') > 0, 'مثال طلایی recall مخاطب در پرامپت هست');
  ok(brainSrc.indexOf('هرگزشاتِ ذخیره‌شدهٔ مخاطب هرگز chat خالی نمی‌ماند') > 0 || brainSrc.indexOf('پرسش دربارهٔ اسمِ ذخیره‌شدهٔ مخاطب هرگز chat خالی نمی‌ماند') > 0, 'قانون recall در مثال پرامپت صریح است');
}
console.log('— ۱۰) رگرسیون‌های طلایی v0.75 (نباید شکسته باشند)');
{
  const t1 = MS.ctCmdParse('ببین من یک کاربر توی دیسکورد مخاطبمه اسمش تو دیسکورد diyako هست ولی من بهش میگم صدرا خب..');
  ok(!!t1 && t1.op === 'save' && t1.app === 'discord' && t1.handle === 'diyako' && t1.name === 'صدرا', 'آموزش صدرا/diyako سر جایش است → ' + JSON.stringify(t1));
  const m1 = MS.msgParse('خب به صدرا تو دیسکورد پیام بده بگو بیا داش');
  ok(m1 && m1.target === 'صدرا' && m1.text === 'بیا داش', 'صدرا همچنان سالم است → ' + JSON.stringify(m1 && m1.target));
  const t2 = MS.ctCmdParse('به علی پیام بده سلام');
  ok(!t2, 'گارد: جملهٔ ارسال هرگز آموزش نیست');
  ok(B.isTeach('یادت باشه فلانی علی چیه') === true, 'رگرسیون: یادت باشه سر جایش است');
  ok(C.LEARN_COMPLAIN_RE.test('چرا حافظه نداری') === true, 'رگرسیون: الگوهای قدیمی گله سر جایش‌اند');
}

console.log('');
if (fail === 0) {
  console.log('BATTERY v0760 GREEN: ' + pass + '/' + (pass + fail) + ' checks passed');
  process.exit(0);
} else {
  console.log('BATTERY v0760 RED: ' + pass + ' passed, ' + fail + ' FAILED');
  fails.forEach((f) => console.log('  FAIL: ' + f));
  process.exit(1);
}
