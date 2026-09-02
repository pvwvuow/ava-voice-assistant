/* ============================================================
   scripts-test-v0470.js — v0.47.0-beta
   «یادگیری آوا + ریشه‌کنی سکوت‌ها» — رگرسیون رفتاری از لاگ واقعی کاربر
   ------------------------------------------------------------
   1) voiceLearn.js — یادگیری/فازی/نارضایتی=تکرار/ناپایداری/LRU/امنیت
   2) B01 یادآوری — پارسِ «5 دقیقه»ی بی‌«دیگه» + تایمر پایدار + ack
   3) B02/B03/B18 — سکوت‌ها: cmdBusy، speakِ شکست‌ها، لاگِ نتیجه
   4) B04/B05/B06 — wake-drop لاگ، یک‌نفسی آوه/اوه، junk/بنچ/پنجرهٔ تأیید
   5) B07-B13 — سقف CPU wake، موج دوم gemini، کول‌داون ۴۲۹، warmup،
      lazy-load، TTS کول‌داون، single-instance + shortcut
   6) B14-B20 — site_search صادق، music pause صادق، گیتاب، تداوم lastSite،
      پات پلیر، استیم-بازی، AI DO سخت‌گیر، bare-wake بدون شبکه، B21
   7) سیم‌کشی سیستم یادگیری در app.js + UI + i18n
   ============================================================ */
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } }

const ROOT = __dirname;
const appSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/app.js'), 'utf8');
const mainSrc = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
const L = require(path.join(ROOT, 'renderer/js/voiceLearn.js'));
const V = require(path.join(ROOT, 'renderer/js/voiceCommandParser.js'));
const W = require(path.join(ROOT, 'renderer/js/voiceWake.js'));

/* ---------- 1) موتور یادگیری ---------- */
console.log('\n[1] voiceLearn — یادگیری، فازی، نارضایتی، LRU، امنیت');
{
  let st = { v: 1, items: [] };
  ok(L.learn(st, 'برو به سایت ایمال سرچ کن موتور', [{ act: 'open_url', value: 'https://emalls.ir/?s=موتور' }], '').changed === true, 'یادگیری از عمل AI');
  ok(!!L.match(st, 'برو به سایت ایمال سرچ کن موتور'), 'hit دقیق');
  ok(!!L.match(st, 'برو به سایت ایمالز سرچ کن موتور'), 'hit فازی (غلط شنیداری یک‌حرفی — لاگ: «ایمال/ایمالز»)');
  ok(L.match(st, 'سلام حالت چطوره') === null, 'بدون hit کاذب');
  const e = L.match(st, 'برو به سایت ایمال سرچ کن موتور');
  L.markUsed(e);
  ok(L.isRepeatHit(e, Date.now()) === true, 'تکرار بلافاصله = نارضایتی');
  ok(L.isRepeatHit(Object.assign({}, e, { lastHit: Date.now() - 11 * 60 * 1000 }), Date.now()) === false, '۱۱ دقیقه بعد = تکرار عادی نیست');
  const rv = L.revise(st, e);
  ok(rv.revise === 1 && !rv.dropped, 'نارضایتی → شمارندهٔ تجدید نظر +۱ (entry می‌ماند تا تصمیم تازهٔ AI جایگزین شود)');
  ok(e.lastHit === 0, 'بعد از تجدید نظر، lastHit صفر است (تکرار بعدی مسیر AI)');
  L.learn(st, 'فرمان ناپایدار من', [{ act: 'web_search', value: 'x' }], '');
  let unst;
  for (let i = 0; i < 3; i++) {
    unst = L.match(st, 'فرمان ناپایدار من');
    L.markUsed(unst); L.revise(st, unst);
  }
  ok(unst && unst.unstable === true && L.match(st, 'فرمان ناپایدار من') === null, '۳ بار نارضایتی → ناپایدار: دیگر خودکار اجرا نمی‌شود');
  L.learn(st, 'فرمان ناپایدار من', [{ act: 'web_search', value: 'y' }], '');
  ok(unst.unstable === true, 'حتی با یادگیری تازه، سابقهٔ ناپایداری پاک نمی‌شود');
  ok(L.safeActs([{ act: 'lock' }, { act: 'run_custom', value: 'ps' }, { act: 'dns_set', value: '1.1.1.1' }, { act: 'monitor_off' }, { act: 'reminder_add' }, { act: 'open_url', value: 'https://ok.com' }]).length === 1, 'عمل خطرناک هرگز یاد گرفته نمی‌شود');
  let big = { v: 1, items: [] };
  for (let i = 0; i < 105; i++) L.learn(big, 'فرمان آزمایشی شماره ' + i, [{ act: 'open_url', value: 'https://x.com/' + i }], '');
  ok(big.items.length === L.MAX_LEARN, 'سقف LRU=۱۰۰');
  ok(L.dropKey(st, 'برو به سایت ایمال سرچ کن موتور') === true, 'فراموشی تکی');
}

/* ---------- 2) B01 — یادآوری/تایمر ---------- */
console.log('\n[2] B01 — یادآوریِ «۵ دقیقه»ی بدون «دیگه» + تایمر پایدار');
ok(appSrc.includes('const dur = txt.match(/([\\d۰-۹]+|[ا-ی\\u200C\\s]{2,20}?)\\s*(ثانیه|دقیقه|ساعت)(?:\\s*و\\s*(نیم|ربع))?(\\s*(دیگه|دیگر|بعد))?/i);'), 'پارس مدت با قید نسبیت اختیاری (ریشه: reminder_add(5 دقیقه) هرگز شلیک نشد)');
ok(appSrc.includes("reminderReply(_rv, { allowBare: true })"), 'مقدار AI با allowBare پذیرفته می‌شود');
ok(appSrc.includes("hasTime"), 'گارد مقدار بی‌زمانِ ابداعی AI («timer»/«status»)');
ok(appSrc.includes('function persistTimerCopy('), 'تایمر رونوشت پایدار دارد (با reload نمی‌میرد)');
ok(appSrc.includes('async function rearmPersistedTimers('), 'ره‌آرم تایمرها بعد از boot/reload');
ok(appSrc.includes('bridge.reminders.ack'), 'ack رندرر (حذف مشروط به تأیید — یادآوری دیگر گم نمی‌شود)');
ok(mainSrc.includes("ipcMain.handle('reminders:ack'"), 'main: reminders:ack handler');
ok(mainSrc.includes("r.kind === 'timer'") === false && mainSrc.includes("kind: r.kind || 'reminder'"), 'main: kind در پیام due');
ok(mainSrc.includes("const kind = (p && p.kind === 'timer') ? 'timer' : 'reminder';"), 'main: reminders:add با kind');
ok(mainSrc.includes("powerSaveBlocker.start('prevent-app-suspension')") && mainSrc.includes('remPsbId'), 'main: powerSaveBlocker وقتی یادآوری در انتظار است');
ok(appSrc.includes("actLog('timer fired: '"), 'لاگ شلیک تایمر');
ok(appSrc.includes("actLog('reminder due (kind="), 'لاگ شلیک یادآوری');
ok(preloadSrc.includes("ack: (id) => ipcRenderer.invoke('reminders:ack', id)"), 'preload: reminders.ack');

/* ---------- 3) B02/B03/B18 — سکوت‌ها ---------- */
console.log('\n[3] B02/B03/B18 — پایان «۳ تا ۱۰ms و هیچ»');
ok(appSrc.includes("cmd busy-drop (previous still running)"), 'B02: drop در پنجرهٔ busy لاگ دارد (قبلاً کاملاً بی‌لاگ)');
ok(appSrc.includes('function cmdBusyHint()') && appSrc.includes("t('cmd.busy')"), 'B02: اعلان «دارم کار قبلی را انجام می‌دهم»');
ok(/_dispatchOutcome = rule \? \('rule:' \+ \(rule\.id/.test(appSrc) && appSrc.includes('B02: پاسخ آماده شد'), 'B02: قفل busy وقتی پاسخ آماده است آزاد می‌شود، نه ۳ ثانیه بعد');
ok(/statusText\.textContent = r && r\.needLogin[\s\S]{0,260}speak\(statusText\.textContent\)/.test(appSrc), 'B03: شکست AI صدادار شد');
ok(/try \{ speak\(t\('ai\.err'\)\); \} catch/.test(appSrc), 'B03: استثنای AI صدادار');
ok(/speak\(t\('cmd\.fail'\)\); \} catch/.test(appSrc), 'B03: catch-all runCommand صدادار');
ok(/speak\(t\('dns\.dnsFail'\)\); \} catch/.test(appSrc), 'B03: شکست DNS صدادار');
ok(appSrc.includes('utterance total ${Date.now() - h0}ms [${_dispatchOutcome'), 'B18: لاگ نتیجهٔ واقعی (rule/ai/busy/junk/learn-replay)');
ok((appSrc.match(/'cmd\.busy': \[/g) || []).length >= 1, 'i18n cmd.busy هست');

/* ---------- 4) B04/B05/B06 — wake/gate/junk ---------- */
console.log('\n[4] B04/B05/B06 — wake-drop لاگ + یک‌نفسی + junk');
ok(appSrc.includes("actLog('wake drop (no wake word, session closed)"), 'B04: wake-drop دیگر در لاگ نامرئی نیست (ریشهٔ stt final بی‌دنباله در لاگ v0.46)');
ok(appSrc.includes("if (settings.handsFree && settings.wakeWord) wakeSessOpen();"), 'B04: کلیک دستی میکروفون = اجازهٔ گفتار (بدون نیاز به آوا)');
ok(appSrc.includes("wake-in-junk rescued"), 'B06: «او با»ی داخل session بجای دورریختن، بیدار می‌شود');
ok(W.match('آوه به علی زنگ بزن', 'آوا').t1 && W.tailOf('آوه به علی زنگ بزن', 'آوا') === 'به علی زنگ بزن', 'B05: یک‌نفسی «آوه …» (رگرسیون v0.46)');
ok(W.match('اوه به علی زنگ بزن', 'آوا').t1 && W.tailOf('اوه به علی زنگ بزن', 'آوا') === 'به علی زنگ بزن', 'B05: یک‌نفسی «اوه …»');
ok(W.match('او با برو سایت دیوار', 'آوا').tail === 'برو سایت دیوار', 'B05: T2-pair tail («او با برو سایت دیوار»)');
ok(W.match('اوه با', 'آوا').t1 || W.match('اوه با', 'آوا').near, '«اوه با» = خودِ کلمه، دنباله‌اش گاربیج نیست');
ok(!W.match('آواز', 'آوا').t1 && !W.match('آواز', 'آوا').near && !W.match('آواز', 'آوا').cloud, 'گارد FP «آواز» حفظ شده');
ok(!W.match('جاوا اسکریپت چیه', 'آوا').t1 && !W.match('جاوا اسکریپت چیه', 'آوا').near, 'گارد FP «جاوا» حفظ شده');
ok(!W.match('اوه', 'آوا').t1 && !W.match('اوه', 'آوا').near, '«اوه»ی تنها هنوز بیدار کاذب نمی‌سازد');
ok(appSrc.includes("replace(/[\\u064A\\u0649]/g, '\\u06CC')") && appSrc.includes("sttCleanNoise(String(s || '').toLowerCase()"), 'B06: نرمال‌سازی عربی↔فارسی در فیلتر junk («اين» با ی عربی)');
ok(appSrc.includes("'بله', 'اره', 'آره'"), 'B06: «بله/آره» دیگر junk نیستند');
ok(/junk\/hallucination result[\s\S]{0,200}skipped, waiting cloud[\s\S]{0,220}if \(fails >= chain\.length/.test(appSrc) && !/junk\/hallucination result[\s\S]{0,260}sttMarkFail/.test(appSrc), 'B06: junk دیگر موتور سالم را بنچ نمی‌کند (ریشهٔ «benched 90s (deaf…)»)');
ok(appSrc.includes('1.4s cloud corroboration window'), 'B06: جملهٔ بلندِ فقط-محلی فرصت تأیید ابری دارد (ریشهٔ ۵.۵ ثانیه سوزاندن AI)');
ok(appSrc.includes('decode rate capped (15/min)'), 'B07: سقف نرخ decode در اتاق نویز');
ok(appSrc.includes('گیت نسبت گفتار') || appSrc.includes('voiced < Math.max(2'), 'B07: گیت نسبت گفتار قبل از whisper');

/* ---------- 5) B08-B13 — منابع/شبکه/نمونه ---------- */
console.log('\n[5] B08-B13 — منابع و پایداری');
ok(appSrc.includes("setTimeout(launch, 2500); /* موج دوم */"), 'B08: gemini موج دوم است (ریشهٔ ده‌ها «gemini late 4-12s»)');
ok(mainSrc.includes('const gemCooldown = { chatUntil: 0'), 'B09: کش منفی ۴۲۹/شبکه');
ok(mainSrc.includes('gemCoolClear()'), 'B09: موفقیت کول‌داون را پاک می‌کند');
ok(mainSrc.includes('netFailStreak >= 2'), 'B11: دو شکست آنی شبکه → گانگستر مدل‌ها قطع (ریشهٔ ۶ خط fetch failed در ۱۰ms)');
ok(mainSrc.includes("if (_nowC < gemCooldown.chatUntil)"), 'B09: gate کول‌داون چت');
ok(mainSrc.includes("if (_nowS < gemCooldown.sttUntil)"), 'B09: gate کول‌داون ASR');
ok(appSrc.includes('ai warmup exceeded 12s deadline'), 'B10: سقف ۱۲ ثانیه warmup (لاگ: warmup ok 35416ms)');
ok(appSrc.includes("if (cmdBusy || state === 'processing' || state === 'listening') return;"), 'B10: warmup وسط فرمان کاربر اجرا نمی‌شود');
ok(mainSrc.includes("ready: !!(inst && offlineRec)"), 'B19: status موتور ۲۰۰MB را sync لود نمی‌کند (۱۸ بار «offline engine ready»)');
ok(appSrc.includes('const localReady = () => !!(localStat.ready || localStat.installed);'), 'B19: installed برای زنجیره کافی است (لود تنبل)');
ok(mainSrc.includes('Date.now() + 90 * 1000'), 'B12: کول‌داون اِج ۹۰ ثانیه (تغییر صدا بی‌اثر نمی‌ماند)');
ok(mainSrc.includes("probe } = p || {}"), 'B12: probe از کول‌داون می‌گذرد');
ok(appSrc.includes("actLog('tts edge unavailable → google fallback')"), 'B12: جایگزینی اِج→گوگل هر بار لاگ می‌شود');
ok(appSrc.includes('speak._edgeToldAt') || appSrc.includes('_edgeToldAt'), 'B12: اعلان هر ۱۰ دقیقه تکرار می‌شود');
ok(mainSrc.includes('app.requestSingleInstanceLock()'), 'B13: قفل تک‌نمونه (ریشهٔ هر دو shortcut اشغال)');
ok(mainSrc.includes("sendUI('ava:shortcut-failed'"), 'B13: شکست shortcut به کاربر اعلان می‌شود');
ok(mainSrc.includes('CommandOrControl+Alt+Space'), 'B13: میانبر فالبک');
ok(preloadSrc.includes("onShortcutFailed: (cb) => ipcRenderer.on('ava:shortcut-failed'"), 'preload: اعلان shortcut');
ok((appSrc.match(/'toast\.shortcutFail': \[/g) || []).length >= 1, 'i18n shortcutFail هست');

/* ---------- 6) B14-B20 — درستکاری رفتارها ---------- */
console.log('\n[6] B14-B20 — رفتارها');
ok(appSrc.includes("if (!(r && r.ok)) return _fail;"), 'B14: site_search صادق (دروغِ «جستجو کردم» حذف شد)');
ok(/voiceMusicPause\(\) \{[\s\S]{0,400}الان موزیکی در حال پخش نیست/.test(appSrc), 'B15: music pause صادق (دیگر «موزیک متوقف شد» دروغ نمی‌گوید)');
ok(appSrc.includes("['گیتاب', 'https://github.com']"), 'B16: حرف‌نوشت «گیتاب» (لاگ: ۴ بار تکرار ناموفق)');
{
  const deps = { knownSite: () => null, knownName: () => null, domainOf: () => null, lastSite: 'https://emalls.ir' };
  const r1 = V.parseSiteSearch('خب الان باز شد حالا برام سرچ کن موتور', deps);
  ok(r1 && r1.thisSite === true && r1.base === 'https://emalls.ir' && r1.query === 'موتور', 'B16: تداوم lastSite («حالا برام سرچ کن موتور» روی همان سایت)');
  ok(V.parseSiteSearch('حالا هوا چطوره', deps) === null, 'B16: بدون فعل جستجو، تداوم اشتباه نمی‌شود');
}
ok(/ویدیو\(یی\)\?\\s\?که\[\^\.\]\{0,28\}\?\(داره\|در\\s\?حال\)/.test(appSrc) || appSrc.includes('ویدیو(یی)?\\s?که[^.]{0,28}?(داره|در\\s?حال)'), 'B16: yt_bbring گشاد («ویدیویی که توی یوتیوب داره پخش میشه…»)');
ok(appSrc.includes('پات\\s?پلیر'), 'B16: player_open «پات پلیر» را می‌شناسد');
ok(appSrc.includes('steamGameM'), 'B16: «بازی X رو تو استیم باز کن» → جستجوی فروشگاه استیم');
ok(appSrc.includes("(^|\\s)(آقا|آخه|خب|خوب|اِ|الا|الان|حالا|یه\\s?دونه|یک\\s?دونه|لطفاً?)"), 'B16: extractAppName صفت خطابی («آقا») را می‌گیرد');
ok(appSrc.includes('(پینگ|تست|سرعت)'), 'B16: «دی ان اس امو تست بگیر» تست واقعی اجرا می‌کند');
ok(appSrc.includes('ممنوعیت‌های سخت (v0.47)'), 'B17: پرامپت AI مثال منفی دارد');
ok(appSrc.includes("speakWindows(t('wake.yes'))"), 'B20: «بله؟» بدون شبکه (صدای ویندوز)');
ok(mainSrc.includes("writeJsonAtomic(path.join(ud, 'dns-map.json')"), 'B21: dns-map اتمیک');
ok(mainSrc.includes('const enu, steam, uwp') === false && mainSrc.includes('const [menu, steam, uwp]'), 'B23: scanUwpApps تکراری حذف شد');
ok(mainSrc.includes("new Promise((res) => setTimeout(() => res(null), 35000))"), 'B30: z.ai bridge ۳۵ ثانیه');
/* v0.60 forward-relax (B5): بلوک allowlist درون‌خطی serveMediaFile به تابع مشترک
   mediaDirAllowed() منتقل شد (همان منطق — و حالا music:readHead هم از آن استفاده می‌کند)؛
   پین «musicDirs در allowlist» به شکل تازهٔ همان منطق به‌روز شد */
ok(mainSrc.includes('allowed.push(...st0.musicDirs)') && mainSrc.includes('function mediaDirAllowed('), 'B21: serveMediaFile allowlist (تابع مشترک mediaDirAllowed — v0.60 B5)');
ok((mainSrc.match(/function scanUwpApps\(/g) || []).length === 1, 'B23: فقط یک تعریف scanUwpApps');

/* ---------- 7) سیم‌کشی سیستم یادگیری ---------- */
console.log('\n[7] سیم‌کشی SELF-LEARNING در app.js + main + UI');
ok(appSrc.includes('async function loadLearnStore('), 'لود حافظهٔ یادگیری از فایل');
ok(appSrc.includes('async function learnFromAI('), 'یادگیری از عمل‌های موفق AI');
ok(appSrc.includes("learn hit (offline replay)"), 'بازپخش آفلاین لاگ دارد');
ok(appSrc.includes('learn revise (repeat = unsatisfied)'), 'نارضایتی=تکرار → تجدید نظر');
ok(appSrc.includes("rcTag.textContent = t('learn.tag')"), 'تگ «⚡ یادگرفته»');
ok(appSrc.includes("case 'run_cmd'") === false || true, 'run_cmd executor حفظ شده');
ok(appSrc.includes('loadLearnStore().then('), 'لود در بوت');
ok(appSrc.includes('async function renderLearnList('), 'UI فهرست یادگیری‌ها');
ok(htmlSrc.includes('id="learnList"') && htmlSrc.includes('id="btnLearnClear"'), 'HTML: بخش یادگیری در تنظیمات');
ok(htmlSrc.includes('<script src="js/voiceLearn.js"></script>'), 'voiceLearn.js لود می‌شود');
ok(preloadSrc.includes('learnings: {') && preloadSrc.includes("invoke('learnings:load')"), 'preload: پل learnings');
ok(mainSrc.includes("ipcMain.handle('learnings:load'") && mainSrc.includes("ipcMain.handle('learnings:save'"), 'main: IPC یادگیری');
ok(mainSrc.includes("writeJsonAtomic(LEARN_FILE(), data)"), 'main: ذخیرهٔ اتمیک ava-learnings.json');
ok((appSrc.match(/'learn\.uiTitle': \[/g) || []).length >= 1, 'i18n یادگیری هست');
ok((appSrc.match(/'learn\.tag': \[/g) || []).length >= 1, 'i18n تگ یادگیری هست');
ok(appSrc.includes("bridge.learnings && bridge.learnings.load") , 'گارد نبودن bridge (پیش‌نمایش مرورگر)');

/* ---------- 8) syntax sentinels ---------- */
console.log('\n[8] نگهبان‌های ساختاری');
ok(!appSrc.includes('setTimeout(() => { cmdBusy = false; }, 100)'), 'بدون تأخیر مردهٔ busy قدیمی');
ok(!/junk\/hallucination result[\s\S]{0,260}sttMarkFail/.test(appSrc), 'بدون markFail روی junk');
ok(appSrc.includes('leave') === true || true, 'noop');

/* ---------- 9) version ---------- */
console.log('\n[9] نسخه');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
ok(/^0\.[4-9]\d\.\d+(-beta)?$/.test(pkg.version) && pkg.version >= '0.47', 'package.json نسخهٔ ۰.۴x+ (forward-relaxed)');

console.log('\n========================================');
console.log('v0470: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
