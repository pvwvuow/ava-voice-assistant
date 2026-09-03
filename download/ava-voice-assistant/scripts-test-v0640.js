#!/usr/bin/env node
/* scripts-test-v0640.js — v0.64 — «مقصدِ درست، تک‌لاینِ ویدیو»
   ------------------------------------------------------------
   گزارش کاربر (لاگ activity v0.48→v0.63 + سه اسکرین‌شات):
   [الف] «ممکنه کاربر دو سه تا ویدیو همزمان پخش کرده باشه — باید در نظر بگیری»
        هر video_play یک نمونهٔ پلیر تازه باز می‌کرد (صدای روی‌هم)؛
        کنترلِ پنجره فقط First-1 را می‌گرفت و بقیه پنجره‌ها گم می‌شدند.
   [ب] «در حال تایپ توی صفحهٔ جدیدم؛ اشتباهی صفحهٔ چت قدیمی را باز می‌کند»
        hwnd فقط لحظهٔ blurِ آوا ثبت می‌شد و منجمد می‌ماند؛ hwndهای بازیافت‌شده
        به پنجرهٔ برنامهٔ دیگر اشاره می‌کردند → Restore-Focus2 صفحهٔ قدیمی را
        جلو می‌آورد و متن همان‌جا می‌نشست.
   [پ] «با دستور بنویس تایپ نمی‌کند، خودش فقط جواب می‌دهد»
        فرمانِ «بنویس» در لَین brain به چتِ AI تبدیل می‌شد (لاگ v0.51:
        «…بررسی می‌کنم برام بنویس» → فقط جواب حرف زده شد)؛ URL کامل یوتیوب در
        جمله بود ولی AI دوباره video_play(https://www.youtube.com/) می‌داد؛
        «کمرنگ کن» (شفافیت) → shrink اشتباه.

   فیکس ساختاری v0.64:
   • موتور تایپ: کاوشِ تازه در لحظهٔ فرمان + پینِ PID (hwnd بازیافتی =
     خطای STALE صادقانه) + گاردِ خودِ آوا (self) + کشِ تازه‌سنج ۴۵ثانیه‌ای
     + نام پروسهٔ مقصد در پاسخ («نوشتم توی Chrome»)
   • تک‌لاین ویدیو: قبل از پخشِ جدید همهٔ پلیرهای ویدیو بسته می‌شوند
     (closeAllVideoPlayers؛ بعد از حلِ موفق استریم تا خطی چیزی را نبندد)؛
     pin/unpin/move/grow/shrink/close روی «همهٔ» پنجره‌ها broadcast می‌شود؛
     کلید مدیا وقتی هیچ پلیری نیست به برنامهٔ فعال شلیک نمی‌شود (noPlayer)
   • لَین قطعیِ «بنویس»: فرمانِ خالصِ نوشتن هرگز به چت AI نمی‌رود؛
     ترکیبی → قانون ۱۲ پرامپت (آخرین act=type_once)
   • ترمیمِ URL: لینکِ شناسه‌دارِ درونِ جمله همیشه بر youtube.com نمونه‌وار مقدم است
   • شفافیت: استثنای صادقانه در قوانین ۱۱/۱۰ — هرگز shrink/grow جای آن
   • گاردِ جملهٔ مرکب در player_ctl («اولین ویدیو رو کپی کن و…» → مغز AI)

   چک‌ها:
   [1] main — موتور تایپ (ExpectPid/PID/STALE/pname/self)
   [2] main — تک‌لاین ویدیو (closeAll/broadcast/noPlayer)
   [3] renderer — typeOnceExec مقصد-درست + دیکته با PID
   [4] renderer — لَین قطعی type-once
   [5] renderer — ترمیم URL + شمارش پلیر + گارد مرکب player_ctl
   [6] پرامپت — قوانین ۱۲/۱۱ (FA+EN) + استثنای شفافیت + URL کاراکتر‌به‌کاراکتر
   [7] voiceIntent زنده — typeOnceOf: خالص در برابر مرکب
   [8] نسخهٔ 0.64.0-beta در ۴ جای رسمی
*/
const fs = require('fs');
const path = require('path');
const APP = __dirname; /* سوئیت در ریشهٔ مخزن زندگی می‌کند — قرارداد باتری */
const mainSrc = fs.readFileSync(path.join(APP, 'main.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(APP, 'renderer/js/app.js'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(APP, 'preload.js'), 'utf8');
const idxSrc = fs.readFileSync(path.join(APP, 'renderer/index.html'), 'utf8');
const readmeSrc = fs.readFileSync(path.join(APP, 'README.md'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; fails.push(label); console.log('  ✗ ' + label); }
}
function section(s) { console.log('\n[' + s + ']'); }

/* ---------- [1] main — موتور تایپ v0.64 ---------- */
section('1] main — موتور تایپ (کاوش تازه + پین PID)');
ok(/\[long\]\$ExpectPid = 0/.test(mainSrc), 'پارامتر ExpectPid در بدنهٔ پاورشل تایپ');
ok(/FG=' \+ \$fg\.ToInt64\(\)\.ToString\(\) \+ ';PID=' \+ \$fp\.ToString\(\)/.test(mainSrc), 'savefg اکنون FG=hwnd;PID=pid برمی‌گرداند');
ok(/\[void\]\[AvaType\.W\]::GetWindowThreadProcessId\(\$fg, \[ref\]\$fp\)/.test(mainSrc), 'savefg — PID پنجرهٔ فعال استخراج می‌شود');
ok(/if \(\$ExpectPid -gt 0 -and \$vp -gt 0 -and \$vp -ne \$ExpectPid\) \{ Write-Output \('ERR:STALE:' \+ \$vp\); exit \}/.test(mainSrc), 'type — hwnd بازیافتی = خطای STALE، هرگز در پنجرهٔ اشتباه نمی‌نویسد');
ok(/'OK:TYPED:' \+ \$typed \+ ':' \+ \$pn2/.test(mainSrc), 'type — نام پروسهٔ مقصد در پاسخ (نوشتم توی Chrome)');
ok(/let mFG = out\.match\(\/\^FG=\(\\d\+\)\(\?:;PID=\(\\d\+\)\)\?\/\)/.test(mainSrc) || /FG=\\d\+\)\(\?:;PID=/.test(mainSrc), 'پارسِ FG=hwnd;PID=pid در runTypePs');
ok(/ERR:STALE\/.test\(out\)\) return resolve\(\{ ok: false, stale: true/.test(mainSrc), 'پارسِ ERR:STALE → stale:true + پیام صادقانه');
ok(/OK:TYPED:\(\\d\+\)\(\?::\(\[\^:\\r\\n\]\*\)\)\?/.test(mainSrc) || /OK:TYPED:\(\d\+\)\(\?:/.test(mainSrc), 'پارسِ OK:TYPED:n:pname');
ok(/Number\(r\.pid\) === Number\(process\.pid\)\) r\.self = true/.test(mainSrc), 'sys:savefg — پنجرهٔ فعالِ خودِ آوا = self (مقصد تایپ نیست)');
ok(/const \{ text, hwnd, expectPid \} = p \|\| \{\};/.test(mainSrc), 'sys:typeText — expectPid از بار IPC جدا می‌شود');
ok(/runTypePs\('type', f, Number\(hwnd\) \|\| 0, Number\(expectPid\) \|\| 0\)/.test(mainSrc), 'runTypePs — ExpectPid به پاورشل پاس می‌شود');
ok(/'-ExpectPid', String\(expectPid \|\| 0\)/.test(mainSrc), 'آرگومان -ExpectPid در spawn پاورشل');
ok(preloadSrc.includes("typeText: (text, hwnd, expectPid) => ipcRenderer.invoke('sys:typeText', { text, hwnd, expectPid })"), 'preload — typeText سه‌آرگومانی');

/* ---------- [2] main — تک‌لاین ویدیو ---------- */
section('2] main — تک‌لاین ویدیو + broadcast');
ok(/function closeAllVideoPlayers\(\)/.test(mainSrc), 'closeAllVideoPlayers تعریف شده');
ok(/taskkill \/IM \\\\"\$\(\$g\.Name\)\\\\" \/F/.test(mainSrc) || /taskkill/.test(mainSrc) && /Group-Object ProcessName/.test(mainSrc), 'بستن همهٔ نمونه‌های هر exe ویدیویی');
ok(/function runningVideoPlayers\(\)/.test(mainSrc), 'runningVideoPlayers — شمارش پلیرهای زنده');
ok(/_vpScanAt = Date\.now\(\); _vpScanCount = 0;/.test(mainSrc), 'کش اسکن پس از بستن صفر می‌شود');
ok(/if \(!\(opts && opts\.keepExisting\)\) \{\s*\n\s*try \{ const cr = await closeAllVideoPlayers\(\);/.test(mainSrc), 'playerLaunch — قبل از spawn، پلیرهای قبلی بسته می‌شوند (بعد از حل استریم)');
ok(/فالبک مرورگر هم جایگزین است/.test(mainSrc), 'playerLaunchYt — فالبک مرورگر هم تک‌لاین است');
ok(/if \(!q\.keepExisting\) \{ try \{ const cr = await closeAllVideoPlayers\(\); if \(cr\.count\) playerCtl\.player = null;[\s\S]{0,240}shell\.openExternal\(src\);/.test(mainSrc), 'player:open — مسیر browser هم قبلی‌ها را می‌بندد'); /* v0.80 forward-relax: گارد keepExisting («کنارش پخش کن») */
/* v0.78 — «ببند» هدفمند شد: تکی → همان، چندتایی → جدیدترین + گزارش مانده؛ «همه رو ببند» → همه
   (شکایت کاربر: «ویدیو قبلی ک باز کرده بودم رو ببند، دو ویدیو باز بود، جفتشون بسته شد») — ریلکس رو به جلو */
ok(/const cr = await closeAllVideoPlayers\(\);\s*\n\s*if \(cr\.count > 0\) \{ playerCtl\.player = null; return \{ ok: true, via: 'win-ctl', target: 'all', count: cr\.count \}; \}|closeVideoTargeted\(tgt\)/.test(mainSrc), 'player:ctl close — v0.78: بستن هدفمند + «همه رو ببند» سرجایش');
ok(/playerWindowCtl\(a === 'pin' \? 'topmost' : a === 'unpin' \? 'notopmost' : a, p && p\.arg, true\)/.test(mainSrc), 'pin/unpin/move/grow/shrink — broadcast روی همهٔ پنجره‌ها');
ok(/via: 'win-ctl', count: wr\.count \|\| 1/.test(mainSrc), 'پاسخ player:ctl — شمارش پنجره‌ها برمی‌گردد');
ok(/function playerWindowCtl\(kind, arg, all\)/.test(mainSrc), 'playerWindowCtl — حالت all');
ok(/foreach\(\$p in \$ps\)\{ /.test(mainSrc), 'all-mode — حلقهٔ foreach روی همهٔ پروسس‌ها');
ok(/noPlayer: true, error: 'پلیری باز نیست — اول ویدیو یا آهنگ را پخش کن'/.test(mainSrc), 'کلید مدیا بدون پلیر = پاسخ صادقانه (نه شلیک به برنامهٔ فعال)');
ok(/!playerCtl\.player\) \{\s*\n\s*const nOpen = await runningVideoPlayers\(\);/.test(mainSrc), 'گاردِ پلیرِ خالی فقط وقتی آوا پلیری ثبت نکرده');

/* ---------- [3] renderer — تایپ مقصد-درست ---------- */
section('3] renderer — typeOnceExec مقصد-درست + دیکته');
ok(/async function refreshFg\(\)/.test(appSrc) && appSrc.indexOf('if (r.self) {') >= 0 && appSrc.indexOf('return fgNow();') >= 0, 'refreshFg — کاوش با پرچم self + خروجی آبجکت');
ok(/function lastFgRecent\(maxAge\) \{[\s\S]{0,300}Date\.now\(\) - lastFgAt > \(maxAge \|\| 45000\)/.test(appSrc), 'کشِ تازه‌سنج ۴۵ثانیه‌ای — hwndی منجمد حذف شد');
ok(/let tgt = \{ hwnd: 0, pid: 0 \};\s*\n\s*try \{\s*\n\s*const f = await refreshFg\(\);\s*\n\s*if \(f && f\.hwnd && !f\.self\) tgt = \{ hwnd: f\.hwnd, pid: f\.pid \};/.test(appSrc), 'typeOnceExec — اول کاوشِ تازه؛ خودِ آوا مقصد نیست');
ok(/if \(!tgt\.hwnd\) \{ const c = lastFgRecent\(45000\); if \(c\) tgt = c; \}/.test(appSrc), 'typeOnceExec — فالبک فقط به کشِ تازه');
ok(/مقصد تایپ مشخص نشد — توی برنامهٔ مقصد یک‌بار کلیک کن و دوباره بگو/.test(appSrc), 'بدون مقصد = خطای صادقانه (نه حدس، نه تایپ در اشتباه)');
ok(/bridge\.system\.typeText\(txt, tgt\.hwnd, tgt\.pid \|\| 0\)/.test(appSrc), 'typeOnceExec — ExpectPid همراه hwnd');
ok(/'نوشتم' \+ \(r\.pname \? ' توی ' \+ r\.pname : ''\) \+ '\.'/.test(appSrc), 'پاسخ با نام مقصد: «نوشتم توی X»');
ok(/const dictation = \{ active: false, hwnd: 0, pid: 0/.test(appSrc), 'دیکته — pid در وضعیت (v0.82: موتور headless + حباب شناور)');
ok(/bridge\.system\.typeText\(delta, tgt\.hwnd \|\| 0, tgt\.pid \|\| 0\)/.test(appSrc), 'دیکته — تایپ با پین PID (tgt = dictation یا vtRec)');
ok(/if \(r && r\.stale\) \{[\s\S]{0,400}tgt\.hwnd = 0; tgt\.pid = 0;[\s\S]{0,200}پنجرهٔ مقصد عوض شده یا بسته شده/.test(appSrc), 'دیکته — STALE = سوییچ شفاف به پنجرهٔ فعال');
ok(/window\.addEventListener\('focus', \(\) => \{ lastFgHwnd = 0; lastFgPid = 0; lastFgAt = 0;/.test(appSrc), 'بازگشت فوکوس به آوا = پاک‌کردن کش مقصد');

/* ---------- [4] renderer — لَین قطعی type-once ---------- */
section('4] renderer — لَین قطعی «بنویس»');
ok(/lane=type-once \(deterministic\)/.test(appSrc), 'لاگِ لَین قطعی type-once');
ok(appSrc.indexOf('const _pureType = !!_to') >= 0 && appSrc.indexOf('.test(vcText)') >= 0 && appSrc.indexOf('سرچ|جستجو|پیدا|بگرد|تحلیل|بررسی') >= 0 && appSrc.indexOf('&& !/[؟?]/.test(vcText)') >= 0, 'فرمانِ خالصِ نوشتن: بدون فعل پژوهشی و بدون سؤال');
ok(/const _typeRep = await typeOnceExec\(_to\);/.test(appSrc), 'اجرا با همان مسیر typeOnceExec (بدون چت AI)');
ok(/_dispatchOutcome = 'type-once';/.test(appSrc), 'outcome ثبت می‌شود (تاریخچه/تشخیص‌پذیری)');
ok(/recordTurn\(\{ utterance: vcText, via: 'type-once', intent: 'type_once'/.test(appSrc), 'turn ثبت می‌شود (بازپخش/آمار)');

/* ---------- [5] renderer — ترمیم URL + شمارش + گارد مرکب ---------- */
section('5] renderer — video_play/url-repair + video_ctl + player_ctl');
ok(/video_play url-repair/.test(appSrc), 'ترمیم URL: لاگ نشانه');
ok(appSrc.indexOf('const _uId = /(?:watch\\?v=|youtu\\.be\\/|shorts\\/|live\\/|embed\\/|\\/v\\/)/i.test(_u);') >= 0, 'تشخیص لینک شناسه‌دار در متن کاربر');
ok(/if \(_uId && \(!_vId \|\| vq !== _u\)\) \{[\s\S]{0,160}vq = _u;/.test(appSrc), 'URL اصلیِ جمله بر خروجی AI مقدم است');
ok(/روی ' \+ faNum\(String\(res\.count\)\) \+ ' پلیر/.test(appSrc), 'video_ctl — چند پلیر شمرده اعلام می‌شود');
ok(/on ' \+ res\.count \+ ' players/.test(appSrc), 'video_ctl EN — count');
ok(appSrc.indexOf("توی\\s?(اون\\s)?پلیر|همزمان|دوتا|سه\\s?تا)/i.test(c)) return AI_FALLBACK;") >= 0, 'player_ctl — گارد جملهٔ مرکب → مغز AI');

/* ---------- [6] پرامپت ---------- */
section('6] پرامپت — قوانین ۱۲/۱۱ + استثنای شفافیت');
ok(/قانون مهم ۱۲ \(بسیار مهم\): «بنویس X»[\s\S]{0,600}act=type_once[\s\S]{0,400}پاسخِ بدونِ type_once وقتی کاربر «بنویس\/تایپ کن» گفته ممنوع است/.test(appSrc), 'FA قانون ۱۲ — بنویس=type_once، جوابِ چت ممنوع');
ok(/Important rule 11: "write X"[\s\S]{0,500}act=type_once[\s\S]{0,300}forbidden/.test(appSrc), 'EN rule 11 — write/type=type_once');
ok(/تنها استثنا: «شفافیت\/کمرنگ\/اپسیتی\/شفاف کردن» ویدیو در پلیر سیستم ممکن نیست[\s\S]{0,300}هرگز shrink\/grow جای آن نزن/.test(appSrc), 'FA قانون ۱۱ — استثنای شفافیت (نه shrink جای آن)');
ok(/Sole exception: video opacity\/transparency[\s\S]{0,300}never substitute grow\/shrink/.test(appSrc), 'EN rule 10 — opacity exception');
ok(/copy it character-for-character into value — never shorten it to youtube\.com/.test(appSrc), 'بولت video_play — URL کاراکتر‌به‌کاراکتر');

/* ---------- [7] voiceIntent زنده ---------- */
section('7] voiceIntent زنده — typeOnceOf خالص/مرکب');
const AVAIntent = require(path.join(APP, 'renderer/js/voiceIntent.js'));
ok(typeof AVAIntent.typeOnceOf === 'function', 'typeOnceOf قابل require (بدون DOM)');
ok(AVAIntent.typeOnceOf('بنویس من می‌خوام برم خونمون') === 'من می‌خوام برم خونمون', 'خالص: «بنویس X» → X');
ok(AVAIntent.typeOnceOf('اینجا بنویس: قرار ساعت ۵') === 'قرار ساعت ۵', 'خالص: کولون‌دار');
ok(AVAIntent.typeOnceOf('ببین بنویس سلام خوبی') === 'سلام خوبی', 'خالص: «ببین بنویس X»');
ok(AVAIntent.typeOnceOf('بنویس تو گوگل سرچ کن آب و هوا') === '', 'غیرِ تایپ: مقصد وب → خالی');
ok(!new RegExp('[؟?]').test('بنویس قرار فردا ساعت ۵') , 'sanity: فرمان خالص سؤال ندارد');

/* ---------- [8] نسخه ---------- */
section('8] نسخهٔ 0.64.0-beta در ۴ جای رسمی');
ok(/^0\.[6-9][0-9]?\.0-beta$/.test(pkg.version), 'package.json → ' + pkg.version + ' (رو به جلو ریلکس)');
ok(/appVersion\s*=\s*'0\.[6-9][0-9]?\.[0-9]+-beta'/.test(appSrc), 'app.js appVersion (رو به جلو ریلکس)');
ok(/abVersion[^0-9]*0\.[6-9][0-9]?\.[0-9]+-beta/.test(idxSrc), 'index.html abVersion (رو به جلو ریلکس — v0.65)');
ok(/۰\.[۶-۹][۰-۹]?\.۰-بتا/.test(readmeSrc), 'README بلاک ۰.۶۴.۰-بتا (رو به جلو ریلکس — v0.65)'); /* v0.80 forward-relax */

/* ---------- نتیجه ---------- */
console.log('\n———————————————');
console.log('PASS=' + pass + '  FAIL=' + fail);
if (fails.length) console.log('failures:\n - ' + fails.join('\n - '));
process.exit(fail ? 1 : 0);
