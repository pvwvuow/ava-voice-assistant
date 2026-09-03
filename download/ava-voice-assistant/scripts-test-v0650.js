#!/usr/bin/env node
/* scripts-test-v0650.js — v0.65 — «آوای یادگیرنده: درسِ صریح + فکرِ پیدکار + ترینگِ کوچولو»
   ------------------------------------------------------------
   درخواست کاربر (پیام مستقیم):
   [الف] «روی یاد دادن به آوا از ریشه خوب کار کن نه فقط یک مسئله»
        → لَین قطعیِ TEACH: «یاد بگیر وقتی گفتم X یعنی Y» ذخیرهٔ پایدار
          ava-taught.json؛ دفعات بعد X پیش از همهٔ لَین‌ها (حتی AI) به Y
          بازنویسی می‌شود — آفلاین، بدون حدس. فراموشی/فهرست هم قطعی.
   [ب] «AI وقتی داره فکر می‌کنه حالت thinking رو نشون بده که کاربر بدونه
        آوا داره فکر می‌کنه نه اینکه هنگ کرده — کوچولو»
        → چیپ کوچکِ آبیِ پالس‌دار با سه‌نقطهٔ جست‌وجو؛ رپر try/finally دور
          کل aiHandleCommand — هیچ مسیر فراری ندارد (موفق/شکست/خطا/ترمیم/پژوهش).
   [پ] «وقتی درخواست انجام شد یک صدای کوچولو بانمک بیاد»
        → playDoneSound: WebAudio سنتز سه‌نت اسپارکل (بدون فایل صوتی)؛
          فقط در موفقیتِ واقعی (گیتِ متنِ شکست) + ترمز ۱٫۲ ثانیه‌ای +
          کلید تنظیمات #optDoneSound.

   چک‌ها:
   [1] voiceLearn زنده — موتور TEACH (پارس/ذخیره/مچ/فراموشی/LRU)
   [2] renderer — لَین TEACH در runCommand (پیش از همهٔ لَین‌ها)
   [3] renderer — چیپ فکر کردن (رپر + DOM + CSS)
   [4] renderer — صدای انجام‌شد (تعریف + نقاط گیت‌دار + تنظیمات + UI)
   [5] main/preload — حافظهٔ ava-taught.json
   [6] نسخهٔ 0.65.0-beta در ۴ جای رسمی
*/
const fs = require('fs');
const path = require('path');
const APP = __dirname; /* سوئیت در ریشهٔ مخزن زندگی می‌کند — قرارداد باتری */
const mainSrc = fs.readFileSync(path.join(APP, 'main.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(APP, 'renderer/js/app.js'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(APP, 'preload.js'), 'utf8');
const idxSrc = fs.readFileSync(path.join(APP, 'renderer/index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(APP, 'renderer/css/styles.css'), 'utf8');
const readmeSrc = fs.readFileSync(path.join(APP, 'README.md'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; fails.push(label); console.log('  ✗ ' + label); }
}
function section(s) { console.log('\n[' + s + ']'); }

/* ---------- [1] voiceLearn زنده — موتور TEACH ---------- */
section('1] voiceLearn زنده — موتور TEACH');
const L = require(path.join(APP, 'renderer/js/voiceLearn.js'));
ok(typeof L.teachParse === 'function' && typeof L.taughtMatch === 'function' && typeof L.taughtSave === 'function' && typeof L.taughtDrop === 'function' && typeof L.forgetParse === 'function' && typeof L.wakeStrip === 'function', 'شش تابع TEACH صادر شده‌اند');
const p1 = L.teachParse('یاد بگیر وقتی گفتم سلام دنیا یعنی باز کن کروم');
ok(p1 && p1.phrase === 'سلام دنیا' && p1.command === 'باز کن کروم', 'پارس: «یاد بگیر وقتی گفتم X یعنی Y»');
const p2 = L.teachParse('هر وقت گفتم موزیک آروم یعنی ولوم رو کم کن');
ok(p2 && p2.phrase === 'موزیک آروم' && p2.command === 'ولوم رو کم کن', 'پارس: «هر وقت گفتم X یعنی Y»');
const p3 = L.teachParse('یادت باشه وقتی گفتم اسکرین یعنی اسکرین شات بگیر');
ok(p3 && p3.phrase === 'اسکرین', 'پارس: «یادت باشه وقتی گفتم X…»');
const p4 = L.teachParse('وقتی میگم خبرها یعنی اخبار روز رو بگو');
ok(p4 && p4.phrase === 'خبرها', 'پارس: «وقتی میگم X یعنی Y»');
const p5 = L.teachParse('آوا یاد بگیر وقتی گفتم ورزش یعنی پخش کن وزش');
ok(p5 && p5.phrase === 'ورزش', 'پارس: پیشوند بیدارباش «آوا» بریده می‌شود');
const p6 = L.teachParse('سلام چطوری');
ok(p6 === null, 'نگاتیو: جملهٔ عادی درس نیست');
const p7 = L.teachParse('یاد بگیر');
ok(p7 === null, 'نگاتیو: «یاد بگیر» لخت بی‌محتوا');
const p8 = L.teachParse('یاد بگیر X یعنی یاد بگیر Y یعنی Z');
ok(p8 === null, 'نگاتیو: یادگیریِ زنجیره‌ای ممنوع');
const st = { v: 1, items: [] };
L.taughtSave(st, 'سلام دنیا', 'باز کن کروم');
const sv = L.taughtSave(st, 'سلام دنیا', 'باز کن فایرفاکس');
ok(st.items.length === 1 && st.items[0].command === 'باز کن فایرفاکس' && !!sv.updated, 'ذخیره: همان عبارت = به‌روزرسانی (نه دوباره‌سازی)');
ok(L.taughtMatch(st, 'سلام دنیا') && L.taughtMatch(st, 'سلام دنیا').command === 'باز کن فایرفاکس', 'مچ دقیق');
ok(L.taughtMatch(st, 'سلام دنیی') !== null, 'مچ فازی: نویز STT (دنیا→دنیی)');
ok(L.taughtMatch(st, 'آوا سلام دنیا') !== null, 'مچ با پیشوند «آوا»');
ok(L.taughtMatch(st, 'باز کن کروم') === null, 'نگاتیو: فرمانِ معمولی به درسِ ناآموخته نمی‌خورد');
const stA = { v: 1, items: [] };
L.taughtSave(stA, 'ميل سريع', 'سرچ کن');
ok(stA.items[0].k === 'میل سریع', 'نرمال‌سازی ي/ك عربی در کلید درس');
ok(L.taughtMatch(stA, 'میل سریع') !== null, 'مچ بعد از نرمال‌سازی عربی→فارسی');
const st3 = { v: 1, items: [] };
for (let i = 0; i < 105; i++) L.taughtSave(st3, 'عبارت شماره ' + i, 'فرمان ' + i);
ok(st3.items.length === 100, 'سقف LRU=۱۰۰');
const f1 = L.forgetParse('سلام دنیا رو فراموش کن');
ok(f1 && f1.key === 'سلام دنیا' && !f1.all, 'فراموشی: پسوندی «X رو فراموش کن»');
const f2 = L.forgetParse('فراموش کن همه');
ok(f2 && f2.all, 'فراموشی: «فراموش کن همه» = پاک‌کردن کل');
const d1 = L.taughtDrop(stA, 'میل سریع');
ok(d1.removed === 1, 'حذف با کلید');
const d2 = L.taughtDrop({ items: [{ k: 'a', phrase: 'a', command: 'b' }, { k: 'c', phrase: 'c', command: 'd' }] }, '', true);
ok(d2.all && d2.removed === 2, 'حذف همه');

/* ---------- [2] renderer — لَین TEACH ---------- */
section('2] renderer — لَین TEACH پیش از همهٔ لَین‌ها');
ok(appSrc.indexOf('v0.65 — لَینِ یادگیریِ صریح (TEACH) — پیش از همهٔ لَین‌ها') >= 0, 'بلاک لَین TEACH داخل runCommand');
ok(/const _tp = AVALearn\.teachParse\(_tw\);/.test(appSrc), 'پارسِ درس روی متنِ بدونِ پیشوندِ بیدارباش');
ok(/if \(_tp\) \{ await teachHandle\(_tp, raw\); return; \}/.test(appSrc), 'درسِ تازه همین‌جا اجرا می‌شود — هرگز به مغز AI نمی‌رود');
ok(/const _tf = AVALearn\.forgetParse \? AVALearn\.forgetParse\(_tw\) : null;/.test(appSrc), 'فراموشی قطعی در لَین');
ok(appSrc.indexOf('چه\\s+چیز(?:ایی|هایی)\\s+یاد') >= 0 && appSrc.indexOf('لیست\\s+یاد') >= 0, 'فهرستِ یادگیری‌ها در لَین');
ok(/const _tm = AVALearn\.taughtMatch\(_tst, _tw\);/.test(appSrc) && /raw = String\(_tm\.command\);\s*\n\s*cmd = raw;/.test(appSrc), 'بازنویسیِ قطعیِ عبارتِ آموخته به فرمان');
ok(/ev: 'teach', hit: true/.test(appSrc), 'لاگ ساخت‌یافتهٔ teach-hit (activity.jsonl)');
ok(/async function teachHandle\(tp, original\)/.test(appSrc) && /async function teachForgetHandle\(tf, original\)/.test(appSrc) && /async function teachListHandle\(original\)/.test(appSrc), 'سه هندلر آموزش تعریف شده‌اند');
ok(/'teach.saved': \[/.test(appSrc) && /'teach.updated': \[/.test(appSrc) && /'teach.forgot': \[/.test(appSrc) && /'teach.list': \[/.test(appSrc), 'پیام‌های فارسی آموزش در i18n');
ok(/taughtLoad\(\)\.catch\(\(\) => \{ \/\* noop \*\/ \}\);/.test(appSrc), 'پیش‌بارگذاریِ آموخته‌ها در شروع');

/* ---------- [3] چیپ فکر کردن ---------- */
section('3] چیپ «آوا داره فکر می‌کنه»');
ok(/async function aiHandleCommand\(cmd, extraCtx\) \{[\s\S]{0,220}thinkChipSet\(true\);[\s\S]{0,220}try \{ return await aiHandleCommandRun\(cmd, extraCtx\); \}[\s\S]{0,220}finally \{ if \(aiRunEpoch === myEpoch\) thinkChipSet\(false\); \}\s*\n\s*\}/.test(appSrc), 'رپر try/finally دور کل سفر AI — هیچ مسیر فراری (v0.66: گارد epoch برای لغو)');
ok(/async function aiHandleCommandRun\(cmd, extraCtx\) \{/.test(appSrc), 'بدنهٔ اصلی به aiHandleCommandRun تغییر نام کرد');
ok(/function thinkChipSet\(on\) \{/.test(appSrc) && /el\.hidden = !on;/.test(appSrc) && /tx\.textContent = t\('ai\.thinking'\);/.test(appSrc), 'thinkChipSet — نمایش/پنهان + متن i18n');
ok(/id="thinkChip" hidden/.test(idxSrc) && /class="tdots"/.test(idxSrc) && /id="thinkTxt"/.test(idxSrc), 'DOM چیپ در کارت پاسخ (کوچولو و hidden پیش‌فرض)');
ok(/\.think-chip \{/.test(cssSrc) && /\.think-chip\[hidden\] \{ display: none; \}/.test(cssSrc) && /@keyframes tdBounce/.test(cssSrc) && /@keyframes thinkPulse/.test(cssSrc), 'CSS چیپ: پیل کوچک + سه‌نقطهٔ جست‌وجو + پالس');
ok(/'ai\.thinking': \['آوا داره فکر می‌کنه…', 'Ava is thinking…'\]/.test(appSrc), 'متن فارسی/انگلیسی چیپ');

/* ---------- [4] صدای انجام‌شد ---------- */
section('4] صدای کوچکِ بانمکِ «انجام شد»');
ok(/function playDoneSound\(\) \{/.test(appSrc) && /if \(!settings\.doneSound\) return;/.test(appSrc) && /if \(now - _doneSfxAt < 1200\) return;/.test(appSrc), 'playDoneSound: گیت تنظیمات + ترمز ۱٫۲ثانیه‌ای');
ok(/783\.99, 0\.0, 0\.22\], \[1046\.5, 0\.085, 0\.24\], \[1318\.51, 0\.17, 0\.34\]/.test(appSrc), 'سنتز سه‌نت اسپارکل (سل۵→دو۶→می۶) — بدون فایل صوتی');
ok((appSrc.match(/playDoneSound\(\);/g) || []).length >= 9, 'نقاط فراخوانی ≥۹ (تایپ‌وانس×۲، فانل قوانین، اپ‌باز، بازپخش، پژوهش، DO، چت، آموزش)');
ok(/if \(\/نوشتم\/\.test\(rep\)\) playDoneSound\(\);/.test(appSrc), 'type-once: فقط وقتی واقعاً نوشت');
ok(/if \(!\/انجام نشد\|Could not\|Couldn't\|پیدا نشد\|نشده\/\.test\(String\(reply\)\)\) playDoneSound\(\);/.test(appSrc), 'فانل قوانین: گیتِ متنِ شکست — خطا بی‌صدا');
ok(/if \(!\/انجام نشد\|باز نشد\|Could not\|Couldn't\|پیدا نشد\/\.test\(String\(finalReply\)\)\) playDoneSound\(\);/.test(appSrc), 'DO مغز: گیتِ متنِ شکست');
ok(/doneSound: store\.get\('doneSound', true\)/.test(appSrc), 'تنظیمات: doneSound پیش‌فرض روشن');
ok(/id="optDoneSound"/.test(idxSrc), 'کلید تنظیمات #optDoneSound در پنل صدا');
ok(/optDoneSoundEl\.addEventListener\('change'/.test(appSrc) && /const ods = \$\('#optDoneSound'\); if \(ods\) ods\.checked = settings\.doneSound !== false;/.test(appSrc), 'سیم‌کشی تنظیمات (نمایش + تغییر)');

/* ---------- [5] main/preload — حافظهٔ درس‌ها ---------- */
section('5] main/preload — حافظهٔ ava-taught.json');
ok(/function loadTaught\(\)/.test(mainSrc) && /'learnings:loadTaught'/.test(mainSrc) && /'learnings:saveTaught'/.test(mainSrc), 'هندلرهای IPC درس‌ها در main');
ok(/TAUGHT_FILE = \(\) => path\.join\(app\.getPath\('userData'\), 'ava-taught\.json'\)/.test(mainSrc), 'ذخیرهٔ پایدار userData/ava-taught.json');
ok(/if \(data\.items\.length > 100\) data\.items = data\.items\.slice\(0, 100\);/.test(mainSrc), 'سقف ۱۰۰ در main هم اعمال می‌شود');
ok(/\.filter\(\(x\) => x\.k && x\.command\)/.test(mainSrc), 'سانیتی‌زیشن: آیتمِ بی‌کلید/بی‌فرمان ذخیره نمی‌شود');
ok(/loadTaught: \(\) => ipcRenderer\.invoke\('learnings:loadTaught'\)/.test(preloadSrc) && /saveTaught: \(data\) => ipcRenderer\.invoke\('learnings:saveTaught', data\)/.test(preloadSrc), 'پل preload برای درس‌ها');

/* ---------- [6] نسخه ---------- */
section('6] نسخهٔ رسمی در ۴ جای رسمی (v0.65→v0.66+ ریلکس رو به جلو)');
ok(/^0\.[6-9][0-9]?\.[0-9]+-beta$/.test(pkg.version), 'package.json → ' + pkg.version); /* v0.70 — forward-relax */
ok(/appVersion\s*=\s*'0\.[6-9][0-9]?\.[0-9]+-beta'/.test(appSrc), 'app.js appVersion');
ok(/abVersion[^0-9]*0\.[6-9][0-9]?\.[0-9]+-beta/.test(idxSrc), 'index.html abVersion');
ok(readmeSrc.indexOf('۰.۶۵.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۶۶.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۶۷.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۶۹.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۷۰.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۷۱.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۷۲.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۷۳.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۷۴.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۷۵.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۷۶.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۷۷.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۷۸.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۷۹.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۸۰.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۸۱.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۸۲.۰-بتا') >= 0 || readmeSrc.indexOf('۰.۸۲.۱-بتا') >= 0 || readmeSrc.indexOf('۰.۸۲.۲-بتا') >= 0, 'README بلاک نسخهٔ فعلی'); /* v0.82.2 forward-relax */

/* ---------- نتیجه ---------- */
console.log('\n———————————————');
console.log('PASS=' + pass + '  FAIL=' + fail);
if (fails.length) console.log('failures:\n - ' + fails.join('\n - '));
process.exit(fail ? 1 : 0);
