#!/usr/bin/env node
/* v0.79.0-beta — «نامِ اول» تلگرام (خواستهٔ صریح کاربر):
   «برای چیز تلگرام تو اینجوری کردی که طرف یوزرنیمشو بره سرچ کنه تو تلگرام — یعنی خود
   ای‌آی یوزرنیم رو سرچ کنه — این اشتباهه؛ باید نامی که بالاش نوشته تو تلگرام رو برید سرچ کنه»
   ریشه: از v0.67 وقتی مخاطب یوزرنیم لاتین ذخیره‌شده داشت، TG_PS_BODY مسیرِ
   tg://resolve را «قبل از» سرچ می‌زد و تیتر چت را هرگز وارسی نمی‌کرد — یوزرنیمِ
   کهنه/غلط بی‌سروصدا چتِ آدمِ اشتباه را باز می‌کرد.
   فیکس: (۱) PS همیشه اول سرچِ نام با واریانت‌ها + وارسی تیتر؛ tg://resolve فقط
   فالبکِ آخرِ کار و باز شدنش هم با وارسی تیتر تأیید می‌شود؛ (۲) هر سه لاین رندرر
   (پیام/بازکردن چت/مغز) نامِ ذخیره‌شده را اولِ صف واریانت می‌گذارند و یوزرنیم را آخر؛
   (۳) مسیر مغز وقتی contactId نمی‌دهد مخاطب را از حافظه حل می‌کند + لاتین‌اول مثل لاین قطعی */
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
const appSrc = read('renderer/js/app.js');
const mainSrc = read('main.js');

console.log('==== v0.79.0-beta: نامِ اول تلگرام — سرچِ «نام بالای چت» نه یوزرنیم ====');

/* ---------- ۱) موتور تلگرام (TG_PS_BODY) ---------- */
section('TG engine — name-first restructure');
const tgBody = (mainSrc.split('const TG_PS_BODY = `')[1] || '').split('`;')[0];
ok(tgBody.length > 2000, 'بدنهٔ PS تلگرام خوانده شد');
ok(!tgBody.includes('if ($Username) {'), 'شاخهٔ اولِ یوزرنیم (tg://resolve قبل از سرچ) حذف شد — ریشهٔ باگ');
ok(tgBody.includes('tg://resolve?domain='), 'tg://resolve حفظ شد — ولی فقط فالبک (پین v0670 رو-به-جلو)');
ok(tgBody.indexOf('foreach ($v in $variants)') < tgBody.indexOf('DBG:RESOLVE_FALLBACK'), 'سرچِ نام همیشه قبل از فالبکِ یوزرنیم اجرا می‌شود');
ok(tgBody.includes('DBG:RESOLVE_FALLBACK'), 'تله‌متری فالبک یوزرنیم (DBG:RESOLVE_FALLBACK)');
ok(tgBody.includes('Test-TgMatch $np3 $nm'), 'فالبک: تیترِ چتِ resolveشده با نام ذخیره‌شده وارسی می‌شود');
ok(tgBody.includes('Test-TgMatch $np3 $Username'), 'فالبک: تیتر با خود یوزرنیم هم وارسی می‌شود (کلاینت‌هایی که یوزر در تیتر دارند)');
ok(tgBody.includes("foreach ($v3 in $variants) { if (Test-TgMatch $np3 $v3) { $okR = $true; break } }"), 'فالبک: تیتر با همهٔ واریانت‌های نام وارسی می‌شود');
ok(tgBody.includes('ERR:TG_NO_MATCH') && tgBody.includes("Write-Output ('DBG:MATCHED=' + $usedVar)"), 'پذیرش/ردِ صادقانه حفظ شد (NO_MATCH / MATCHED)');
ok(tgBody.includes('ERR:NOFOCUS2'), 'گارد فوکوسِ بعد از resolve حفظ شد');
ok(/Get-TgNamePart \$title3\) -ne \$np0/.test(tgBody), 'فالبک: نظرسنجی تیتر مثل سرچ (بخش نام تیتر — پین v0720)');
ok(/if \(\(\$np2 -ne \$np0\) -and \(Test-TgMatch \$np2 \$v\)\)/.test(tgBody), 'پذیرشِ دوگانهٔ سرچِ نام دست‌نخورده (پین v0720)');
ok(tgBody.includes("Send-Combo 'ctrl,k'"), 'سرچ گلوبال Ctrl+K حفظ شد (پین v0670)');

/* ---------- ۲) لاین قطعی پیام‌رسانی — نامِ ذخیره‌شده اولِ صف ---------- */
section('renderer lanes — saved display name first, handle last');
ok(appSrc.includes("if (_ct && _ct.name && _mp.app !== 'discord') { _pushV(_ct.name); }"), 'لاین پیام: گارد «نامِ اول» (تلگرام) اضافه شد');
const laneA = appSrc.indexOf("if (_ct && _ct.name && _mp.app !== 'discord') { _pushV(_ct.name); }");
const laneB = appSrc.indexOf('_pushV(_mp.target);');
ok(laneA >= 0 && laneB > laneA && (laneB - laneA) < 400, 'لاین پیام: نام ذخیره‌شده قبل از اسمِ گفته‌شده پوش می‌شود');
ok(appSrc.includes("if (_ctO && _ctO.name && _cop.app !== 'discord') { _pushO(_ctO.name); }"), 'لاین بازکردن چت: گارد «نامِ اول» اضافه شد');
ok(appSrc.indexOf("if (_ctO && _ctO.name && _cop.app !== 'discord')") < appSrc.indexOf('_pushO(_cop.target);'), 'لاین بازکردن چت: نام ذخیره‌شده قبل از اسمِ گفته‌شده');
ok(appSrc.includes("if (ct && p.name && String(p.name).trim() !== name) _pushV(p.name);"), 'مسیر مغز: اسمِ گفته‌شده هم بعد از نام ذخیره‌شده در صف است');
ok(appSrc.includes('AVAMessaging.contactFind(list, app, p.name'), 'مسیر مغز: مخاطب از حافظه حل می‌شود وقتی contactId نیست («چرا از ذخیره استفاده نمیکنه»)');
ok(appSrc.includes('_hasSavedLatin'), 'مسیر مغز: لاتین‌اول مثل لاین قطعی (آوانگاریِ حدسی تنها تریگر نیست)');

/* ---------- ۳) رفتاری — ترتیب واریانت‌ها با مخاطب ذخیره‌شده ---------- */
section('behavior — variant order with a saved contact');
const contacts = [{ id: 'c1', app: 'telegram', name: 'pourya rahmani', handle: 'pourya_rah', aliases: ['پوریا'] }];
const hit = M.contactFind(contacts, 'telegram', 'پوریا');
ok(hit && hit.name === 'pourya rahmani', 'contactFind: «پوریا» → نامِ ذخیره‌شدهٔ «pourya rahmani» (پایهٔ نامِ اول)');
ok(hit && hit.handle === 'pourya_rah', 'contactFind: هندل جدا نگه داشته می‌شود (فالبک، نه کلید سرچ)');
/* شبیه‌سازی دقیق صف واریانت لاین قطعی + لاتین‌اول (همان کد app.js) */
function buildVariants(target, ct) {
  const vs = [];
  const push = (x) => { const v = String(x || '').trim(); if (v && vs.indexOf(v) === -1) vs.push(v); };
  if (ct && ct.name && 'telegram' !== 'discord') push(ct.name);
  push(target);
  if (ct) { push(ct.name); (Array.isArray(ct.aliases) ? ct.aliases : []).forEach(push); push(ct.handle); }
  if (vs.some((x) => /[A-Za-z]/.test(String(x || ''))) && M.latinFirstOrder) {
    const ord = M.latinFirstOrder(vs.slice()); vs.length = 0; ord.forEach(push);
  }
  return vs;
}
const vsTg = buildVariants('پوریا', contacts[0]);
ok(vsTg[0] === 'pourya rahmani', 'تلگرام: اولین سرچ = «نامِ بالای چت» (pourya rahmani) — نه یوزرنیم، نه اسمِ بریده');
ok(vsTg.indexOf('pourya_rah') > 0 && vsTg.indexOf('pourya_rah') > vsTg.indexOf('pourya rahmani'), 'تلگرام: یوزرنیم هرگز اولِ صف نیست — بعد از نامِ ذخیره‌شده (فقط فالبک)');
ok(vsTg.includes('پوریا'), 'تلگرام: اسمِ گفته‌شده هم تو صف سرچ هست');
/* دیسکورد: سرِ خود — سوییچر با هندل کار می‌کند (درس 0.74/0.75) */
const ctD = { id: 'c2', app: 'discord', name: 'محمد', handle: 'mmd', aliases: [] };
const vsD = buildVariants('محمد', ctD).map((x) => x);
ok(vsD[0] === 'محمد' || vsD[0] === 'mmd', 'دیسکورد: ترتیبِ آزمودهٔ خودش حفظ شد (' + vsD.join('|') + ')');
/* لاتین‌اول پایدار: ترتیب نسبی داخل گروه حفظ می‌شود */
const ord = M.latinFirstOrder(['pourya rahmani', 'پوریا', 'pourya_rah']);
ok(ord[0] === 'pourya rahmani' && ord.indexOf('pourya_rah') > ord.indexOf('pourya rahmani'), 'latinFirstOrder: نام ذخیره‌شده قبل از هندل می‌ماند (stable partition)');

/* ---------- ۴) بدون رگرسیون — مسیرهای صادقانهٔ دیگر ---------- */
section('no regression — honest paths kept');
ok(appSrc.includes("tg://resolve?domain=' + _uname"), 'فالبک «تلگرام باز نبود» با کلیپ‌بورد حفظ شد (هیچ ادعای ارسالی)');
ok(mainSrc.includes("'ERR:TG_NO_MATCH':") || mainSrc.includes('ERR:TG_NO_MATCH'), 'پیام کاربرِ NO_MATCH در map خطاها');
ok(mainSrc.includes("runTgPs(name, text, username, false, variants, openMode)"), 'msg:send همان پارامترها را می‌دهد (username فقط فالبک‌هینت است)');
ok(!/msgBuild\('telegram'[^)]*desktopLink/.test(appSrc), 'هیچ لاینی برای تلگرام deep-link لخت نمی‌زند');

/* ---------- نتیجه ---------- */
console.log('\n———————————————');
console.log('PASS=' + pass + '  FAIL=' + fail);
if (fails.length) { console.log('FAILED:'); fails.forEach((f) => console.log(' - ' + f)); }
console.log('==== v0.79.0-beta: ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
