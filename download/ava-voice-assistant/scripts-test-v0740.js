#!/usr/bin/env node
/* v0.74.0-beta — «ممیزی کامل فرمان‌ها + حافظه در سوییچر دیسکورد» — عین شکایت‌های لاگ 0.73 میدانی
   ۱) ریشهٔ اصلی: main.js:1721 — مسیر دیسکورد فقط name (اسم گفتاری «علی») را می‌گرفت و
      واریانت‌های حافظه (ali-hk | Ali | علی) هرگز استفاده نمی‌شدند → شکایت کاربر:
      «چرا از ذخیره استفاده نمیکنه برای سرچ مخاطب تو پیام رسان ها... اصلا انگار توجه نمیکنه به مموری»
   ۲) دروازهٔ دیسکورد (tryDiscordCmd) جملهٔ «آفرین حالا برو به علی تو دیسکورد پیام بده» را
      ربود، نام را بد تمیز کرد («علی تو») و خروجی‌اش هیچ‌وقت _dispatchOutcome نمی‌گرفت → [unrouted] 3ms
   ۳) یادگیری مسموم: گلهٔ کاربر «دهن منو سرویس کردی..چرا نمیفهمی» → open_app(Discord) یاد گرفته شد
   ۴) خواستهٔ کاربر: «کامند هایی ک ب اوا یاد داده بودیم رو کامل بیار بررسی کن (مخصوصا کنترل
      ویدیو پلیر)... یجا ذخیره کن بعد تست کن» → docs/COMMANDS-FA.md + گرامر videoCtlOf کامل */
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
const intentSrc = read('renderer/js/voiceIntent.js');
const MS = require('./renderer/js/voiceMessaging.js');
const I = require('./renderer/js/voiceIntent.js');
const C = require('./renderer/js/voiceCore.js');
const B = require('./renderer/js/voiceBrain.js');

console.log('— ۱) دیسکورد واریانت‌های حافظه را می‌گیرد (ریشهٔ شکایت «توجه نمیکنه به مموری») —');
ok(/return runDiscordPs\('msgsend', 'fg', name, 46, 52, text, variants(, openMode)?\)/.test(mainSrc), 'msg:send دیسکورد variants را به موتور می‌دهد'); /* v0.75 forward-relax: +openMode */
ok(mainSrc.includes('ava-dc-req.json'), 'ترابری JSON-فایل برای دیسکورد (درس تلگرام v0.72)');
ok(/function runDiscordPs\(psAction, mode, nm, dxN, dyN, msgText, variants(, msgOpenMode)?\)/.test(mainSrc), 'امضای runDiscordPs با variants'); /* v0.75 forward-relax: +msgOpenMode */
ok(mainSrc.indexOf("[string]$Req = ''") > mainSrc.indexOf('DISCORD_PS_BODY'), 'پارامتر $Req در PS دیسکورد');
ok(mainSrc.includes("if ($ReqObj.variants) { $vars = @($ReqObj.variants | ForEach-Object { [string]$_ }) }"), 'خواندن واریانت‌ها از req JSON');
ok(mainSrc.includes("if ($vars -notcontains $name) { $vars = @($name) + @($vars) }"), 'اسم گفتاری همیشه در لیست واریانت‌ها');
ok(mainSrc.includes("if ($vars.Count -gt 6) { $vars = @($vars[0..5]) }"), 'سقف ۶ واریانت (زمان‌بندی PS)');

console.log('— ۲) راستی‌آزمایی سوییچر + صداقت — هیچ تطبیق = هیچ ارسال —');
ok(mainSrc.includes('function Test-DcSwitchHit([string]$needle)'), 'تستر تطبیق سوییچر با UIA');
ok(mainSrc.includes("if ($ct -match 'Edit|Document') { continue }"), 'فیلد ورودی سوییچر از شمارش حذف');
ok(mainSrc.includes("Write-Output ('DBG:TRY=' + $v + ' HIT=' + $hit + ' TREE=' + $script:LastTreeCount)"), 'تله‌متری هر واریانت (DBG:TRY/HIT/TREE)');
ok(mainSrc.includes("if ($hit -le 0) {"), 'واریانت بی‌نتیجه → Esc → واریانت بعدی');
ok(mainSrc.includes("Write-Output ('ERR:NOMATCH:' + ($vars -join '|'))"), 'هیچ واریانتی نتیجه نداد → ERR:NOMATCH (هیچی ارسال نمی‌شود)');
ok(mainSrc.includes('DBG:BLIND=1'), 'درخت UIA کور → فالبک صادقانهٔ BLIND');
ok(mainSrc.includes('if (!msg && em.startsWith(\'ERR:NOMATCH\'))'), 'پیام صادقانهٔ فارسی برای NOMATCH');
ok(/ERR:NOMATCH|NOMATCH/.test(appSrc) && appSrc.includes('/NO_MATCH|NOMATCH/'), 'رندرر NOMATCH دیسکورد را هم پاسخ صادقانه می‌دهد');

console.log('— ۳) دروازهٔ دیسکورد دیگر جملهٔ پیام را نمی‌رباید —');
ok(appSrc.includes('try { if (typeof AVAMessaging !== \'undefined\' && AVAMessaging.msgParse && AVAMessaging.msgParse(t0)) return null; } catch (_) { /* noop */ }'), 'جملهٔ استاندارد پیام → واگذاری به لاین حافظه‌دار');
ok(appSrc.includes("nm = nm.replace(/(توی|تو|در|با|و|رو|را|برام|برای|دیسکورد)\\s*$/g, '')"), 'تمیزکردن نام در مسیر legacy («علی تو» → «علی»)');
ok(appSrc.includes("_dispatchOutcome = 'discord';"), 'اوتکام دروازهٔ دیسکورد ثبت می‌شود (دیگر unrouted دروغین)');
ok(appSrc.includes("_dispatchOutcome = 'discord-off';"), 'اوتکام افزونهٔ خاموش ثبت می‌شود');

console.log('— ۴) «برو/بریم/بیا» لیدفیلر لاین پیام — عین جملهٔ لاگ —');
const rp1 = MS.msgParse('آفرین حالا برو به علی تو دیسکورد پیام بده');
ok(rp1 && rp1.app === 'discord' && rp1.target === 'علی' && !rp1.text, '«برو…» → مقصد علی (سؤال صادقانهٔ متن، نه unrouted)');
const rp2 = MS.msgParse('برو به علی تو دیسکورد پیام بده که سلام');
ok(rp2 && rp2.app === 'discord' && rp2.target === 'علی' && rp2.text === 'سلام', '«برو… که سلام» → متن سلام');
ok(MS.msgParse('برو جلو ۳۰ ثانیه') === null, '«برو جلو» (کنترل پلیر) پیام نیست');

console.log('— ۵) گلهٔ کاربر هرگز فرمان دائمی نمی‌شود —');
ok(coreSrc.includes('LEARN_COMPLAIN_RE'), 'آشکارساز گله در voiceCore');
ok(typeof C.LEARN_COMPLAIN_RE.test === 'function' && C.LEARN_COMPLAIN_RE.test('دهن منو سرویس کردی ..وقتی میگم علی تو باید یوزرش رو سرچ کنی توی دیسکورد چرا نمیفهمی'), 'گلهٔ عین لاگ 0.73 → می‌گیرد');
ok(C.LEARN_COMPLAIN_RE.test('کار نمیکنه دیگه') && C.LEARN_COMPLAIN_RE.test('به مموری توجه نمیکنی'), 'شکل‌های دیگر گله');
ok(!C.LEARN_COMPLAIN_RE.test('یادت باشه فردا آب میوه بخر'), 'جملهٔ عادی → گیت نمی‌گیرد');
ok(appSrc.includes('learn skip: گله/شکایت کاربر'), 'learnFromAI گیت گله دارد');
ok(B.brainSystem('fa').includes('گله/شکایت'), 'پرامپت مغز: قانون گله (FA)');
ok(B.brainSystem('en').includes('Complaints'), 'پرامپت مغز: قانون گله (EN)');

console.log('— ۶) ممیزی کنترل ویدیو پلیر — گرامر کامل فارسی (خواستهٔ صریح کاربر) —');
ok(typeof I.videoCtlOf === 'function', 'AVAIntent.videoCtlOf موجود');
const VCM = [
  ['ویدیو رو برام پین کن', 'pin', 0],
  ['پین رو بردار', 'unpin', 0],
  ['ویدیو رو بر بالا سمت راست', 'move', 'top-right'],
  ['ببر بالا سمت راست', 'move', 'top-right'],
  ['ببر پایین چپ', 'move', 'bottom-left'],
  ['ببرش وسط', 'move', 'center'],
  ['ببر بالا', 'move', 'top'],
  ['ویدیو رو بزرگتر کن', 'grow', 0],
  ['بزرگترش کن', 'grow', 0],
  ['کوچکترش کن', 'shrink', 0],
  ['ویدیو رو ببند', 'close', 0],
  ['برو جلو ۳۰ ثانیه', 'seek', 30],
  ['برو عقب', 'seek', -10],
  ['فول اسکرین کن', 'fullscreen', 0],
  ['ویدیو رو پاز کن', 'play_pause', 0],
  ['ویدیو بعدی', 'next', 0],
];
for (const [cmd2, act2, arg2] of VCM) {
  const g = I.videoCtlOf(cmd2);
  ok(g && g.action === act2 && JSON.stringify(g.arg) === JSON.stringify(arg2), '«' + cmd2 + '» → ' + act2 + ':' + JSON.stringify(arg2));
}
ok(!I.videoCtlOf('اولین ویدیو شادمهر رو کپی کن'), 'جملهٔ مرکب → null (به مغز)');
ok(!I.videoCtlOf('به علی تو دیسکورد پیام بده که سلام'), 'جملهٔ پیام → null');
/* اتصال به مسیر مغز و قاعدهٔ قطعی */
ok(appSrc.includes('AVAIntent.videoCtlOf(raw)'), 'videoCtlParse (مسیر مغز) از گرامر کامل استفاده می‌کند');
ok(appSrc.indexOf('const _rich = (typeof AVAIntent') > -1 && appSrc.includes("bridge.player.ctl({ action: _rich.action, arg: _rich.arg })"), 'قاعدهٔ player_ctl آفلاین از گرامر کامل استفاده می‌کند');
ok(appSrc.includes('(ویدیو|فیلم|کلیپ|پلیر|مدیا|پنجره)[^.]{0,14}(پین|روییر?|بزرگ|کوچک|کوچیک|ببر|بیار|منتقل|جابجا|جابه)'), 'کلیدواژه‌های پین/جابه‌جایی در k قاعدهٔ player_ctl');
/* چیت‌شیت در پرامپت مغز (FA + EN) */
ok(B.brainSystem('fa').includes('چیت‌شیت video_ctl') && B.brainSystem('fa').includes('move:top-right'), 'چیت‌شیت video_ctl در پرامپت FA');
ok(B.brainSystem('en').includes('video_ctl cheat-sheet') && B.brainSystem('en').includes('move:top-right'), 'چیت‌شیت video_ctl در پرامپت EN');

console.log('— ۷) دفتر ممیزی فرمان‌ها یکجا —');
const cmdDoc = read('docs/COMMANDS-FA.md');
ok(cmdDoc.includes('کنترل ویدیو پلیر'), 'docs/COMMANDS-FA.md: بخش ویدیو پلیر');
ok(cmdDoc.includes('پیام‌رسان‌ها') && cmdDoc.includes('حافظه و آموزش'), 'بخش‌های پیام‌رسان و حافظه');
ok(cmdDoc.includes('ERR:NOMATCH'), 'مستند صداقت دیسکورد');

console.log('— ۸) رگرسیون — نجات‌های قبلی سر جایشان —');
ok(mainSrc.includes('ava-tg-req.json'), 'ترابری JSON تلگرام v0.72 حفظ است');
ok(mainSrc.includes('Get-TgNamePart'), 'شاهد بخش نام تیتر v0.72 حفظ است');
ok(appSrc.includes('x !== _flPushed'), 'لاتین‌اول v0.73 حفظ است');
ok(appSrc.includes("messaging variants latin-first (taught rule)"), 'لاگ latin-first حفظ است (پین v0710)');
ok(msgSrc.includes('برو|بریم|بیا'), 'لیدفیلر جدید در LEAD_FILLER');
ok(B.brainSystem('fa').includes('۸ب) گله') || B.brainSystem('fa').includes('گله/شکایت/گزارش خرابی'), 'قانون ۸ب FA');
ok(mainSrc.includes('[string]$Text = \'\','), 'پارامترهای قدیمی PS دیسکورد حفظ شده');

console.log('\n==== v0.74.0-beta: ' + pass + ' passed, ' + fail + ' failed ====');
if (fail) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('ALL GREEN');
