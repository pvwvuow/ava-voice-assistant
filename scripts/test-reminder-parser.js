/* تست منطقی parseReminder/faWordNum — استخراج تابع‌ها از app.js و اجرا */
const fs = require('fs');
const src = fs.readFileSync('/home/z/my-project/download/ava-voice-assistant/renderer/js/app.js', 'utf8');

/* استاب‌های محیط */
const faToEn = (s) => String(s || '')
  .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const faNum = (s) => String(s);
let LANG = 'fa';
const FA_WORD_NUM = {
  صفر: 0, یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10,
  یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, پونزده: 15, شانزده: 16, هفده: 17, هجده: 18, نوزده: 19,
  بیست: 20, سی: 30, چهل: 40, پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90, صد: 100, هزار: 1000,
};

/* استخراج بدنه تابع‌ها */
function grab(name, after) {
  const re = new RegExp('function ' + name + '\\([\\s\\S]*?\\n  \\}', '');
  const m = src.match(re);
  if (!m) throw new Error('not found: ' + name);
  return m[0];
}
const code = [grab('faWordNum'), grab('parseReminder')].join('\n');
const sandbox = new Function('faToEn', 'FA_WORD_NUM', 'faNum', 'LANG', code + '; return { faWordNum, parseReminder };');
const { faWordNum: fwn, parseReminder } = sandbox(faToEn, FA_WORD_NUM, faNum, LANG);

let pass = 0, fail = 0;
const check = (label, cond, extra) => { if (cond) { pass++; console.log('PASS |', label, extra || ''); } else { fail++; console.log('FAIL |', label, extra || ''); } };

/* ۱) تبدیل کلمه به عدد */
check('faWordNum بیست و پنج = 25', fwn('بیست و پنج') === 25, String(fwn('بیست و پنج')));
check('faWordNum یک = 1', fwn('یک') === 1, String(fwn('یک')));
check('faWordNum ۲۰ = 20', fwn('۲۰') === 20, String(fwn('۲۰')));

/* ۲) مدت: ۲۰ دقیقه دیگه */
const now = Date.now();
const r1 = parseReminder('بیست دقیقه دیگه یادم بنداز چای درست کنم');
const d1 = r1 ? r1.at - now : -1;
check('reminder 20min parsed', r1 && Math.abs(d1 - 20 * 60000) < 15000, r1 ? `+${Math.round(d1 / 60000)}min text="${r1.text}"` : 'null');
check('reminder text stripped', r1 && /چای/.test(r1.text) && !/یادم|دقیقه/.test(r1.text), r1 && r1.text);

/* ۳) ساعت مطلق با عصر */
const r2 = parseReminder('یادآوری کن ساعت ۵ عصر چایی بخوریم');
if (r2) {
  const dt = new Date(r2.at);
  const h = dt.getHours();
  check('reminder 5PM = hour 17', h === 17, `hour=${h} min=${dt.getMinutes()} text="${r2.text}"`);
} else check('reminder 5PM parsed', false, 'null');

/* ۴) یک ساعت و نیم */
const r3 = parseReminder('یک ساعت و نیم دیگه یادم بنداز آهنگ رو ببینم');
const d3 = r3 ? r3.at - now : -1;
check('reminder 90min parsed', r3 && Math.abs(d3 - 90 * 60000) < 20000, r3 ? `+${Math.round(d3 / 60000)}min` : 'null');

/* ۵) نیم ساعت */
const r4 = parseReminder('نیم ساعت دیگه یادم بنداز قرص بخورم');
const d4 = r4 ? r4.at - now : -1;
check('reminder 30min (نیم ساعت)', r4 && Math.abs(d4 - 30 * 60000) < 15000, r4 ? `+${Math.round(d4 / 60000)}min` : 'null');

/* ۶) بدون زمان → null */
check('no time → null', parseReminder('یادآوری کن که چایی درست کنم') === null, '-');

/* ۷) ساعت با دقیقه: ساعت ۱۰ و ربع صبح */
const r5 = parseReminder('ساعت ۱۰ و ربع صبح جلسه داریم');
if (r5) {
  const dt = new Date(r5.at);
  check('reminder 10:15am', dt.getHours() === 10 && dt.getMinutes() === 15, `h=${dt.getHours()} m=${dt.getMinutes()}`);
} else check('reminder 10:15 parsed', false, 'null');

console.log(`\nPARSER TEST: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
