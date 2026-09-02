#!/usr/bin/env node
/* scripts-test-v0600a.js — Wave 1 / PACKAGE A (v0.60.0-beta line, A1–A11)
   فیکس‌های صدا/گفتار روی پایهٔ v0.57.0-beta (هیچ bump نسخه‌ای در همین موج نیست)
   ------------------------------------------------------------
   چک‌ها:
     1) A2 — typeOnceOf واقعی (require روی voiceIntent.js): کولون فقط بعد از
        فعلِ نوشتن می‌بُرد؛ «ساعت ۱۲:۳۰»/URL/نسبت هرگز؛ گیومه و ماتریس v0510 سالم
     2) A4 — گیت زنده: «گوگل کن/گوگل بزن/پیداش کن» مسیر سریع؛ «گوگل چیه؟» هنوز AI
     3) A5 — ریاضی «ظهر» در parseReminder واقعی (vm): ۲ ظهر→۱۴، ۱۲ ظهر→۱۲
     4) A1 — پاور: ۴ قانون فقط r (بدون run) → اجرای دقیقاً یک‌بار در resolveReply
     5) A3+A8 — PTT: اپوک در pttStop، گارد تایمر کهنه، aveKillAudio تایمر را می‌کشد،
        فلاش خالی → aveFinalize (WAV/ابر) نه دورانداختن جلسه
     6) A7 — میک: کش اعتبارسنجی + onended ترک + تنها یک devicechange (بدون نشت)
     7) A10 — گارد لرن: «آخرین سایت/یادداشت/آهنگ» هرگز یاد گرفته نمی‌شود
     8) A9 — stripSearch: «سرو کاج» سالم می‌ماند
     9) A11 — پرامپت FA/EN بدون run_cmd(dict) (فالبک صادق سر جایش)
    10) A6 — «برام تایپ کن سلام» → تایپ یک‌باره؛ «برام تایپ کن» لخت → حالت مودار
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

const appSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/app.js'), 'utf8');
const intentSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/voiceIntent.js'), 'utf8');
const AVAIntent = require(path.join(ROOT, 'renderer/js/voiceIntent.js'));

/* ============================================================
   [1] A2 — typeOnceOf: کولون فقط چسبیده به فعلِ نوشتن
   ============================================================ */
console.log('\n[1] A2 — typeOnceOf (موتور واقعی voiceIntent.js)');
ok(AVAIntent.typeOnceOf('اینجا بنویس ساعت ۱۲:۳۰ جلسه دارم') === 'ساعت ۱۲:۳۰ جلسه دارم',
   '«اینجا بنویس ساعت ۱۲:۳۰ جلسه دارم» → کل متن (قبلاً «۳۰ جلسه دارم» تایپ می‌شد!)');
ok(AVAIntent.typeOnceOf('ساعت ۱۲:۳۰ یادم بنداز') === '', 'کولونِ بی‌فعل: حتی اگر جمله به type_once برسد هم بی‌محتوا است');
ok(AVAIntent.typeOnceOf('اینجا بنویس: قرار ساعت ۵') === 'قرار ساعت ۵', 'کولونِ چسبیده به فعل هنوز می‌بُرد («اینجا بنویس: قرار ساعت ۵»)');
ok(AVAIntent.typeOnceOf('بزن: سلام روی صفحه') === 'سلام روی صفحه', '«بزن: …» (کولونِ بلافاصل) می‌بُرد');
ok(AVAIntent.typeOnceOf('بنویسید: متن رسمی جلسه') === 'متن رسمی جلسه', '«بنویسید: …» می‌بُرد');
ok(AVAIntent.typeOnceOf('بنویس https://x.com:8080/a') === 'https://x.com:8080/a', 'URL با پورت هرگز برش نمی‌خورد');
ok(AVAIntent.typeOnceOf('بنویس نسبت ۲:۳ مهمه') === 'نسبت ۲:۳ مهمه', 'نسبت ۲:۳ هرگز برش نمی‌خورد');
ok(AVAIntent.typeOnceOf('آوا اینجا بنویس "من فلانم"') === 'من فلانم', 'گیومه‌دار — فقط داخل گیومه (پین v0510)');
ok(AVAIntent.typeOnceOf('اینجا بنویس سلام خوبی') === 'سلام خوبی', '«اینجا بنویس سلام خوبی» (پین v0510)');
ok(AVAIntent.typeOnceOf('ببین بنویس من فردا میام') === 'من فردا میام', '«ببین بنویس …» (پین v0510)');
ok(AVAIntent.typeOnceOf('اینو تایپ کن قرار ساعت ۵') === 'قرار ساعت ۵', '«اینو تایپ کن …» (پین v0510)');
ok(AVAIntent.typeOnceOf('برام بنویس که جلسه داریم') === 'جلسه داریم', '«برام بنویس که …» (پین v0510)');
ok(AVAIntent.typeOnceOf('اینجا برام تایپ کن') === '', 'بی‌محتوا → حالت مودار (پین v0510)');
ok(AVAIntent.typeOnceOf('اسم آهنگ جدید رو بنویس') === '', 'فعل در انتها و بی‌محتوا → AI (پین v0510)');
ok(AVAIntent.typeOnceOf('بنویس تو گوگل سرچ کن شادمهر') === '', 'مقصد وب — دیکته نیست (پین v0510 — بدون کولون برش کولونی رخ نمی‌دهد)');
ok(AVAIntent.typeOnceOf('type this hello world') === 'hello world', 'انگلیسی (پین v0510)');
ok(/بنویسید\|بنویسش\|بنویشه\|بنویش\|بنویس/.test(intentSrc) && intentSrc.includes('بزن)\\s*[:：]'),
   'سورس: لایهٔ کولون فقط با فعلِ نوشتن انکر می‌شود');

/* ============================================================
   [2] A4 — گیت زنده: فعل‌های جستجوی صریح تازه
   ============================================================ */
console.log('\n[2] A4 — گیت: «گوگل کن/پیداش کن» مسیر سریع، سؤال هنوز AI');
ok(AVAIntent.gateReason('گوگل کن شادمهر', 'web_search') === '', '«گوگل کن شادمهر» → مسیر سریع web_search (قبلاً no-verb)');
ok(AVAIntent.gateReason('گوگل کن شادمهر', 'open_music') === '', '…و برای قانون موسیقی هم گیت نمی‌خورد (عبور از no-verb)');
ok(AVAIntent.gateReason('گوگل بزن قیمت گوشی', 'web_search') === '', '«گوگل بزن …» → مسیر سریع');
ok(AVAIntent.gateReason('پیداش کن کفش', 'web_search') === '', '«پیداش کن کفش» → مسیر سریع (قبلاً no-verb)');
ok(AVAIntent.gateReason('گوگل چیه؟', 'web_search') === 'question', '«گوگل چیه؟» → question → AI (گارد FP سالم)');
ok(AVAIntent.gateReason('گوگل چیه', 'web_search') === 'question', '«گوگل چیه» بدون علامت → question → AI');
ok(AVAIntent.blocksActionRule('گوگل کن شادمهر', 'web_search') === false, 'blocksActionRule سازگار بولین: fast = false');
ok(AVAIntent.blocksActionRule('جدیدترین آهنگ شادمهر در ۲۰۲۶', 'open_music') === true, 'no-verb هنوز بلاک است (وارونگی v0510 سالم)');
ok(/گوگل\(ش\)\?\\s\?کن\|گوگل\\s\?بزن\|پیداش\\s\?کن/.test(intentSrc), 'سورس: گوگل(ش)?کن + گوگل بزن + پیداش کن داخل GATE_EXEC_RE');

/* ============================================================
   [3] A5 — «ظهر» در یادآوری مطلق (vm روی سورس واقعی)
   ============================================================ */
console.log('\n[3] A5 — parseReminder واقعی: ۲ ظهر→۱۴، ۱۲ ظهر→۱۲');
const sbR = {};
vm.createContext(sbR);
{
  const a1 = appSrc.indexOf('const faToEn');
  const b1 = appSrc.indexOf('\n', a1);
  const a2 = appSrc.indexOf('const FA_WORD_NUM');
  const b2 = appSrc.indexOf('};', a2) + 2;
  const a3 = appSrc.indexOf('function faWordNum');
  const b3 = appSrc.indexOf('function fmtClock');
  const a4 = appSrc.indexOf('function parseReminder');
  const b4 = appSrc.indexOf('async function reminderReply');
  ok(a1 > 0 && a2 > 0 && a3 > 0 && a3 < b3 && a4 > 0 && a4 < b4, 'برش‌های vm (faToEn/FA_WORD_NUM/faWordNum/parseReminder) پیدا شدند');
  vm.runInContext(appSrc.slice(a1, b1) + '\n' + appSrc.slice(a2, b2) + '\n' + appSrc.slice(a3, b3) + '\n' + appSrc.slice(a4, b4) +
    '\nthis.parseReminder = parseReminder;', sbR);
}
const pr = sbR.parseReminder;
const hrOf = (ms) => new Date(ms).getHours();
ok(!!pr('ساعت ۲ ظهر یادم بنداز چایی درست کن'), '«ساعت ۲ ظهر …» پارس شد');
ok(hrOf(pr('ساعت ۲ ظهر یادم بنداز چایی درست کن').at) === 14, '«ساعت ۲ ظهر» → ساعت ۱۴ (قبلاً ۲ بامداد فردا می‌شد!)');
ok(hrOf(pr('ساعت ۱۲ ظهر یادم بنداز ناهار').at) === 12, '«ساعت ۱۲ ظهر» → ساعت ۱۲ (ظهر واقعی)');
ok(hrOf(pr('ساعت ۱ ظهر یادم بنداز تماس').at) === 13, '«ساعت ۱ ظهر» → ۱۳');
ok(hrOf(pr('ساعت ۵ عصر یادم بنداز دارو').at) === 17, 'رجسیون: «۵ عصر» → ۱۷ (pm سالم)');
ok(hrOf(pr('ساعت ۸ صبح یادم بنداز ورزش').at) === 8, 'رجسیون: «۸ صبح» → ۸ (am سالم)');
const dur = pr('۲۰ دقیقه دیگه چایی درست کن');
ok(!!dur && dur.at > Date.now() + 19 * 60000 && dur.at < Date.now() + 21 * 60000, 'رجسیون: «۲۰ دقیقه دیگه» → ~+۲۰ دقیقه');

/* ============================================================
   [4] A1 — پاور: هیچ فرمانی دوبار اجرا نمی‌شود (پین ساختاری)
   ============================================================ */
console.log('\n[4] A1 — ۴ قانون پاور فقط r دارند (بدون run) → یک اجرا');
ok(appSrc.includes("id: 'sleep', t: 'حالت خواب', i: '#i-moon', r: () => runPower('sys_sleep') }"),
   'قانون sleep: r=runPower و بدون run');
ok(appSrc.includes("i: '#i-monitor', r: () => runPower('monitor_off') }"),
   'قانون monitor_off: r=runPower و بدون run');
ok(appSrc.includes("i: '#i-refresh', confirm: 'restart', r: () => runPower('sys_restart') }"),
   'قانون restart: r=runPower و بدون run');
ok(appSrc.includes("i: '#i-power', confirm: 'shutdown',") && appSrc.includes("r: () => runPower('sys_shutdown'),"),
   'قانون shutdown: r=runPower و بدون run');
ok(!appSrc.includes("run: 'sys_sleep'") && !appSrc.includes("run: 'monitor_off'") &&
   !appSrc.includes("run: 'sys_restart'") && !appSrc.includes("run: 'sys_shutdown'"),
   'هیچ‌کدام از ۴ شناسهٔ پاور دیگر در مسیر rule.run نیستند');
ok(appSrc.includes("run: 'open_chrome'"), 'رجسیون: مسیر عمومی run (open_chrome و…) دست‌نخورده');
ok(appSrc.includes("id: 'shutdown_abort', t: 'لغو خاموش شدن', i: '#i-power', run: 'shutdown_abort'"),
   'shutdown_abort (خارج از دامنهٔ A1 — idempotent) دست‌نخورده');
ok(appSrc.includes("if (!rule.run) { rcTag.textContent = rule.custom ? t('tag.custom') : t('tag.reply'); return reply; }"),
   'resolveReply: گارد «!rule.run → فقط r» سالم است (یک اجرا، یک پاسخ)');
ok(appSrc.includes('const res = await bridge.system.run(id).catch(() => ({ ok: false }));'),
   'runPower: تنها نقطهٔ اجرای bridge.system.run برای پاور');

/* ============================================================
   [5] A3+A8 — PTT: اپوک/تایمر کهنه/فلاش خالی → finalize
   ============================================================ */
console.log('\n[5] A3+A8 — pttStop اپوک‌دار + aveKillAudio تایمر را می‌کشد');
const pA = appSrc.indexOf('function pttStop()');
const pB = appSrc.indexOf('const toggleListen');
const pttSlice = (pA > -1 && pB > pA) ? appSrc.slice(pA, pB) : '';
ok(pttSlice.includes('const myEpoch = ave.myEpoch;'), 'pttStop: اپوک جلسه در لحظهٔ رهاکردن قفل می‌شود');
ok(pttSlice.includes('ave.myEpoch !== myEpoch'), 'pttStop: تایمر با گارد اپوک — تایمر کهنه جلسهٔ تازه را نمی‌کشد');
ok(!/stopListening\(\)/.test(pttSlice), 'pttStop: دیگر هیچ‌وقت جلسه را با stopListening دور نمی‌ریزد');
ok(pttSlice.includes("aveFinalize(myEpoch, 'ptt-flush')"), 'A3: فلاشِ بدون متن → aveFinalize (بافر PCM → WAV/ابر)');
ok(pttSlice.includes("aveDeliver(txt, 'ptt-flush', myEpoch)"), 'مسیر تحویل متن با اپوک قفل‌شده صدا زده می‌شود');
ok(pttSlice.includes("actLog('ptt flush: empty (no speech detected)')"), 'لاگ صادقانهٔ خالی (پین v0530) سر جایش است');
ok(appSrc.includes('clearTimeout(ave.tPttFlush); ave.tPttFlush = null;'), 'aveKillAudio: tPttFlush هم کشته می‌شود (A8 نیمهٔ دوم)');
ok(pttSlice.includes("actLog('ptt flush: stale timer — session changed, ignored')"), 'لاگ صادقانهٔ تایمر کهنه');
ok(appSrc.includes("function aveFinalize(myEpoch, reason) {") &&
   appSrc.slice(appSrc.indexOf('function aveFinalize'), appSrc.indexOf('function aveFinalize') + 200).includes('ave.myEpoch !== myEpoch'),
   'aveFinalize: خودش هم با اپوک/دلیوری گارد دارد (دوباره-finalize ممکن نیست)');

/* ============================================================
   [6] A7 — میک: کشِ مرده بازسازی می‌شود؛ یک گوش‌دهٔ devicechange
   ============================================================ */
console.log('\n[6] A7 — attachMic اعتبارسنجی + onended + devicechange تک‌شنونده');
ok(!appSrc.includes('    if (analyser) return true;'), '«if (analyser) return true» بی‌پایان حذف شد (ریشهٔ میکِ زامبی)');
ok(appSrc.includes("trk.readyState === 'ended'") && appSrc.includes('mic: cached stream is dead (device gone) — rebuilding'),
   'attachMic: استریمِ مرده → باطل و بازسازی');
ok(appSrc.includes("trk.onended = () => { actLog('mic: track ended (device unplugged?) — mic cache invalidated'); detachMic(); }"),
   'ترک مُرده خودش را اعلام می‌کند (onended → detachMic)');
ok((appSrc.match(/addEventListener\('devicechange'/g) || []).length === 1, 'دقیقاً یک گوش‌دهٔ devicechange در کل برنامه (بدون نشت)');
ok(appSrc.includes('window.__AVA_MIC_DEVCHANGE__') &&
   appSrc.indexOf('window.__AVA_MIC_DEVCHANGE__') < appSrc.indexOf("addEventListener('devicechange'"),
   'گارد duplicate (فقط یک‌بار بسته می‌شود حتی با اجرای دوباره)');
ok(appSrc.includes('if (isRecording || ave || wakeLoop) return; /* حین ضبط/جلسه/بیدارباش، استریم نباید بسته شود */'),
   'detachMic: گارد جلسهٔ فعال (پین v029) سالم — حین جلسه watchdog/attach بعدی بازسازی می‌کند');

/* ============================================================
   [7] A10 — گارد لرن: «آخرین سایت/یادداشت/آهنگ»
   ============================================================ */
console.log('\n[7] A10 — گارد یادگیری روی ارجاع‌های «آخرین X»');
const g1 = appSrc.indexOf('if (/(همون|همین');
let LEARN_RE = null;
if (g1 > 0) {
  const s1 = appSrc.indexOf('/', g1);
  LEARN_RE = eval(appSrc.slice(s1, appSrc.indexOf('/', appSrc.indexOf('/', s1) + 1) + 1));
}
ok(!!LEARN_RE, 'regex گارد استخراج شد (روش v0540)');
ok(LEARN_RE.test('آخرین سایت دیوار رو باز کن') === true, '«آخرین سایت دیوار رو باز کن» → learn skip');
ok(LEARN_RE.test('آخرین یادداشت رو نشون بده') === true, '«آخرین یادداشت …» → learn skip');
ok(LEARN_RE.test('آخرین آهنگ شادمهر رو بذار') === true, '«آخرین آهنگ …» → learn skip');
ok(LEARN_RE.test('آخرین اخبار فارس‌نیک رو نشون بده') === false, 'رجسیون v0540: «آخرین اخبار…» فرمان پایدار — یادگیری مجاز');
ok(LEARN_RE.test('پلی کن آهنگ دیوونه از شادمهر') === false, 'رجسیون v0540: فرمان عادی — یادگیری مجاز');
ok(appSrc.includes('آخرین بار|قبلی'), 'رجسیون v0530: زیررشتهٔ «آخرین بار|قبلی» سالم');

/* ============================================================
   [8] A9 — stripSearch: «رو» داخل کلمات خورده نمی‌شود
   ============================================================ */
console.log('\n[8] A9 — stripSearch (vm روی سورس واقعی)');
const sbS = {};
vm.createContext(sbS);
{
  const a = appSrc.indexOf('const stripSearch');
  const b = appSrc.indexOf('/* ============================================================', a);
  vm.runInContext(appSrc.slice(a, b) + '\nthis.stripSearch = stripSearch;', sbS);
}
ok(sbS.stripSearch('سرچ کن قیمت سرو کاج') === 'قیمت سرو کاج', '«سرچ کن قیمت سرو کاج» → «قیمت سرو کاج» (قبلاً «قیمت س کاج» می‌شد!)');
ok(sbS.stripSearch('سرچ کن شادمهر رو تو گوگل') === 'شادمهر',
   '«رو/را»ی واژهٔ مستقل هنوز برداشته می‌شود («سرچ کن شادمهر رو تو گوگل» → «شادمهر»)');
ok(sbS.stripSearch('بابا دیگه ممنون سرچ کن کفش') === 'کفش', 'رجسیون v0360: پرت‌گوی‌ها هنوز حذف می‌شوند');
ok(sbS.stripSearch('توی گوگل موتور') === 'موتور', 'رجسیون v0410: «توی گوگل» از عبارت حذف می‌شود');
ok(appSrc.includes(".replace(/(^|\\s)(را|رو)\\s+/g, '$1')"),
   'سورس: الگوی مرزدار (^|\\s)(را|رو)\\s+ با حفظ $1');

/* ============================================================
   [9] A11 — پرامپت: ارجاع مردهٔ run_cmd(dict) حذف شد
   ============================================================ */
console.log('\n[9] A11 — پرامپت FA/EN بدون run_cmd(dict)');
const faLine = appSrc.split('\n').find((l) => l.includes("'قانون مهم ۹ (مهم):"));
const enLine = appSrc.split('\n').find((l) => l.includes("'Important rule 8:"));
ok(!!faLine && faLine.includes('act=type_once') && !faLine.includes('run_cmd'), 'FA قانون ۹: سالم و بدون ارجاع مرده');
ok(!!enLine && enLine.includes('act=type_once') && !enLine.includes('run_cmd'), 'EN rule 8: سالم و بدون ارجاع مرده');
ok(!appSrc.includes('run_cmd(dict)'), 'در کل app.js هیچ run_cmd(dict) باقی نیست');
ok(appSrc.includes("چنین فرمانی در فهرست آوا نیست."), 'فالبک صادقِ run_cmd ناموجود سر جایش است');
ok(appSrc.includes("if (a.act === 'run_cmd')"), 'اجرای run_cmd واقعی (rule idهای کاتالوگ) دست‌نخورده');
ok(appSrc.includes("متنِ داخل گیومه عیناً).\\n' +") || appSrc.includes("متنِ داخل گیومه عیناً).\\n'+"), 'FA: جمله فقط تا «عیناً).» تموم می‌شود');
ok(appSrc.includes("keep only the quoted part).\\n' +") || appSrc.includes("keep only the quoted part).\\n'+"), 'EN: جمله فقط تا «quoted part).»');

/* ============================================================
   [10] A6 — «برام تایپ کن سلام» → تایپ یک‌باره (نه حالت مودار)
   ============================================================ */
console.log('\n[10] A6 — مسیر DICT_START اول یک‌باره را چک می‌کند');
ok(AVAIntent.typeOnceOf('برام تایپ کن سلام') === 'سلام', 'typeOnceOf: «برام تایپ کن سلام» → «سلام»');
ok(AVAIntent.typeOnceOf('برام تایپ کن') === '', 'typeOnceOf: «برام تایپ کن» لخت → خالی (حالت مودار)');
const dA = appSrc.indexOf('if (DICT_START_RE.test(raw) || wakeDictStart) {');
const dSlice = (dA > -1) ? appSrc.slice(dA, dA + 1200) : ''; /* v0.65: پنجره ۹۰۰→۱۲۰۰ (چکِ صدای انجام‌شد داخل بلوک اضافه شد) */
ok(dA > -1, 'بلوک DICT_START_RE پیدا شد');
ok(dSlice.includes('AVAIntent.typeOnceOf(raw)'), 'اول typeOnceOf روی raw اجرا می‌شود');
ok(dSlice.indexOf('_dispatchOutcome = \'type-once\'') > -1 && dSlice.indexOf('_dispatchOutcome = \'type-once\'') < dSlice.indexOf('startDictation();'),
   'محتوا → مسیر type-once؛ فقط بی‌محتوا → startDictation (ترتیب درست)');
ok(dSlice.includes("await typeOnceExec(onceTxt)"), 'اجرا همان مسیر type_once (typeOnceExec) است');
ok(appSrc.indexOf('SYS_DICT_RE.test(raw)') < appSrc.indexOf('DICT_START_RE.test(raw)'), 'رجسیون v0340/smoke: SYS_DICT قبل از DICT_START');

console.log('\n-----------------------------');
console.log(`RESULT: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
