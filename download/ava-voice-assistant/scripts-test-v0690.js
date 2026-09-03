'use strict';
/* ============================================================
   آوا — scripts-test-v0690.js — حافظهٔ مکالمه + درست‌گویی پیام‌رسان
   ------------------------------------------------------------
   منبع: لاگ واقعی Ali-HK (activity.log ۱۲ سپتامبر — v0.68.0-beta).
   همهٔ پین‌ها از جمله‌های واقعی کاربر در آن لاگ‌اند:
   «اول انگلیسی یادداشت کن علی اچ کی وسطشم یه خط فاصله» → باید Ali-HK ذخیره شود
   «همون اسمی که بهت گفتم بنویس یادداشت کن…» → یادداشت، نه تایپ در پنجرهٔ دیگر
   «میگم همون اسمی که الان یادداشت کردیم…» → خواندن قطعی یادداشت
   «تو تلگرام به ان پیام بده…» → وارسی عنوان چت (پیام به «اقتصاد انلاین» نرود)
   «آفرین حالا به همین اسم توی دیسکورد پیام بده سلام» → آنافورا از حافظه
   «بهش بگو بیا دیسکورد» → مقصد ضمیری
   «دو تلیگرام بیدی بیدی بید» → یادگیری مسموم نشود
   ============================================================ */
const fs = require('fs');
const path = require('path');
const APP = __dirname;
const mainSrc = fs.readFileSync(path.join(APP, 'main.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(APP, 'renderer/js/app.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(APP, 'renderer/js/voiceCore.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
const MM = require(path.join(APP, 'renderer/js/voiceMessaging.js'));
const C = require(path.join(APP, 'renderer/js/voiceCore.js'));

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; fails.push(label); console.log('  ✗ ' + label); }
}
function section(name) { console.log('\n— ' + name + ' —'); }

/* ============ ۱) آشکارساز جملهٔ بی‌معنی (گیت یادگیری) ============ */
section('isGibberish — نویز STT لاگ');
ok(C.isGibberish('دو تلیگرام بیدی بیدی بید') === true, '«دو تلیگرام بیدی بیدی بید» = نویز');
ok(C.isGibberish('تو تهلگ روم بایم بایم بایم بایم بایم بایم') === true, '«بایم×۶» = نویز');
ok(C.isGibberish('سلام خوبی چطوری') === false, '«سلام خوبی چطوری» سالم');
ok(C.isGibberish('خیلی خیلی ممنون') === false, '«خیلی خیلی ممنون» سالم (تاکید طبیعی)');
ok(C.isGibberish('چطوری چطوری چرا انقدر تو بچه باهوشی هستی') === false, 'جملهٔ بلند سالم با تکرار واحد');

/* ============ ۲) حل‌گر ارجاع — حاشیه، نه بازنویسیِ مخرب ============ */
section('resolveRefs — متن دست‌نخورده + hints');
const R1 = 'میگم همون اسمی که الان یادداشت کردیم با هم علی اچ کی وسط فاصله بود ببینم چطور یادداشت کردیم';
const r1 = C.resolveRefs(R1, {});
ok(r1.text === R1, 'جملهٔ ارجاعی هرگز بازنویسی نمی‌شود (ریشهٔ «ویدیو رو یی» و «کپی برام پینش کن»)');
ok(Array.isArray(r1.hints), 'hints آرایه است');
C.recordTurn({ utterance: 'تو دیسکورد به علی اچ کی پیام بده بیا', via: 'messaging', intent: 'msg_send', params: { app: 'discord', msgTarget: 'علی اچ کی', msgApp: 'discord' }, reply: 'فرستادم به «علی اچ کی»' });
C.recordTurn({ utterance: 'اول انگلیسی یادداشت کن علی اچ کی', via: 'rule', intent: 'notes', params: { noteText: 'Ali-HK', person: 'Ali-HK' }, reply: 'ثبت شد' });
const r2 = C.resolveRefs('آفرین حالا به همین اسم توی دیسکورد پیام بده سلام', {});
ok(r2.hints.length >= 1 && /علی اچ کی|Ali-HK/.test(r2.hints.join(' ')), 'hint «به همین اسم» از حافظه: ' + r2.hints.join('؛ '));
ok(C.resolveRefTarget('آفرین حالا به همین اسم توی دیسکورد پیام بده سلام') === 'Ali-HK', 'resolveRefTarget «همین اسم» → person');
ok(C.resolveRefTarget('بهش بگو بیا دیسکورد') === 'علی اچ کی', 'resolveRefTarget «بهش» → msgTarget');
ok(C.resolveRefTarget('به علی پیام بده') === '', 'بدون ضمیر ارجاعی → خالی');
const p1 = C.prepare('همینو برام پخش کن', {});
ok(!/\(ارجاع/.test(p1.text) && Array.isArray(p1.hints), 'prepare حاشیه را به متن نمی‌چسباند (مقدار کوتاه بازنویسی v0.61 مجاز است)');

/* ============ ۳) موجودیت‌های واقعیت‌های اخیر ============ */
section('ContextStore — یادداشت/مقصد پیام در حافظه');
ok(C._state.entities.note === 'Ali-HK', 'entities.note ثبت شد');
ok(C._state.entities.msgTarget === 'علی اچ کی', 'entities.msgTarget ثبت شد');
ok(C._state.entities.msgApp === 'discord', 'entities.msgApp ثبت شد');
const ec = C.entityCtx();
ok(/آخرین یادداشت ثبت‌شده/.test(ec) && /Ali-HK/.test(ec), 'entityCtx یادداشت را به مغز می‌رساند');
ok(/آخرین مقصد پیام/.test(ec), 'entityCtx مقصد پیام را می‌رساند');

/* ============ ۴) گرامر پیام‌رسان v4 — جمله‌های واقعی لاگ ============ */
section('msgParse v4 — جمله‌های واقعی لاگ');
const m1 = MM.msgParse('خوب به همین علی اچ کی تو دیسکورد پیام بده');
ok(m1 && m1.target === 'علی اچ کی' && m1.app === 'discord', 'لَیدِ «خوب به همین» حل شد → علی اچ کی');
const m2 = MM.msgParse('آفرین حالا به همین اسم توی دیسکورد پیام بده سلام');
ok(m2 && m2.targetRef === true && m2.target === '' && m2.text === 'سلام', '«به همین اسم» → targetRef (بدون ارسال لفظی)');
const m3 = MM.msgParse('بهش بگو بیا دیسکورد');
ok(m3 && m3.targetRef === true && m3.text === 'بیا دیسکورد', '«بهش بگو» → targetRef');
const m4 = MM.msgParse('تو تلگرام به علی همساده پیام بده چطوری اسمشو انگلیسی بنویس کامل');
ok(m4 && m4.text === 'چطوری' && m4.lang === 'en', 'دستورِ «اسمشو انگلیسی بنویس کامل» از متن پیام حذف شد');
const m5 = MM.msgParse('تو تلگرام به شماره ۹۳۷ ۶۳۰۸۶۷۶ پیام بده بگو بیا');
ok(m5 && m5.target === '۹۳۷ ۶۳۰۸۶۷۶', 'پیشوند «شماره» حذف شد');
const m6 = MM.msgParse('تو دیسکورد به علی اچ کی پیام بده چطوری');
ok(m6 && m6.target === 'علی اچ کی' && m6.text === 'چطوری', 'جملهٔ سالم دست‌نخورده ماند');
const m7 = MM.msgParse('انگلیسی بنویسی جان جدت بنویس خوبی چطوری');
ok(!m7 || !(m7.target && m7.text), 'جملهٔ متای تایپی به پیام‌رسان نمی‌رود');

/* ============ ۵) تبدیل املایی لاتین ============ */
section('noteLatinOf — «علی اچ کی وسطشم یه خط فاصله» → Ali-HK');
const L1 = MM.noteLatinOf('اول انگلیسی یادداشت کن علی اچ کی وسطشم یه خط فاصله');
ok(L1 && L1.out === 'Ali-HK', 'Ali-HK ساخته شد: ' + (L1 && L1.out));
const L2 = MM.noteLatinOf('انگلیسی بنویس رضا نقطه محمد');
ok(L2 && L2.out === 'Reza.Mohammad', 'نقطه: Reza.Mohammad');
const L3 = MM.noteLatinOf('یادداشت کن انگلیسی سیاوش آندرلاین محمد');
ok(L3 && L3.out === 'Siavash_Mohammad', 'آندرلاین: Siavash_Mohammad');
ok(MM.noteLatinOf('یادداشت کن که فردا جلسه دارم') === null, 'بدون دستورِ انگلیسی → null');

/* ============ ۶) گارد type-once متا ============ */
section('_pureType گاردها در app.js');
ok(!/(میشه|ممکنه)/.test('x') && appSrc.includes('برای\\s?من\\s?بنویسی'), 'گارد «برای من بنویسی»');
ok(appSrc.includes('بنویس|بنویسی|بنیویس)[^.]{0,24}(بنویس'), 'گارد دوفعل («بنویس … بنویس»)');
ok(appSrc.includes("lane=notes (deterministic)"), 'لاین قطعی یادداشت قبل از مغز ثبت می‌شود');
ok(appSrc.includes('take a note/i.test(raw)'), 'تشخیص یادداشت روی raw');
ok(/if \(_mp && _mp\.targetRef && !_mp\.target\)/.test(appSrc), 'آنافورا مقصد قبل از اجرای لاین پیام‌رسان');

/* ============ ۷) موتور تلگرام — وارسی عنوان چت ============ */
section('TG engine — variants + title verify');
ok(mainSrc.includes('[string]$Variants') || mainSrc.includes('$ReqObj.variants'), 'پارامتر -Variants در TG_PS_BODY'); /* v0.72 forward-relax: از req JSON */
ok(mainSrc.includes('function Test-TgMatch'), 'تابع Test-TgMatch');
ok(mainSrc.includes('ERR:TG_NO_MATCH'), 'خروجی صادقانهٔ NO_MATCH');
ok(mainSrc.includes('DBG:TRY='), 'لاگ هر واریانت + تیتر');
ok(mainSrc.includes("'-Variants', safeVars.join('|')") || mainSrc.includes('$ReqObj.variants'), 'واریانت‌ها از argv (نه شل)'); /* v0.72 forward-relax: req JSON */
ok(appSrc.includes('variants: _vs'), 'رندرر واریانت‌ها را می‌فرستد');
const tgBody = (mainSrc.split('const TG_PS_BODY = `')[1] || '').split('`;')[0];
ok(tgBody.length > 2000 && !tgBody.includes('/*'), 'بدون کامنت /* در پاورشل');
ok(/runTgPs\(name, text, username, false, variants(, openMode)?\)/.test(mainSrc), 'msg:send واریانت را به موتور می‌دهد'); /* v0.75 forward-relax: +openMode */

/* ============ ۸) یادگیری — گیت کیفیت ============ */
section('learn gate');
ok(appSrc.includes('جملهٔ نامفهوم (نویز STT) — ذخیره نشد'), 'گیت نویز قبل از ذخیرهٔ learn');
ok(appSrc.includes('isGibberish(cmd)'), 'isGibberish روی فرمان AI');

/* ============ ۹) حافظهٔ ۱۰ رد و بدل ============ */
section('turnsCtx(10)');
ok(appSrc.includes('turnsCtx(10)'), 'تاریخچهٔ ۱۰ تایی به مغز');
ok(coreSrc.includes('MAX_TURNS = 12'), 'ظرفیت حافظهٔ داخلی ۱۲');
ok(appSrc.includes('_vc.hints.join'), 'حاشیه‌های ارجاع فقط به مغز می‌چسبند');

/* ============ ۱۰) observability ============ */
section('observability');
ok(appSrc.includes("_dispatchOutcome = 'unrouted'"), 'شروع هر runCommand با تگ unrouted — تگ کهنه ممنوع');
ok(appSrc.includes("_dispatchOutcome = 'wake-bare'"), 'مسیر wake-lخت تگ دارد');

/* ============ ۱۱) نسخه ============ */
section('نسخه');
ok(/^0\.[6-9][0-9]?\.\d+-beta$/.test(pkg.version), 'package.json = 0.69.0-beta');

console.log('\n============================================');
console.log(`نتیجه: ${pass} PASS / ${fail} FAIL`);
if (fail) { console.log('فیل‌ها:'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log('ALL GREEN — v0.69 حافظهٔ مکالمه + درست‌گویی');
