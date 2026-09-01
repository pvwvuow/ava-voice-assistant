'use strict';
/* ============================================================
   آوا — scripts-test-v0390.js — تست رگرسیون فیکس‌ها و قابلیت‌های v0.39
   ------------------------------------------------------------
   پوشش:
   - Gemini: زنجیرهٔ تازه (بدون مدل مرده در اول صف) + پارس هینت 404 گوگل
     + قطع سریع خطای موقعیت + 429 → مدل بعدی + هدر x-goog-api-key
     (پشتیبانی کلیدهای جدید AQ.) + پیام رله در gemErrHuman + ai:gemmodels
   - انتخابگر مدل: پنل فهرست کامل + جستجو + datalist پویا + پذیرش کلید AQ.
   - پیشنهاد زمینه‌ای فرمان‌ها: SUGGEST_TRIGGERS + SUGGEST_DECK + کارت
     (کلیک=runCommand، خروج انیمیشنی، تrottle ۱۲ ساعته)
   - نگاشت معنایی فرمان نامتعارف: id روی RULES + کاتالوگ AI (aiCmdCatalogCtx)
     + act=run_cmd در DO_ACTS + اجرای محلی executeDoActions + قانون ۴ پرامپت
   - نسخه 0.39.0-beta
   ============================================================ */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname);
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const AVAVoice = require('./renderer/js/voiceCommandParser');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('PASS | ' + name); } else { fail++; console.log('FAIL | ' + name); } };

const app = read('renderer/js/app.js');
const mainjs = read('main.js');
const pre = read('preload.js');
const idx = read('renderer/index.html');
const css = read('renderer/css/styles.css');
const pkg = JSON.parse(read('package.json'));

/* ---------- ۱) زنجیرهٔ مدل گوگل — تست رفتاری واقعی ---------- */
/* بدنهٔ geminiModelChain را از main.js بیرون می‌کشیم و واقعاً اجرا می‌کنیم */
function extractFn(name, src) {
  const i = src.indexOf('function ' + name);
  if (i === -1) return null;
  let depth = 0, started = false, out = '';
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    out += ch;
    if (ch === '{') { depth++; started = true; }
    if (ch === '}') { depth--; if (started && depth === 0) break; }
  }
  return out;
}
const chainSrc = extractFn('geminiModelChain', mainjs);
ok(!!chainSrc, 'main: geminiModelChain پیدا شد');
const geminiModelChain = eval('(' + chainSrc + ')');
{
  const ch = geminiModelChain('gemini-3.6-flash');
  ok(ch[0] === 'gemini-3.6-flash', 'زنجیره: مدل کاربر اول');
  ok(ch.includes('gemini-flash-lite-latest') && ch.includes('gemini-flash-latest'), 'زنجیره: نام‌های مستعار همیشه‌سبز هستند');
  ok(ch.includes('gemini-3.7-flash') && ch.includes('gemini-3.5-flash-lite'), 'زنجیره: نسل روز (۳.۷/۳.۵ لایت) داخل زنجیره است');
  ok(ch.indexOf('gemini-2.5-flash') > ch.indexOf('gemini-3.5-flash'), 'زنجیره: ۲.۵ فقط فالبک آخر است (برای کلیدهای جدید بازنشسته شده)');
  ok(new Set(ch).size === ch.length, 'زنجیره: بدون تکرار');
}

/* ---------- ۲) هینت 404 گوگل + خطای موقعیت ---------- */
const gemHintSrc = mainjs.match(/const gemHintModel = \(msg\) => \{[\s\S]*?\n\};/);
ok(!!gemHintSrc, 'main: gemHintModel تعریف شده');
{
  const gemHintModel = eval('(' + gemHintSrc[0].replace('const gemHintModel = ', '').replace(/\n\};$/, '\n}') + ')');
  ok(gemHintModel('This model models/gemini-2.5-flash-lite is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite for the latest features') === 'gemini-3.5-flash-lite', 'هینت 404: نام جایگزین از پیام رسمی گوگل استخراج می‌شود');
  ok(gemHintModel('HTTP 500') === '', 'هینت 404: پیام بی‌مدل → خالی');
}
ok(/const gemIsLocationErr = \(status, msg\) =>/.test(mainjs), 'main: gemIsLocationErr تعریف شده');
ok((mainjs.match(/locBlocked/g) || []).length >= 6, 'main: قطع سریع حلقه روی خطای موقعیت (هر سه هندلر)');
ok(/queue\.unshift\(hint\)/.test(mainjs), 'main: مدل جایگزینِ گوگل اول صف می‌نشیند');
ok((mainjs.match(/queue\.shift\(\)/g) || []).length >= 2, 'main: صف پویا در چت و STT هر دو');

/* ---------- ۳) هدر احراز هویت (کلیدهای AIza و AQ.) ---------- */
ok(!/models\?key=/.test(mainjs), 'main: کلید دیگر در کوئری URL نیست');
ok((mainjs.match(/'x-goog-api-key'/g) || []).length >= 4, 'main: هدر x-goog-api-key در هر ۴ مسیر (discover/stt/chat/gemtest)');
ok(/gemModels: \(payload\) => ipcRenderer\.invoke\('ai:gemmodels', payload\)/.test(pre), 'preload: پل gemModels');
ok(/ipcMain\.handle\('ai:gemmodels'/.test(mainjs), 'main: هندلر ai:gemmodels');
ok(/models: \(gemDiscoverCache\.all \|\| \[\]\)\.slice\(\)/.test(mainjs), 'main: gemtest فهرست کامل مدل‌ها را برمی‌گرداند');
ok(/gemDiscoverCache = \{ at: 0, models: \[\], all: \[\], inflight: null, failAt: 0 \}/.test(mainjs), 'main: کش discovery فهرست کامل (all) هم دارد');
ok(/gemRankModels\(chat, 8\)/.test(mainjs) && /gemRankModels\(chat, 0\)/.test(mainjs), 'main: رتبه‌بندی دوتایی — زنجیره ۸تایی + فهرست کامل');

/* ---------- ۴) پیام انسانی خطاها ---------- */
ok(/«آدرس رلهٔ جمنای» را با آدرس رلهٔ شخصی خودت پر کن/.test(mainjs), 'main: خطای موقعیت راهنمای رلهٔ واقعی می‌دهد');
ok(/429 سهمیهٔ همین مدل است/.test(mainjs) && /if \(r\.status === 429\) \{ lastErr = gemErrHuman\(r\.status, msg\) \|\| lastErr; continue; \}/.test(mainjs), 'main: 429 → مدل بعدی (سهمیهٔ جدا)، نه شکست کل');
ok(/if \(\[401, 403\]\.includes\(r\.status\)\)/.test(mainjs), 'main: 401/403 → کلید بعدی');

/* ---------- ۵) انتخابگر مدل در UI ---------- */
ok(idx.includes('id="btnGemModels"') && idx.includes('id="gemModelPanel"'), 'index: دکمه و پنل فهرست مدل‌ها');
ok(idx.includes('id="gemModelSearch"') && idx.includes('id="gemModelListDiv"'), 'index: جستجو و لیست پنل مدل');
ok(!idx.includes('gemini-2.0-flash'), 'index: مدل مردهٔ 2.0 از datalist حذف شد');
ok(idx.includes('gemini-flash-lite-latest'), 'index: پیش‌فرض جدید flash-lite-latest');
ok(/AIza… یا AQ\./.test(idx), 'index: placeholder کلید هر دو فرمت را می‌پذیرد');
ok(css.includes('.gem-panel') && css.includes('.gem-mlist') && css.includes('.gem-mitem'), 'css: استایل پنل مدل‌ها');
ok(/fillGemModelList/.test(app) && /renderGemModelItems/.test(app), 'app: رندر فهرست مدل wired');
ok(/bridge\.ai\.gemModels\(\{ key, base: settings\.gemBase/.test(app), 'app: دکمهٔ فهرست از گوگل تازه‌سازی می‌کند');
ok(/store\.set\('gemModelList', r\.models\)/.test(app), 'app: فهرست مدل‌ها ذخیره می‌شود (بار بعد حاضر است)');
ok(/\^\(AIza\|AQ\\\.\)/.test(app), 'app: اعتبارسنجی کلید AQ. را هم معتبر می‌داند');
ok(/set\.ai\.gemModelsBtn/.test(app) && /set\.ai\.gemSearchPh/.test(app), 'app: رشته‌های i18n پنل مدل');

/* ---------- ۶) پیشنهاد زمینه‌ای فرمان‌ها ---------- */
ok(idx.includes('id="cmdSuggest"') && idx.includes('id="csChips"') && idx.includes('id="csClose"'), 'index: کارت پیشنهاد فرمان‌ها');
ok(css.includes('.cs-card') && css.includes('@keyframes csIn') && css.includes('.cs-chip'), 'css: انیمیشن کارت پیشنهاد');
ok(/const SUGGEST_TRIGGERS = new Set\(\[/.test(app), 'app: مجموعهٔ تریگر ویدیو/یوتیوب');
ok(/SUGGEST_TRIGGERS\.has\(rule\.id\)\) maybeSuggestCommands\('video'\)/.test(app), 'app: تریگر در مسیر موفق RULES');
ok(/SUGGEST_TRIGGERS\.has\(rr\.id\)\) maybeSuggestCommands\('video'\)/.test(app), 'app: تریگر در مسیر run_cmd هم');
ok(/12 \* 60 \* 60 \* 1000/.test(app), 'app: تrottle ۱۲ ساعته (هر دسته)');
ok(/store\.set\('cmdSuggestAt', seen\)/.test(app), 'app: تrottle ماندگار (store)');
ok(/setTimeout\(hideCmdSuggest, 16000\)/.test(app), 'app: خروج خودکار بعد از ۱۶ ثانیه');
ok(/runCommand\(txt, \{ wake: false \}\)/.test(app), 'app: کلیک روی فرمان پیشنهادی = اجرای واقعی');
ok(/ویدیو رو پین کن/.test(app), 'app: فرمان‌های پیشنهادی واقعی (نه متن خالی)');

/* ---------- ۷) نگاشت معنایی فرمان نامتعارف (AI) ---------- */
{
  const ids = [...app.matchAll(/id: '([a-z_]+)'/g)].map((m) => m[1]);
  ok(ids.length >= 45, 'قوانین شناسه‌دار به اندازهٔ کافی هستند (' + ids.length + ')');
  ok(new Set(ids).size === ids.length, 'هیچ id تکراری نیست');
  ['shutdown', 'restart', 'open_youtube', 'yt_search', 'pip', 'music_play', 'vol_mute', 'reminder', 'timer', 'weather', 'calc'].forEach((x) =>
    ok(ids.includes(x), 'id کلیدی موجود: ' + x));
}
ok(/function aiCmdCatalogCtx\(\)/.test(app), 'app: سازندهٔ کاتالوگ AI');
ok(/aiHandleCommand\(cmd, (?:await aiFallbackCtx\((?:null, )?cmd\)|aiCmdCatalogCtx\(\))\)/.test(app), 'app: کاتالوگ فقط وقتی تزریق می‌شود که فرمان شناخته نشد'); /* v0.42: aiFallbackCtx = کاتالوگ+وضعیت؛ v0.50: aiFallbackCtx(null, cmd) */
ok(/'run_custom', 'run_cmd'((, '[a-z_]+')*)?\]/.test(app), 'app: run_cmd در DO_ACTS مجاز است'); /* v0.42: +note_show؛ v0.46: +set_wake_word */
ok(/a\.act === 'run_cmd'/.test(app), 'app: اجراکنندهٔ run_cmd');
ok(/RULES\.find\(\(x\) => x\.id === String\(a\.value \|\| ''\)\.trim\(\)\)/.test(app), 'app: run_cmd فقط idهای واقعی کاتالوگ را اجرا می‌کند');
ok(/executeDoActions\(doRes\.do\.actions, cmd\)/.test(app), 'app: جملهٔ اصلی کاربر برای run_cmd پاس می‌شود');
ok(/قانون مهم ۴: اگر زیر پیام کاربر «فهرست فرمان‌های آوا» آمده/.test(app), 'app: قانون ۴ پرامپت فارسی');
ok(/Important rule 4: if an "AVA command catalog" is attached/.test(app), 'app: قانون ۴ پرامپت انگلیسی');
ok(/act=run_cmd و value=همان id/.test(app), 'app: دستورالعمل دقیق بلوک DO در کاتالوگ');
ok(/هم‌معنای یکی از این فرمان‌ها بود \(حتی با تعبیر کاملاً متفاوت\)/.test(app), 'app: کاتالوگ صریحاً «تعبیر متفاوت» را پوشش می‌دهد');

/* ---------- ۸) پارسر PiP دست‌نخورده (رگرسیون) ---------- */
ok(AVAVoice && typeof AVAVoice.parseVoiceCommand === 'function', 'پارسر PiP بارگذاری شد');
ok(!!AVAVoice.PIP_COMMAND_RE, 'PIP_COMMAND_RE سر جایش است');

/* ---------- ۹) نسخه ---------- */
ok(/^0\.(39|[4-9][0-9])\.\d+-beta$/.test(pkg.version), 'نسخه 0.39+ در package.json (forward)');
ok(/'0\.(39|[4-9][0-9])\.\d+-beta'/.test(app), 'نسخه در app.js (forward)');
ok(/v0\.(39|[4-9][0-9])\.\d+-beta/.test(idx), 'نسخه در دربارهٔ index.html (forward)');

console.log('');
console.log(`RESULT: ${pass}/${pass + fail}`);
if (fail > 0) { console.log('FAIL_OK'); process.exit(1); }
console.log('V0390_OK');
