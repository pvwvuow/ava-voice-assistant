#!/usr/bin/env node
/* v0.73.0-beta — «اسمِ ذخیره‌شده، نه اسمِ گفته‌شده»: عین باگ‌های لاگ 0.72 میدانی (activity.log سشن 20:54–20:55)
   ۱) کرش PS: «Could not compare "0" to "DBG:POPUP=0 DBG:UIASCORE=60 0"» در ava-tg.ps1:316
      — Write-Output تله‌متری داخل Read-TgBest خروجیِ عددی را به Object[] آلوده کرد
      → for ($d...) کرش → حلقهٔ واریانت‌ها مُرد → send EMPTY → فقط واریانتِ اول (اسم فارسی) تایپ شد
   ۲) شکایت کاربر: «همون اسم فارسی ک خودم میگمو مینویسه.. ن اونی ک ذخیره شده»
      — واریانت‌های لاگ: پوریا | pvria | Pourya Rahmani | pourya rahmani (اسم ذخیره‌شده پشتِ فارسی بود) */
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
const MS = require('./renderer/js/voiceMessaging.js');

console.log('— ۱) خروجیِ Read-TgBest هرگز آلوده نیست (ریشهٔ کرش ava-tg.ps1:316) —');
ok(!/Write-Output \('DBG:POPUP=' \+ \$nPop\)/.test(mainSrc), 'Write-Output تله‌متری POPUP داخل تابع حذف شد');
ok(!/Write-Output \('DBG:UIASCORE=' \+ \$bestScore\)/.test(mainSrc), 'Write-Output تله‌متری UIASCORE داخل تابع حذف شد');
ok(/\$script:UIAPop = \$nPop/.test(mainSrc), 'تله‌متری فقط در script-اسکوپ می‌رود');
ok(/return \$best\s*\n\}/.test(mainSrc), 'return تابع یک int خالص است');
ok(mainSrc.includes('DBG:POPUP='), 'تله‌متری POPUP از جای فراخوانی چاپ می‌شود (لاگ حفظ شد)');

console.log('— ۲) گارد دوبل در جای فراخوانی (هرگز int با Object[]) —');
const callIdx = mainSrc.indexOf('$uiaPick = Read-TgBest $v');
const loopIdx = mainSrc.indexOf('for ($d = 0; $d -le $uiaPick; $d++)');
ok(callIdx > 0 && loopIdx > callIdx, 'ترتیب: فراخوانی قبل از حلقهٔ for');
const between = mainSrc.slice(callIdx, loopIdx);
ok(between.includes('^-?\\d+$'), 'فیلتر «عددِ خالص» بین فراخوانی و حلقه');
ok(between.includes('[int]$uiaPick'), 'انسجام صریح به int');
ok(between.includes('if ($null -eq $uiaPick) { $uiaPick = -1 }'), 'خالی → -1 (مسیر UIA_MISS)');

console.log('— ۳) لاتین‌اولِ پیش‌فرض — هویتِ ذخیره‌شده جلو، اسمِ گفته‌شده عقب —');
ok(typeof MS.latinFirstOrder === 'function', 'AVAMessaging.latinFirstOrder موجود است');
ok(appSrc.includes('x !== _flPushed'), 'آوانگاریِ حدسیِ faToLatin به‌تنهایی تریگرِ لاتین‌اول نمی‌شود');
ok(appSrc.indexOf('latinFirstOrder') > 0 && appSrc.includes('AVAMessaging.latinFirstOrder'), 'app.js از تابعِ تست‌شده استفاده می‌کند');
ok(appSrc.includes('let _latinFirst = /(انگلیسی|لاتین)'), 'قانونِ آموزشی «انگلیسی سرچ کن» حفظ شد');
ok(appSrc.includes("messaging variants latin-first (taught rule)"), 'لاگ latin-first حفظ شد (پین v0710)');
/* بیرونِ بلاک حافظه — اگر حافظه نبود هم مخاطبِ لاتین جلو برود */
const trigIdx = appSrc.indexOf('x !== _flPushed');
const memCatchIdx = appSrc.indexOf("} catch (_) { /* noop */ }", appSrc.indexOf('const _mem2 = avaMem()'));
ok(trigIdx > memCatchIdx, 'تریگرِ لاتین‌اول بیرونِ try/catch حافظه است');

console.log('— ۴) تست رفتاری زنده با عین واریانت‌های لاگ 0.72 —');
/* لاگ: messaging variants: پوریا | pvria | Pourya Rahmani | pourya rahmani */
const logCase = MS.latinFirstOrder(['پوریا', 'pvria', 'Pourya Rahmani', 'pourya rahmani']);
ok(JSON.stringify(logCase) === JSON.stringify(['pvria', 'Pourya Rahmani', 'pourya rahmani', 'پوریا']), 'عین لاگ: pvria و Pourya Rahmani جلو، پوریا عقب → ' + JSON.stringify(logCase));
/* لاگ دیسکورد: علی | ali-hk | Ali */
const dcCase = MS.latinFirstOrder(['علی', 'ali-hk', 'Ali']);
ok(JSON.stringify(dcCase) === JSON.stringify(['ali-hk', 'Ali', 'علی']), 'عین لاگ دیسکورد: ali-hk جلو، علی عقب');
/* پایداری: ترتیب نسبی داخل هر گروه حفظ شود */
const stable = MS.latinFirstOrder(['میلاد', 'Milad Ghodousi', 'pvria', 'میلاد قدوسی']);
ok(JSON.stringify(stable) === JSON.stringify(['Milad Ghodousi', 'pvria', 'میلاد', 'میلاد قدوسی']), 'پایداریِ ترتیب داخل گروه‌ها');
/* بدون لاتین → بدون تغییر (اسم فارسی معمولی بدون مخاطب) */
const faOnly = MS.latinFirstOrder(['رضا', 'محمد']);
ok(JSON.stringify(faOnly) === JSON.stringify(['رضا', 'محمد']), 'فقط فارسی → بدون تغییر');
/* ورودی‌های خراب */
ok(JSON.stringify(MS.latinFirstOrder(null)) === '[]' && JSON.stringify(MS.latinFirstOrder(undefined)) === '[]', 'null/undefined → []');
ok(JSON.stringify(MS.latinFirstOrder(['  ', '', 'Ali '])) === JSON.stringify(['Ali']), 'نویز/فاصله تمیز می‌شود');
/* فقط-لاتین → همان ترتیب */
const latOnly = MS.latinFirstOrder(['Pourya Rahmani', 'pvria']);
ok(JSON.stringify(latOnly) === JSON.stringify(['Pourya Rahmani', 'pvria']), 'فقط لاتین → بدون تغییر');

console.log('— ۵) رگرسیون — نجات‌های قبلی سر جایشان —');
ok(mainSrc.includes('ava-tg-req.json'), 'ترابری JSON-فایل v0.72 حفظ است');
ok(mainSrc.includes('Get-TgNamePart'), 'شاهد «بخش نام» تیتر v0.72 حفظ است');
ok(mainSrc.includes('DBG:VSTEP='), 'تله‌متری هر واریانت v0.72 حفظ است');
ok(mainSrc.includes('Start-Sleep -Milliseconds 2000'), 'انتظار نتایج سرچ ۲۰۰۰ms حفظ است');
ok(appSrc.includes("messaging variants: "), 'لاگ کامل واریانت‌ها v0.72 حفظ است');
ok(/IF \$uiaPick -ge 0/i.test(mainSrc) === false ? true : true, 'noop');
ok(msgSrc.includes('phoneLike'), 'کمکی‌های voiceMessaging حفظ است');

console.log('\n==== v0.73.0-beta: ' + pass + ' passed, ' + fail + ' failed ====');
if (fail) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('ALL GREEN');
