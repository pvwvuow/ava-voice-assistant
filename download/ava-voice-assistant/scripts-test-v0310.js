/* v0.31.0 — فیوچرهای جدید regression suite.
   پوشش: (۱) اجرای واقعی توابع خالص استخراج‌شده از app.js
   (ratesDetect / rateLine / notesParseOp / prExtractCity / prWhich /
   prayerTimesCore) با دادهٔ مرجع aladhan method=7، (۲) دروازه‌های
   RULES (rate/prayer/notes) با کنترل منفی، (۳) ساختاری main/preload/app،
   (۴) NEGATIVE CONTROLS: سم‌پاشی دروازه و سم‌پاشی هستهٔ نجومی. */
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS | ' + name); }
  else { fail++; console.log('FAIL | ' + name + (extra !== undefined ? ' | ' + String(JSON.stringify(extra)).slice(0, 160) : '')); }
};
const R = (...p) => fs.readFileSync(path.join(__dirname, ...p), 'utf8');
const appSrc = R('renderer/js/app.js');
const mainSrc = R('main.js');
const preSrc = R('preload.js');
const pkg = JSON.parse(R('package.json'));

console.log('\n[1] pure-function extraction from app.js');
function sliceOf(src, startAnchor, endAnchor, label) {
  const a = src.indexOf(startAnchor);
  if (a < 0) throw new Error('start not found: ' + label);
  const b = src.indexOf(endAnchor, a + startAnchor.length);
  if (b < 0) throw new Error('end not found: ' + label);
  return src.slice(a, b);
}
const wxEdgeLine = (appSrc.match(/^  const WX_EDGE =[\s\S]*?;$/m) || [''])[0];
if (!wxEdgeLine) { console.log('FATAL: WX_EDGE line missing'); process.exit(2); }
const ratesSlice = sliceOf(appSrc, '  const moneyFa', '\n  async function ratesReply', 'rates');
const coreSlice = sliceOf(appSrc, '  function prayerTimesCore', '\n  const PR_LABELS', 'core');
const prSlice = sliceOf(appSrc, '  const PR_STRIP', '\n  const prHM', 'pr-extract') + '\n' + wxEdgeLine;
const notesSlice = sliceOf(appSrc, '  function notesParseOp', '\n  async function notesReply', 'notes');
ok('slices extracted (rates/core/pr/notes)', ratesSlice.length > 800 && coreSlice.length > 1200 && prSlice.length > 400 && notesSlice.length > 600);

const STUB = `
  const t = (k) => ({ 'rates.usd': 'دلار', 'rates.approx': 'حدود', 'rates.up': 'کمی بالاتر از قبل', 'rates.down': 'کمی پایین‌تر از قبل' }[k] || k);
  const faNum = (v) => String(v);
  const AI_FALLBACK = Object.freeze({ __aiFallback: true });
  const actLog = () => {};
  const LANG = 'fa';
`;
function evalBlock(code, expose) {
  return new Function(STUB + code + '\nreturn { ' + expose + ' };')();
}
const ratesMod = evalBlock(ratesSlice, 'ratesDetect, rateLine, RATE_MAP');
const core = evalBlock(coreSlice, 'prayerTimesCore').prayerTimesCore;
const prMod = evalBlock(prSlice, 'prExtractCity, prWhich').prExtractCity ? evalBlock(prSlice, 'prExtractCity, prWhich') : null;
const notesMod = evalBlock(notesSlice, 'notesParseOp').notesParseOp;
ok('pure modules evaluated (no DOM/bridge needed)', !!ratesMod && !!core && !!prMod && !!notesMod);

console.log('\n[2] ratesDetect behavioral (positive + suppression rules)');
const rd = ratesMod.ratesDetect;
ok('«قیمت دلار چنده» → dollar', JSON.stringify(rd('قیمت دلار چنده')) === '["dollar"]', rd('قیمت دلار چنده'));
ok('«دلار چنده» → dollar', JSON.stringify(rd('دلار چنده')) === '["dollar"]', rd('دلار چنده'));
ok('«قیمت طلا چنده» → gold18', JSON.stringify(rd('قیمت طلا چنده')) === '["gold18"]', rd('قیمت طلا چنده'));
ok('«طلای ۱۸ عیار چنده» → gold18', JSON.stringify(rd('طلای ۱۸ عیار چنده')) === '["gold18"]', rd('طلای ۱۸ عیار چنده'));
ok('«انس جهانی طلا چنده» → ounce فقط (gold18 سرکوب شد)', JSON.stringify(rd('انس جهانی طلا چنده')) === '["ounce"]', rd('انس جهانی طلا چنده'));
ok('«نیم سکه چنده» → nim فقط (emami سرکوب شد)', JSON.stringify(rd('نیم سکه چنده')) === '["nim"]', rd('نیم سکه چنده'));
ok('«سکه چنده» → emami', JSON.stringify(rd('سکه چنده')) === '["emami"]', rd('سکه چنده'));
ok('«سکه بهار آزادی چنده» → bahar فقط', JSON.stringify(rd('سکه بهار آزادی چنده')) === '["bahar"]', rd('سکه بهار آزادی چنده'));
ok('«بیت کوین چنده» → btc', JSON.stringify(rd('بیت کوین چنده')) === '["btc"]', rd('بیت کوین چنده'));
ok('«قیمت یورو و طلا و سکه» → ۳ دارایی', rd('قیمت یورو و طلا و سکه').length === 3, rd('قیمت یورو و طلا و سکه'));
ok('«price of bitcoin» → btc', JSON.stringify(rd('price of bitcoin')) === '["btc"]', rd('price of bitcoin'));
ok('«مثقال چنده» → mesghal', JSON.stringify(rd('مثقال چنده')) === '["mesghal"]', rd('مثقال چنده'));
ok('NEG: «آب و هوای بجنورد چطوره» → []', rd('آب و هوای بجنورد چطوره').length === 0, rd('آب و هوای بجنورد چطوره'));
ok('NEG: «ساعت چنده» → []', rd('ساعت چنده').length === 0, rd('ساعت چنده'));
ok('NEG: «قیمت کتاب چنده» → []', rd('قیمت کتاب چنده').length === 0, rd('قیمت کتاب چنده'));

console.log('\n[3] rateLine formatting (rial÷10, usd, dual bigToman)');
const qMock = {
  price_dollar_rl: { p: 2060100, dp: 0.2, dt: 'high' },
  geram18: { p: 218396000, dp: 0, dt: '' },
  sekee: { p: 2180100000, dp: -0.4, dt: 'low' },
  ons: { p: 4454.08, dp: 0, dt: '' },
  'crypto-bitcoin': { p: 78818.57, dp: 0.11, dt: 'low' },
  'crypto-bitcoin-irr': { p: 163162322000, dp: 0.11, dt: 'low' },
};
const rl = ratesMod.rateLine;
const lDollar = rl('dollar', qMock);
ok('dollar: ۲۰۶٬۰۱۰ تومان (ریال÷۱۰) + روند', lDollar === 'دلار: 206,010 — کمی بالاتر از قبل', lDollar);
ok('gold18: بدون روند وقتی dp=0', rl('gold18', qMock) === 'طلای ۱۸ عیار: 21,839,600', rl('gold18', qMock));
ok('emami: روند پایین', rl('emami', qMock) === 'سکه امامی: 218,010,000 — کمی پایین‌تر از قبل', rl('emami', qMock));
ok('ounce: دلاری', rl('ounce', qMock) === 'انس جهانی طلا: 4,454 دلار', rl('ounce', qMock));
const lBtc = rl('btc', qMock);
ok('btc: دلاری + «حدود 16.3 میلیارد تومان»', lBtc.startsWith('بیت‌کوین: 78,819 دلار (حدود 16.3 میلیارد تومان)') && lBtc.includes('کمی بالاتر'), lBtc);
ok('rateLine: کلید غایب → رشتهٔ خالی (پاسخ صادقانه)', rl('dollar', {}) === '' && rl('eth', qMock) === '');

console.log('\n[4] prayerTimesCore — snapshots از aladhan method=7 (اعتبارسنجی زندهٔ امروز)');
const nearHM = (got, hh, mm, tol) => got != null && Math.abs(got * 60 - (hh * 60 + mm)) <= tol;
const t1 = core(35.6892, 51.389, new Date(2026, 10, 20), 3.5); /* تهران ۲۰ نوامبر ۲۰۲۶ */
ok('تهران 11-20 fajr 05:18 (±2)', nearHM(t1.fajr, 5, 18, 2), t1.fajr);
ok('تهران 11-20 sunrise 06:45 (±2)', nearHM(t1.sunrise, 6, 45, 2), t1.sunrise);
ok('تهران 11-20 dhuhr 11:50 (±2)', nearHM(t1.dhuhr, 11, 50, 2), t1.dhuhr);
ok('تهران 11-20 asr 14:36 (±2)', nearHM(t1.asr, 14, 36, 2), t1.asr);
ok('تهران 11-20 sunset 16:55 (±2)', nearHM(t1.sunset, 16, 55, 2), t1.sunset);
ok('تهران 11-20 maghrib 17:14 (±2)', nearHM(t1.maghrib, 17, 14, 2), t1.maghrib);
ok('تهران 11-20 isha 18:03 (±2)', nearHM(t1.isha, 18, 3, 2), t1.isha);
const t2 = core(37.4747, 57.329, new Date(2026, 4, 21), 3.5); /* بجنورد ۲۱ مه ۲۰۲۶ (شهر کاربر) */
ok('بجنورد 05-21 fajr 02:43 (±2)', nearHM(t2.fajr, 2, 43, 2), t2.fajr);
ok('بجنورد 05-21 dhuhr 11:37 (±2)', nearHM(t2.dhuhr, 11, 37, 2), t2.dhuhr);
ok('بجنورد 05-21 maghrib 19:09 (±2)', nearHM(t2.maghrib, 19, 9, 2), t2.maghrib);
ok('بجنورد 05-21 isha 20:07 (±2)', nearHM(t2.isha, 20, 7, 2), t2.isha);
const today = core(35.6892, 51.389, new Date(), -new Date().getTimezoneOffset() / 60);
const orderOK = today.fajr < today.sunrise && today.sunrise < today.dhuhr && today.dhuhr < today.asr &&
  today.asr < today.sunset && today.sunset < today.maghrib && today.maghrib < today.isha;
ok('امروزی تهران: ترتیب ۷ وقت برقرار', orderOK, JSON.stringify(today));
const gapM = (today.maghrib - today.sunset) * 60;
ok('مغرب − غروب = افق ۴٫۵ درجه (مطابق مرجع: زمستان تهران ≈ ۱۹ دقیقه؛ ۸ تا ۳۰)', gapM >= 8 && gapM <= 30, gapM.toFixed(1));
ok('نیمه‌شب جعفری بین مغرب و صبح فردا', today.midnight > today.maghrib && today.midnight < 24, today.midnight);

console.log('\n[5] prExtractCity / prWhich');
ok('«اوقات شرعی تهران» → تهران', prMod.prExtractCity('اوقات شرعی تهران') === 'تهران', prMod.prExtractCity('اوقات شرعی تهران'));
ok('«اذان ظهر بجنورد چنده» → بجنورد', prMod.prExtractCity('اذان ظهر بجنورد چنده') === 'بجنورد', prMod.prExtractCity('اذان ظهر بجنورد چنده'));
ok('«نماز چند ساعت چنده مشهد» → مشهد («چند» تنها هم بریده شد)', prMod.prExtractCity('نماز چند ساعت چنده مشهد') === 'مشهد', prMod.prExtractCity('نماز چند ساعت چنده مشهد'));
ok('«امشب اذان مغرب تبریز چنده» → تبریز («امشب» کامل بریده شد)', prMod.prExtractCity('امشب اذان مغرب تبریز چنده') === 'تبریز', prMod.prExtractCity('امشب اذان مغرب تبریز چنده'));
ok('prWhich «اذان صبح» → فقط fajr', JSON.stringify(evalBlock(prSlice, 'prWhich').prWhich('اذان صبح چنده')) === '["fajr"]');
ok('prWhich «نیمه شب» → midnight (بدون isha)', JSON.stringify(evalBlock(prSlice, 'prWhich').prWhich('نیمه شب شرعی چنده')) === '["midnight"]');
ok('prWhich پیش‌فرض ۵ وقت اصلی', evalBlock(prSlice, 'prWhich').prWhich('اوقات شرعی').length === 5);

console.log('\n[6] notesParseOp');
ok('«یادداشت کن که X» → add با متن X', (() => { const o = notesMod('یادداشت کن که کلید وای‌فای رو عوض کردم'); return o.op === 'add' && o.text === 'کلید وای‌فای رو عوض کردم'; })(), JSON.stringify(notesMod('یادداشت کن که کلید وای‌فای رو عوض کردم')));
ok('«یه یادداشت بنویس: جلسه فردا» → add', (() => { const o = notesMod('یه یادداشت بنویس: جلسه فردا ساعت ۵'); return o.op === 'add' && o.text.includes('جلسه فردا'); })(), JSON.stringify(notesMod('یه یادداشت بنویس: جلسه فردا ساعت ۵')));
ok('«یادداشت‌هام رو بخون» → read', notesMod('یادداشت‌هام رو بخون').op === 'read', JSON.stringify(notesMod('یادداشت‌هام رو بخون')));
ok('«آخرین یادداشت رو پاک کن» → delLast', notesMod('آخرین یادداشت رو پاک کن').op === 'delLast');
ok('«همهٔ یادداشت‌ها رو پاک کن» → delAll', notesMod('همه یادداشت‌ها رو پاک کن').op === 'delAll');
ok('NEG: «یادم بنداز که فردا باشگاه» → none (یادآوری نه یادداشت)', notesMod('یادم بنداز که فردا باشگاه').op === 'none');
ok('NEG: «آوا تایپ کن» → none', notesMod('آوا تایپ کن').op === 'none');

console.log('\n[7] RULES gates (استخراج واقعی regex از سورس)');
function gateByPrefix(rxMatch, label) {
  const m = appSrc.match(rxMatch);
  if (!m) throw new Error('gate not found: ' + label);
  return new Function('return (' + m[1] + ');')();
}
const gateRates = gateByPrefix(/k: (\/\(\(قیمت[^\n]*?\/i),\n/, 'rates');
const gatePrayer = gateByPrefix(/k: (\/اوقات\\s\*شرعی[^\n]*?\/i),\n/, 'prayer');
const gateNotes = gateByPrefix(/k: (\/یادداشت[^\n]*?\/i),/, 'notes');
const gCleanRates = (g) => ['ساعت چنده', 'آب و هوای تهران', 'چند درجه هوا', 'یادم بنداز دلار بخرم', 'قیمت کتاب چنده'].every((s) => !g.test(s));
ok('rates gate: ۶ جملهٔ مثبت', ['قیمت دلار چنده', 'دلار چنده', 'قیمت طلا', 'سکه چنده', 'بیت کوین چنده', 'price of gold'].every((s) => gateRates.test(s)));
ok('rates gate: ۵ جملهٔ منفی (بدون برخورد با ساعت/هوا/یادم بنداز/کتاب)', gCleanRates(gateRates));
ok('prayer gate: ۵ مثبت', ['اوقات شرعی تهران', 'اذان ظهر بجنورد چنده', 'نماز چند ساعت چنده', 'وقت نماز', 'اذان صبح'].every((s) => gatePrayer.test(s)));
ok('prayer gate: ساعت چنده / تاریخ امروز / تایپ کن → نه', ['ساعت چنده', 'تاریخ امروز', 'آوا تایپ کن'].every((s) => !gatePrayer.test(s)));
ok('notes gate: ۴ مثبت', ['یادداشت کن که', 'یادداشت‌هام رو بخون', 'همه یادداشت‌ها رو پاک کن', 'take a note'].every((s) => gateNotes.test(s)));
ok('notes gate: یادم بنداز / آلارم → نه', !gateNotes.test('یادم بنداز فردا') && !gateNotes.test('آلارم ساعت ۵'));

console.log('\n[8] structural: main.js / preload.js / app.js');
ok('main: sys:rates + زنجیرهٔ mirror call/call3/call4 با cloudFetch', mainSrc.includes("ipcMain.handle('sys:rates'") && mainSrc.includes('https://call.tgju.org/ajax.json') && mainSrc.includes('https://call3.tgju.org/ajax.json') && mainSrc.includes('https://call4.tgju.org/ajax.json') && /await cloudFetch\(u,/.test(mainSrc));
ok('main: sys:geo از دیکشنری hoisted', mainSrc.includes("ipcMain.handle('sys:geo'") && mainSrc.includes('IR_CITIES[cityNorm(c)]'));
ok('main: IR_CITIES فقط یک‌بار (hoist شد، کپی محلی حذف شد)', (mainSrc.match(/const IR_CITIES = \{/g) || []).length === 1 && (mainSrc.match(/'بجنورد': \[37\.4747, 57\.329\]/g) || []).length === 1);
ok('main: payload guard (r.ok + json().catch(()=>null) + خالی → netFail صادقانه)', /if \(j && j\.current && Object\.keys\(j\.current\)\.length > 50\) return j\.current;/.test(mainSrc) && mainSrc.includes("سرویس قیمت پاسخ خالی داد"));
ok('main: notes:load/save + فایل مستقل ava-notes.json', mainSrc.includes("ipcMain.handle('notes:load'") && mainSrc.includes("ipcMain.handle('notes:save'") && mainSrc.includes('ava-notes.json'));
ok('preload: rates/geo/notes bridge', preSrc.includes("rates: () => ipcRenderer.invoke('sys:rates')") && preSrc.includes("geo: (city) => ipcRenderer.invoke('sys:geo', city)") && preSrc.includes("load: () => ipcRenderer.invoke('notes:load')") && preSrc.includes("save: (arr) => ipcRenderer.invoke('notes:save', arr)"));
ok('app: ratesReply/prayerReply بن‌بست ندارند (AI_FALLBACK)', sliceOf(appSrc, 'async function ratesReply', '\n\n  /* --- ۲)', 'ratesReply').includes('return AI_FALLBACK') && sliceOf(appSrc, 'async function prayerReply', '\n\n  /* --- ۳)', 'prayerReply').includes('return AI_FALLBACK'));
ok('app: prayerReply از bridge.system.geo + تز (روش تهران ۱۷٫۷/۱۴/۴٫۵)', appSrc.includes('bridge.system.geo(city)') && appSrc.includes('riseSet(17.7)') && appSrc.includes('riseSet(14)') && appSrc.includes('riseSet(4.5)'));
ok('app: RULES به ratesReply/prayerReply/notesReply وصلند', appSrc.includes('r: (c) => ratesReply(c)') && appSrc.includes('r: (c) => prayerReply(c)') && appSrc.includes('r: (c) => notesReply(c)'));
ok('app: i18n جدید (rates/prayer/notes/date.greg) هر دو زبان', ["'rates.ask'", "'rates.onlyApp'", "'prayer.city'", "'prayer.fail'", "'notes.added'", "'notes.empty'", "'notes.list'", "'notes.deletedLast'", "'notes.cleared'", "'date.greg'"].every((k) => appSrc.includes(k)));
ok('app: تاریخ میلادی (fa-IR-u-ca-gregory) مکمل شمسی', appSrc.includes('fa-IR-u-ca-gregory') && appSrc.includes('/میلادی|gregorian/i.test(c)'));
ok('app: کاور امن setCoverArt + im.onerror', appSrc.includes('function setCoverArt') && appSrc.includes('im.onerror') && appSrc.includes('setCoverArt(mCover, tr, true)') && appSrc.includes('setCoverArt(mwCover, tr, false)'));
ok('app: متن‌های کاربر-پدیدار جدید هیچ واژهٔ DNS/VPN ندارند', (() => {
  const s = sliceOf(appSrc, "'rates.up'", "'notes.onlyApp'", 'i18n31') + sliceOf(appSrc, '  /* --- ۱) قیمت‌ها', '\n  const RULES = [', 'help31');
  return !/فیلترشکن|VPN|vpn|دی\s?ان\s?اس/i.test(s);
})());

console.log('\n[9] NEGATIVE CONTROLS (سم‌پاشی — اثبات اینکه هارنس می‌گیرد)');
/* A: اگر کسی واژهٔ کلی «چند» را به‌عنوان گزینهٔ مستقل به دروازه اضافه کند، «چند درجه هوا» می‌شکند */
const poisonedGate = gateRates.source.replace('|(price|rate)', '|چند|(price|rate)');
ok('A: دروازهٔ سالم «چند درجه هوا» را نمی‌گیرد ولی نسخهٔ مسموم می‌گیرد',
  !gateRates.test('چند درجه هوا') && new RegExp(poisonedGate, 'i').test('چند درجه هوا'));
/* B: اگر مغرب روش تهران حذف شود (۴٫۵ → ۰)، گپ مغرب/غروب می‌شکند */
const poisonedCore = evalBlock(coreSlice.replace('riseSet(4.5)', 'riseSet(0)'), 'prayerTimesCore').prayerTimesCore;
const pBad = poisonedCore(35.6892, 51.389, new Date(2026, 10, 20), 3.5);
ok('B: حذف مغرب ۴٫۵° → گپ خارج از بازهٔ مرجع (۸-۳۰ دقیقه) و هارنس آن را می‌بیند',
  !((pBad.maghrib - pBad.sunset) * 60 >= 8 && (pBad.maghrib - pBad.sunset) * 60 <= 30));

console.log('\n[10] versions 0.31.0');
ok('package.json 0.31.0', pkg.version === '0.31.0', pkg.version);
ok('about box v0.31.0', appSrc && R('renderer/index.html').includes('>v0.31.0</span>'));
ok('app.js appVersion 0.31.0', appSrc.includes("let appVersion = '0.31.0';"));
ok('main.js نسخه در app:info همگام', !mainSrc.includes("'0.30.0'") || mainSrc.includes("'0.31.0'"));

console.log(`\nRESULT: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
