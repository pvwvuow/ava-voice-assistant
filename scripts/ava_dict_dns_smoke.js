// Smoke test برای رجکس‌های تایپ صوتی و DNS — نسخه ۰.۸ (بعد از فیکس مادّه)
const DICT_STOP_RE = /([اآا]وا|ava)[\s\u200C]*\s*(تموم|تمام|کافیه|بس|پایان|قطع|خاموش).{0,6}(تایپ|دیکته)|(تموم|تمام|کافیه|بس|پایان|قطع|خاموش)[\s\u200C]*\s*(کن)?[\s\u200C]*\s*(تایپ|دیکته)|تایپ.{0,4}(تموم|تمام|قطع|پایان|کافیه|بسه|بس)|([اآا]وا|ava)[\s\u200C]*\s*(تموم|تمام|کافیه)/i;
const DICT_START_RE = /([اآا]وا|ava)[\s\u200C،,:-]*تایپ|حالت\s*تایپ|تایپ\s*(رو\s*)?(شروع|بزن)\s*کن|شروع\s*به\s*تایپ/i;
const DNS_RE = /دی\s?ان\s?اس|dns/i;

const cases = [
  // [text, expectStart, expectStop, isDns]
  ['آوا تایپ', true, false, false],
  ['اوا تایپ', true, false, false],
  ['آوا تایپ کن', true, false, false],
  ['حالت تایپ', true, false, false],
  ['تایپ رو شروع کن', true, false, false],
  ['آوا تموم', false, true, false],
  ['اوا تمام', false, true, false],
  ['قطع تایپ', false, true, false],
  ['پایان تایپ', false, true, false],
  ['تایپ تموم شد', false, true, false],
  ['آوا قطع تایپ', false, true, false],
  ['تایپ بسه', false, true, false],
  ['سلام آوا نت‌پد را باز کن', false, false, false],
  ['یک متن درباره تایپ بنویس', false, false, false], // نباید شروع شود
  ['دی ان اس الکترو', false, false, true],
  ['دی اناس شماره یک', false, false, true],
  ['dns جدید', false, false, true],
  ['دی ان اس رو بردار', false, false, true],
  ['دی ان اس', false, false, true],
];

let fail = 0;
for (const [t, s, p, d] of cases) {
  const gs = DICT_START_RE.test(t) && !DICT_STOP_RE.test(t);
  const gp = DICT_STOP_RE.test(t);
  const gd = DNS_RE.test(t);
  const ok = gs === s && gp === p && (d ? gd : true);
  if (!ok) { fail++; console.log('FAIL:', JSON.stringify(t), { gs, gp, gd, want: { s, p, d } }); }
  else console.log('ok  :', JSON.stringify(t));
}

// تست n-gram فرمان سفارشی تایپ
const norm = (w) => String(w || '').toLowerCase().replace(/[\s\u200C]+/g, ' ').trim();
const words = 'سلام این را بنویس خیلی خب'.split(/[\s\u200C]+/);
const phrase = 'این را بنویس'.split(/[\s\u200C]+/);
let matched = false;
for (let i = 0; i + phrase.length <= words.length; i++) {
  if (norm(words.slice(i, i + phrase.length).join(' ')) === norm(phrase.join(' '))) { matched = true; break; }
}
console.log(matched ? 'ok  : n-gram custom phrase' : 'FAIL: n-gram');
if (!matched) fail++;

console.log(fail ? `\n${fail} FAILURES` : '\nALL PASS');
process.exit(fail ? 1 : 0);
