'use strict';
/* ============================================================
   آوا — scripts-test-v0710.js — «حافظهٔ چسبان»
   ------------------------------------------------------------
   ریشه‌های لاگ 0.70.0-beta (سشن Ali-HK 19:04-19:10):
   R1) contact_save خالی ×۳ («+98 937 298 9120…»، «خب من الان شمارشو…»،
       «Milad Ghodousi این اسمو هم یادت باشه…») → نجات از جمله + پیش‌فرض اپ
   R2) «به جای آی وای گذاشتم» بی‌اکشن → بلوک آخرین ذخیره‌سازی‌ها در ctx
   R3) قانون «انگلیسی سرچ کن» به لاین قطعی نمی‌رسید → واریانت فکت‌مبنا
   R4) -Variants با «|» به PS نمی‌رسید → Base64 JSON
   R5) DBG:UIA_MISS همیشه → پاپ‌آپ‌محور
   R6) تیترِ بدونِ تغییر = ارسال به چت بازِ اشتباه → شاهد دوگانه + نظرسنجی
   R7) مخاطب آپ‌سرت: Pouria→Pourya ادغام، میلاد→میلاد قدوسی پیشوند
   ============================================================ */
const fs = require('fs');
const path = require('path');
const APP = __dirname;
const mainSrc = fs.readFileSync(path.join(APP, 'main.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(APP, 'renderer/js/app.js'), 'utf8');
const brainSrc = fs.readFileSync(path.join(APP, 'renderer/js/voiceBrain.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
const B = require(path.join(APP, 'renderer/js/voiceBrain.js'));
const M = require(path.join(APP, 'renderer/js/voiceMemory.js'));
const MM = require(path.join(APP, 'renderer/js/voiceMessaging.js'));

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; fails.push(label); console.log('  ✗ ' + label); }
}
function section(t) { console.log('\n— ' + t + ' —'); }

/* استخراج teachContactHints از app.js (تابع خالص — eval امن در همین سندباکس) */
function extractFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0, started = false, end = -1;
  for (let j = src.indexOf('{', i); j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') { d++; started = true; }
    else if (ch === '}') { d--; if (started && d === 0) { end = j; break; } }
  }
  if (end < 0) return null;
  return src.slice(i, end + 1);
}
let teachContactHints = null;
try {
  const code = extractFn(appSrc, 'teachContactHints');
  if (code) teachContactHints = new Function('return (' + code + ')')();
} catch (e) { console.log('extract fail: ' + e.message); }

/* ============ R1 — استخراج قطعی مخاطب (عین جمله‌های لاگ) ============ */
section('teachContactHints — عین جمله‌های لاگ 0.70');
{
  const h1 = teachContactHints('+98 937 298 9120 این شماررو به اسم پوریا یادت بمونه هر موقع اسم پوریا اوردم برای پیام دادن به این شماره پیام بدی');
  ok(!!h1, 'جملهٔ شمارهٔ پوریا → hints تولید می‌شود');
  ok(h1 && h1.phone === '+989372989120', 'شماره استخراج شد: ' + (h1 && h1.phone));
  ok(h1 && h1.nameFa === 'پوریا', 'نام فارسی «پوریا» استخراج شد: ' + (h1 && h1.nameFa));
  ok(h1 && h1.handle === '+989372989120', 'handle=شماره برای سرچ تلگرام');
  const h2 = teachContactHints('Milad Ghodousi این اسمو هم یادت باشه اگ فارسی گفتم به میلاد پیام بده این اسمو انگلیسی سرچ کنی');
  ok(h2 && h2.nameEn === 'Milad Ghodousi', 'نام لاتین عین املای کاربر: ' + (h2 && h2.nameEn));
  ok(h2 && h2.nameFa === 'میلاد', 'نام فارسی «میلاد» از «به میلاد پیام بده»: ' + (h2 && h2.nameFa));
  const h3 = teachContactHints('پوریا رو تو تلگرام ذخیره کن با یوزر pourya_r');
  ok(h3 && h3.nameFa === 'پوریا', '«پوریا رو تو تلگرام ذخیره کن» → پوریا');
  ok(h3 && h3.app === 'telegram', 'اپ تلگرام شناخته شد');
  ok(h3 && h3.handle === '@pourya_r', 'یوزرنیم handle شد: ' + (h3 && h3.handle));
  const h4 = teachContactHints('فردا باید برم خرید');
  ok(h4 === null || (!h4.nameEn && !h4.nameFa && !h4.phone), 'جملهٔ غیرمخاطبی → بدون hints');
  ok(teachContactHints('') === null, 'رشتهٔ خالی → null');
}

/* ============ R1 — نجات contact_save خالی (ساختار app.js) ============ */
section('contact_save نجات فیلد خالی — پین‌های ساختاری app.js');
ok(/brain contact_save salvage-from-sentence/.test(appSrc), 'لاگ salvage وجود دارد');
ok(/teachContactHints\(cmd\) : null/.test(appSrc) && /if \(!_nmFa && _h\.nameFa\)[\s\S]{0,300}?if \(_h\.app\) _app = _h\.app/.test(appSrc), 'فیلد خالی → استخراج از جمله'); /* v0.75 forward-relax: hints همیشه + اپِ جمله مقدم */
ok(/if \(!_app\) _app = 'telegram';/.test(appSrc), 'اپِ خالی → پیش‌فرض telegram');
ok(/if \(ok\) \{ try \{ if \(window\.AVACore && window\.AVACore\._state\) window\.AVACore\._state\.entities\.person/.test(appSrc), 'entities.person فقط روی ذخیرهٔ موفق');
ok(/نتونستم اسم مخاطب را بفهمم/.test(appSrc), 'پیام صادقانه وقتی هیچ نامی قابل استخراج نیست');

/* ============ R7 — آپ‌سرت مخاطب (رفتاری) ============ */
section('addContact آپ‌سرت — سناریوهای لاگ');
{
  const m = M.createMemory(null);
  const list = [];
  const id1 = m.addContact(list, { name: 'پوریا رحمانی', app: 'telegram', aliases: ['Pouria Rahmani'] });
  const id2 = m.addContact(list, { name: 'پوریا رحمانی', app: 'telegram', aliases: ['Pourya Rahmani'] });
  ok(id1 === id2 && list.length === 1, 'Pouria→Pourya همان رکورد (آپ‌سرت)');
  ok(list[0].aliases.some((a) => /pouria rahmani/i.test(a)) && list[0].aliases.some((a) => /pourya rahmani/i.test(a)), 'هر دو املای لاتین ادغام شدند: ' + JSON.stringify(list[0].aliases));
  const list2 = [];
  m.addContact(list2, { name: 'میلاد', app: 'telegram', handle: '+98912...' });
  m.addContact(list2, { name: 'میلاد قدوسی', app: 'telegram', aliases: ['Milad Ghodousi'] });
  ok(list2.length === 1 && list2[0].name === 'میلاد قدوسی', 'میلاد → میلاد قدوسی: نام بلندتر برنده، رکورد تکراری نه');
  ok(list2[0].handle === '+98912...', 'handle قبلی حفظ شد');
  const id3 = m.addContact(list2, { name: 'Milad Ghodousi', app: 'telegram' });
  ok(id3 === list2[0].id && list2.length === 1, 'ذخیرهٔ دوباره با نام لاتین → همان رکورد');
  const list4 = [];
  m.addContact(list4, { name: 'علی همساده', app: 'telegram' });
  m.addContact(list4, { name: 'علی همکار', app: 'telegram' });
  ok(list4.length === 2, 'دو مخاطب متفاوت ادغام نمی‌شوند');
  ok(m.addContact([], { name: '', app: 'telegram' }) === null, 'نام خالی → null (بدون استثنا)');
}

/* ============ R2 — بلوک آخرین ذخیره‌سازی‌ها در ctx مغز ============ */
section('زمینهٔ مغز — آخرین ذخیره‌سازی‌ها + راهنمای مخاطب');
ok(/آخرین ذخیره‌سازی‌ها — اگر جملهٔ کاربر اصلاح\/ادامهٔ همین‌ها بود/.test(appSrc), 'بلوک «آخرین ذخیره‌سازی‌ها» در aiBrainRound');
ok(/مخاطب‌های اخیر: /.test(appSrc), 'مخاطب‌های اخیر تزریق می‌شود');
ok(/فکت‌های اخیر: /.test(appSrc), 'فکت‌های اخیر تزریق می‌شود');
ok(/راهنمای مخاطب — در contact_save همین مقادیر را عیناً کپی کن/.test(appSrc), 'راهنمای teach به پرامپت می‌رود');
ok(/contact_save هرگز params خالی یا فیلدِ خالی ندارد/.test(brainSrc), 'قانون پرامپت FA: فیلد خالی ممنوع');
ok(/2b\) Correcting the last save/.test(brainSrc), 'قانون پرامپت EN: اصلاح آخرین ذخیره');
ok(/«Milad Ghodousi این اسمو هم یادت باشه اگ فارسی گفتم به میلاد پیام بده این اسمو انگلیسی سرچ کنی»/.test(brainSrc), 'مثال طلایی Milad (عین جملهٔ لاگ)');
ok(/«\+98 937 298 9120 این شماررو به اسم پوریا/.test(brainSrc), 'مثال طلایی شمارهٔ پوریا (عین جملهٔ لاگ)');
ok(/«ببینم چه شکلی ذخیره کردی اسمشو»/.test(brainSrc), 'مثال طلایی بازخوانی مخاطبین');

/* ============ validateBrain — عبور contact_save خالی برای نجات ============ */
section('validateBrain — contact_save با params خالی عبور می‌کند (نجاح در app.js)');
{
  const j = B.parseBrainJSON('{"speak":"حفظ شد","actions":[{"act":"memory_save","value":"x"},{"act":"contact_save","params":{}}],"confirm":"","clarify":""}');
  const v = B.validateBrain(j);
  ok(v && v.ok && v.actions.length === 2, 'JSON با contact_save خالی معتبر است');
  ok(v && v.actions[1] && v.actions[1].act === 'contact_save' && Array.isArray(Object.keys(v.actions[1].params)) && Object.keys(v.actions[1].params).length === 0, 'params خالی دست‌نخورده می‌رسد');
}

/* ============ R3 — واریانت فکت‌مبنا + قانون انگلیسی-سرچ ============ */
section('لاین پیام‌رسانی — واریانت از فکت‌ها');
ok(appSrc.indexOf("messaging variants latin-first (taught rule)") !== -1, 'لاگ latin-first وجود دارد');
ok(/const _fh = _mem2\.findFacts\(_mp\.target, 4\);/.test(appSrc), 'فکت‌های مرتبط با مقصد خوانده می‌شوند');
ok(/if \(\/\(انگلیسی\|لاتین\)\\s\*\(سرچ\|جستجو\|تایپ\|بگرد\)\//.test(appSrc) || /\(انگلیسی\|لاتین\)\\s\*\(سرچ\|جستجو\|تایپ\|بگرد\)/.test(appSrc), 'قانون «انگلیسی سرچ کن» از فکت شناسایی می‌شود');
ok(MM.faToLatin('میلاد') === 'Milad', 'faToLatin(میلاد)=Milad (رجیژن واریانت دوم لاگ)');

/* ============ R4/R5/R6 — تلگرام (ساختار main.js) ============ */
section('تلگرام — B64 واریانت + پاپ‌آپ UIA + شاهد دوگانه');
ok(/'-VariantsB64', varsB64/.test(mainSrc) || mainSrc.includes('ava-tg-req.json'), 'آرگومان -VariantsB64 پاس می‌شود'); /* v0.72 forward-relax: req JSON جایگزین B64 شد */
ok(/\[string\]\$VariantsB64 = ''/.test(mainSrc) || mainSrc.includes("[string]$Req = ''"), 'پارامتر PS تعریف شده'); /* v0.72 forward-relax */
ok(/FromBase64String\(\$VariantsB64\)/.test(mainSrc) || mainSrc.includes('$ReqObj.variants'), 'PS واریانت را از B64 دیکود می‌کند'); /* v0.72 forward-relax: req JSON */
ok(/DBG:VARN=/.test(mainSrc), 'شمارش واریانت در لاگ دیباگ');
{
  const enc = Buffer.from(JSON.stringify(['میلاد', 'Milad Ghodousi', 'پوریا رحمانی']), 'utf8').toString('base64');
  const dec = JSON.parse(Buffer.from(enc, 'base64').toString('utf8'));
  ok(Array.isArray(dec) && dec.length === 3 && dec[1] === 'Milad Ghodousi', 'گردش B64-JSON بی‌خرابی یونیکد');
  ok(!/[^A-Za-z0-9+/=]/.test(enc), 'B64 هیچ نویسهٔ خاصی ندارد (از pipe/quote می‌گذرد)');
}
ok(/RootElement\.FindAll/.test(mainSrc), 'UIA پنجره‌های تاپ‌لول را جستجو می‌کند (پاپ‌آپ Ctrl+K)');
ok(/NativeWindowHandle -eq \[int64\]\$hwnd/.test(mainSrc), 'پنجرهٔ اصلی از پاپ‌آپ‌ها جدا می‌شود');
ok(/DBG:UIASCORE=/.test(mainSrc), 'امتیاز UIA در لاگ دیباگ');
ok(/DBG:TITLE0=/.test(mainSrc), 'تیتر اولیه ثبت می‌شود');
ok(/for \(\$pt = 0; \$pt -lt 6; \$pt\+\+\)/.test(mainSrc), 'نظرسنجی تیتر (~۲ ثانیه)');
ok(/\(\$title2 -ne \$title0\) -and \(Test-TgMatch \$title2 \$v\)/.test(mainSrc) || /\(\$np2 -ne \$np0\) -and \(Test-TgMatch \$np2 \$v\)/.test(mainSrc), 'پذیرش: تیتر عوض شده و جور است'); /* v0.72 forward-relax: شاهد روی بخش نام تیتر */
ok(/\(\$uiaPick -ge 0\) -and \(Test-TgMatch \$title2 \$v\)/.test(mainSrc) || /\(\$uiaPick -ge 0\) -and \(\$script:UIAScore -ge 100\) -and \(Test-TgMatch \$np2 \$v\)/.test(mainSrc), 'پذیرش: شاهد UIA + تیتر جور است'); /* v0.72 forward-relax */
ok(mainSrc.indexOf('if (($title2 -ne $title0) -and (Test-TgMatch $title2 $v))') < mainSrc.indexOf('if (($uiaPick -ge 0) -and (Test-TgMatch $title2 $v))') || mainSrc.indexOf('if (($np2 -ne $np0) -and (Test-TgMatch $np2 $v))') < mainSrc.indexOf('if (($uiaPick -ge 0) -and ($script:UIAScore -ge 100) -and (Test-TgMatch $np2 $v))'), 'اولویت پذیرش درست'); /* v0.72 forward-relax */
ok(/\$uiaPick = Read-TgBest \$v/.test(mainSrc), 'متغیر شاهد UIA جدا از پذیرش تیتر');

/* ============ رگرسیون — گاردهای قبلی ============ */
section('رگرسیون — گاردهای v0.69/v0.70 سرِ جایشان');
ok(B.isTeach('Milad Ghodousi این اسمو هم یادت باشه اگ فارسی گفتم به میلاد پیام بده این اسمو انگلیسی سرچ کنی') === true, 'جملهٔ Milad → لاین teach');
ok(B.isTeach('+98 937 298 9120 این شماررو به اسم پوریا یادت بمونه') === true, 'جملهٔ شماره → لاین teach');
ok(B.isTeach('تو تلگرام به میلاد پیام بده سلام') === false, 'فرمان واقعی پیام → NOT teach');
ok(B.isGreeting('سلام خوبی') === true && B.isGreeting('به پوریا پیام بده سلام') === false, 'isGreeting دست‌نخورده');
ok(/«به میلاد پیام بده چطوری» \+ مخاطب id=c123 موجود/.test(brainSrc), 'مثال confirm حساس حفظ شده');
ok(/هرگز پیام نمی‌فرستی، هرگز «بعد هر وقت» مقصد نمی‌شود/.test(brainSrc), 'قانون طلایی ضد «بعد هر وقت» حفظ شده');

/* ============ نسخه ============ */
section('نسخه');
ok(/^0\.7[0-9]\.0-beta$/.test(pkg.version), 'نسخهٔ 0.71+ (forward-relax) → ' + pkg.version); /* v0.72 forward-relax — پین سخت 0.71 مانع ریلیزهای بعدی بود */

console.log('\n=========================================');
console.log('PASS: ' + pass + '  FAIL: ' + fail);
if (fail) { console.log('FAILED:'); fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
console.log('ALL GREEN');
