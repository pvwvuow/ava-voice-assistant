/* تست extractAppName + matchSysApp + lev از app.js */
const fs = require('fs');
const src = fs.readFileSync('/home/z/my-project/download/ava-voice-assistant/renderer/js/app.js', 'utf8');

function grabFn(name) {
  const re = new RegExp('function ' + name + '\\([\\s\\S]*?\\n  \\}');
  const m = src.match(re);
  if (!m) throw new Error('not found: ' + name);
  return m[0];
}
const normAppM = src.match(/const normApp = \(s\) =>[\s\S]*?\.trim\(\);/);
const simM = src.match(/const simRatio = \(a, b\) =>[^;]+;/);
const reM = src.match(/const APP_OPEN_RE = [^;]+;/);
const code = [reM[0], normAppM[0], grabFn('lev'), simM[0], grabFn('extractAppName'), grabFn('matchSysApp')].join('\n');

/* استاب sysApps و APP_PHONETIC */
const APP_PHONETIC = { 'کروم': 'chrome', 'تلگرام': 'telegram', 'فتوشاپ': 'photoshop' };
const sysApps = {
  list: [
    { name: 'Google Chrome', exe: 'C:\\chrome.exe', kind: 'app' },
    { name: 'Telegram Desktop', exe: 'C:\\tg.exe', kind: 'app' },
    { name: 'Adobe Photoshop 2024', exe: 'C:\\ps.exe', kind: 'app' },
    { name: 'Half-Life 2', exe: 'steam://rungameid/220', kind: 'steam', appid: '220' },
    { name: 'Visual Studio Code', exe: 'C:\\code.exe', kind: 'app' },
  ],
};
const sandbox = new Function('APP_PHONETIC', 'sysApps', code + '; return { extractAppName, matchSysApp, APP_OPEN_RE };');
const { extractAppName, matchSysApp, APP_OPEN_RE } = sandbox(APP_PHONETIC, sysApps);

let pass = 0, fail = 0;
const check = (l, c, x) => { if (c) { pass++; console.log('PASS |', l, x || ''); } else { fail++; console.log('FAIL |', l, x || ''); } };

check('intent: باز کن', APP_OPEN_RE.test('تلگرام رو باز کن'));
check('intent: اجرا کن', APP_OPEN_RE.test('فتوشاپ رو اجرا کن'));
check('intent: not a run cmd', !APP_OPEN_RE.test('آب و هوای تهران'));

check('extract تلگرام', extractAppName('تلگرام رو باز کن') === 'تلگرام', extractAppName('تلگرام رو باز کن'));
check('extract فتوشاپ با لطفا', extractAppName('لطفا فتوشاپ رو برام اجرا کن') === 'فتوشاپ', extractAppName('لطفا فتوشاپ رو برام اجرا کن'));
check('extract وی اس کد', extractAppName('وی اس کد رو باز کن') === 'وی اس کد', extractAppName('وی اس کد رو باز کن'));
check('extract سایت رد شود', extractAppName('سایت گوگل رو باز کن') === '', extractAppName('سایت گوگل رو باز کن'));

/* فونتیک: تلگرام → telegram → Telegram Desktop */
const m1 = matchSysApp('تلگرام');
check('phonetic تلگرام→Telegram', m1 && /telegram/i.test(m1.app.name), m1 && m1.app.name);
/* فونتیک: فتوشاپ → photoshop → Adobe Photoshop 2024 */
const m2 = matchSysApp('فتوشاپ');
check('phonetic فتوشاپ→Photoshop', m2 && /photoshop/i.test(m2.app.name), m2 && m2.app.name);
/* فازی: «تلگرم» (تایپ اشتباه) */
const m3 = matchSysApp('تلگرم');
check('fuzzy تلگرم→Telegram', m3 && /telegram/i.test(m3.app.name), m3 && m3.app.name);
/* انگلیسی مستقیم: chrome */
const m4 = matchSysApp('chrome');
check('direct chrome→Google Chrome', m4 && /chrome/i.test(m4.app.name), m4 && m4.app.name);
/* نام بی‌ربط → null */
check('no match → null', matchSysApp('xyzzy') === null || matchSysApp('xyzzy') === undefined || matchSysApp('xyzzy')?.score < 0.62, String(matchSysApp('xyzzy')));

console.log(`\nAPP-OPEN TEST: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
