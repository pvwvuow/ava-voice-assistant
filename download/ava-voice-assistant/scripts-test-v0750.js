#!/usr/bin/env node
/* v0.75.0-beta — «حلقهٔ آموزش-ذخیره-ارسال بسته شد» — عین صحنه‌های لاگ میدانی 0.74:
   صحنهٔ ۲۲:۰۵ — کاربر آموزش داد «اسمش تو دیسکورد diyako هست ولی من بهش میگم صدرا» →
   مغز contact_save خالی با اپِ غلط داد (/telegram/) → ذخیره شکست خورد → «به صدرا پیام بده» →
   msgParse «صدرا» را به «صد» برید (STOP_TAIL بدون مرزواژه) → سوییچر دیسکورد «صد» را با
   HIT زیررشته‌ای جور دید و پیام به چتِ اشتباه فرستاد (OK:MSGSENT:صد) → عصبانیت کاربر.
   + صحنهٔ ۲۲:۰۴ — «آفرین با همین برو بهش پیام بده» (بدون اپ) → مغز جا ماند (kind=chat).
   + صحنهٔ ۲۰:۲۸ — «همینو برام تو یوتیوب پیدا کن» → «باور کن برام…» (موجودیتِ آلوده). */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

const mainSrc = read('main.js');
const appSrc = read('renderer/js/app.js');
const msgSrc = read('renderer/js/voiceMessaging.js');
const coreSrc = read('renderer/js/voiceCore.js');
const brainSrc = read('renderer/js/voiceBrain.js');
const MS = require('./renderer/js/voiceMessaging.js');
const C = require('./renderer/js/voiceCore.js');
const B = require('./renderer/js/voiceBrain.js');

console.log('— ۱) فیکس «صدرا→صد» — حذف دُم فقط واژه‌به‌واژه');
{
  const m1 = MS.msgParse('خب به صدرا تو دیسکورد پیام بده بگو بیا داش');
  ok(m1 && m1.target === 'صدرا', '«به صدرا تو دیسکورد پیام بده» → target=صدرا (نه صد) → ' + JSON.stringify(m1 && m1.target));
  ok(m1 && m1.app === 'discord' && m1.text === 'بیا داش', 'همان جمله: app=discord و text=بیا داش');
  const m2 = MS.msgParse('به سارا تو تلگرام پیام بده که سلام');
  ok(m2 && m2.target === 'سارا', '«به سارا پیام بده» → سارا (نه سا) → ' + JSON.stringify(m2 && m2.target));
  const m3 = MS.msgParse('به زهرا پیام بده تو تلگرام بگو هی');
  ok(m3 && m3.target === 'زهرا', '«به زهرا پیام بده» → زهرا (نه زه) → ' + JSON.stringify(m3 && m3.target));
  const m4 = MS.msgParse('به پوریا رحمانی تو تلگرام پیام بده سلام');
  ok(m4 && m4.target === 'پوریا رحمانی', '«به پوریا رحمانی پیام بده» → پوریا رحمانی');
  const m5 = MS.msgParse('به علی تو دیسکورد پیام بده بنویس سلام چطوری');
  ok(m5 && m5.target === 'علی' && m5.text === 'سلام چطوری', 'رگرسیون: «علی تو» → علی + متن تمیز');
  const m6 = MS.msgParse('به pourya rahmani تو تلگرام پیام بده بگو تست');
  ok(m6 && m6.target === 'pourya rahmani' && m6.text === 'تست', 'رگرسیون لاگ 21:31: مقصد لاتین چندواژه‌ای');
  const m7 = MS.msgParse('از این به بعد هر وقت گفتم به میلاد پیام بده این اسمو تایپ کن تو تلگرام');
  ok(m7 && m7.target === 'میلاد', 'رگرسیون 17:05: «به بعد» هرگز مقصد نمی‌شود → ' + JSON.stringify(m7 && m7.target));
}
console.log('— ۲) آموزش قطعی آفلاین مخاطب (ctCmdParse v0.75)');
{
  const t1 = MS.ctCmdParse('ببین من یک کاربر توی دیسکورد مخاطبمه اسمش تو دیسکورد diyako هست ولی من بهش میگم صدرا خب..');
  ok(!!t1 && t1.op === 'save' && t1.app === 'discord' && t1.handle === 'diyako' && t1.name === 'صدرا', 'آموزش صدرا/diyako/دیسکورد → ' + JSON.stringify(t1));
  const t2 = MS.ctCmdParse('یوزرش تو دیسکورد dd77 هست و من بهش میگم سینا');
  ok(!!t2 && t2.op === 'save' && t2.app === 'discord' && t2.handle === 'dd77' && t2.name === 'سینا', 'آموزش سینا/dd77 → ' + JSON.stringify(t2));
  const t3 = MS.ctCmdParse('علی رو تو تلگرام با یوزر ali_gh ذخیره کن');
  ok(!!t3 && t3.op === 'save' && t3.app === 'telegram' && t3.handle === 'ali_gh', 'رگرسیون: شکل کلاسیک ذخیره سر جایش است');
  const t4 = MS.ctCmdParse('به علی پیام بده سلام');
  ok(!t4, 'گارد: جملهٔ ارسال پیام هرگز فرمان مخاطبین نیست');
  const t5 = MS.ctCmdParse('اسمش چیه تو دیسکورد');
  ok(!t5, 'سوالِ بدون واژهٔ لاتین آموزش نیست → ' + JSON.stringify(t5));
}
console.log('— ۳) گارد هدفِ مشکوک (suspiciousTarget)');
{
  ok(MS.suspiciousTarget('صد') === true, '«صد» مشکوک است (بریدهٔ صدرا)');
  ok(MS.suspiciousTarget('سلام') === true && MS.suspiciousTarget('تست') === true, 'سلام/تست هرگز مقصد پیام نمی‌شوند');
  ok(MS.suspiciousTarget('هزار') === true, 'واژهٔ عدد مشکوک است');
  ok(MS.suspiciousTarget('صدرا') === false, '«صدرا» اسم معتبر شمرده می‌شود');
  ok(MS.suspiciousTarget('علی') === false && MS.suspiciousTarget('پوریا رحمانی') === false, 'اسم‌های فارسی معتبر');
  ok(MS.suspiciousTarget('ali-hk') === false && MS.suspiciousTarget('diyako') === false, 'لاتین معتبر');
  ok(MS.suspiciousTarget('+989372989120') === false, 'شمارهٔ تلفن معتبر');
  ok(MS.suspiciousTarget('مامان') === false, '«مامان» قربانی گارد نمی‌شود');
}
console.log('— ۴) گرامرهای جدید: بازکردن چت + خواندن چت‌ها');
{
  const c1 = MS.chatOpenParse('چت علی رو تو دیسکورد باز کن');
  ok(!!c1 && c1.app === 'discord' && c1.target === 'علی', '«چت علی رو تو دیسکورد باز کن» → ' + JSON.stringify(c1));
  const c2 = MS.chatOpenParse('تو تلگرام چت پوریا رحمانی رو باز کن');
  ok(!!c2 && c2.app === 'telegram' && c2.target === 'پوریا رحمانی', 'شکل دوم: «تو تلگرام چت X رو باز کن»');
  ok(MS.chatOpenParse('به علی پیام بده سلام') === null, 'نیتِ ارسال هرگز chat-open نمی‌شود');
  ok(MS.chatOpenParse('تلگرام رو باز کن') === null, 'بدون مقصد → null');
  const r1 = MS.msgReadParse('ببین کی برام پیام داده');
  ok(!!r1 && r1.app === 'telegram', '«کی برام پیام داده» → تلگرام');
  const r2 = MS.msgReadParse('پیام های جدید چیه');
  ok(!!r2 && r2.app === 'telegram', '«پیام های جدید» → تلگرام');
  const r3 = MS.msgReadParse('تو دیسکورد کی برام پیام داده');
  ok(!!r3 && r3.app === 'discord', 'دیسکورد هم پارس می‌شود (پاسخ صادقانه در رندرر)');
  ok(MS.msgReadParse('خوبی') === null, 'جملهٔ عادی → null');
}
console.log('— ۵) گارد ارزشِ موجودیت (voiceCore v0.75)');
{
  C.reset();
  C.recordTurn({ utterance: 'باور کن اینو برام پیدا کنی', via: 'ai', intent: 'chat', params: { q: 'باور کن' } });
  ok(C._state.entities.video === '', '«باور کن» هرگز موجودیت video نمی‌شود → ' + JSON.stringify(C._state.entities.video));
  ok(C.entityOk('باور کن') === false && C.entityOk('صد') === false && C.entityOk('آمده‌ای') === false, 'entityOk: باور کن/صد/آمده‌ای رد می‌شوند');
  ok(C.entityOk('شادمهر') === true && C.entityOk('ali-hk') === true && C.entityOk('قشنگترین گناه') === true, 'entityOk: مقادیر سالم می‌گذرند');
  C.reset();
  C.recordTurn({ utterance: 'شادمهر رو برام پلی کن', via: 'ai', intent: 'yt_search', params: { q: 'شادمهر' } });
  const r1 = C.resolveRefs('همینو برام تو یوتیوب پیدا کن');
  ok(r1.text.indexOf('شادمهر') === 0, 'رگرسیون: «همینو» با موجودیت سالم بازنویسی می‌شود → ' + JSON.stringify(r1.text));
  C.reset();
  const r2 = C.resolveRefs('همینو برام تو یوتیوب پیدا کن');
  ok(r2.text === 'همینو برام تو یوتیوب پیدا کن' && r2.unresolved === true, '«همینو» بدون موجودیت معتبر دست نمی‌خورد (لاگ 20:28)');
  C.reset();
  C.recordTurn({ utterance: 'به صدرا تو دیسکورد پیام بده', via: 'messaging', intent: 'msg_send', params: {} });
  ok(C._state.entities.msgTarget === 'صدرا', 'msgTarget تمیز: «صدرا تو دیسکورد» بریده در تو → صدرا → ' + JSON.stringify(C._state.entities.msgTarget));
  C.reset();
  C.recordTurn({ utterance: 'به صد تو دیسکورد پیام بده', via: 'messaging', intent: 'msg_send', params: {} });
  ok(C._state.entities.msgTarget === '', 'msgTarget زباله («صد») ذخیره نمی‌شود');
  C.reset();
  C.recordTurn({ utterance: 'به علی تو دیسکورد پیام بده که سلام', via: 'messaging', intent: 'msg_send', params: { msgTarget: 'علی', msgApp: 'discord' } });
  ok(C.resolveRefTarget('آفرین با همین برو بهش پیام بده بنویس سلام') === 'علی', 'resolveRefTarget(بهش) → علی (لاگ 22:04)');
}
console.log('— ۶) پرامپت مغز: قانون ۶ب + مثال‌های طلایی جدید');
{
  ok(brainSrc.indexOf('۶ب) ارسالِ ارجاعیِ بدون اپ') >= 0, 'قانون ۶ب (ارسال ارجاعی) در پرامپت فارسی');
  ok(brainSrc.indexOf('6b) App-less anaphoric sends') >= 0, 'قانون 6b در پرامپت انگلیسی');
  ok(brainSrc.indexOf('اسمش تو دیسکورد diyako') >= 0, 'مثال طلایی آموزش صدرا/diyako در پرامپت');
  ok(brainSrc.indexOf('هرگز telegram حدس نزن') >= 0, 'ممنوعیت حدسِ اپ در پرامپت');
  ok(brainSrc.indexOf('اپِ مخاطب را از جملهٔ کاربر بردار') >= 0 || brainSrc.indexOf("Take the app from the user's own sentence") >= 0, 'قانون ۲: اپ از جملهٔ کاربر');
  ok(B.isTeach('از این به بعد هر وقت گفتم به میلاد پیام بده انگلیسی سرچ کن'), 'رگرسیون: گارد آموزش سر جایش است');
}
console.log('— ۷) پین‌های ساختاری app.js (لاین‌ها و گاردهای v0.75)');
{
  ok(appSrc.indexOf('lane=msg-read (deterministic)') >= 0 && appSrc.indexOf('AVAMessaging.msgReadParse') >= 0, 'لاین msg-read وایر شده');
  ok(appSrc.indexOf('lane=chat-open (deterministic)') >= 0 && appSrc.indexOf('AVAMessaging.chatOpenParse') >= 0, 'لاین chat-open وایر شده');
  ok(appSrc.indexOf('lane=msg-ref (deterministic)') >= 0, 'لاین msg-ref (بهش/براش + تأیید) وایر شده');
  ok(appSrc.indexOf('AVAMessaging.suspiciousTarget') >= 0, 'گارد هدفِ مشکوک در لاین پیام‌رسانی');
  ok(appSrc.indexOf('teachContactHints(cmd) : null') >= 0 && appSrc.indexOf('اپِ جمله همیشه بر مغز مقدم است') >= 0, 'contact_save: teachContactHints همیشه + اپِ جمله مقدم');
  ok(appSrc.indexOf('brain contact_save salvage-from-sentence') >= 0, 'لاگ salvage حفظ شده');
  ok(appSrc.indexOf('bridge.msg.read') >= 0, 'bridge.msg.read مصرف می‌شود');
}
console.log('— ۸) پین‌های ساختاری main.js (دیسکورد/تلگرام v0.75)');
{
  ok(mainSrc.indexOf('DBG:HDR=') >= 0 && mainSrc.indexOf('$hdrOk') >= 0, 'دیسکورد: راستی‌آزمایی تیتر DM قبل از تایپ');
  ok(mainSrc.indexOf('OK:CHATOPEN') >= 0, 'OK:CHATOPEN (بازکردن چت بدون ارسال) در هر دو موتور');
  ok(mainSrc.indexOf('OK:READ|') >= 0, 'تلگرام: خواندن چت‌های اخیر (OK:READ)');
  ok(mainSrc.indexOf('$script:DcOpen') >= 0 && mainSrc.indexOf("($ReqObj.open)") >= 0, 'دیسکورد: فلگ open از req');
  ok(mainSrc.indexOf('[int]$Read =') >= 0 && mainSrc.indexOf('[int]$Open =') >= 0, 'تلگرام: فلگ‌های read/open از req');
  ok(mainSrc.indexOf("ipcMain.handle('msg:read'") >= 0, 'IPC msg:read');
  ok(mainSrc.indexOf('if (!text && !openMode)') >= 0, 'msg:send در حالت open متنِ خالی را می‌پذیرد');
  ok(mainSrc.indexOf('if ($k -gt 1500)') >= 0, 'probe ارسال: 1500 عنصر + تلاش دوم');
  ok(mainSrc.indexOf('ERR:TG_READ_EMPTY') >= 0, 'نگاشت خطای TG_READ_EMPTY');
}
console.log('— ۹) پین‌های پل/نسخه');
{
  const pre = read('preload.js');
  ok(pre.indexOf("read: (p) => ipcRenderer.invoke('msg:read', p)") >= 0, 'preload: bridge.msg.read');
  const pkg = JSON.parse(read('package.json'));
  ok(pkg.version === '0.75.0-beta' || pkg.version === '0.76.0-beta' || pkg.version === '0.77.0-beta' || pkg.version === '0.78.0-beta' || pkg.version === '0.79.0-beta', 'نسخهٔ 0.75+ (forward-relax) → ' + pkg.version); /* v0.79 forward-relax */
}
console.log('— ۱۰) رگرسیون‌های عمومی v0.74');
{
  ok(typeof MS.stripStopTail === 'function' && MS.stripStopTail('علی پیام بده') === 'علی', 'stripStopTail: دُم ایستا واژه‌به‌واژه');
  ok(MS.stripStopTail('صدرا') === 'صدرا', 'stripStopTail: داخل واژه بریده نمی‌شود');
  ok(MS.latinFirstOrder(['پوریا', 'Pourya Rahmani']).indexOf('Pourya Rahmani') === 0, 'رگرسیون v0.73: لاتین‌اول');
  const bl = B.validateBrain({ actions: [{ act: 'contact_send', params: { app: 'telegram', name: 'علی', text: 'سلام' } }], confirm: 'بفرستم؟' });
  ok(bl.ok && bl.actions.length === 0, 'رگرسیون: confirm → بدون اجرای حدسی');
}

console.log('');
console.log('PASS=' + pass + ' FAIL=' + fail);
if (fail) { console.log('FAILS:\n' + fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
console.log('v0750 GREEN');
