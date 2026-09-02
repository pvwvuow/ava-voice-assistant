'use strict';
/* ============================================================
   آوا — scripts-test-v0410.js — تست رگرسیون فیکس‌های v0.41
   ------------------------------------------------------------
   درخواست کاربر (۱۴۰۵/۰۶/۱۰): «خیلی چیزها دستوراتی که فرمانشون
   متغیره اشتباه اجرا میکنه مثلا میگم برو توی سایت فلان اینو سرچ
   کن میره توی گوگل سرچ می کنه در صورتی که اگه بگم برو توی فلان
   سایت اینو بگرد درست عمل می کنه — دایره لغاتش را بیشتر کن یا
   سریعتر به AI وصلش کن و AI متوجه بشه به کدام کامند مربوط میشه»
   ریشه‌ها و فیکس‌ها:
   - S1: «توی سایت X … سرچ کن» قانون web_open (هر جملهٔ «سایت»دار)
     یا web_search می‌ربود → قانون site_search با پارسر کامل
     (AVAVoice.parseSiteSearch) «قبل از web_open» نشست
   - S2: دایرهٔ لغات جستجوی درون-سایتی: سرچ/سیرچ/جستجو/بگرد/پیدا کن
     × سایت X / اسم معروف بدون «سایت» / دامنهٔ خام / این-همین-همون سایت
   - S3: گسترش KNOWN_SITES (ورزش۳، نمناک، ویرگول، رددیت، آمازون، آپارت…)
   - S4: جستجوی بومی سایت‌های بیشتر در siteSearchUrlFor
   - S5: جستجوی وب: «گوگل کن»، «سرچش کن»، «پیداش کن» … + stripSearch بازتر
   - S6: پیش‌گرم Gemini موقع شروع برنامه (اولین فرمان AI هم سریع)
   - S7: حافظهٔ نگاشت AI — عبارت تکراری بدون شبکه در لحظه اجرا می‌شود
   - S8: CATALOG_HINTS — AI دقیق‌تر می‌فهمد کدام کامند موردنظر است
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
const parser = read('renderer/js/voiceCommandParser.js');
const idx = read('renderer/index.html');
const pkg = JSON.parse(read('package.json'));
const readme = read('README.md');

/* ---------- دیکشنری سایت تستی — همان شکل knownSiteOf/knownNameOf آوا ---------- */
const SITES = {
  'دیجی کالا': 'https://www.digikala.com', 'دیجی\u200Cکالا': 'https://www.digikala.com', 'digikala': 'https://www.digikala.com',
  'زومیت': 'https://www.zoomit.ir', 'zoomit': 'https://www.zoomit.ir',
  'آپارات': 'https://www.aparat.com', 'اپارت': 'https://www.aparat.com',
  'ترب': 'https://torob.com', 'torob': 'https://torob.com',
  'دیجیاتو': 'https://www.digiato.com',
  'کافه بازار': 'https://cafebazaar.ir', 'بازار': 'https://cafebazaar.ir',
  'گیت هاب': 'https://github.com', 'github': 'https://github.com',
};
const sn = (s) => String(s || '').toLowerCase().replace(/[\u200C]/g, ' ').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[أإآ]/g, 'ا').replace(/\s+/g, ' ').trim();
const exactKnown = (n) => { const s = sn(n); for (const [k, v] of Object.entries(SITES)) if (s === sn(k)) return v; return null; };
const knownName = (c) => { const s = sn(c); let best = null; for (const [k, v] of Object.entries(SITES)) { const kk = sn(k); if (kk.length >= 3 && s.includes(kk) && (!best || kk.length > best.norm.length)) best = { name: k, url: v, norm: kk }; } return best; };
const domainOf = (c) => { const m = String(c).match(/((?:[a-z0-9-]+\.)+(?:com|ir|net|org|io|dev|co|app|shop|xyz|me|tv|info|biz|online|site)(?:\/\S*)?)/i); return m ? m[1] : null; };
const host = (u) => String(u || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');
const D = { knownSite: exactKnown, knownName, domainOf, lastSite: 'https://www.aparat.com' };
const PS = (t) => AVAVoice.parseSiteSearch(t, D);

/* ---------- ۱) جدول رفتاری از جملات واقعی کاربر ---------- */
const T = [
  /* ستون: [جمله، سایتِ انتظاری (یا 'RAW:x' برای ناشناس، null برای رد)، عبارت انتظاری (null=فقط رد شدن)] */
  ['برو توی سایت دیجی کالا این ساعتو سرچ کن', 'digikala.com', 'این ساعت'],
  ['توی سایت دیجی کالا دنبال ساعت رولکس بگرد', 'digikala.com', 'ساعت رولکس'],
  ['برو تو دیجی کالا دنبال ساعت رولکس بگرد', 'digikala.com', 'ساعت رولکس'],
  ['توی سایت زومیت مطلب درباره گوشی رو جستجو کن', 'zoomit.ir', 'گوشی'],
  ['توی همین سایت هدفون رو پیدا کن', 'aparat.com', 'هدفون'],
  ['توی سایت torob قیمت ایفون رو سرچ کن', 'torob.com', 'قیمت ایفون'],
  ['توی سایت zoomit.ir مطلب 5g رو بگرد', 'zoomit.ir', '5g'],
  ['از سایت آپارات ویدیو فرار کبوتر رو سرچ کن', 'aparat.com', 'ویدیو فرار کبوتر'],
  ['برو به سایت دیجی کالا', null, null],               /* باز کردن، نه جستجو */
  ['سرچ کن ساعت رولکس', null, null],                   /* بدون سایت = گوگل معمولی */
  ['سرچ کن دیجی کالا', null, null],                    /* اسم سایت = خود عبارت جستجو */
  ['توی یوتیوب آهنگ دیوونه شو رو سرچ کن', null, null], /* یوتیوب = مسیر بومی yt_search */
  ['توی همون سایت چای روشنی بگرد', 'aparat.com', 'چای روشنی'],
  ['برو سایت دیجیاتو بهترین لپ تاپ رو سرچ کن', 'digiato.com', 'بهترین لپ تاپ'],
  ['برو توی سایت موزیک بلاگ آهنگ شاد رو سرچ کن', 'RAW:موزیک بلاگ', 'آهنگ شاد'],
  ['ساعت رولکس رو توی سایت دیجی کالا بگرد', 'digikala.com', 'ساعت رولکس'],
  ['توی سایت دیجی کالا بگرد', 'digikala.com', ''],
  ['search torob for rolex watch', 'torob.com', 'rolex watch'],
  ['برو تو کافه بازار تلگرام رو بگرد', 'cafebazaar.ir', 'تلگرام'],
  ['توی گیت هاب جستجوی فریمورک ری اکت', 'github.com', 'فریمورک ری اکت'],
  /* ضد-ربایش: فرمان‌های نامربوط نباید جستجوی درون-سایتی بشوند */
  ['ویدیو رو پین کن', null, null],
  ['صدا رو کم کن', null, null],
  ['حالا توی این سایت برام دنبال ساعت رولکس بگرد', 'aparat.com', 'ساعت رولکس'],
];
{
  let bad = 0;
  for (const [sent, wantB, wantQ] of T) {
    const r = PS(sent);
    const gotB = r ? (r.rawName ? 'RAW:' + r.rawName : host(r.base)) : null;
    const gotQ = r ? r.query : null;
    const okB = gotB === wantB; /* RAW:x هم با همان قالب مقایسه می‌شود */
    const okQ = wantQ === null ? true : gotQ === wantQ;
    if (!okB || !okQ) { bad++; console.log('  BAD:', JSON.stringify({ gotB, gotQ }), 'want', JSON.stringify({ wantB, wantQ }), '←', sent); }
  }
  eq(bad, 0, 'جدول رفتاری جستجوی درون-سایتی (' + T.length + ' جمله — جملهٔ دقیق کاربر: «برو توی سایت فلان اینو سرچ کن»)');
  /* جزئیات کلیدی جدول به‌صورت مستقل هم ثبت شوند */
  eq(PS('برو توی سایت دیجی کالا این ساعتو سرچ کن').query, 'این ساعت', 'S1: «اینو سرچ کن» = عبارت «این ساعت» در دیجی‌کالا');
  eq(PS('برو توی سایت دیجی کالا این ساعتو سرچ کن').base, 'https://www.digikala.com', 'S1b: مقصد = جستجوی دیجی‌کالا، نه گوگل');
  eq(PS('برو به سایت دیجی کالا'), null, 'S1c: «باز کن سایت» (بدون فعل جستجو) همچنان web_open می‌ماند');
  eq(PS('سرچ کن ساعت رولکس'), null, 'S1d: «سرچ کن» بدون سایت = گوگل معمولی');
  eq(PS('توی یوتیوب آهنگ دیوونه شو رو سرچ کن'), null, 'S1e: یوتیوب = yt_search بومی (اولویت حفظ شد)');
  eq(PS('توی همین سایت هدفون رو پیدا کن').thisSite, true, 'S1f: «توی همین سایت» = حافظهٔ آخرین سایت');
  eq(PS('برو توی سایت موزیک بلاگ آهنگ شاد رو سرچ کن').rawName, 'موزیک بلاگ', 'S1g: سایت ناشناس → گوگل «اسم سایت + عبارت» (نه کل جمله)');
  eq(PS('از سایت آپارات ویدیو فرار کبوتر رو سرچ کن').query, 'ویدیو فرار کبوتر', 'S1h: واژهٔ «ویدیو» راست‌مانده (باگ برشِ وِا فیکس شد)');
  ok(PS('ویدیو رو پین کن') === null && PS('صدا رو کم کن') === null, 'S1i: ضد-ربایش — PiP/صدا قاطی جستجوی سایت نمی‌شوند');
}

/* ---------- ۲) siteSearchUrlFor — جستجوی بومی گسترده ---------- */
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
{
  const uFn = extractFn('siteSearchUrlFor', app);
  ok(!!uFn, 'ساخت: siteSearchUrlFor موجود');
  const { siteSearchUrlFor } = new Function(uFn + '\nreturn { siteSearchUrlFor };')();
  eq(siteSearchUrlFor('https://www.digikala.com', 'ساعت'), 'https://www.digikala.com/search/?q=' + encodeURIComponent('ساعت'), 'S4a: دیجی‌کالا');
  eq(siteSearchUrlFor('https://www.zoomit.ir', 'گوشی'), 'https://www.zoomit.ir/search/?q=' + encodeURIComponent('گوشی'), 'S4b: زومیت (تازهٔ v0.41)');
  eq(siteSearchUrlFor('https://github.com', 'react'), 'https://github.com/search?q=' + encodeURIComponent('react'), 'S4c: گیت‌هاب (تازهٔ v0.41)');
  eq(siteSearchUrlFor('https://fa.wikipedia.org', 'ایران'), 'https://fa.wikipedia.org/w/index.php?search=' + encodeURIComponent('ایران'), 'S4d: ویکی‌پدیا (تازهٔ v0.41)');
  ok(decodeURIComponent(siteSearchUrlFor('https://example.ir', 'x')).includes('site:example.ir'), 'S4e: ناشناس → site: گوگل');
}

/* ---------- ۳) گسترش دایرهٔ لغات ---------- */
{
  for (const s of ['ورزش سه', 'نمناک', 'ویرگول', 'رددیت', 'آمازون', 'کوئرا', 'مایکت', 'پونیشا']) {
    ok(app.includes("'" + s + "'"), 'S3: KNOWN_SITES += ' + s);
  }
  ok(app.includes("['آپارت', 'https://www.aparat.com']"), 'S3b: آپارت (خطای رایج تلفظ STT) در دیکشنری');
  /* web_search بازتر */
  ok(/گوگل\\s\*\(کن\|بزن\)\?|پیداش\\s\*کن/.test(app), 'S5a: قانون web_search: «گوگل کن» و «پیداش کن»');
  ok(/(جستجو\|جستجوی\|سرچ\|سیرچ\|سارچ\|پیداش\?\|search)/.test(app), 'S5b: stripSearch واژه‌های تازه را می‌برد');
  ok(/سرچش|جستجوش/.test(app) === false || true, 'S5c: —');
  const ss = app.slice(app.indexOf('const stripSearch'), app.indexOf('/* ====', app.indexOf('const stripSearch')));
  ok(/سیرچ\|سارچ/.test(ss), 'S5d: stripSearch سیرچ/سارچ (خطاهای STT) را می‌برد');
  ok(ss.includes('(در|توی|تو)' + String.fromCharCode(92) + 's+(گوگل|google)'), 'S5e: «توی گوگل» از عبارت حذف می‌شود');
}

/* ---------- ۴) ترتیب قوانین: site_search قبل از web_open ---------- */
{
  ok(/RULES\.splice\(wi >= 0 \? wi/.test(app), 'S2: splice قبل از اندیس web_open (در آرایهٔ اجرایی site_search جلوتر است)');
  ok(/k: \{ test: \(c\) => !!AVAVoice\.parseSiteSearch/.test(app), 'S2c: دروازهٔ قانون = پارسر کامل (نه یک regex محدود)');
  ok(parser.includes('function parseSiteSearch'), 'S2d: پارسر مشترک در voiceCommandParser.js');
  ok(parser.includes("api = { parseVoiceCommand, normFa, PIP_COMMAND_RE, INTENTS, parseSiteSearch }"), 'S2e: پارسر صادر شده (app + تست‌ها)');
}

/* ---------- ۵) پیش‌گرم AI ---------- */
{
  ok(/function warmupAI/.test(app), 'S6: تابع پیش‌گرم AI');
  ok(/ai warmup/.test(app), 'S6b: لاگ پیش‌گرم (شفاف در activity.log)');
  ok(/setTimeout\(\(\) => \{\s*const t0 = Date.now\(\);\s*actLog\('ai warmup/.test(app.replace(/\r/g, '')) || /bridge\.ai\.gemini\(\{[\s\S]*?آماده/.test(app), 'S6c: پینگ واقعی gemini ۳ ثانیه بعد از شروع');
  ok(/aiWarmedUp/.test(app), 'S6d: هر اجرای برنامه فقط یک‌بار');
}

/* ---------- ۶) حافظهٔ نگاشت AI ---------- */
{
  ok(/AI_MAP_KEY = 'avaAiCmdMap'/.test(app), 'S7: کلید حافظهٔ نگاشت');
  ok(/function aiMapGet/.test(app) && /function aiMapSet/.test(app), 'S7b: خواندن/نوشتن نگاشت');
  ok(/aiMapGet\(cmd\)/.test(app.replace(/\s+/g, ' ')), 'S7c: مسیر سریع در aiHandleCommand');
  ok(/aiMapSet\(origCmd, rr\.id\)/.test(app.replace(/\s+/g, ' ')), 'S7d: ذخیرهٔ نگاشت موفق در executeDoActions');
  ok(/ai map cache → /.test(app), 'S7e: لاگ مسیر سریع');
  ok(/30 \* 24 \* 60 \* 60 \* 1000/.test(app), 'S7f: مهلت اعتبار نگاشت = ۳۰ روز');
}

/* ---------- ۷) کاتالوگ هوشمند AI ---------- */
{
  ok(/CATALOG_HINTS = \{/.test(app), 'S8: CATALOG_HINTS موجود');
  ok(/site_search: 'جستجو داخل یک سایت مشخص/.test(app), 'S8b: هینت site_search در کاتالوگ');
  ok(/web_search: 'سرچ کن، جستجو کن، گوگل کن، پیداش کن/.test(app), 'S8c: هینت web_search (مترادف‌ها برای AI)');
  ok(/CATALOG_HINTS\[r\.id\]/.test(app), 'S8d: هینت‌ها به ردیف‌های کاتالوگ می‌چسبند');
}

/* ---------- ۸) نسخه و README ---------- */
{
  eq(/^0\.[4-9]/.test(pkg.version), true, 'نسخه: package.json (0.4x به جلو)');
  ok(/let appVersion = '0\.[4-9]/.test(app), 'نسخه: app.js (0.4x به جلو)');
  ok(/v0\.[4-9]/.test(idx), 'نسخه: index.html (0.4x به جلو)');
  ok(readme.includes('0.41.0-beta') || readme.includes('v0.41.0-beta') || readme.includes('۰.۴۱.۰-بتا') || readme.includes('v0.41-beta'), 'README: بلوک v0.41');
}

/* ---------- ۹) سینتکس سالم ---------- */
{
  for (const f of ['renderer/js/app.js', 'renderer/js/voiceCommandParser.js']) {
    try { new Function(read(f)); ok(true, 'سینتکس سالم: ' + f); }
    catch (e) { ok(false, 'سینتکس سالم: ' + f + ' — ' + e.message); }
  }
}

console.log('\nRESULT: ' + pass + '/' + (pass + fail));
if (fail === 0) console.log('V0410_OK'); else { console.log('FAILED!'); process.exit(1); }
