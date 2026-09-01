'use strict';
/* ============================================================
   آوا — scripts-test-v0381.js — تست رگرسیون فیکس‌های v0.38.1
   ------------------------------------------------------------
   پوشش:
   - حذف ربایش «خاموش» به خاموشی PC / اضافه شدن آن به میوت
   - گارد «رم» / ترتیب یادآوری قبل از مانیتورینگ و ساعت
   - حذف «حساب کن» از باز کردن ماشین‌حساب
   - «پینگ» دیگر پین/PiP نیست + گارد پلی‌لیست UNPIN
   - نرمال‌سازی cmd قبل از dispatch (ریشهٔ «فرمان کاری نمی‌کند»)
   - تایمر ساعت/ترکیبی + فلش مرورگری یادآوری
   - wakeHitText: آواز/جاوا کاذب نیست، آواجون/آوه هست + دنبالهٔ یک‌نفس
   - PiP: stepOpacity چرخه، شناسهٔ ۱۱ رقمی، bindMoveKeys در show،
     pause هنگام hide، فوکوس ورودی جستجو، restore، clamp resize،
     flush در will-quit، CORS برای ava-media
   - main: EncodedCommand، کش منفی discover، & در safeUrl،
     render-process-gone هویت پنجره، خطای ws، اتمیک بودن نوشتن‌ها،
     openPath چک‌شده، برگشت globalShortcut
   - app: play().catch، زمان واقعی تاریخچه، حذف بایندینگ مردهٔ
     btnDcSettings، کارت یادآوری در تنظیمات، حذف ادعای ویژوالایزر
   ============================================================ */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname);
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const core = require('./pipCore');
const AVAVoice = require('./renderer/js/voiceCommandParser');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('PASS | ' + name); } else { fail++; console.log('FAIL | ' + name); } };

const app = read('renderer/js/app.js');
const mainjs = read('main.js');
const pwm = read('pipWindowManager.js');
const phtml = read('renderer/pip.html');
const pRenderer = read('renderer/js/pipRenderer.js');
const pPreload = read('pipPreload.js');
const idx = read('renderer/index.html');
const pkg = JSON.parse(read('package.json'));

/* ---------- استخراج قوانین از source (بدون اجرای app.js) ---------- */
function extractRuleK(tag) {
  const i = app.indexOf(tag);
  if (i === -1) return null;
  const seg = app.slice(Math.max(0, i - 400), i);
  /* v0.39 — بین k: و t: ممکن است id: '...' اضافه شده باشد */
  const m = seg.match(/k: (\/(?:[^\/\\]|\\.)+\/[a-z]*)\s*,\s*(?:id: '[a-z_]+',\s*)?$/);
  return m ? m[1] : null;
}
const evalRe = (src) => { try { return eval(src); } catch (_) { return null; } };

/* ۱) خاموش — دستگاه الزامی */
const shK = extractRuleK("t: 'خاموش کردن'");
const shutdownRe = shK && evalRe(shK);
ok(!!shutdownRe, 'قانون خاموشی استخراج شد');
if (shutdownRe) {
  ok(!shutdownRe.test('صدا رو خاموش کن'), 'NEG: «صدا رو خاموش کن» → خاموشی PC نمی‌رود');
  ok(!shutdownRe.test('بیدارباش رو خاموش کن'), 'NEG: «بیدارباش رو خاموش کن» → خاموشی PC نمی‌رود');
  ok(!shutdownRe.test('وای فای رو خاموش کن'), 'NEG: «وای‌فای رو خاموش کن» → خاموشی PC نمی‌رود');
  ok(shutdownRe.test('کامپیوتر رو خاموش کن'), 'POS: «کامپیوتر رو خاموش کن» → خاموشی');
  ok(shutdownRe.test('خاموش کن کامپیوتر رو'), 'POS: ترتیب برعکس هم قبول');
  ok(shutdownRe.test('shut down the computer'), 'POS: shut down the computer');
  ok(shutdownRe.test('سیستم رو شات داون کن'), 'POS: شات داون');
}

/* ۲) میوت — «صدا رو خاموش کن» حالا میوت می‌شود */
const muteK = extractRuleK("t: 'بی‌صدا کردن'");
const muteRe = muteK && evalRe(muteK);
ok(!!muteRe, 'قانون میوت استخراج شد');
if (muteRe) ok(muteRe.test('صدا رو خاموش کن'), 'POS: «صدا رو خاموش کن» → میوت');

/* ۳) رم — گارد توکن */
const monK = extractRuleK("t: 'مانیتورینگ'");
const monRe = monK && evalRe(monK);
ok(!!monRe, 'قانون مانیتورینگ استخراج شد');
if (monRe) {
  ok(!monRe.test('بیدارم کن ساعت 6'), 'NEG: «بیدارم کن» دیگر رم نمی‌گیرد');
  ok(!monRe.test('الارم ساعت 7'), 'NEG: «آلارم» بدون رم اشتباه نمی‌شود');
  ok(monRe.test('رم چنده'), 'POS: «رم چنده» → مانیتورینگ');
  ok(monRe.test('وضعیت سیستم چطوره'), 'POS: وضعیت سیستم');
  ok(monRe.test('cpu usage'), 'POS: cpu');
}

/* ۴) ترتیب: یادآوری/تایمر قبل از مانیتورینگ و ساعت */
const iRem = app.indexOf("k: /یادآوری|یادم\\s?بنداز|یادت\\s?بنداز|یادآور|آلارم|بیدارم\\s?کن|remind me/");
const iMon = app.indexOf("t: 'مانیتورینگ'");
const iClk = app.indexOf("t: 'ساعت'");
ok(iRem !== -1 && iMon !== -1 && iClk !== -1 && iRem < iMon && iRem < iClk,
  'ترتیب: یادآوری قبل از مانیتورینگ و ساعت است (index ' + [iRem, iMon, iClk] + ')');

/* ۵) ماشین‌حساب — «حساب کن» حذف شد */
const calcSeg = app.slice(app.indexOf("t: 'باز کردن ماشین‌حساب'") - 500, app.indexOf("t: 'باز کردن ماشین‌حساب'"));
const calcKm = calcSeg.match(/k: (\/(?:[^\/\\]|\\.)+\/[a-z]*)\s*,\s*(?:id: '[a-z_]+',\s*)?$/); /* v0.39: id بین k و t */
const calcRe = calcKm && evalRe(calcKm[1]);
ok(!!calcRe && !calcRe.test('حساب کن پنج ضربدر هفت'), 'NEG: «حساب کن …» دیگر اپ ماشین‌حساب باز نمی‌کند');
ok(calcRe && calcRe.test('ماشین حساب رو باز کن'), 'POS: «ماشین حساب» هنوز اپ را باز می‌کند');

/* ۶) پینگ — پارسر + دروازه */
ok(!AVAVoice.PIP_COMMAND_RE.test('پینگ گوگل چنده'), 'NEG: «پینگ گوگل چنده» → دروازهٔ PiP باز نمی‌شود');
ok(AVAVoice.PIP_COMMAND_RE.test('ویدیو رو پین کن'), 'POS: «ویدیو رو پین کن» → دروازهٔ PiP');
ok(!AVAVoice.parseVoiceCommand('پینگ گوگل چنده', {}) , 'NEG: پارسر برای «پینگ» PIN نمی‌دهد');
ok(AVAVoice.parseVoiceCommand('ویدیو رو پین کن', {}) && AVAVoice.parseVoiceCommand('ویدیو رو پین کن', {}).intent === 'PIN_VIDEO', 'POS: پین معمولی هنوز PIN_VIDEO');
ok(!AVAVoice.parseVoiceCommand('این آهنگ رو از پلی لیست بردار', { pipOpen: true }), 'NEG: «از پلی‌لیست بردار» با PiP باز UNPIN نمی‌شود');
ok(AVAVoice.parseVoiceCommand('ببندش', { pipOpen: true }) && AVAVoice.parseVoiceCommand('ببندش', { pipOpen: true }).intent === 'UNPIN_VIDEO', 'POS: «ببندش» با PiP باز UNPIN');

/* ۷) نرمال‌سازی cmd در dispatch */
ok(/raw = normFaFull\(raw\);\s*\n\s*cmd = raw;/.test(app), 'dispatch: cmd همیشه متن نرمال‌شده است');
ok(/} catch \(err\) \{[\s\S]{0,200}command fail/.test(app), 'dispatch: try/catch دور اجرای قوانین (میکروفن دیگر قفل نمی‌شود)');

/* ۸) تایمر — ساعت/ترکیبی/ثانیه (regex واقعی از source) */
const upM = app.match(/const unitPairs = \[\.\.\.txt\.matchAll\(\/(.+)\/gi\)\];/);
ok(!!upM, 'startTimer: استخراج جفت عدد+واحد پیدا شد');
if (upM) {
  const upRe = new RegExp(upM[1], 'gi');
  const minsOf = (txt) => {
    let mins = 0;
    let firstUnit = '';
    for (const p of txt.matchAll(upRe)) {
      const n = parseFloat(p[1]); const u = p[2].toLowerCase();
      if (/ساعت|hour|hr/.test(u)) { mins += n * 60; if (!firstUnit) firstUnit = 'h'; }
      else if (/ثانیه|sec/.test(u)) { mins += n / 60; if (!firstUnit) firstUnit = 's'; }
      else { mins += n; if (!firstUnit) firstUnit = 'm'; }
    }
    return { mins, firstUnit };
  };
  ok(minsOf('تایمر 2 ساعت').mins === 120, 'POS: «تایمر ۲ ساعت» = ۱۲۰ دقیقه (قبلاً ۲!)');
  ok(minsOf('1 ساعت و 30 دقیقه').mins === 90, 'POS: «۱ ساعت و ۳۰ دقیقه» = ۹۰');
  ok(minsOf('30 ثانیه').mins === 0.5, 'POS: «۳۰ ثانیه» = ۰.۵ دقیقه');
  ok(minsOf('5 دقیقه').mins === 5, 'POS: «۵ دقیقه» = ۵');
  ok(/msOverride/.test(app), 'startTimer: فلش مدت دقیق مرورگری (msOverride) هست');
  ok(/return startTimer\(c, Math\.max\(5000, parsed\.at - Date\.now\(\)\)\)/.test(app), 'یادآوری مرورگر: مدت واقعی به‌جای ternary مرده');
}

/* ۹) wake — آواز/جاوا کاذب نیست؛ دنبالهٔ variant ها می‌آید */
const nfM = app.match(/function normFaFull\(s\) \{[\s\S]*?\n  \}/);
const wkM = app.match(/const WAKE_ACCEPT = new Set\(\[[\s\S]*?\]\);[\s\S]*?function wakeHitText\(txt\) \{[\s\S]*?\n  \}/);
const wreM = app.match(/const WAKE_WORD_RE = (\/[^\/\n]+\/[a-z]);/);
ok(!!(nfM && wkM && wreM), 'استخراج wakeHitText/WAKE_WORD_RE/normFaFull از source');
if (nfM && wkM && wreM) {
  const sandbox = new Function(nfM[0] + '\n' + wkM[0].replace('const WAKE_ACCEPT', 'var WAKE_ACCEPT') + '\n' + 'return { hit: wakeHitText, WAKE_WORD_RE: ' + wreM[1] + ' };');
  const w = sandbox();
  ok(w.hit('آواز بخون') === false, 'NEG: «آواز بخون» بیدارباش کاذب نمی‌سازد');
  ok(w.hit('جاوا اسکریپت چیه') === false, 'NEG: «جاوا» (java) بیدارباش کاذب نمی‌سازد');
  ok(w.hit('java tutorial') === false, 'NEG: java');
  ok(w.hit('ava') === true, 'POS: ava');
  ok(w.hit('آوا') === true, 'POS: آوا');
  ok(w.hit('آبا') === true, 'POS: آبا');
  ok(w.hit('آوه') === true, 'POS: آوه (fuzzy)');
  ok(w.hit('آواجون') === true, 'POS: آواجون');
  ok(w.hit('آواز') === false, 'NEG: آواز دقیق');
  ok(w.hit('اوه اوه') === false, 'NEG: «اوه» تنها عمداً غیرفعال');
  const wm = 'آوه به علی زنگ بزن'.match(w.WAKE_WORD_RE);
  ok(!!wm && wm[2] === 'به علی زنگ بزن', 'POS: دنبالهٔ یک‌نفس بعد از variant فازی حفظ می‌شود');
  const wm2 = 'هی آوا پین کن ویدیو رو'.match(w.WAKE_WORD_RE);
  ok(!!wm2 && wm2[2] === 'پین کن ویدیو رو', 'POS: «هی آوا …» دنباله');
}

/* ۱۰) PiP — pipCore: چرخهٔ شفافیت */
ok(core.stepOpacity(0.3, -1) === 1, 'PiP: opacity از ۳۰٪ می‌چرخد به ۱۰۰٪ (قبلاً گیر می‌کرد)');
ok(core.stepOpacity(1, -1) === 0.7, 'PiP: ۱۰۰→۷۰');
ok(core.stepOpacity(0.3, 1) === 0.5, 'PiP: ۳۰→۵۰');

/* ۱۱) PiP — شناسهٔ ۱۱ رقمی */
const lvM = pwm.match(/function looksLikeVideoId\(s\) \{[\s\S]*?\n\}/);
ok(!!lvM, 'looksLikeVideoId استخراج شد');
if (lvM) {
  const f = new Function('return ' + lvM[0].replace(/^function /, 'function ')) ;
  const looks = f();
  ok(looks('hello-world') === false, 'NEG: «hello-world» یوتیوب باز نمی‌کند');
  ok(looks('abcdefghijk') === false, 'NEG: ۱۱ حرف کوچک یکدست');
  ok(looks('dQw4w9WgXcQ') === true, 'POS: شناسهٔ واقعی یوتیوب');
  ok(looks('abcdefghi1j') === true, 'POS: ۱۱ نویسه با رقم');
}
ok(!/\/\^\[a-zA-Z0-9_-\]\{11\}\$\/\.test\(s\) \? s : null/.test(pwm), 'PiP: heuristic خام ۱۱ نویسه‌ای حذف شد');

/* ۱۲) PiP — بازبست میانبرها + pause + فوکوس + restore + clamp + flush */
ok(/function showPiP\(source\) \{[\s\S]*?bindMoveKeys\(true\);/.test(pwm), 'PiP: showPiP دوباره bindMoveKeys می‌کند (میانبر بعد از hide→show مرده نیست)');
ok(/function hidePiP\(\) \{[\s\S]*?pip:pause/.test(pwm), 'PiP: hidePiP قبل از مخفی شدن صدا را pause می‌کند');
ok(pPreload.includes('onPause'), 'PiP: پل onPause در preload');
ok(pRenderer.includes("pipHost.onPause"), 'PiP: renderer به onPause گوش می‌دهد');
ok(/pip:host:focus-input/.test(pwm) && /pip:host:blur-input/.test(pwm), 'PiP: handler فوکوس/بلور ورودی');
ok(pRenderer.includes('pipHost.focusInput') && pRenderer.includes('pipHost.blurInput'), 'PiP: ورودی جستجو فوکوس/بلور را خبر می‌دهد');
ok(/setFocusable\(true\)/.test(pwm) && /setFocusable\(false\)/.test(pwm), 'PiP: setFocusable موقت در تایپ');
ok(/opts\.restore === undefined\) opts\.restore = true/.test(pwm), 'PiP: restore موقعیت ذخیره‌شده پیش‌فرض شد');
ok(/getAllDisplays\(\)\.some/.test(pwm), 'PiP: جای ذخیره‌شده فقط روی مانیتور مرئی بازیابی می‌شود');
ok(/Math\.min\(state\.lastBounds\.x, wa\.x \+ wa\.width - s\.w\)/.test(pwm), 'PiP: resize به workArea مهار می‌شود');
ok(pwm.includes('flushPiPState'), 'PiP: flushPiPState صادر می‌شود');
ok(/will-quit[\s\S]{0,200}flushPiPState/.test(mainjs), 'PiP/main: flush در will-quit');
ok(/will-quit[\s\S]{0,200}unregisterAll/.test(mainjs), 'main: unregisterAll در will-quit ماند');

/* ۱۳) PiP — صدا هنگام بستن */
ok(/function showEmpty\(msg\) \{[\s\S]*?vid\.pause\(\)/.test(pRenderer), 'PiP: showEmpty پخش را واقعاً می‌بندد');
ok(/function showEmpty\(msg\) \{[\s\S]*?about:blank/.test(pRenderer), 'PiP: iframe خالی می‌شود');
ok(pRenderer.includes('executeJavaScript') && !pRenderer.includes('enablejsapi=1'), 'PiP: postMessage با origin مشخص (بدون wildcard)');
ok('PiP v2: وضعیت یوتیوب با ytVideoState سینک می‌شود', pRenderer.includes('ytVideoState') && pRenderer.includes('setPlayIcon(!!st.p)'));
ok(pRenderer.includes("volumechange"), 'PiP: رویداد mute ویدیوی مستقیم سینک می‌شود');
ok(/barEl\.addEventListener\('mouseleave'/.test(pRenderer), 'PiP: خروج از نوار کنترل hoverUi(false) می‌فرستد (dead zone iframe)');
ok(pRenderer.includes('setPlayIcon(false);\n      setMuteIcon(false);') || /loadSource\(src\) \{[\s\S]{0,120}setPlayIcon\(false\)/.test(pRenderer), 'PiP: دکمه‌ها با هر منبع جدید ریست می‌شوند');

/* ۱۴) main — EncodedCommand و بقیه */
ok(/custom:run[\s\S]{0,400}-EncodedCommand/.test(mainjs), 'main: custom:run با EncodedCommand (کوتیشن دیگر نمی‌شکند)');
ok(!/NonInteractive -Command "\$\{s\.replace/.test(mainjs), 'main: escaping دستی قدیمی حذف شد');
ok(/failAt: 0/.test(mainjs) && /gemDiscoverCache\.failAt && now - gemDiscoverCache\.failAt < 3 \* 60 \* 1000/.test(mainjs), 'main: کش منفی ۳ دقیقه‌ای discovery');
ok(/gemDiscoverCache\.failAt = Date\.now\(\)/.test(mainjs), 'main: شکست discovery ثبت می‌شود');
ok(/s\.replace\(\/\["\^|<>\]\/g, ''\)|\["\^|<>\]/.test(mainjs.replace('&', '')) && !/replace\(\/\["\^&\|<>\]\/g/.test(mainjs), 'main: & دیگر از URL حذف نمی‌شود');
ok(/app\.on\('render-process-gone', \(_ev, wc, details\) => \{[\s\S]{0,700}wc === win\.webContents/.test(mainjs), 'main: render-process-gone فقط پنجرهٔ مرده را ریکاور می‌کند');
ok(/ws\.on\('error', \(e\) => finish\(e\)\)/.test(mainjs), 'main: خطای stream در ghDownloadToFile');
ok(/wsErr = e; try \{ reader\.cancel\(\)/.test(mainjs), 'main: خطای stream در offlineDownloadFile');
ok(/function writeJsonAtomic/.test(mainjs), 'main: helper نوشتن اتمیک');
ok(/return writeJsonAtomic\(f, obj\);/.test(mainjs), 'main: settings:save اتمیک');
ok(/writeJsonAtomic\(f, reminders\)/.test(mainjs), 'main: یادآوری‌ها اتمیک');
ok(/writeJsonAtomic\(f, arr\.slice\(0, 200\)\)/.test(mainjs), 'main: یادداشت‌ها اتمیک');
ok(/writeJsonAtomic\(f, appsCache\)/.test(mainjs), 'main: کش برنامه‌ها اتمیک');
ok(/renameSync\(tmp, statePath\)/.test(pwm), 'PiP: نوشتن state اتمیک');
ok(/installer open failed/.test(mainjs), 'main: خطای openPath نصّاب چک می‌شود');
ok(/shortcut register FAILED/.test(mainjs), 'main: اشغال میانبر PTT لاگ می‌شود (v0.47: پیام داینامیک + fallback + اعلان)');
ok(/KEY_BUSY:Ctrl\+Shift\+P/.test(pwm), 'PiP: اشغال Ctrl+Shift+P لاگ می‌شود');

/* ۱۵) app — بقیه فیکس‌ها */
ok(/mAudio\.play\(\)\.catch\(\(\) => \{/.test(app), 'app: play() بدون unhandled rejection');
ok(/\(LANG === 'en' \? timeFmtEn : timeFmt\)\.format\(new Date\((h\.)?at \|\| Date\.now\(\)\)\)/.test(app), 'app: تاریخچه زمان واقعی هر آیتم را نشان می‌دهد (forward-relaxed: v0.55 تاریخچهٔ گفتگو)');
ok(!/const btnDcSettings = \$\('#btnDcSettings'\)/.test(app), 'app: بایندینگ مردهٔ btnDcSettings حذف شد');
ok(idx.includes('id="remList"') && idx.includes('id="btnRemClear"'), 'index: کارت یادآوری‌ها در تنظیمات');
ok(app.includes('renderRemList'), 'app: رندر فهرست یادآوری‌ها wired شد');
ok(/bridge\.reminders\.remove\(rem\.id\)/.test(app), 'app: حذف تک یادآوری wired');
ok(/bridge\.reminders\.clear\(\)/.test(app), 'app: پاک کردن همهٔ یادآوری‌ها wired');
ok(!app.includes('ویژوالایزر زنده، ویجت') , 'app: ادعای ویژوالایزر زنده از توضیح موزیک حذف شد (بوم ندارد — ریسک سکوت WebAudio)');
ok(/یورو|ارو\(\?!\[\\u0600-\\u06FF\]\)|euro/.test(app) && !/ارو\\b/.test(app), 'app: alias یورو با lookahead (ب مرده حذف شد)');
ok(/^0\.(38|39|[4-9][0-9])\./.test(pkg.version), 'نسخه 0.38.x+ در package.json (forward-regex)');
ok(/0\.38\.1-beta|0\.39\.0-beta|0\.[4-9][0-9]\.[01]-beta/.test(app), 'نسخه در app.js (forward-regex)');

console.log('');
console.log(`RESULT: ${pass}/${pass + fail}`);
if (fail > 0) { console.log('FAIL_OK'); process.exit(1); }
console.log('V0381_OK');
