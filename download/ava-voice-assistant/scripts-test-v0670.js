'use strict';
/* ============================================================
   آوا — scripts-test-v0670.js — اکستنشن پیام‌رسانی مرحلهٔ ۲ (اتوماسیون واقعی)
   ------------------------------------------------------------
   ریشهٔ گزارش کاربر روی v0.66.0-beta: «پیام رسان‌ها هیچکدوم کار نمیکنه؟؟؟
   میگم به فلانی پیام بده تو تلگرام اصن هیچکاری نمیکنه… یا تو دیسکورد، حتی
   با این ک تلگرام pc بازه»
   ریشه‌ها: (۱) tg://resolve فقط یوزرنیم لاتین می‌شناسد — نام فارسی ساکت
   نادیده می‌شود؛ (۲) موتور اثبات‌شدهٔ msgsend دیسکورد (v0.35) به لَین وصل
   نبود؛ (۳) «به فلانی پیام بده تو تلگرام» متن = «تو تلگرام»؛ (۴) پاسخ
   دروغین «باز شد»؛ (۵) تلگرام هیچ موتور اتوماسیونی نداشت.
   فیکس‌های این سوئیت: موتور تلگرام (TG_PS_BODY + runTgPs)، IPC msg:send،
   گرامر v2 (عبارت اپ از متن حذف؛ مقصد چندکلمه‌ای؛ گارد بله)، مخاطبین
   (settings.msgContacts + contactFind + UI)، گارد دیکتهٔ پیام‌رسانی.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const APP = __dirname;
const mainSrc = fs.readFileSync(path.join(APP, 'main.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(APP, 'renderer/js/app.js'), 'utf8');
const idxSrc = fs.readFileSync(path.join(APP, 'renderer/index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(APP, 'renderer/css/styles.css'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(APP, 'preload.js'), 'utf8');
const MM = require(path.join(APP, 'renderer/js/voiceMessaging.js'));

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; fails.push(label); console.log('  ✗ ' + label); }
}

/* ---------- ۱) گرامر v2 — جمله‌های دقیق کاربر (زنده) ---------- */
console.log('\n[1] گرامر v2 — جمله‌های دقیق کاربر');
const c1 = MM.msgParse('به فلانی پیام بده تو تلگرام');
ok(!!c1 && c1.app === 'telegram' && c1.target === 'فلانی', 'جملهٔ کاربر: اپ=تلگرام مقصد=فلانی');
ok(!!c1 && c1.text === '', 'رگرسیون اصلی: «تو تلگرام» دیگر متنِ پیام نمی‌شود (متن خالی = سؤال صادقانه)');
const c2 = MM.msgParse('به فلانی تو تلگرام پیام بده که سلام خوبی');
ok(!!c2 && c2.target === 'فلانی' && c2.text === 'سلام خوبی', 'مکان وسط جمله + متن بعد از «که»');
const c3 = MM.msgParse('پیام بده به علی تو دیسکورد که بیا ویس');
ok(!!c3 && c3.app === 'discord' && c3.target === 'علی' && c3.text === 'بیا ویس', 'فعل در سر جمله: «پیام بده به علی تو دیسکورد که…»');
const c4 = MM.msgParse('به مامان بزرگ تو بله پیام بده که رسیدم');
ok(!!c4 && c4.app === 'bale' && c4.target === 'مامان بزرگ' && c4.text === 'رسیدم', 'مقصد چندکلمه‌ای + بله با عبارت مکانی');
const c5 = MM.msgParse('بله بگو سلام');
ok(c5 === null, 'نگاتیو: «بله بگو سلام» (بله بدون مکان) → null');
const c6 = MM.msgParse('سلام خوبی');
ok(c6 === null, 'نگاتیو: جملهٔ عادی → null');
const c7 = MM.msgParse('به علی در تلگرام پیام بده که سلام');
ok(!!c7 && c7.target === 'علی' && c7.text === 'سلام', 'سازگاری v0660a: شکل استاندارد دست‌نخورده');
const c8 = MM.msgParse('در بله به مامان پیام بده شام خوردی');
ok(!!c8 && c8.app === 'bale' && c8.target === 'مامان' && c8.text === 'شام خوردی', 'سازگاری v0660a: «در بله به مامان پیام بده …»');
const c9 = MM.msgParse('به رضا واتساپ پیام بده سلام داری؟');
ok(!!c9 && c9.app === 'whatsapp' && c9.target === 'رضا' && c9.text === 'سلام داری؟', 'سازگاری v0660a: واتساپ بدون «که»');
const c10 = MM.msgParse('به علی تلگرام پیام بده "فردا میام"');
ok(!!c10 && c10.text === 'فردا میام', 'گیومه اولویت دارد');
const c11 = MM.msgParse('تلگرام به مامان بگو شام خوردی');
ok(!!c11 && c11.app === 'telegram' && c11.target === 'مامان' && c11.text === 'شام خوردی', 'اپ در سر جمله');
const c12 = MM.msgParse('به رضا تو دیسکورد پیام بده');
ok(!!c12 && c12.target === 'رضا' && c12.text === '', 'بدون متن → مقصد هست، متن خالی (سؤال می‌شود)');

/* ---------- ۲) توابع مسیریابی قطعی ---------- */
console.log('\n[2] توابع کمکی مسیریابی');
ok(MM.isLatinUsername('ali_dev') === true, 'isLatinUsername: ali_dev → true');
ok(MM.isLatinUsername('@ali.dev') === true, 'isLatinUsername: @ali.dev → true (با @)');
ok(MM.isLatinUsername('فلانی') === false, 'isLatinUsername: فلانی → false (ریشهٔ بن‌بست deep-link)');
ok(MM.isLatinUsername('2abc') === false, 'isLatinUsername: شروع با رقم → false');
ok(MM.phoneLike('۰۹۱۲ ۳۴۵ ۶۷۸۹') === '09123456789', 'phoneLike: ارقام فارسی → 09123456789');
ok(MM.phoneLike('مامان') === '', 'phoneLike: نام → خالی');
const ctList = [{ id: 'm1', name: 'علی چت', app: 'telegram', handle: 'ali_dev' }];
const ctH = MM.contactFind(ctList, 'telegram', 'علی چت');
ok(!!ctH && ctH.handle === 'ali_dev', 'contactFind: تطبیق دقیق');
const ctF = MM.contactFind(ctList, 'telegram', 'علی چط');
ok(!!ctF && ctF.handle === 'ali_dev', 'contactFind: نویز STT (لوانشتاین محافظه‌کار)');
ok(MM.contactFind(ctList, 'whatsapp', 'علی چت') === null, 'contactFind: اپ اشتباه → null');
ok(MM.contactFind([], 'telegram', 'علی') === null, 'contactFind: لیست خالی → null');
const ctP = MM.contactFind([{ id: 'm2', name: 'مامان', app: 'whatsapp', handle: '09123456789' }], 'whatsapp', 'مامان');
ok(!!ctP && MM.phoneLike(ctP.handle) === '09123456789', 'contactFind واتساپ: نام مامان → شماره');

/* ---------- ۳) موتور تلگرام در main.js ---------- */
console.log('\n[3] موتور اتوماسیون تلگرام (TG_PS_BODY + runTgPs)');
const tgStart = mainSrc.indexOf('const TG_PS_BODY');
const tgEnd = mainSrc.indexOf('function runTgPs');
ok(tgStart > -1 && tgEnd > tgStart, 'TG_PS_BODY قبل از runTgPs تعریف شده');
const tgBody = tgStart > -1 ? mainSrc.slice(tgStart, tgEnd) : '';
ok((tgBody.match(/\/\*/g) || []).length === 0, 'بدنهٔ PS تلگرام هیچ کامنت /* ندارد (پاورشل فقط # می‌فهمد — رگرسیون)');
ok(tgBody.includes("Get-Process -Name Telegram,TelegramDesktop,64Gram,Unigram"), 'کشف پروسهٔ تلگرام + فورک‌های شناخته‌شده');
ok(tgBody.includes('ERR:NO_TG') && tgBody.includes('ERR:NO_TG_WINDOW'), 'خطای صادقانه: تلگرام باز نیست / پنجره پیدا نشد');
ok(tgBody.includes("Send-Combo 'ctrl,k'"), 'v0.70 — سرچ گلوبال با Ctrl+K (Ctrl+F فقط داخل چت بود — ریشهٔ NO_MATCH لاگ Ali-HK)');
ok(tgBody.includes("'f' = 0x21") && tgBody.includes("'esc' = 0x01"), 'اسکن‌کد مستقل از layout: f=0x21, esc=0x01');
ok(tgBody.includes('Set-Clipboard -Value $nm') && tgBody.includes('Set-Clipboard -Value $msg'), 'پیست با کلیپ‌بورد (SendKeys فارسی نمی‌نویسد)');
ok(tgBody.includes("Get-Clipboard -Raw"), 'تایید کلیپ‌بورد قبل از پیست (الگوی دیسکورد)');
ok(tgBody.includes('Focus-TgHard') && tgBody.includes('AttachThreadInput') && tgBody.includes('SwitchToThisWindow'), 'زنجیرهٔ فوکوس تاییدشده (همان الگوی اثبات‌شدهٔ دیسکورد)');
ok(tgBody.includes("Send-Combo 'esc'") && tgBody.includes('Read-TgBest'), 'Esc×2 + انتخاب نتیجه با UIA (v0.70)');
ok(tgBody.includes('tg://resolve?domain='), 'مسیر یوزرنیم لاتین: tg://resolve (سریع‌تر از سرچ)');
ok(tgBody.includes('OK:MSGSENT-UNVERIFIED') && tgBody.includes('OK:MSGSENT'), 'خروجی صادقانه: SENT با تأیید UIA یا UNVERIFIED — هیچ OK دروغین');
ok(tgBody.includes('UIAutomationClient'), 'تلاش تأیید ارسال در درخت UIA');
ok(tgBody.includes('Restore-Focus'), 'بازگردانی فوکوس به پنجرهٔ قبلی');
ok(mainSrc.includes("path.join(app.getPath('userData'), 'ava-tg.ps1')"), 'اسکریپت در userData با BOM نوشته می‌شود');
ok(mainSrc.slice(tgEnd, tgEnd + 2200).includes("'-STA'"), 'spawn پاورشل با -STA (Set-Clipboard کاری)');

/* ---------- ۴) IPC msg:send + پل preload ---------- */
console.log('\n[4] IPC msg:send و پل preload');
ok(/ipcMain\.handle\('msg:send'/.test(mainSrc), 'هندلر msg:send در main');
ok(mainSrc.includes("runDiscordPs('msgsend', 'fg', name, 46, 52, text"), 'دیسکورد → موتور اثبات‌شدهٔ v0.35 (پارادوکس deep-link حل شد — v0.74 ریلکس: +variants)');
ok(/return runTgPs\(name, text, username, false, variants(, openMode)?\)/.test(mainSrc), 'تلگرام → موتور جدید (+واریانت‌ها)'); /* v0.75 forward-relax: +openMode */
ok(mainSrc.includes("String((p && p.username) || '').replace(/[^a-zA-Z0-9_@.]/g, '')"), 'پاک‌سازی username (قاعدهٔ B8)');
ok(/send: \(p\) => ipcRenderer\.invoke\('msg:send', p\)/.test(preloadSrc), 'پل preload msg.send');

/* ---------- ۵) لَین پیام‌رسانی v2 در app.js ---------- */
console.log('\n[5] لَین پیام‌رسانی v2 — مسیریابی صادقانه');
ok(appSrc.includes('v0.67 — لَین قطعیِ پیام‌رسانی (اکستنشن مرحلهٔ ۲ — اتوماسیون واقعی)'), 'کامنت لَین v0.67');
ok(appSrc.includes('bridge.msg.send({ app: _mp.app, name: _name, text: _mp.text, username: _uname, variants: _vs })'), 'لَین: ارسال با اتوماسیون (msg.send + واریانت‌ها)');
ok(appSrc.includes('AVAMessaging.contactFind(_cts, _mp.app, _mp.target)'), 'لَین: حل مخاطب قبل از ارسال');
ok(appSrc.includes('/UNVERIFIED/.test(String(r.result || \'\'))'), 'لَین: پاسخ UNVERIFIED صادقانه («چک کن رسیده باشه»)');
ok(appSrc.includes('چی برای «'), 'لَین: بدون متن پیام سؤال صادقانه می‌شود (نه deep-link لخت)');
ok(appSrc.includes('AVAMessaging.phoneLike(_mp.target) || (_ct2 ? AVAMessaging.phoneLike(_ct2.handle)'), 'واتساپ: شماره از جمله یا مخاطبین');
ok(appSrc.includes('(وب اتوماسیون تایپ ندارم)'), 'بله/روبیکا: صادقانه — خودت Ctrl+V کن');
ok(appSrc.includes("tg://resolve?domain=' + _uname"), 'فالبک تلگرام-بسته با یوزرنیم: deep-link + کلیپ‌بورد');
ok(appSrc.indexOf('v0.67 — لَین قطعیِ پیام‌رسانی') < appSrc.indexOf('لَینِ قطعیِ «بنویس»'), 'لَین پیام‌رسانی قبل از لَین «بنویس» (بنویسِ پیام‌رسانی نمی‌دزدد)');

/* ---------- ۶) گارد دیکتهٔ پیام‌رسانی ---------- */
console.log('\n[6] گارد دیکته');
ok(/const MSG_APP_SENT_RE = \/[^;]*تلگرام[^;]*دیسکورد[^;]*واتساپ[^;]*\/i;/.test(appSrc), 'MSG_APP_SENT_RE تعریف شده (v0.68: forward-relax برای ایتا)');
ok(appSrc.includes('if ((DICT_START_RE.test(raw) || wakeDictStart) && !MSG_APP_SENT_RE.test(raw)) {'), 'دیکتهٔ صوتی جملهٔ پیام‌رسانی را نمی‌رباید');
ok(appSrc.indexOf('MSG_APP_SENT_RE') < appSrc.indexOf('v0.67 — لَین قطعیِ پیام‌رسانی'), 'گارد قبل از لَین پیام‌رسانی تعریف شده');

/* ---------- ۷) مخاطبین: UI + settings + i18n ---------- */
console.log('\n[7] مخاطبین پیام‌رسان (UI + ذخیره + i18n)');
ok(appSrc.includes('msgContacts: store.get(\'msgContacts\', [])'), 'پیش‌فرض settings.msgContacts');
ok(appSrc.includes('function msgContactsRender()'), 'رندر لیست مخاطبین');
ok(appSrc.includes("store.set('msgContacts', settings.msgContacts)"), 'ذخیرهٔ مخاطبین در store');
ok(appSrc.includes("id: 'm' + Date.now().toString(36)"), 'ایجاد مخاطب با id یکتا');
ok(appSrc.includes("'set.ext.ctTitle': ['مخاطبین پیام‌رسان'"), 'i18n: ctTitle FA');
ok(appSrc.includes("'set.ext.ctAdd': ['افزودن'"), 'i18n: ctAdd FA');
ok(/id="msgContactsList"/.test(idxSrc) && /id="btnCtAdd"/.test(idxSrc), 'UI: لیست + دکمهٔ افزودن');
ok(/id="ctName"/.test(idxSrc) && /id="ctHandle"/.test(idxSrc) && /id="ctApp"/.test(idxSrc), 'UI: فیلدهای نام/اپ/شناسه');
ok(cssSrc.includes('.ct-form') && cssSrc.includes('.ct-del'), 'CSS فرم مخاطبین');

/* ---------- نتیجه ---------- */
console.log('\n———————————————');
console.log('PASS=' + pass + '  FAIL=' + fail);
if (fails.length) console.log('failures:\n - ' + fails.join('\n - '));
process.exit(fail ? 1 : 0);
