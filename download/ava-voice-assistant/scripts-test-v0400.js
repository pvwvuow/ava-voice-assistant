'use strict';
/* ============================================================
   آوا — scripts-test-v0400.js — تست رگرسیون فیکس‌های v0.40
   ------------------------------------------------------------
   همهٔ این‌ها گزارشِ واقعی activity.log کاربر بودند (۲۰۲۶-۰۸-۳۱):
   - W1: «پین رو واضح‌ترش کن» → PIN_VIDEO اشتباه می‌خورد (واضح‌تر = شفافیت!)
   - W2: «اپسیتی فیفتی» / «اپسیتی رو تغییر بده» / «یکم روشن واضح‌ترش کن»
     → هیچ‌کدام شفافیت نمی‌شد (واژه‌های اپسیتی/واضح نبودند)
   - W3: «فیلم یا ویدیو رو ببند آوا» → هیچ (دروازهٔ پارسر ببندِ بدون «ش» را
     نمی‌گرفت) → باید UNPIN شود
   - W4: «ببرش بالا سمت راست آوا» → هیچ (دروازه ببرش را نمی‌گرفت) → MOVE
   - W5: «یکم کوچکترش کن» → قانون مینیمایزِ همهٔ پنجره‌ها می‌خورد! (کوچک.{0,8}کن)
   - W6: «از از از از از…» هذیان whisper برندهٔ مسابقه می‌شد، ۳۶ ثانیه AI
     می‌سوزاند و خطای دروغین می‌داد → گارد ضد-هذیان (dispatch ممنوع)
   - W7: «سلام حالت چطوره خوبی میشه گوگلو برام باز کنی…» → قانون راهنما
     می‌گرفت (میشه/کنی گاردِ HOW بود) → باید سایت/گوگل باز شود
   - W8: «می‌خوام دستورات مربوط به یوتیوب و فیلم… رو ببینم» → یوتیوب باز
     می‌شد! → حالا صفحهٔ کامل فرمان‌ها با انیمیشن باز می‌شود
   - W9: «توی سایت دیجی کالا دنبال ساعت رولکس بگرد» → صفحهٔ اصلی دیجی‌کالا
     باز می‌شد نه جستجو؛ «حالا توی این سایت…» هم سایت قبلی را بلد نبود
   + رگرسیون‌های قدیمی (شفافش کن/کلیک ببند/ضد-ربایش) همه سبز می‌مانند
   ============================================================ */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname);
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const AVAVoice = require('./renderer/js/voiceCommandParser');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('PASS | ' + name); } else { fail++; console.log('FAIL | ' + name); } };
const eq = (a, b, name) => ok(a === b, name + (a === b ? '' : `  [got=${JSON.stringify(a)} want=${JSON.stringify(b)}]`));

const app = read('renderer/js/app.js');
const idx = read('renderer/index.html');
const css = read('renderer/css/styles.css');
const pkg = JSON.parse(read('package.json'));

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

/* کِشیدن regex قانون از سورس با لنگرِ id (مقاوم به تغییر جزئی متن) */
function ruleRegexBy(id) {
  const i = app.indexOf("id: '" + id + "'");
  if (i < 0) return null;
  const kstart = app.lastIndexOf('k: /', i);
  if (kstart < 0) return null;
  const kend = app.indexOf('/i,', kstart);
  if (kend < 0 || kend > i) return null;
  return new RegExp(app.slice(kstart + 4, kend), 'i');
}

/* ---------- ۱) پارسر PiP — جدولِ رفتاری از خودِ activity.log کاربر ---------- */
const P = (txt, ctx) => AVAVoice.parseVoiceCommand(txt, ctx);
const I = (r) => (r ? r.intent : 'null');
const OP = (r) => (r && r.entities && typeof r.entities.opacity === 'number' ? r.entities.opacity : '');

{
  const ctxOpen = { pipOpen: true, size: 'medium', opacity: 0.5 };
  const r1 = P('پین رو واضح‌ترش کن', ctxOpen);
  eq(I(r1), 'OPACITY_PIP', 'W1: «پین رو واضح‌ترش کن» = شفافیت، دیگر PIN اشتباه نیست');
  eq(r1 && r1.entities.opacity, 0.7, 'W1b: واضح‌تر از 0.5 یک پله بالا می‌رود (0.7)');
  eq(I(P('پین ویدیو رو واضح‌تر کن', { pipOpen: true, opacity: 1 })), 'OPACITY_PIP', 'W1c: «پین ویدیو رو واضح‌تر کن» = OPACITY');
  eq(I(P('فیلم یا ویدیو رو ببند آوا', { pipOpen: true })), 'UNPIN_VIDEO', 'W3: «فیلم یا ویدیو رو ببند» = UNPIN');
  eq(I(P('ویدیو رو ببند', { pipOpen: false })), 'UNPIN_VIDEO', 'W3b: با لنگرِ ویدیو بدون PiP باز هم UNPIN');
  const r4 = P('ببرش بالا سمت راست آوا', { pipOpen: true });
  eq(I(r4), 'MOVE_PIP', 'W4: «ببرش بالا سمت راست» = MOVE');
  eq(r4 && r4.entities.position, 'top-right', 'W4b: موقعیت = top-right');
  const r5 = P('یکم کوچکترش کن', { pipOpen: true, size: 'large' });
  eq(I(r5), 'RESIZE_PIP', 'W5: «یکم کوچکترش کن» با PiP باز = RESIZE');
  eq(r5 && r5.entities.size, 'medium', 'W5b: از large یک پله کوچکتر = medium');
  eq(P('یکم کوچکترش کن', { pipOpen: false }), null, 'W5c: بدون PiP باز و بدون لنگر = null (به AI)');

  /* W2 — خانوادهٔ شفافیت/اپسیتی */
  eq(OP(P('اپسیتی فیفتی', { pipOpen: true })), 0.5, 'W2: «اپسیتی فیفتی» = 0.5');
  eq(OP(P('اوپسیتی پنجاه', { pipOpen: true })), 0.5, 'W2b: «اوپسیتی پنجاه» = 0.5');
  const rCh = P('اپسیتی رو تغییر بده', { pipOpen: true, opacity: 1 });
  eq(I(rCh), 'OPACITY_PIP', 'W2c: «اپسیتی رو تغییر بده» = OPACITY');
  eq(rCh && rCh.entities.opacity, 0.7, 'W2d: تغییر روی حالت کامل = 0.7 (تغییری واقعاً دیده شود)');
  eq(OP(P('یکم روشن واضح‌ترش کن', { pipOpen: true, opacity: 0.3 })), 0.5, 'W2e: روشن/واضح‌تر از 0.3 → 0.5');
  eq(OP(P('ویدیو رو شیشه‌ای کن', { pipOpen: true })), 0.5, 'W2f: «شیشه‌ای کن» = 0.5 (چیپ کارت پیشنهاد)');
  eq(OP(P('شفاف‌ترش کن', { pipOpen: true, opacity: 0.7 })), 0.5, 'W2g: شفاف‌تر از 0.7 → 0.5');
  eq(OP(P('شفاف‌ترش کن', { pipOpen: true })), 0.7, 'W2h: شفاف‌تر بدون زمینه (فرض کامل) → 0.7');

  /* رگرسیون‌های قدیمی — نباید بشکنند */
  eq(OP(P('شفافش کن', { pipOpen: true })), 0.5, 'REG: «شفافش کن» = 0.5 (v0.37)');
  eq(I(P('ویدیو رو پین کن', { pipOpen: false })), 'PIN_VIDEO', 'REG: «ویدیو رو پین کن» = PIN');
  eq(I(P('کلیک روش رو ببند', { pipOpen: true })), 'CLICK_THROUGH_ON', 'REG: «کلیک روش رو ببند» = قفل کلیک (معکوس، v0.37)');
  eq(I(P('کلیک روش فعال باشه', { pipOpen: true })), 'CLICK_THROUGH_OFF', 'REG: «کلیک روش فعال باشه» = باز (v0.37)');
  eq(I(P('پین رو ببر بالا سمت راست', { pipOpen: true })), 'MOVE_PIP', 'REG: «پین رو ببر بالا سمت راست» = MOVE (کار می‌کرد، نباید بشکند)');
  eq(I(P('پین را یکم کوچکتر کن', { pipOpen: true, size: 'large' })), 'RESIZE_PIP', 'REG: «پین را یکم کوچکتر کن» = RESIZE');
  eq(I(P('قیمت دلار چنده', { pipOpen: false })), 'null', 'REG ضد-ربایش: قیمت دلار');
  eq(I(P('هوا چطوره', { pipOpen: false })), 'null', 'REG ضد-ربایش: هوا چطوره');
  eq(I(P('یوتیوب رو باز کن', { pipOpen: false })), 'null', 'REG ضد-ربایش: یوتیوب رو باز کن');
  eq(I(P('از پلی‌لیست بردار', { pipOpen: true })), 'null', 'REG v0.38.1: «از پلی‌لیست بردار» = null');
  /* سوالِ روش هرگز اقدام مستقیم نیست (v0.40) */
  eq(I(P('چجوری میتونم ویدیو رو پین کنم', { pipOpen: true })), 'null', 'W7b: «چجوری میتونم… پین کنم» = null (راهنما/AI، نه پین)');
  eq(I(P('چجوری فیلم دانلود کنم', { pipOpen: false })), 'null', 'W7c: «چجوری فیلم دانلود کنم» = null');
  eq(I(P('چطوری میتونم پین رو جابجا کنم', { pipOpen: true })), 'null', 'W7d: «چطوری میتونم جابجا کنم» = null');
}

/* ---------- ۲) دروازهٔ قانون pip — همهٔ جملاتِ لاگ کاربر باید به پارسر برسند ---------- */
{
  const G = AVAVoice.PIP_COMMAND_RE;
  for (const t of ['فیلم یا ویدیو رو ببند آوا', 'ببرش بالا سمت راست آوا', 'یکم کوچکترش کن',
    'اپسیتی فیفتی', 'اپسیتی رو تغییر بده', 'پین رو واضح‌ترش کن', 'ویدیو رو پین کن', 'ویدیو رو شیشه‌ای کن']) {
    ok(G.test(t), 'GATE: «' + t + '» به پارسر می‌رسد');
  }
  for (const t of ['قیمت دلار چنده', 'هوا چطوره', 'سلام', 'تایمر ۵ دقیقه']) {
    ok(!G.test(t), 'GATE-NEG: «' + t + '» وارد پارسر PiP نمی‌شود');
  }
}

/* ---------- ۳) گارد ضد-هذیان STT — همان جمله‌های لاگ کاربر ---------- */
{
  const fns = [extractFn('collapseRepeats', app), extractFn('sttCleanNoise', app), extractFn('isJunkUtterance', app)].join('\n');
  const jw = app.match(/const STT_JUNK_WORDS = new Set\(\[[^\]]*\]\);/);
  const sw = app.match(/const STT_SHORT_OK = new Set\(\[[^\]]*\]\);/);
  ok(!!jw && !!sw, 'ساخت: مجموعه‌های زباله/مجاز تعریف شده‌اند');
  const sandbox = new Function(fns + '\n' + jw[0] + '\n' + sw[0] + '\nreturn isJunkUtterance;');
  const isJunk = sandbox();
  const JUNK = ['از از از از از از از از از از از ا', 'از از از', 'این این این این این این این', '[صحر]', '"Q"', '[Sigh]', '"Dar', 'ببب', 'او با', 'آبا', 'aba', 'اوه', 'ایه ای', 'برده از از از از از از', 'از ا', '[صول]', '"مه'];
  for (const t of JUNK) ok(isJunk(t) === true, 'JUNK: «' + t.slice(0, 24) + '» دور ریخته می‌شود');
  const GOOD = ['هوا هوا', 'خیلی خیلی ممنون', 'گوگل کروم را برام باز کن', 'سلام', 'فیلم یا ویدیو رو ببند آوا', 'حالت چطوره', 'آوا', 'توی سایت دیجی کالا برام دنبال ساعت رولکس بگرد', 'ویدیو رو پین کن', 'ببرش بالا سمت راست آوا', 'پین رو واضح‌ترش کن', 'اپسیتی فیفتی', 'می‌خوام دستورات مربوط به یوتیوب و فیلم و این چیزا رو ببینم', 'بجنورد دقیقاً کجاست', 'تایمر ۱ ساعت و ۳۰ دقیقه'];
  for (const t of GOOD) ok(isJunk(t) === false, 'KEEP: «' + t.slice(0, 24) + '» سالم می‌ماند');
  ok(/junk\/hallucination result/.test(app), 'ساخت: برندهٔ هذیانی مسابقهٔ STT برنده نیست (منتظر ابر می‌ماند)');
  ok(/utterance junk dropped/.test(app), 'ساخت: گارد زباله در handleUtterance (هیچ dispatch و بدون AI)');
  ok(/stt all engines returned junk/.test(app), 'ساخت: پایان ساکت وقتی همهٔ موتورها زباله دادند (بدون توست دروغین)');
}

/* ---------- ۴) قانون HOW — دیگر «میشه … کنی» راهنما نمی‌گیرد ---------- */
{
  const HOW = ruleRegexBy('howto');
  ok(!!HOW, 'ساخت: قانون HOW پیدا شد');
  ok(!HOW.test('سلام حالت چطوره خوبی میشه گوگلو برام باز کنی یه جورایی که خوب باز بشه'), 'W7: جملهٔ واقعیِ لاگ دیگر قانون راهنما را نمی‌گیرد');
  ok(!HOW.test('میشه گوگلو برام باز کنی'), 'W7b: «میشه … باز کنی» = درخواستِ کار، نه سوالِ روش');
  ok(!HOW.test('حالت چطوره خوبی'), 'REG: «حالت چطوره خوبی» راهنما نیست');
  ok(!HOW.test('هوا چطوره'), 'REG: «هوا چطوره» راهنما نیست');
  ok(HOW.test('چجوری میتونم ویدیو رو پین کنم'), 'REG: «چجوری میتونم …» راهنما می‌ماند');
  ok(HOW.test('چی میتونی'), 'REG: «چی میتونی» راهنما می‌ماند');
  ok(HOW.test('لیست فرمان‌ها'), 'REG: «لیست فرمان‌ها» راهنما می‌ماند');
  ok(HOW.test('چیکار میتونی بکنی'), 'REG: «چیکار میتونی» راهنما می‌ماند');
}

/* ---------- ۵) قانون صفحهٔ فرمان‌ها (v0.40) ---------- */
{
  const CP = ruleRegexBy('cmdpage');
  ok(!!CP, 'ساخت: قانون cmdpage پیدا شد');
  ok(CP.test('می‌خوام دستورات مربوط به یوتیوب و فیلم و این چیزا رو ببینم'), 'W8: جملهٔ دقیقِ لاگ کاربر → صفحهٔ فرمان‌ها');
  ok(CP.test('دستورات رو نشون بده'), 'W8b: «دستورات رو نشون بده»');
  ok(CP.test('فرمان‌های مربوط به ویدیو رو ببینم'), 'W8c: «فرمان‌های مربوط به ویدیو رو ببینم»');
  ok(CP.test('لیست فرمان‌ها'), 'W8d: «لیست فرمان‌ها»');
  ok(CP.test('چه فرمان‌هایی داری'), 'W8e: «چه فرمان‌هایی داری»');
  ok(!CP.test('یوتیوب رو باز کن'), 'GATE-NEG: «یوتیوب رو باز کن» صفحهٔ فرمان‌ها نیست');
  ok(!CP.test('برو سایت دیجی کالا'), 'GATE-NEG: «برو سایت دیجی کالا» صفحهٔ فرمان‌ها نیست');
  ok(/id: 'cmdpage'/.test(app) && /RULES\.splice\(1, 0, cmdPageRule\)/.test(app), 'ساخت: cmdpage بالای فهرست قوانین (قبل از open_youtube)');
  ok(/function openCmdPage/.test(app) && /function closeCmdPage/.test(app) && /function cpRender/.test(app), 'ساخت: توابع صفحهٔ فرمان‌ها');
  ok(/CMD_PAGE_DECK/.test(app) && /ویدیو رو پین کن/.test(app), 'ساخت: دادهٔ دسته‌های فرمان');
  ok(idx.includes('id="cmdPage"') && idx.includes('id="cpTabs"') && idx.includes('id="cpChips"') && idx.includes('id="cpClose"') && idx.includes('id="cpBack"'), 'ساخت: صفحهٔ فرمان‌ها در index.html');
  ok(css.includes('.cp-wrap') && css.includes('@keyframes cpIn') && css.includes('@keyframes cpOut') && css.includes('.cp-tab'), 'ساخت: CSS انیمیشن صفحهٔ فرمان‌ها');
  ok(css.includes('.cs-all') && /className = 'cs-all'/.test(app) && /openCmdPage\(cat\)/.test(app), 'ساخت: دکمهٔ «همهٔ فرمان‌ها» روی کارت پیشنهاد');
  ok(/commands page open/.test(app), 'ساخت: لاگ باز شدن صفحه');
  /* دسته‌بندی صوتی */
  const catFn = extractFn('cmdCategoryOf', app);
  ok(!!catFn, 'ساخت: cmdCategoryOf');
  if (catFn) {
    const catOf = new Function(catFn + '\nreturn cmdCategoryOf;');
    eq(catOf()('دستورات مربوط به یوتیوب رو ببینم'), 'video', 'دسته: یوتیوب → video');
    eq(catOf()('دستورات موزیک رو ببینم'), 'music', 'دسته: موزیک → music');
    eq(catOf()('دستورات دیسکورد'), 'discord', 'دسته: دیسکورد');
    eq(catOf()('دستورات سایت‌ها'), 'web', 'دسته: سایت');
  }
}

/* ---------- ۶) مینیمایز — دیگر «کوچک کن» هر جمله‌ای را نمی‌گیرد ---------- */
{
  const MIN = ruleRegexBy('minimize_all');
  ok(!!MIN, 'ساخت: قانون minimize_all پیدا شد');
  ok(!MIN.test('یکم کوچکترش کن'), 'W5d: «یکم کوچکترش کن» دیگر مینیمایز نمی‌کند');
  ok(!MIN.test('پین را یکم کوچکتر کن'), 'W5e: «پین را یکم کوچکتر کن» مینیمایز نیست');
  ok(!MIN.test('کوچیکش کن'), 'W5f: «کوچیکش کن» مینیمایز نیست');
  ok(MIN.test('مینیمایز کن'), 'REG: «مینیمایز کن» مینیمایز می‌ماند');
  ok(MIN.test('پنجره رو کوچک کن'), 'REG: «پنجره رو کوچک کن» مینیمایز می‌ماند');
  ok(MIN.test('همه پنجره‌ها رو کوچک کن'), 'REG: «همه پنجره‌ها» مینیمایز می‌ماند');
  ok(MIN.test('نمایش دسکتاپ'), 'REG: «نمایش دسکتاپ» می‌ماند');
}

/* ---------- ۷) جستجوی درون-سایتی (v0.40 → v0.41 forward-relax) ----------
   v0.41 پارسرِ مشترک AVAVoice.parseSiteSearch جای siteSearchQueryOf را گرفت و
   قانون site_search «قبل از web_open» رفت (ریشهٔ «توی سایت X سرچ کن → گوگل»). */
{
  const uFn = extractFn('siteSearchUrlFor', app);
  ok(!!uFn, 'ساخت: تابع URL جستجوی سایت');
  const { siteSearchUrlFor } = new Function(uFn + '\nreturn { siteSearchUrlFor };')();
  eq(siteSearchUrlFor('https://www.digikala.com', 'ساعت رولکس'), 'https://www.digikala.com/search/?q=' + encodeURIComponent('ساعت رولکس'), 'W9d: سرچ واقعی دیجی‌کالا');
  eq(siteSearchUrlFor('https://www.aparat.com', 'گربه'), 'https://www.aparat.com/result/' + encodeURIComponent('گربه'), 'W9e: سرچ واقعی آپارات');
  ok(decodeURIComponent(siteSearchUrlFor('https://example.ir', 'ساعت')).includes('site:example.ir'), 'W9f: سایت ناشناس → site: در گوگل');
  ok(/id: 'site_search'/.test(app), 'ساخت: قانون site_search');
  /* v0.41 — ترتیب تازه: site_search «قبل از web_open» (پارسر خودش یوتیوب را رد می‌کند
     تا مسیر بومی yt_search اول بماند) — هر دو ساختار قدیم/تازه قبول */
  ok(/RULES\.splice\(wi >= 0 \? wi/.test(app) || /RULES\.splice\(yi >= 0 \? yi \+ 1/.test(app), 'ساخت: site_search قبل از web_open (دیگر Googleِ کور نمی‌شود)');
  ok(/AVAVoice\.parseSiteSearch\(c, siteSearchDeps\(\)\)/.test(app), 'ساخت: دروازهٔ site_search = پارسر کامل v0.41');
  ok(/store\.set\('lastSite', base\)/.test(app) && /store\.get\('lastSite'/.test(app), 'ساخت: حافظهٔ «این سایت»');
  ok(/if \(ks\) \{ store\.set\('lastSite', ks\); return ks; \}/.test(app), 'ساخت: باز کردن سایت عادی هم حافظه را پر می‌کند');
  /* v0.41 — رفتار W9 با پارسر تازه (همان جملات لاگ کاربر) */
  const D9 = {
    knownSite: (n) => (/دیجی|digikala/i.test(n) ? 'https://www.digikala.com' : null),
    knownName: (c) => (/دیجی\s*کالا|دیجی کالا/i.test(c) ? { name: 'دیجی کالا', url: 'https://www.digikala.com', norm: 'دیجی کالا' } : null),
    domainOf: null, lastSite: '',
  };
  eq((AVAVoice.parseSiteSearch('توی سایت دیجی کالا برام دنبال ساعت رولکس بگرد', D9) || {}).query, 'ساعت رولکس', 'W9: عبارت جستجو = «ساعت رولکس»');
  eq((AVAVoice.parseSiteSearch('تو دیجی کالا برام دنبال ساعت رولکس بگرد', D9) || {}).query, 'ساعت رولکس', 'W9b: «تو دیجی کالا…» هم همین');
  eq((AVAVoice.parseSiteSearch('حالا توی این سایت برام دنبال ساعت رولکس بگرد', D9) || {}).thisSite, true, 'W9c: «توی این سایت…» همین');
}

/* ---------- ۸) پارسر فرمان صوتی سالم (v0.61: پنجرهٔ شناور حذف شد؛ پارسر می‌ماند) ---------- */
{
  ok(/const PIP_COMMAND_RE = /.test(app) === false, 'app.js دیگر PIP_COMMAND_RE را مصرف نمی‌کند (پارسر کتابخانه‌ای باقی است)');
  ok(/const PIP_COMMAND_RE = /.test(read('renderer/js/voiceCommandParser.js')), 'پارسر voiceCommandParser سر جایش است');
}

/* ---------- ۹) نسخه و سلامت فایل‌ها ---------- */
{
  ok(/^0\.[4-9][0-9]*\.\d+-beta$/.test(pkg.version), 'نسخهٔ 0.4x/0.5x-beta در package.json (forward-compatible)');
  ok(/let appVersion = '0\.[4-9][0-9]*\.\d+-beta';/.test(app), 'نسخه در app.js (forward-compatible)');
  ok(/v0\.[4-9][0-9]*\.\d+-beta/.test(idx), 'نسخه در دربارهٔ index.html (forward-compatible)');
  const { execSync } = require('child_process');
  for (const f of ['renderer/js/app.js', 'renderer/js/voiceCommandParser.js', 'main.js', 'preload.js']) {
    let okk = true;
    try { execSync('node --check ' + f, { cwd: R, stdio: 'pipe' }); } catch (_) { okk = false; }
    ok(okk, 'سینتکس سالم: ' + f);
  }
}

/* ---------- ۱۰) هیچ فریب خورده‌ای باقی نمانده: عددهای نهایی ---------- */
console.log('\nRESULT: ' + pass + '/' + (pass + fail));
if (fail > 0) { console.log('FAILED!'); process.exit(1); }
console.log('V0400_OK');
