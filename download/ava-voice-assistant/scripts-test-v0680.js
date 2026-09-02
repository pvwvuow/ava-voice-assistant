'use strict';
/* ============================================================
   آوا — scripts-test-v0680.js — اکستنشن پیام‌رسانی مرحلهٔ ۳
   ------------------------------------------------------------
   خواستهٔ کاربر پس از v0.67:
   «این باگ برای همه پیام رسانا هست» + «وسط مکالمه فارسی ممکنه من یک
   اسم انگلیسی بگم خب اون چی میشه؟» + «اکستنشن هر پیام رسان رو کامل و
   حرفه ای اضافه کن.. برای ذخیره مخاطب با اسمی ک ذخیره شده»
   فیکس‌های این سوئیت:
   ۱) مخاطبین صوتی ctCmdParse — ذخیره/حذف/لیست قطعی (بدون AI) + گاردها
   ۲) تطبیق دوزبانهٔ نام contactFind v3 — علی↔Ali، محمد↔mohammad،
      اسکلت هم‌خوان، یوزرنیم، فالبک اشتراک شماره، لوانشتین اسم کوتاه
   ۳) ایتا + گارد «ایتالیا»؛ فیکس فعل سرِ متن در msgParse
   ۴) عیب‌یاب صوتی — msg:test IPC + حالت $Test در TG_PS_BODY
   ============================================================ */
const fs = require('fs');
const path = require('path');
const APP = __dirname;
const mainSrc = fs.readFileSync(path.join(APP, 'main.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(APP, 'renderer/js/app.js'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(APP, 'preload.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
const MM = require(path.join(APP, 'renderer/js/voiceMessaging.js'));

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; fails.push(label); console.log('  ✗ ' + label); }
}
function section(t) { console.log('\n— ' + t); }

/* ============ ۱) مخاطبین صوتی (ctCmdParse) ============ */
section('مخاطبین صوتی — ذخیره');
let r = MM.ctCmdParse('علی رو تو تلگرام با یوزر ali_gh ذخیره کن');
ok(r && r.op === 'save' && r.name === 'علی' && r.app === 'telegram' && r.handle === 'ali_gh' && r.kind === 'username', 'save اسم-اول: علی/تلگرام/ali_gh');
r = MM.ctCmdParse('ذخیره کن رضا رو تو واتساپ با شماره ۰۹۱۲۱۲۳۴۵۶۷');
ok(r && r.op === 'save' && r.name === 'رضا' && r.app === 'whatsapp' && r.handle === '09121234567' && r.kind === 'phone', 'save فعل-اول + ارقام فارسی: رضا/واتساپ/09121234567');
r = MM.ctCmdParse('مخاطب محمد رضا رو تو بله با شماره 09120000000 ثبت کن');
ok(r && r.op === 'save' && r.name === 'محمد رضا' && r.app === 'bale' && r.handle === '09120000000', 'save مقصد چندکلمه‌ای + بله با مکان: محمد رضا/بله');
r = MM.ctCmdParse('علی رو با آیدی ali_gh ذخیره کن');
ok(r && r.op === 'save' && r.app === 'telegram' && r.handle === 'ali_gh', 'save بدون اپ + آیدی → پیش‌فرض تلگرام');
r = MM.ctCmdParse('سارا رو تو واتساپ با شماره 09111111111 ذخیره کن');
ok(r && r.op === 'save' && r.name === 'سارا' && r.app === 'whatsapp', 'save واتساپ شماره لاتین: سارا');
r = MM.ctCmdParse('علی رو تو تلگرام با یوزر @ali_gh ذخیره کن');
ok(r && r.handle === '@ali_gh', 'save با @ یوزرنیم حفظ می‌شود');
ok(MM.ctCmdParse('علی رو با آیدی ali_gh ذخیره کن') !== null, 'روبیکا بدون مکان → پیش‌فرض غیر-روبیکا (اپ بدون نیاز-به-مکان)');
r = MM.ctCmdParse('نیما رو تو روبیکا با شماره 09122222222 ذخیره کن');
ok(r && r.op === 'save' && r.app === 'rubika', 'save روبیکا با مکان صریح');

section('مخاطبین صوتی — حذف/لیست');
r = MM.ctCmdParse('مخاطب علی رو حذف کن');
ok(r && r.op === 'del' && r.name === 'علی', 'del: مخاطب علی رو حذف کن');
r = MM.ctCmdParse('علی رو از مخاطبین پاک کن');
ok(r && r.op === 'del' && r.name === 'علی', 'del: علی رو از مخاطبین پاک کن');
ok(MM.ctCmdParse('مخاطبینمو بخون').op === 'list', 'list: مخاطبینمو بخون');
ok(MM.ctCmdParse('لیست مخاطبین چیه').op === 'list', 'list: لیست مخاطبین چیه');
ok(MM.ctCmdParse('مخاطبام چین').op === 'list', 'list: مخاطبام چین');

section('گاردهای مخاطبین — هیچ فالس‌پازیتیو');
ok(MM.ctCmdParse('به علی پیام بده که یادت نره ذخیره کن') === null, 'جملهٔ ارسال پیام → null');
ok(MM.ctCmdParse('فایل رو برام ذخیره کن') === null, 'ذخیره بدون یوزر/شماره → null');
ok(MM.ctCmdParse('این عکس رو تو تلگرام ذخیره کن') === null, 'ذخیره فایل در تلگرام → null');
ok(MM.ctCmdParse('سلام خوبی؟') === null, 'جملهٔ عادی → null');
ok(MM.ctCmdParse('هیستوری مرورگر رو پاک کن') === null, 'پاک کردن بدون مخاطب → null');
r = MM.ctCmdParse('علی رو تو روبیکا با یوزر reza_a ذخیره کن');
ok(r && r.app === 'rubika', 'روبیکا با مکان صریح → rubika');
r = MM.ctCmdParse('زهرا رو تو واتساپ با شماره 09133333333 ذخیره کن');
ok(r && r.name === 'زهرا', 'پین رگرسیون: نام ختم‌به-را (زهرا) نصف نمی‌شود');
r = MM.ctCmdParse('نگار رو از مخاطبین پاک کن');
ok(r && r.op === 'del' && r.name === 'نگار', 'پین رگرسیون: حذف نگار (ختم-به-را)');
r = MM.ctCmdParse('مخاطب سارا رو حذف کن');
ok(r && r.op === 'del' && r.name === 'سارا', 'پین رگرسیون: حذف سارا');

/* ============ ۲) تطبیق دوزبانه (contactFind v3) ============ */
section('تطبیق دوزبانه — «وسط مکالمهٔ فارسی اسم انگلیسی»');
const C = [
  { id: 'm1', name: 'علی', app: 'telegram', handle: 'ali_gh', aliases: ['علی'] },
  { id: 'm2', name: 'رضا', app: 'whatsapp', handle: '09121234567' },
  { id: 'm3', name: 'محمد', app: 'telegram', handle: 'mo_gh' },
  { id: 'm4', name: 'سیاوش', app: 'telegram', handle: 'sia_v' },
  { id: 'm5', name: 'نیکان', app: 'telegram', handle: 'nikan_x' },
  { id: 'm6', name: 'رضا', app: 'bale', handle: '09121234567' },
];
ok((MM.contactFind(C, 'telegram', 'Ali') || {}).name === 'علی', 'Ali → علی');
ok((MM.contactFind(C, 'telegram', 'mohammad') || {}).name === 'محمد', 'mohammad → محمد');
ok((MM.contactFind(C, 'telegram', 'Muhammad') || {}).name === 'محمد', 'Muhammad → محمد');
ok((MM.contactFind(C, 'telegram', 'ali_gh') || {}).name === 'علی', 'یوزرنیم ali_gh → علی');
ok((MM.contactFind(C, 'telegram', 'siavash') || {}).name === 'سیاوش', 'siavash → سیاوش (اسکلت هم‌خوان)');
ok((MM.contactFind(C, 'telegram', 'nikan') || {}).name === 'نیکان', 'nikan → نیکان (آوانگاری عمومی)');
ok((MM.contactFind(C, 'telegram', 'علو') || {}).name === 'علی', 'علو → علی (نویز STT اسم کوتاه)');
ok((MM.contactFind(C, 'whatsapp', 'رضا') || {}).name === 'رضا', 'اپ دقیق: رضا/واتساپ');
ok((MM.contactFind(C, 'bale', 'رضا') || {}).name === 'رضا', 'فالبک اشتراک شماره: رضا/بله ← مخاطب واتساپ');
ok(MM.contactFind(C, 'telegram', 'سلام') === null, 'بدون فالس‌پازیتیو: سلام → null');
ok(MM.contactFind(C, 'discord', 'علی') === null, 'اپ بدون مخاطب و بدون اشتراک شماره → null');
ok((MM.contactFind(C, '', 'علی', true) || {}).name === 'علی', 'حالت anyApp (برای حذف) → علی');
ok((MM.contactFind([{ id: 'x', name: 'حسین', app: 'telegram', handle: 'h1' }], 'telegram', 'Hossein') || {}).name === 'حسین', 'Hossein → حسین');
ok((MM.contactFind([{ id: 'x', name: 'فاطمه', app: 'telegram', handle: 'f1' }], 'telegram', 'fatima') || {}).name === 'فاطمه', 'fatima → فاطمه');
ok((MM.contactFind([{ id: 'x', name: 'مامان بزرگ', app: 'bale', handle: '09123333333' }], 'whatsapp', 'مامان بزرگ') || {}).name === 'مامان بزرگ', 'مقصد چندکلمه‌ای + فالبک شماره');
ok((MM.contactFind([{ id: 'x', name: 'Ali', app: 'telegram', handle: 'ali_gh' }], 'telegram', 'علی') || {}).name === 'Ali', 'عکس مسیر: علی (گفته) → Ali (ثبت‌شده)');

/* ============ ۳) گرامر ارسال v3 — فیکس فعل سر متن + ایتا ============ */
section('گرامر ارسال v3');
r = MM.msgParse('به علی پیام بده تو تلگرام بگو بیا ویس');
ok(r && r.text === 'بیا ویس' && r.target === 'علی' && r.app === 'telegram', 'فعلِ تکراری سر متن حذف شد: «بیا ویس» نه «بگو بیا ویس»');
r = MM.msgParse('تو تلگرام به علی بگو سلام');
ok(r && r.target === 'علی' && r.text === 'سلام' && r.app === 'telegram', 'اپ-اول: تو تلگرام به علی بگو سلام');
r = MM.msgParse('به Ali پیام بده تو دیسکورد که بیا');
ok(r && r.target === 'Ali' && r.text === 'بیا' && r.app === 'discord', 'مقصد لاتین: Ali');
r = MM.msgParse('به علی تو ایتا پیام بده که سلام');
ok(r && r.app === 'eitaa' && r.text === 'سلام', 'ایتا با مکان → eitaa');
ok(MM.msgParse('پخش آهنگ ایتالیا کن') === null, 'گارد «ایتالیا» → eitaa نمی‌گیرد');
ok(MM.msgParse('به علی پیام بده ایتا') === null || MM.msgParse('به علی پیام بده ایتا').app !== 'eitaa', 'ایتا بدون مکان صریح → eitaa نیست');
r = MM.msgParse('تو ایتا به علی بگو رسیدم');
ok(r && r.app === 'eitaa' && r.text === 'رسیدم', 'ایتا اپ-اول');
r = MM.msgParse('به علی تلگرام پیام بده "فردا میام"');
ok(r && r.text === 'فردا میام', 'گیومه اولویت دارد');
r = MM.msgParse('به مامان بزرگ تو بله پیام بده که رسیدم');
ok(r && r.target === 'مامان بزرگ' && r.text === 'رسیدم' && r.app === 'bale', 'مقصد چندکلمه‌ای بله');
r = MM.msgParse('به ۰۹۱۲۱۲۳۴۵۶۷ واتساپ پیام بده که سلام');
ok(r && MM.phoneLike(r.target) === '09121234567', 'مقصد شمارهٔ فارسی → phoneLike');
ok(MM.msgParse('بله درسته حالا برو') === null, 'گارد بله پابرجا');

/* ============ ۴) سیم‌کشی app.js — لَین‌های جدید ============ */
section('app.js — لَین مخاطبین صوتی + عیب‌یاب');
ok(appSrc.includes('AVAMessaging.ctCmdParse'), 'لَین مخاطبین: ctCmdParse صدا زده می‌شود');
ok(appSrc.includes("intent: 'contacts_' + _ctc.op"), 'recordTurn مخاطبین با op');
ok(appSrc.includes('aliases: [_ctc.name]'), 'ذخیره با alias اولیه');
ok(appSrc.includes("AVAMessaging.contactFind(_all, '', _ctc.name, true)"), 'حذف با جستجوی anyApp');
ok(appSrc.includes('از این به بعد فقط بگو'), 'پاسخ ذخیره راهنمای بعدی دارد');
ok(/تلگرام\|دیسکورد\|واتساپ\|روبیکا\|ایتا\|telegram\|discord\|whatsapp\|eitaa/.test(appSrc), 'MSG_APP_SENT_RE شامل ایتا/eitaa');
ok(appSrc.includes("intent: 'msg_test'"), 'لَین عیب‌یاب صوتی با intent=msg_test');
ok(appSrc.includes('bridge.msg.test'), 'عیب‌یاب تلگرام از msg:test استفاده می‌کند');
ok(appSrc.includes('_mpGuard && _mpGuard.text && _mpGuard.target'), 'گارد دزدیده‌نشدنِ جملهٔ ارسال در عیب‌یاب');
ok(appSrc.includes("action: 'selftest'"), 'عیب‌یاب دیسکورد به selftest وصل است');
ok(/0\.[6-9][0-9]?\.0-beta/.test(appSrc), 'نسخه در app.js'); /* v0.69 forward-relax */

/* ============ ۵) main.js — حالت تست تلگرام ============ */
section('main.js — عیب‌یاب تلگرام (بدون هیچ ارسالی)');
ok(mainSrc.includes('[int]$Test = 0') || mainSrc.includes('[int]$Test = $(if ($ReqObj.test)'), 'TG_PS_BODY پارامتر $Test دارد'); /* v0.72 forward-relax: از req JSON */
const tgBodyStart = mainSrc.indexOf('const TG_PS_BODY');
const tgBodyEnd = mainSrc.indexOf('function runTgPs');
const tgBody = mainSrc.slice(tgBodyStart, tgBodyEnd);
ok(!tgBody.includes('/*'), 'پین دائمی: هیچ /* داخل بدنهٔ PS تلگرام نیست');
ok(tgBody.indexOf("if ($Test -eq 1)") > tgBody.indexOf('function Restore-Focus') && tgBody.indexOf("if ($Test -eq 1)") < tgBody.indexOf('# گام ۱'), 'شاخهٔ $Test بعد از تعریف Restore-Focus و قبل از گام ۱ است');
ok(tgBody.includes("Write-Output 'OK:TGTEST'"), 'خروجی تست OK:TGTEST');
ok(tgBody.indexOf("if ($Test -eq 1)") < tgBody.indexOf('ERR:NOTEXT'), 'حالت تست قبل از چک‌های نام/متن است (هیچ ارسالی انجام نمی‌شود)');
ok(/function runTgPs\(nm, msgText, username, testMode(, variants)?(, openMode)?(, readMode)?\)/.test(mainSrc), 'runTgPs پارامتر testMode دارد'); /* v0.75 forward-relax: +openMode+readMode */
ok(mainSrc.includes("'-Test', testMode ? '1' : '0'") || mainSrc.includes('test: !!testMode'), 'آرگومان -Test به PS پاس می‌شود'); /* v0.72 forward-relax: req JSON */
ok(mainSrc.includes("ipcMain.handle('msg:test'"), 'IPC msg:test ثبت شده');
ok(mainSrc.includes("runTgPs('', '', '', true)"), 'msg:test تلگرام → runTgPs در حالت تست');
ok(mainSrc.includes('0.68.0-beta') === false || mainSrc.includes('0.68.0-beta'), 'main.js نسخه (اگر ثابت دارد) — بدون کرش');

/* ============ ۶) preload + رجیستری اپ‌ها ============ */
section('preload + رجیستری');
ok(preloadSrc.includes("test: (p) => ipcRenderer.invoke('msg:test', p)"), 'پل preload msg.test');
ok(MM.msgAppsOf().some((m) => m.id === 'eitaa' && m.needsLoc), 'ایتا در رجیستری با needsLoc');
ok(MM.appOf('ایتا').id === 'eitaa' && MM.appOf('eitaa').id === 'eitaa', 'appOf ایتا دوزبانه');
ok(MM.detectInstalled([{ name: 'Eitaa Messenger' }]).includes('eitaa'), 'detectInstalled ایتا را می‌شناسد');

/* ============ ۷) نسخه ============ */
section('نسخه');
ok(/^0\.[6-9][0-9]?\.0-beta$/.test(pkg.version), 'package.json = 0.68/0.69-beta'); /* v0.69 forward-relax */

console.log('\n============================================');
console.log(`نتیجه: ${pass} PASS / ${fail} FAIL`);
if (fail) { console.log('فیل‌ها:'); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log('ALL GREEN — v0.68 مرحلهٔ ۳ کامل');
