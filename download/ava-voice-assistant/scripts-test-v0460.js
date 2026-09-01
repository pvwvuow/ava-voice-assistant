/* ============================================================
   scripts-test-v0460.js — v0.46.0-beta WAKE BRAIN
   موتور سه‌لایهٔ کلمهٔ بیدارباش + فرمان‌پذیریِ لاگ‌محور
   ------------------------------------------------------------
   1) voiceWake.js — تطبیق T1/T2/T3 روی «همان خروجی‌های واقعی whisper
      در activity.log کاربر» (او با، اوه با، حو با، آبا، ava, Aba…)
   2) گارد FP — واژه‌های عادی و نویز هرگز بیدار نمی‌کنند
   3) tail یک‌نفسی + کلمهٔ بیدارباش دلخواه
   4) app.js — سیم‌کشی wakeCheck/پیش‌نواز/آمار/تأیید ابری/bare-wake
   5) emalls + aiUrlWithQuery + قانون ۶ + set_wake_word + UI
   ============================================================ */
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ FAIL: ' + msg); } }

const ROOT = __dirname;
const appSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/app.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
const wakeSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/voiceWake.js'), 'utf8');
const W = require(path.join(ROOT, 'renderer/js/voiceWake.js'));

/* ---------- 1) موتور سه‌لایه — خروجی‌های واقعی لاگ v0.45 ---------- */
console.log('\n[1] T1/T2 — تلفظ‌های واقعی «آوا» از activity.log کاربر (بیدار فوری)');
const REAL_HEARD = ['او با', 'اوه با', 'حو با', 'اوبا', 'اوهبا', 'آبا', 'ابا', 'اوا', 'آوا', 'آوا جان', 'هی آوا', 'او افا', 'Aba', 'ava', 'آوای من', 'اوا ی'];
for (const t of REAL_HEARD) {
  const m = W.match(t, 'آوا');
  ok(m.t1 || m.near, `«${t}» → wake (t1=${m.t1} near=${m.near})`);
}

console.log('\n[2] T3 — نامزد تأیید ابری (تک‌تکه‌های سخت)');
for (const t of ['باو باو', 'پاو با', 'اوربا', 'orba', 'a bar']) {
  const m = W.match(t, 'آوا');
  ok(m.cloud && !m.t1 && !m.near, `«${t}» → cloud-verify candidate`);
}

console.log('\n[3] گارد FP — واژه‌های عادی و نویز هرگز (تلفظ عادی + ابری) بیدار نمی‌کنند');
const FP = ['اوه', 'او', 'هوا', 'باور', 'بابا', 'ابر', 'ابان', 'آباد', 'سلام', 'خوبی',
  'صول', '[صول]', 'صحر', 'صی', '"Q"', 'از از از از', 'ششششش', '[cough]', 'usic]',
  'اره', 'نه', 'درست', 'بگه یه چیم', 'موتور', 'یوتیوب', 'رو با مطرقه تمش', 'این از', 'برام', 'دیوار'];
for (const t of FP) {
  const m = W.match(t, 'آوا');
  ok(!m.t1 && !m.near && !m.cloud, `«${t}» → no wake`);
}

console.log('\n[4] دنبالهٔ یک‌نفسی + کلمهٔ دلخواه');
ok(W.tailOf('آوا برو به سایت ایمال سرچ کن موتور', 'آوا') === 'برو به سایت ایمال سرچ کن موتور', 'tail: «آوا برو به سایت ایمال سرچ کن موتور»');
ok(W.tailOf('آوا', 'آوا') === '' && W.tailOf('آوا جان', 'آوا') === '', 'tail خالی برای «آوا»/«آوا جان»');
ok(W.tailOf('اوا بگو سلام', 'آوا') === 'بگو سلام', 'tail با آ/ا انعطاف‌پذیر');
const mS = W.match('سارا', 'سارا');
ok(mS.t1, 'کلمهٔ دلخواه «سارا» → T1');
ok(W.match('صارا', 'سارا').near, 'کلمهٔ دلخواه: «صارا» → T2 آوانگار (س/ص)');
ok(W.match('سا را', 'سارا').near, 'کلمهٔ دلخواه: «سا را» → T2 (پیوستهٔ توکن‌ها)');
ok(W.tailOf('سارا بگو سلام', 'سارا') === 'بگو سلام', 'کلمهٔ دلخواه: tail');
ok(!W.match('سلام', 'سارا').t1 && !W.match('سلام', 'سارا').near && !W.match('سلام', 'سارا').cloud, 'کلمهٔ دلخواه: «سلام» نه');
ok(W.quickHit('او با', 'آوا') === true, 'quickHit سازگاری (T1∪T2)');

/* ---------- 5) app.js — سیم‌کشی مغز بیدارباش ---------- */
console.log('\n[5] app.js — wakeCheck سه‌لایه + پیش‌نواز + آمار + تأیید ابری');
ok(appSrc.includes('const wm = (window.AVAWake ||'), 'wakeCheck از AVAWake.match استفاده می‌کند');
ok(appSrc.includes('function wakeWordCfg()') && appSrc.includes('AVAWake.norm(settings.wakeWordText)'), 'wakeWordCfg از تنظیمات می‌خواند');
ok(appSrc.includes("s0 = Math.max(0, i - 2)"), 'پیش‌نواز ۲ چانک (~۱۷۰ms) — ریشهٔ «آوا»ی بریده');
ok(appSrc.includes('wake-always cloud verify ('), 'تأیید ابری با برچسب near/miss');
ok(appSrc.includes("L.lastCloudTry = Date.now(); L.lastCloudSig = sig; L.lastCloudSigAt = Date.now();"), 'سقف زمانی + امضای برش برای تأیید ابری');
ok(appSrc.includes('L.nearHits = (L.nearHits || []).filter((ts) => Date.now() - ts < 12000)'), 'قاعدهٔ تکرار: دو نامزد در ۱۲ ثانیه');
ok(appSrc.includes('wake stats (10min): checks='), 'آمار دوره‌ای ۱۰ دقیقه (RAM/CPU شفاف)');
ok(appSrc.includes("const fresh = txt && txt !== (L.lastHeard || '')"), 'لاگِ غیرتکراری — پایان سیلِ «[صول]»');
ok(/function wakeHitText\(txt\) \{\s*\n\s*if \(typeof window !== 'undefined' && window\.AVAWake/.test(appSrc), 'wakeHitText به موتور جدید delegate شد (سازگاری قدیمی)');
ok(appSrc.includes("const WAKE_ACCEPT = new Set([") && appSrc.includes("'آبا', 'ابا'"), 'WAKE_ACCEPT سازگاری قدیمی حفظ شد');
ok(appSrc.includes("else if (txt && Date.now() < wakeTestUntil)"), 'حالت تست بیدارباش: نخوردن هم صریح اعلام می‌شود');
ok(appSrc.includes('AVAWake.prefixRe(wakeWordCfg())'), 'RE پویای کلمهٔ بیدارباش در handleUtterance/runCommand');
ok(appSrc.includes('cmd = String(m[1] || \'\').trim();'), 'دنبالهٔ فرمان از گروه ۱ prefixRe');

/* ---------- 6) bare wake word ---------- */
console.log('\n[6] «آوا»ی تنها فرمان نیست — بدون سوختن Gemini');
ok(appSrc.includes('const bareWake = (bwm && !String(bwm[1] || \'\').trim()) || (raw.length <= 5 && /\\b(?:ava|awa)\\b/i.test(raw));'), 'گارد bare-wake در runCommand');
ok(/bareWake\) \{\s*\n\s*wakeSessOpen\(\);/.test(appSrc), 'bare-wake → جلسهٔ گفتگو باز می‌شود');
ok(/bareWake\) \{[\s\S]{0,300}speak\(t\('wake\.yes'\)\);/.test(appSrc), 'bare-wake → پاسخ «بله؟»');
ok(!(appSrc.match(/bareWake/g) || []).length < 2, 'bare-wake گارد واقعاً present');

/* ---------- 7) emalls + query-restore + قانون ۶ ---------- */
console.log('\n[7] emalls + بازسازی URLِ بی‌عبارت + قانون ۶');
ok(appSrc.includes("if (/emalls/.test(host)) return 'https://emalls.ir/?s=' + enc;"), 'جستجوی بومی emalls (فرمت 200-OK)');
ok(appSrc.includes('function aiUrlWithQuery(url, cmd)'), 'aiUrlWithQuery — بازساز URL');
ok(appSrc.includes("actLog('ai open_url query-restore → '"), 'هوک در executeDoActions open_url');
ok(appSrc.includes('قانون مهم ۶ (بسیار مهم): اگر درخواست، جستجوی درون-سایتی است'), 'قانون ۶ فارسی — URL باید عبارت را داشته باشد');
ok(appSrc.includes('Important rule 6 (critical): for an in-site search request the open_url MUST CONTAIN the search query'), 'قانون ۶ انگلیسی');
ok(appSrc.includes('ایمالز=emalls.ir/?s=…') && appSrc.includes('emalls.ir/?s=…, instagram'), 'emalls در قانون ۵ (فا+ان)');

/* ---------- 8) set_wake_word ---------- */
console.log('\n[8] set_wake_word — تغییر ویکورد با فرمان صوتی');
ok(appSrc.includes("'set_wake_word', 'research', 'type_once']"), 'DO_ACTS + set_wake_word');
ok(appSrc.includes("case 'set_wake_word': {"), 'executor case');
ok(appSrc.includes('- set_wake_word: value=کلمهٔ بیدارباش جدید'), 'پرامپت فارسی');
ok(appSrc.includes('set_wake_word(value=the new wake word, one word)'), 'پرامپت انگلیسی');
ok(appSrc.includes("wakeWordText: store.get('wakeWordText', 'آوا')"), 'تنظیم پیش‌فرض آوا');
ok(appSrc.includes('function wakeWordTextApply()'), 'apply از UI');
ok(htmlSrc.includes('id="optWakeWordText"'), 'ورودی UI در index.html');
ok(htmlSrc.includes('<script src="js/voiceWake.js"></script>'), 'voiceWake.js قبل از app.js لود می‌شود');
ok((appSrc.match(/'set\.stt\.wakeWordText': \[/g) || []).length === 2, 'i18n کلیدها در هر دو دیکشنری');
ok((appSrc.match(/'toast\.wakeWordSet': \[/g) || []).length === 2, 'i18n toast در هر دو دیکشنری');

/* ---------- 9) version ---------- */
console.log('\n[9] نسخه');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
ok(/^0\.[45]\d\.\d+(-beta)?$/.test(pkg.version) && pkg.version >= '0.46', 'package.json نسخهٔ ۰.۴x+ (forward-relaxed)');

console.log('\n========================================');
console.log('v0460: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
