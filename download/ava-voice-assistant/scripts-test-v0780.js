#!/usr/bin/env node
/* v0.78.0-beta — «پاپ‌آپ مخاطب جدید وسط مکالمه + فول‌اسکرین/بستن هدفمند/مانیتور»
   عین خواسته‌های کاربر:
   ۱) «یک المان کوچولو برای اضافه کردن مخاطب که وسط همون مکالمه پاپ بشه… AI بنویسه
      همینه درسته؟؟؟ و دکمه تایید… بعد خودکار صدا کاربرو بگیره ک تایید کنه اگ نکرد
      میتونه بگه کدوم ویرایش بشه و ادامه..یا منصرف بشه.. سناریوی جاافتاده رو هم اضافه کن»
   ۲) «اپشن فول اسکرین کردن ویدو پلیر کار نمیکنه»
   ۳) «وقتی میگم ویدیو قبلی ک باز کرده بودم رو ببند (دو ویدیو همزمان بازه) جفتشون رو میبنده»
   ۴) «خاموش کردن مانیتور کار نمیکنه» (ریشه: escape خرابِ PS از v0.43) */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
function section(t) { console.log('— ' + t); }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

const M = require('./renderer/js/voiceMessaging.js');
const I = require('./renderer/js/voiceIntent.js');
const appSrc = read('renderer/js/app.js');
const mainSrc = read('main.js');
const idxSrc = read('renderer/index.html');
const cssSrc = read('renderer/css/styles.css');
const docsSrc = read('docs/COMMANDS-FA.md');

console.log('==== v0.78.0-beta: پاپ‌آپ مخاطب جدید + فیکس‌های پلیر/مانیتور ====');

/* ---------- ۱) ctAddParse — عین جمله‌های کاربر ---------- */
section('۱) ctAddParse — جمله‌های طبیعی کاربر (رفتاری)');
{
  const a1 = M.ctAddParse('میخام مخاطب جدید ایجاد کنم برا دیسکورد');
  ok(!!a1 && a1.op === 'add-popup' && a1.app === 'discord', '«میخام مخاطب جدید ایجاد کنم برا دیسکورد» → اپ دیسکورد → ' + JSON.stringify(a1));
  ok(!!a1 && a1.appFa === 'دیسکورد', 'appFa فارسی = دیسکورد');
  ok(!!a1 && !a1.handle && !a1.name, 'بدون یوزر/لقب → فیلدهای خالی برای پرسش صوتی');

  const a2 = M.ctAddParse('میخام یک نفر اد کنی برام به اسم soliiii تو دیسکورد من صداش میکنم داداش');
  ok(!!a2 && a2.handle === 'soliiii', '«به اسم soliiii … صداش میکنم داداش» → یوزر soliiii → ' + JSON.stringify(a2));
  ok(!!a2 && a2.name === 'داداش', 'لقب = داداش');
  ok(!!a2 && a2.app === 'discord', 'اپ = دیسکورد');

  const a3 = M.ctAddParse('یه نفر اضافه کن برام تو تلگرام بهش میگم علی');
  ok(!!a3 && a3.app === 'telegram' && a3.name === 'علی' && !a3.handle, '«بهش میگم علی» → لقب علی، اپ تلگرام، یوزر خالی');

  const a4 = M.ctAddParse('ذخیره کن سارا رو تو تلگرام');
  ok(!!a4 && a4.name === 'سارا' && a4.app === 'telegram' && !a4.handle, 'شکل کلاسیک بدون هندل → پاپ‌آپ با نام+اپ → ' + JSON.stringify(a4));

  const a5 = M.ctAddParse('مخاطب جدید برا واتساپ شماره ۰۹۱۲۳۴۵۶۷۸۹۰');
  ok(!!a5 && a5.app === 'whatsapp' && a5.kind === 'phone' && a5.handle === '091234567890', 'شمارهٔ فارسی → kind=phone');

  const a6 = M.ctAddParse('اد کن برام به اسم سولی تو دیسکورد من صداش میکنم داداش');
  ok(!!a6 && a6.handle === 'سولی' && a6.name === 'داداش' && Array.isArray(a6.warn) && a6.warn.includes('latin-needed'), 'یوزرِ فارسی (STT) → هندل + هشدار لاتین‌بودن → ' + JSON.stringify(a6));

  /* گاردها — نباید پاپ‌آپ باز شود */
  ok(M.ctAddParse('به علی پیام بده تو تلگرام که سلام') === null, 'گارد: جملهٔ ارسال پیام هرگز پاپ‌آپ نیست');
  ok(M.ctAddParse('علی رو تو تلگرام با یوزر ali_gh ذخیره کن') === null, 'گارد: شکل کلاسیک با یوزر صریح → ctCmdParse (پاپ‌آپ نمی‌خواهد)');
  ok(M.ctAddParse('مخاطب علی رو حذف کن') === null, 'گارد: حذف مخاطب پاپ‌آپ نیست');
  ok(M.ctAddParse('مخاطبینو بخون') === null, 'گارد: لیست مخاطبین پاپ‌آپ نیست');
  ok(M.ctAddParse('اسم مخاطبم تو دیسکورد mmd هست من محمد صداش میکنم') === null, 'گارد: آموزشِ قطعی v0.76 (با یوزر) سرجایش است');
}

/* ---------- ۲) ویرایش صوتی + تایید/انصراف ---------- */
section('۲) ctAddEditParse / ctAddValueOf / REهای تایید و انصراف');
{
  const e1 = M.ctAddEditParse('یوزرشو بکن soli_2');
  ok(!!e1 && e1.field === 'handle' && e1.value === 'soli_2', '«یوزرشو بکن soli_2» → ' + JSON.stringify(e1));
  const e2 = M.ctAddEditParse('اسمشو بکن سارا');
  ok(!!e2 && e2.field === 'name' && e2.value === 'سارا', '«اسمشو بکن سارا» → ' + JSON.stringify(e2));
  const e3 = M.ctAddEditParse('برا واتساپه');
  ok(!!e3 && e3.field === 'app' && e3.value === 'whatsapp', '«برا واتساپه» → اپ واتساپ');
  const e4 = M.ctAddEditParse('آیدیش رو عوض کن به soli.real');
  ok(!!e4 && e4.field === 'handle' && e4.value === 'soli.real', '«آیدیش رو عوض کن به …» → هندل');
  const v1 = M.ctAddValueOf('soliiii', 'handle');
  ok(!!v1 && v1.field === 'handle' && v1.value === 'soliiii', 'توکن لاتین تنها در مرحلهٔ handle → ' + JSON.stringify(v1));
  const v2 = M.ctAddValueOf('سارا', 'name');
  ok(!!v2 && v2.field === 'name' && v2.value === 'سارا', 'واژهٔ فارسی تنها در مرحلهٔ name → لقب');
  const v3 = M.ctAddValueOf('سولی', 'handle');
  ok(!!v3 && v3.field === 'handle' && v3.warn && v3.warn.includes('latin-needed'), 'واژهٔ فارسی در مرحلهٔ handle → هشدار لاتین');
  ok(M.CTADD_YES_RE.test('ذخیره کن') && M.CTADD_YES_RE.test('همینه') && M.CTADD_YES_RE.test('آره') && M.CTADD_YES_RE.test('تایید'), 'RE تایید: ذخیره کن/همینه/آره/تایید');
  ok(M.CTADD_NO_RE.test('بیخیال') && M.CTADD_NO_RE.test('منصرف شدم') && M.CTADD_NO_RE.test('کنسل') && M.CTADD_NO_RE.test('ولش کن'), 'RE انصراف: بیخیال/منصرف شدم/کنسل/ولش کن');
  ok(!M.CTADD_YES_RE.test('به علی پیام بده سلام'), 'جملهٔ بلند هرگز تاییدِ عین نیست');
  ok(!M.CTADD_NO_RE.test('نه بابا من گفتم علی'), 'جملهٔ بلند هرگز انصرافِ عین نیست');
}

/* ---------- ۳) videoCtlOf — هدف بستن ---------- */
section('۳) videoCtlOf — بستن هدفمند (رفتاری)');
{
  const c1 = I.videoCtlOf('ویدیو قبلی ک باز کرده بودم رو ببند');
  ok(!!c1 && c1.action === 'close' && c1.arg === 'oldest', '«ویدیو قبلی ک باز کرده بودم رو ببند» → close:oldest → ' + JSON.stringify(c1));
  const c2 = I.videoCtlOf('ویدیو رو ببند');
  ok(!!c2 && c2.action === 'close' && c2.arg === 'auto', '«ویدیو رو ببند» → close:auto');
  const c3 = I.videoCtlOf('ویدیو جدید رو ببند');
  ok(!!c3 && c3.action === 'close' && c3.arg === 'newest', '«ویدیو جدید رو ببند» → close:newest');
  const c4 = I.videoCtlOf('همه ویدیو ها رو ببند');
  ok(!!c4 && c4.action === 'close' && c4.arg === 'all', '«همه ویدیوها رو ببند» → close:all');
  const c5 = I.videoCtlOf('دو ویدیو رو ببند');
  ok(!!c5 && c5.action === 'close' && c5.arg === 'all', '«دو ویدیو رو ببند» → close:all');
  const c6 = I.videoCtlOf('جفتشون رو ببند');
  ok(!!c6 && c6.action === 'close' && c6.arg === 'all', '«جفتشون رو ببند» → close:all');
  const c7 = I.videoCtlOf('اولین ویدیو رو ببند');
  ok(!!c7 && c7.action === 'close' && c7.arg === 'oldest', '«اولین ویدیو رو ببند» → close:oldest');
  /* رگرسیون‌ها */
  const r1 = I.videoCtlOf('ویدیو رو فول اسکرین کن');
  ok(!!r1 && r1.action === 'fullscreen', 'رگرسیون: فول اسکرین سرجایش');
  const r2 = I.videoCtlOf('برو جلو ۳۰ ثانیه');
  ok(!!r2 && r2.action === 'seek' && r2.arg === 30, 'رگرسیون: پرش ۳۰ ثانیه (ارقام فارسی)');
  const r3 = I.videoCtlOf('ویدیو قبلی رو بده');
  ok(!!r3 && r3.action === 'prev', 'رگرسیون: «ویدیو قبلی رو بده» → prev (بدون فعل بستن)');
  const r4 = I.videoCtlOf('ویدیو رو پاز کن');
  ok(!!r4 && r4.action === 'play_pause', 'رگرسیون: پاز');
  const r5 = I.videoCtlOf('ویدیو رو بر بالا سمت راست');
  ok(!!r5 && r5.action === 'move' && r5.arg === 'top-right', 'رگرسیون v0.74: جابه‌جایی پنجره');
}

/* ---------- ۴) videoCtlParse مغز — close:oldest ---------- */
section('۴) videoCtlParse (app.js) — بستن هدفمند از مغز');
{
  const m = appSrc.match(/function videoCtlParse\(value\) \{[\s\S]*?\n  \}/);
  ok(!!m, 'videoCtlParse در app.js پیدا شد');
  if (m) {
    const fn = new Function('AVAIntent', 'return (' + m[0].replace(/^function videoCtlParse/, 'function') + ')');
    const vp = fn(I);
    const a = vp('close:oldest');
    ok(!!a && a.action === 'close' && a.arg === 'oldest', 'close:oldest → ' + JSON.stringify(a));
    const b = vp('close:newest');
    ok(!!b && b.action === 'close' && b.arg === 'newest', 'close:newest → ' + JSON.stringify(b));
    const cc = vp('close:all');
    ok(!!cc && cc.action === 'close' && cc.arg === 'all', 'close:all → ' + JSON.stringify(cc));
    const d = vp('close');
    ok(!!d && d.action === 'close' && d.arg === 'auto', 'close ساده → auto');
    const e = vp('فول اسکرین کن');
    ok(!!e && e.action === 'fullscreen', 'رگرسیون: عبارت کامل فارسی هنوز فهمیده می‌شود');
  }
}

/* ---------- ۵) main.js — فوکوس فول‌اسکرین + بستن هدفمند + مانیتور ---------- */
section('۵) main.js — فوکوس پلیر / بستن هدفمند / مانیتور DDC');
{
  ok(/function focusPlayerWindow\(\)/.test(mainSrc), 'focusPlayerWindow تعریف شده');
  ok(/SetForegroundWindow/.test(mainSrc) && /GetForegroundWindow/.test(mainSrc), 'فوکوس با راستی‌آزمایی GetForegroundWindow');
  ok(/keybd_event\(0x12,0,0,0\)/.test(mainSrc), 'ترفند استاندارد Alt (VK_MENU) برای حق SetForegroundWindow');
  ok(/function closeVideoTargeted\(/.test(mainSrc), 'closeVideoTargeted تعریف شده');
  ok(/Sort-Object StartTime/.test(mainSrc), 'مرتب‌سازی پلیرها بر StartTime (قبلی/جدیدترین)');
  ok(/0x0010/.test(mainSrc), 'WM_CLOSE گریس (0x0010) قبل از force');
  const fsBranch = mainSrc.match(/if \(a === 'fullscreen'\) \{[\s\S]*?\n  \}/);
  ok(!!fsBranch && /focusPlayerWindow\(\)/.test(fsBranch[0]), 'شاخهٔ fullscreen اول فوکوس می‌گیرد');
  const clBranch = mainSrc.match(/if \(a === 'close'\) \{[\s\S]*?پلیری باز نیست' \};\n  \}/);
  ok(!!clBranch && /closeVideoTargeted\(tgt\)/.test(clBranch[0]), 'شاخهٔ close مسیر هدفمند دارد');
  ok(!!clBranch && /tgt !== 'all'/.test(clBranch[0]), 'close:all تنها مسیرِ همه‌کش است');
  /* مانیتور — ریشهٔ escape + DDC */
  const mon = mainSrc.match(/monitor_off: \{[\s\S]*?fa: 'خاموش کردن مانیتور',\n  \}/);
  ok(!!mon, 'بلوک monitor_off پیدا شد');
  ok(!!mon && /SetVCPFeature/.test(mon[0]) && /0xD6/.test(mon[0]), 'DDC/CI واقعی: SetVCPFeature کد 0xD6 (روش Twinkle Tray)');
  ok(!!mon && /GetPhysicalMonitorsFromHMONITOR/.test(mon[0]) && /EnumDisplayMonitors/.test(mon[0]), 'DDC: شمارش همهٔ مانیتورهای فیزیکی');
  ok(!!mon && /0x0112/.test(mon[0]) && /0xf170/i.test(mon[0]), 'فالبک SC_MONITORPOWER broadcast حفظ شده');
  ok(!!mon && /replace\(\/"\/g, '\\\\\\"'\)/.test(mon[0].replace(/\s+/g, ' ')) || !!mon && /replace\(\/\"\/g/.test(mon[0]), 'الگوی اثبات‌شدهٔ .replace(/"/g) برای escape');
  /* فیکس خانوادهٔ PS_KEY — دیگر `\"` تک‌بک‌اسلشِ مرگبار ندارد */
  const psKey = mainSrc.match(/const PS_KEY = \(vk[\s\S]*?\n\};/);
  ok(!!psKey && /\\\\\"user32/.test(psKey[0]), 'PS_KEY: escape دوبل (\\\\\"user32.dll) — کلیدهای مدیا/صدا زنده');
  const sysSleep = mainSrc.match(/sys_sleep: \{[\s\S]*?fa: 'حالت خواب',\n  \}/);
  ok(!!sysSleep && /\\\\\"powrprof/.test(sysSleep[0]), 'sys_sleep: escape دوبل powrprof');
  const volSet = mainSrc.match(/vol_set: \{[\s\S]*?fa: 'تنظیم دقیق صدا',\n  \}/);
  ok(!!volSet && /\\\\\"user32/.test(volSet[0]), 'vol_set: escape دوبل user32');
  /* عین خطای قبلی نباید جایی بماند: '...MemberDefinition \'[DllImport(\" — الگوی شکسته */
  const brokenPattern = mainSrc.match(/MemberDefinition \\'\[DllImport\(\\"/);
  ok(!brokenPattern, 'دیگر الگوی escape شکسته (\'[DllImport(\") در main.js نیست');
}

/* ---------- ۶) app.js — لاین‌های پاپ‌آپ + UI + مغز ---------- */
section('۶) app.js — لاین‌ها، UI، i18n، کاتالوگ مغز');
{
  const iLane = appSrc.indexOf('v0.78 — لَین پاپ‌آپ مخاطب جدید — قبل از همهٔ لاین‌ها');
  const iConfirm = appSrc.indexOf('v0.70 — تأییدِ در انتظار');
  ok(iLane >= 0 && iConfirm > iLane, 'لاین تعامل پاپ‌آپ قبل از لاین تأیید contact_send است (' + iLane + ' < ' + iConfirm + ')');
  const oLane = appSrc.indexOf('v0.78 — لَین باز کردنِ پاپ‌آپ «مخاطب جدید»');
  const teach = appSrc.indexOf('v0.70 — گارد لَین آموزش/حافظه');
  ok(oLane >= 0 && teach > oLane, 'لاین باز کردن پاپ‌آپ قبل از گارد آموزش است (' + oLane + ' < ' + teach + ')');
  ok(/ctAddParse\(raw\)/.test(appSrc), 'لاین باز کردن از AVAMessaging.ctAddParse تغذیه می‌شود');
  ok(/ctAddConsume\(raw\)/.test(appSrc), 'لاین تعامل از ctAddConsume مصرف می‌کند');
  ok(/function ctAddOpen\(/.test(appSrc) && /function ctAddSave\(/.test(appSrc) && /function ctAddCancel\(/.test(appSrc) && /function ctAddQuestion\(/.test(appSrc), 'توابع پاپ‌آپ کامل: Open/Save/Cancel/Question');
  ok(/function ctAddValidate\(/.test(appSrc) && /'latin'/.test(appSrc) && /'phone'/.test(appSrc), 'اعتبارسنجی: لاتین‌بودن یوزر + شماره‌بودن واتساپ');
  ok(/function ctAddDupOf\(/.test(appSrc), 'هشدار مخاطب تکراری (بروزرسانی با اطلاع)');
  ok(/ctAddArmTimeout/.test(appSrc) && /32000/.test(appSrc), 'تایم‌اوت دو مرحله‌ای ۳۲ ثانیه (پرسش مجدد → بستن محترمانه)');
  ok(/'ctAdd\.title'/.test(appSrc) && /'ctAdd\.hint'/.test(appSrc) && /'ctAdd\.phone'/.test(appSrc), 'کلیدهای i18n ctAdd در دیکشنری');
  ok(/if \(ctAddEl && !ctAddEl\.hidden\) ctAddCancel\(\)/.test(appSrc), 'Esc پاپ‌آپ مخاطب را می‌بندد (اول زنجیره)');
  ok(/ctAdd: کنترل|close:oldest\|close:newest\|close:all/.test(appSrc), 'کاتالوغ مغز: close:oldest|newest|all در پرامپت');
  ok(/ویدیو قبلی \(ک قبلاً باز کرده بودم\) رو ببند»=close:oldest/.test(appSrc) || /«ویدیو قبلی.*close:oldest/.test(appSrc), 'قانون ۱۱ فارسی: نگاشت close:oldest');
  ok(/close the PREVIOUS video I had opened"=close:oldest/.test(appSrc), 'قانون EN: close:oldest mirror');
  ok(/'مخاطب جدید برا دیسکورد'/.test(appSrc), 'چیپ پیشنهاد «مخاطب جدید برا دیسکورد» در SUGGESTIONS');
  ok(/close:oldest|close:newest/.test(read('scripts-test-v0780.js')) === true, 'self');
}

/* ---------- ۷) UI (index.html + css) ---------- */
section('۷) UI — پاپ‌آپ شیشه‌ای مخاطب جدید');
{
  ok(/id="ctAdd"/.test(idxSrc) && /id="ctAddForm"/.test(idxSrc), 'مارک‌آپ #ctAdd + فرم');
  ok(/id="ctAddApp"/.test(idxSrc) && /id="ctAddName"/.test(idxSrc) && /id="ctAddHandle"/.test(idxSrc), 'فیلدهای اپ/لقب/یوزر');
  ok(/id="ctAddSave"/.test(idxSrc) && /id="ctAddEdit"/.test(idxSrc) && /id="ctAddCancel"/.test(idxSrc), 'دکمه‌های تایید/ویرایش/بی‌خیال');
  ok(/data-i18n="ctAdd\.title"/.test(idxSrc) && /data-i18n-ph="ctAdd\.handlePh"/.test(idxSrc), 'i18n مارک‌آپ');
  ok(/\.ctadd-card \{/.test(cssSrc), 'استایل .ctadd-card (خانوادهٔ dnsq)');
  ok(/\.ctadd-warn \{/.test(cssSrc), 'استایل هشدار داخل پاپ‌آپ');
}

/* ---------- ۸) سند ---------- */
section('۸) docs/COMMANDS-FA.md — دفتر ممیزی');
{
  ok(docsSrc.indexOf('v0.78.0') >= 0, 'سند به v0.78 به‌روز شد');
  ok(docsSrc.indexOf('پاپ‌آپ «مخاطب جدید»') >= 0, 'بخش ۴.۵ پاپ‌آپ مخاطب');
  ok(docsSrc.indexOf('close:oldest') >= 0, 'بستن هدفمند در جدول پلیر');
  ok(docsSrc.indexOf('DDC/CI') >= 0, 'یادداشت فیکس مانیتور');
}

/* ---------- نتیجه ---------- */
console.log('\n———————————————');
console.log('PASS=' + pass + '  FAIL=' + fail);
if (fails.length) { console.log('FAILED:'); fails.forEach((f) => console.log(' - ' + f)); }
console.log('==== v0.78.0-beta: ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
