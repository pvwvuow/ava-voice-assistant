#!/usr/bin/env node
/* v0.72.0-beta — «آخرین مایل»: عین باگ‌های لاگ 0.71 میدانی (activity.jsonl آپلودی 20:02–20:05)
   ۱) DBG:VARN=1 با ۷ واریانتِ فاصله‌خورده در یک رشته — argv پاورشل | و کوتیشن را می‌بلعید
   ۲) مخاطب ذخیره‌شده در واریانت‌های ارسال بعدی غایب بود
   ۳) «تمام داده‌های مربوط به پوریا پاک کن» → مخاطب پاک نشد
   ۴) «به پوریا توتل پیام بده» → مغز chat خالی داد
   ۵) تیتر «‎stagVII (5152326)» — شمارندهٔ پرانتز، شاهد تیتر را بی‌اعتبار می‌کرد */
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
const brainSrc = read('renderer/js/voiceBrain.js');
const msgSrc = read('renderer/js/voiceMessaging.js');

console.log('— ۱) ترابری JSON-فایل (ریشهٔ VARN=1) —');
ok(mainSrc.includes("[string]$Req = ''"), 'پارام اسکریپت فقط -Req (بدون -Name/-Variants argv)');
ok(!/['"]-VariantsB64['"]/.test(mainSrc), 'argv دیگر -VariantsB64 ندارد');
ok(!/['"]-Variants['"]/.test(mainSrc), 'argv دیگر -Variants ندارد');
ok(!/['"]-Name['"],\s*safeName,\s*['"]-Text['"]/.test(mainSrc), 'argv تلگرام دیگر -Name ندارد (نام از فایل می‌آید — الگوی قدیم -Name,-Text)');
ok(mainSrc.includes('ava-tg-req.json'), 'فایل درخواست JSON نوشته می‌شود');
ok(mainSrc.includes("Get-Content -LiteralPath $Req -Raw -Encoding UTF8"), 'PS فایل را UTF8 می‌خواند');
ok(mainSrc.includes("ConvertFrom-Json"), 'PS درخواست را JSON-پارس می‌کند');
ok(mainSrc.includes("Write-Output 'ERR:REQ'"), 'شکست خواندن درخواست = خطای صادقانه ERR:REQ');
ok(mainSrc.includes("'ERR:REQ': 'ارسال درخواست به موتور تلگرام ناقص ماند"), 'پیام کاربر برای ERR:REQ');
ok(/JSON\.stringify\(\{\s*name:\s*safeName,\s*text:\s*safeText,\s*username:\s*safeUser,\s*variants:\s*safeVars,\s*test:/.test(mainSrc), 'req کامل: name+text+username+variants+test');
ok(/'-File',\s*psFile,\s*'-Req',\s*reqFile/.test(mainSrc), 'argv فقط -File و -Req');

console.log('— ۲) تله‌متری میدانی —');
ok(mainSrc.includes('DBG:POPUP='), 'شمارش پاپ‌آپ‌های تلگرام (DBG:POPUP)');
ok(/DBG:VSTEP=/.test(mainSrc), 'تله‌متری هر واریانت (DBG:VSTEP)');
ok(/\$script:UIAScore/.test(mainSrc), 'امتیاز UIA در متغیر script-اسکوپ برای پذیرش');
ok(mainSrc.includes("telegram req: v="), 'لاگ js-ساید لیست واریانت‌ها');
ok(appSrc.includes("messaging variants: "), 'لاگ رندرر واریانت‌ها در لاین قطعی');
ok(appSrc.includes("brain-send variants: "), 'لاگ رندرر واریانت‌ها در مسیر مغز');

console.log('— ۳) شاهد «بخش نام» تیتر (شمارندهٔ پرانتز) —');
ok(mainSrc.includes('function Get-TgNamePart'), 'تابع استخراج بخش نام تیتر');
ok(/\\u200E\\u200F/.test(mainSrc), 'حذف LRM/RLM از تیتر (تیتر لاگ با ‎ شروع می‌شد)');
ok(/Get-TgNamePart \$title0/.test(mainSrc), 'np0 از تیتر اولیه');
ok(/\(\$np2 -ne \$np0\) -and \(Test-TgMatch \$np2 \$v\)/.test(mainSrc), 'پذیرش روی np2 (نه تیتر خام با شمارندهٔ متغیر)');
ok(/Get-TgNamePart \$title2\) -ne \$np0/.test(mainSrc), 'نظرسنجی تیتر هم با بخش نام');

console.log('— ۴) واریانت‌ها از req —');
ok(mainSrc.includes('$ReqObj.variants'), 'واریانت‌ها از ReqObj.variants (نه B64، نه split)');
ok(!/FromBase64String/.test(mainSrc), 'مسیر Base64 حذف شد');
ok(!/-split '\\\\\|'/.test(mainSrc), 'مسیر split روی | حذف شد');

console.log('— ۵) memory_forget واقعی (فکت + مخاطب) —');
ok(appSrc.includes('brain memory_forget facts='), 'لاگ اجرای forget با شمارش');
ok(/msgContacts[\s\S]{0,600}memory_forget|memory_forget[\s\S]{0,900}msgContacts/.test(appSrc), 'forget مخاطب هم‌نام را هم پاک می‌کند');
ok(appSrc.includes("چیزی دربارهٔ «"), 'پاسخ صادقانه وقتی چیزی برای پاک کردن نبود');
ok(appSrc.includes('بگو اطلاعاتِ کی پاک شود'), 'سؤال روشن وقتی value خالی است');

console.log('— ۶) «توتل» = تلگرام (لاگ: «به پوریا توتل پیام بده» → chat خالی) —');
ok(/توتل|تلیگرام/.test(msgSrc), 'رجیستری اپ: توتل/تلیگرام = تلگرام');
ok(/توتل/.test(brainSrc), 'پرامپت مغز هم توتل را اپ می‌داند');
ok(brainSrc.includes('هرگز chat خالی نمی‌ماند'), 'قانون: جملهٔ پیام‌دار هرگز chat خالی');
ok(brainSrc.includes('NEVER stays an empty chat reply'), 'قانون EN: messaging verb never empty');

console.log('— ۷) رفتارهای محافظت‌شده (بدون رگرسیون) —');
ok(mainSrc.includes('ERR:TG_NO_MATCH'), 'شکست صادقانه NO_MATCH سر جای خودش');
ok(mainSrc.includes('DBG:TITLE0='), 'لاگ تیتر اولیه حفظ شد');
ok(mainSrc.includes('DBG:VARN='), 'شمارش واریانت در لاگ حفظ شد');
ok(mainSrc.includes('DBG:VARIANTS='), 'لیست واریانت در لاگ حفظ شد');
ok(mainSrc.includes('DBG:UIASCORE='), 'امتیاز UIA در لاگ حفظ شد');
ok(mainSrc.includes('OK:MSGSENT') && mainSrc.includes('OK:MSGSENT-UNVERIFIED'), 'خروجی صادقانهٔ ارسال حفظ شد');
ok(mainSrc.includes("Send-Combo 'ctrl,k'"), 'سرچ گلوبال Ctrl+K حفظ شد');
ok(mainSrc.includes('-Milliseconds 2000'), 'انتظار نتایج ابری ۲ ثانیه');
ok(mainSrc.includes("'ERR:CLIP': 'کلیپ‌بورد در دسترس نیست"), 'پیام خطای کلیپ‌بورد حفظ شد');
ok(appSrc.includes('نجاتِ فیلدهای خالی (R1)'), 'نجات contact_save خالی v0.71 حفظ شد');
ok(appSrc.includes('آخرین ذخیره‌سازی‌ها'), 'بلوک آخرین ذخیره‌سازی‌ها حفظ شد');
ok(appSrc.includes('resolveRefTarget'), 'حل ارجاع «بهش/همین اسم» حفظ شد');
ok(msgSrc.includes('isLatinUsername'), 'تشخیص یوزرنیم لاتین حفظ شد');
ok(msgSrc.includes('faToLatin'), 'آوانگاری لاتین حفظ شد');

console.log('— ۸) تست رفتاری contactFind / msgParse (زنده) —');
const MS = require('./renderer/js/voiceMessaging.js');
const list = [
  { id: 'c1', name: 'میلاد قدوسی', app: 'telegram', handle: 'Milad Ghodousi', aliases: ['Milad Ghodousi'] },
  { id: 'c2', name: 'پوریا رحمانی', app: 'telegram', handle: 'pourya rahmani', aliases: ['Pouria Rahmani', 'pourya', '+989372989120'] },
];
ok(!!MS.contactFind(list, 'telegram', 'میلاد'), 'contactFind(میلاد) → میلاد قدوسی');
const mp1 = MS.msgParse('خوب به پوریا توتل پیام بده سلام');
ok(mp1 && mp1.app === 'telegram', 'msgParse «توتل» → telegram (لاگ 20:03:06)');
ok(mp1 && mp1.target === 'پوریا', 'msgParse «توتل» مقصد درست: پوریا');
ok(!!MS.msgParse('تو تلیگرام به میلاد پیام بده بنویس سلام'), 'msgParse «تلیگرام» → telegram');
const mpNorm = MS.msgParse('تو تلگرام به میلاد پیام بده بنویس سلام');
ok(mpNorm && mpNorm.text === 'سلام', 'رفتار عادی msgParse دست‌نخورده');

/* شبیه‌سازی PS: Get-TgNamePart باید شمارندهٔ پرانتز را بیندازد */
const namePart = (s) => {
  let x = String(s);
  x = x.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
  x = (x.replace(/\([^)]*\)\s*$/, '')).trim();
  return x.trim();
};
ok(namePart('\u200EstagVII (5152326)') === 'stagVII', 'Get-TgNamePart مدل‌سازی‌شده: تیتر لاگ واقعی → stagVII');
ok(namePart('\u200EstagVII (5152333)') === namePart('\u200EstagVII (5152326)'), 'دو تیترِ با شمارندهٔ متفاوت = یک نام (ریشهٔ شاهدِ کاذب)');

console.log('\n==== v0.72.0-beta: ' + pass + ' passed, ' + fail + ' failed ====');
if (fail) { fails.forEach((f) => console.log('FAIL: ' + f)); process.exit(1); }
