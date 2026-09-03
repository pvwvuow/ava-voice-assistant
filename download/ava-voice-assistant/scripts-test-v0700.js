'use strict';
/* ============================================================
   آوا — scripts-test-v0700.js — «مغز واحد + هستهٔ حافظه»
   ------------------------------------------------------------
   طرح بازنویسی v0.70 (AI-First) پس از تحلیل لاگ Ali-HK:
   فاز ۰: هستهٔ حافظه — facts پایدار (ava-memory.json) + آداپتور مخاطب
   فاز ۱: مغز واحد — پرامپت JSON سخت‌ساختار + صحه‌گذار + فالبک مسیر قدیمی
          + گارد لَین آموزش + ایزوله‌سازی سلام/حال + تأیید کار حساس
   فاز ۲: تلگرام Ctrl+K گلوبال + خواندن نتایج UIA + واژه‌های ایستای مقصد
   فاز ۳: دیکشنری واژه‌محور تلفظ↔لاتین
   پین‌های دود (ساختار): اینکلودها، IPC حافظه، سیم‌کشی‌های app.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const APP = __dirname;
const mainSrc = fs.readFileSync(path.join(APP, 'main.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(APP, 'renderer/js/app.js'), 'utf8');
const idxSrc = fs.readFileSync(path.join(APP, 'renderer/index.html'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(APP, 'preload.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
const B = require(path.join(APP, 'renderer/js/voiceBrain.js'));
const M = require(path.join(APP, 'renderer/js/voiceMemory.js'));
const MM = require(path.join(APP, 'renderer/js/voiceMessaging.js'));

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; fails.push(label); console.log('  ✗ ' + label); }
}
function section(t) { console.log('\n— ' + t + ' —'); }

/* ================= فاز ۱ — گارد لَین آموزش ================= */
section('گارد لَین آموزش (isTeach) — عین جمله‌های لاگ Ali-HK');
ok(B.isTeach('آفرین از این به بعد هر وقت گفتم به میلاد پیام بده باید این اسمو تایپ کنی تو تلگرام و بهش پیام بدی اوکی') === true, 'جملهٔ آموزشی لاگ 17:05:10 → teach');
ok(B.isTeach('یادت باشه فلانی علی چیه') === true, '«یادت باشه فلانی علی چیه» → teach');
ok(B.isTeach('آقا این اسمو برام به انگلیسی ذخیره کن میلاد قدوسی') === true, '«این اسمو … ذخیره کن» → teach');
ok(B.isTeach('نه نه اشتباه شد میگم فقط اینو ذخیره کن میلاد قدوس یادت باشه') === true, 'تصحیح + ذخیره + یادت‌باشه → teach');
ok(B.isTeach('از این به بعد همیشه وقتی گفتم بیا ویس زنگ بزن') === true, '«از این به بعد همیشه وقتی» → teach');
ok(B.isTeach('اسم میلاد قدوسی رو ذخیره کن') === true, '«اسم … ذخیره کن» → teach');
ok(B.isTeach('به مخاطب هات اضافه کن به نام علی') === true, '«به مخاطب‌هات اضافه کن» → teach');
ok(B.isTeach('تو تلگرام به ان پیام بده چطوری') === false, 'فرمان واقعی پیام → NOT teach');
ok(B.isTeach('به علی همساده پیام بده چطوری') === false, 'فرمان واقعی پیام ۲ → NOT teach');
ok(B.isTeach('فردا باید برم خرید') === false, 'جملهٔ عادی → NOT teach');
ok(B.isTeach('این فایل رو تو Downloads ذخیره کن') === false, 'ذخیرهٔ فایل (بدون اسم/مخاطب/حافظه) → NOT teach');

/* ================= فاز ۱ — ایزوله‌سازی سلام/حال ================= */
section('ایزوله‌سازی سلام/حال (isGreeting) — ریشهٔ «خوبی→دودو»');
ok(B.isGreeting('سلام خوبی') === true, '«سلام خوبی» → greeting');
ok(B.isGreeting('خوبی') === true, '«خوبی» → greeting');
ok(B.isGreeting('حالت چطوره مشتی') === true, '«حالت چطوره مشتی» → greeting');
ok(B.isGreeting('سلام درود مرسی خوبم') === true, 'ترکیب سلام/حال → greeting');
ok(B.isGreeting('خوبی رو چطور عوض کنم؟') === false, 'جملهٔ کاری با «خوبی» → NOT greeting');
ok(B.isGreeting('سلام به علی پیام بده') === false, '«سلام + فرمان» → NOT greeting');

/* ================= فاز ۱ — صحه‌گذار JSON ================= */
section('parseBrainJSON / validateBrain');
const j1 = B.parseBrainJSON('```json\n{"think":"t","speak":"حفظ شد","actions":[{"act":"memory_save","value":"فلانی=علی"},{"act":"contact_save","params":{"app":"telegram","nameFa":"میلاد قدوسی","nameEn":"Milad Ghodousi"}}],"confirm":"","clarify":""}\n```');
ok(!!j1 && Array.isArray(j1.actions) && j1.actions.length === 2, 'JSON داخل بلوک کد پارس می‌شود');
const v1 = B.validateBrain(j1);
ok(v1.ok === true && v1.actions.length === 2 && v1.actions[1].params.nameEn === 'Milad Ghodousi', 'validate: params حفظ می‌شود');
const v2 = B.validateBrain({ speak: 'سوال', actions: [{ act: 'contact_send', params: { app: 'telegram', name: 'علی', text: 'سلام' } }], confirm: 'بفرستم؟' });
ok(v2.ok === true && v2.actions.length === 0 && v2.confirm.length > 0, 'confirm حساس → اکشن‌ها خالی می‌شوند (هیچ اجرای حدسی)');
const v3 = B.validateBrain({ speak: '', actions: [] });
ok(v3.ok === false, 'خالیِ کامل → رد');
const j4 = B.parseBrainJSON('متن اضافه {"speak":"با } داخل رشته","actions":[]} بعدش');
ok(!!j4 && j4.speak.indexOf('}') > 0, 'آکولاد داخل رشتهٔ JSON پارسر را نمی‌شکند');
const v5 = B.validateBrain({ speak: 'ok', actions: [{ act: 'type_once', value: 'x' }, { act: 'y1' }, { act: 'y2' }, { act: 'y3' }] });
ok(v5.actions.length === 3, 'سقف ۳ اکشن');
ok(typeof B.brainSystem('fa') === 'string' && B.brainSystem('fa').indexOf('memory_save') > 0 && typeof B.brainSystem('en') === 'string', 'پرامپت مغز واحد fa/en');

/* ================= واژه‌های ایستای مقصد ================= */
section('REF_MSG_STOP_RE — ریشهٔ «بعد هر وقت»');
ok(B.REF_MSG_STOP_RE.test('بعد') && B.REF_MSG_STOP_RE.test('وقت') && B.REF_MSG_STOP_RE.test('عنوان') && B.REF_MSG_STOP_RE.test('گفتم'), 'بعد/وقت/عنوان/گفتم ایستا هستند');
ok(!B.REF_MSG_STOP_RE.test('میلاد') && !B.REF_MSG_STOP_RE.test('علی'), 'نام‌ها ایستا نیستند');

/* ================= فاز ۰ — هستهٔ حافظه ================= */
section('هستهٔ حافظه (voiceMemory)');
const mem = M.createMemory({ load: async () => null, save: async (d) => { saved = JSON.parse(JSON.stringify(d)); return true; } });
let saved = null;
(async () => { })();
ok(mem.addFact('فلانی = علی') !== null, 'addFact جدید');
ok(mem.addFact('فلانی  =  علی') !== null && mem.data.facts.length === 1, 'dedupe نرمال‌شده');
ok(mem.addFact('هر وقت گفتم به میلاد پیام بده → چت Milad Ghodousi تلگرام') !== null, 'addFact دوم');
ok(mem.findFacts('علی چیه', 3).some((f) => f.text.indexOf('علی') !== -1), 'بازیابی مرتبط: «علی چیه»');
ok(mem.findFacts('علی چیه', 3).every((f) => f.text.indexOf('میلاد') === -1) === true, 'بدون فکتِ بی‌ربط (تازگیِ خالی امتیاز نمی‌دهد)');
ok(mem.findFacts('به میلاد پیام بده', 3).some((f) => f.text.indexOf('میلاد') !== -1), 'بازیابی مرتبط: میلاد');
ok(mem.delFact('فلانی') !== null && mem.data.facts.length === 1, 'delFact با پیشوند');
const cl = [];
const cid = mem.addContact(cl, { nameFa: 'میلاد قدوسی', app: 'telegram', nameEn: 'Milad Ghodousi' });
ok(cid && cl[0].name === 'میلاد قدوسی' && cl[0].aliases.indexOf('Milad Ghodousi') !== -1, 'addContact با نام دوفرمی');
ok(mem.addContact(cl, { nameFa: 'میلاد قدوسی', app: 'telegram', handle: '@milad' }) === cid && cl[0].handle === '@milad', 'dedupe مخاطب → به‌روزرسانی هندل');
ok(mem.findContact(cl, 'telegram', 'میلاد قدوسی') !== null, 'findContact دقیق');
ok(mem.findContact(cl, 'telegram', 'میلاد قدسی') !== null, 'findContact لوانشتین ≤۱');
ok(mem.findContact(cl, 'whatsapp', 'میلاد قدوسی') === null, 'findContact اپ ناهمسان → null');
ok(mem.contactsCtx(cl).indexOf('id=c') > 0, 'contactsCtx فرمت id');
ok(mem.factsCtx('میلاد', 3).indexOf('حافظهٔ پایدار') >= 0, 'factsCtx بستهٔ زمینه');

/* ================= فاز ۲/۳ — گرامر پیام و تلفظ ================= */
section('گرامر پیام — واژه‌های ایستا + رگرسیون‌های لاگ');
const p1 = MM.msgParse('تو تلگرام به ان پیام بده چطوری');
ok(p1 && p1.target === 'ان' && p1.text === 'چطوری', '«به ان» سالم (لاگ 17:02)');
const p2 = MM.msgParse('تو تلگرام به علی همساده پیام بده چطوری اسمشو انگلیسی بنویس کامل');
ok(p2 && p2.target === 'علی همساده' && /چطوری/.test(p2.text) && !/انگلیسی/.test(p2.text), 'دنبالهٔ دستوری جزو متن پیام نیست (لاگ 15:53)');
const p3 = MM.msgParse('تو دیسکورد به علی اچ کی پیام بده بیا');
ok(p3 && p3.target === 'علی اچ کی' && p3.text === 'بیا', 'مقصد چندکلمه‌ای (لاگ 15:47)');
const p4 = MM.msgParse('به همین اسم توی دیسکورد پیام بده سلام');
ok(p4 && p4.targetRef === true && !p4.target, '«به همین اسم» → targetRef (حل از حافظه، هرگز سرچ لفطی)');
const p5 = MM.msgParse('آفرین از این به بعد هر وقت گفتم به میلاد پیام بده باید این اسمو تایپ کنی تو تلگرام و بهش پیام بدی اوکی');
ok(!p5 || p5.target !== 'بعد هر وقت', '«بعد هر وقت» دیگر هرگز مقصد نمی‌شود (لاگ 17:05)');
const p6 = MM.msgParse('تو تلگرام به شماره ۹۳۷۶۳۰۸۶۷۶ پیام بده بگو بیا');
ok(p6 && p6.target === '۹۳۷۶۳۰۸۶۷۶', 'پیشوند شماره حذف');
section('faToLatin واژه‌محور (فاز ۳)');
ok(MM.faToLatin('میلاد قدوسی') === 'Milad Ghodousi', 'نام واقعی لاتین');
ok(MM.faToLatin('سلفون') === 'cellphone', 'سلفون → cellphone (لاگ 17:03)');
ok(MM.faToLatin('علی همساده') === 'Ali Hamsadeh', 'ترکیب دیکشنری+واژهٔ عام');
ok(MM.faToLatin('قیم پیلی ربا') !== '' && MM.faToLatin('قیم پیلی ربا') === 'ghimpilirba', 'فالبک حرف‌به‌حرف');

/* ================= پین‌های ساختاری ================= */
section('پین‌های ساختاری (سیم‌کشی)');
ok(idxSrc.indexOf('js/voiceMemory.js') > 0 && idxSrc.indexOf('js/voiceBrain.js') > 0, 'index.html اینکلودهای جدید');
ok(idxSrc.indexOf('js/voiceBrain.js') < idxSrc.indexOf('js/app.js'), 'voiceBrain قبل از app.js');
ok(preloadSrc.indexOf("invoke('mem:load')") > 0 && preloadSrc.indexOf("invoke('mem:save'") > 0, 'preload: بریج mem');
ok(mainSrc.indexOf("ipcMain.handle('mem:load'") > 0 && mainSrc.indexOf("ipcMain.handle('mem:save'") > 0, 'main: IPC حافظه');
ok(mainSrc.indexOf('ava-memory.json') > 0, 'main: فایل پایدار حافظه');
ok(appSrc.indexOf('async function aiBrainRound') > 0 && appSrc.indexOf('async function brainExecute') > 0, 'app: مغز واحد');
ok(appSrc.indexOf('AVABrain.isTeach(raw)') > 0, 'app: گارد لَین آموزش قبل از لَین‌های اجرایی');
ok(appSrc.indexOf('lane=teach (guard)') > 0, 'app: لاگ لَین آموزش');
ok(appSrc.indexOf('_pendingConfirm') > 0 && appSrc.indexOf('brainSendResolved') > 0, 'app: تأیید کار حساس + اجرای ارسال');
ok(appSrc.indexOf('await aiBrainRound(cmd, extraCtx)') > 0 && appSrc.indexOf('legacy think-first fallback') > 0, 'app: برین JSON اول + فالبک مسیر قدیمی');
ok(appSrc.indexOf('executeBrainNewActs') > 0 && appSrc.indexOf("'memory_save'") > 0 && appSrc.indexOf("'contact_save'") > 0 && appSrc.indexOf("'note_add'") > 0, 'app: actهای جدید حافظه/مخاطب/یادداشت');
ok(appSrc.indexOf('noSearch: true, timeoutMs: BRAIN_TIMEOUT_MS') > 0, 'app: سرچ خاموش + بودجهٔ زمانی مغز');
ok(appSrc.indexOf('search: !(opts && opts.noSearch)') > 0, 'app: aiAsk — noSearch قابل تنظیم');
ok(mainSrc.indexOf("Send-Combo 'ctrl,k'") > 0 && mainSrc.indexOf('Read-TgBest') > 0, 'main: تلگرام Ctrl+K + انتخاب UIA');
ok(mainSrc.indexOf("Send-Combo 'ctrl,f'") === -1, 'main: Ctrl+F در اسکریپت تلگرام حذف شد');
ok(mainSrc.indexOf("'down' = 0x28") > 0 && mainSrc.indexOf("'k' = 0x4B") > 0, 'main: VKNAME تلگرام k/down');
ok(/^0\.[7-9][0-9]?\.\d+-beta$/.test(pkg.version), 'package.json = 0.70/0.71-beta'); /* v0.71 forward-relax */

/* ================= سلامت سینتکس ================= */
section('node --check');
const { execSync } = require('child_process');
for (const f of ['main.js', 'preload.js', 'renderer/js/app.js', 'renderer/js/voiceBrain.js', 'renderer/js/voiceMemory.js', 'renderer/js/voiceMessaging.js', 'renderer/js/voiceCore.js']) {
  try { execSync('node --check "' + path.join(APP, f) + '"', { stdio: 'pipe' }); ok(true, 'سینتکس سالم: ' + f); }
  catch (e) { ok(false, 'سینتکس خراب: ' + f); }
}

console.log('\n========================================');
console.log('نتیجه: ' + pass + ' پاس / ' + fail + ' خطا');
if (fail) { console.log('خطاها:'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log('V0700_ALL_GREEN');
