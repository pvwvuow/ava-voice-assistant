#!/usr/bin/env node
/* brain-gemini-test.mjs — v0.63 — تستِ زندهٔ مغز آوا با جیمینای واقعی
   ------------------------------------------------------------
   خواستهٔ کاربر: «بهت کی جیمینای می‌دم که خودت هرچی به ذهنت میاد تست کنی».
   سرورِ توسعه در منطقهٔ مسدود جیمینای است (User location is not supported)
   — پس این هارنس روی «سیستمِ خود کاربر» اجرا می‌شود (جیمینایِ اپ هم از
   همین کلید استفاده می‌کند؛ کلید اینجا فقط از env/آرگومان می‌آید و
   هیچ‌جا ذخیره نمی‌شود).

   اجرا (در پوشهٔ اپ، cmd):
     set GEMINI_KEY=کلید_تو && node scripts\brain-gemini-test.mjs
   یا:
     node scripts\brain-gemini-test.mjs کلید_تو

   چه چیزی را تست می‌کند؟ ۲۲ فرمانِ «واقعی از لاگ خودت» + چند مورد مرزی،
   با همان پرامپتِ همان فایل app.js (استخراج زنده)، همان پارسِ فکر/DO،
   و همان «دور ترمیم» v0.63 — امتیاز نهایی + فهرست خطاها چاپ می‌شود.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const KEY = process.env.GEMINI_KEY || (process.argv.slice(2).find((a) => !a.startsWith('--')) || '');
if (!KEY) { console.error('کلید جیمینای داده نشد — GEMINI_KEY=... node scripts/brain-gemini-test.mjs'); process.exit(2); }

const appSrc = fs.readFileSync(path.join(ROOT, 'renderer/js/app.js'), 'utf8');
function extractBetween(src, a, b) {
  const i = src.indexOf(a); if (i < 0) return null;
  const j = src.indexOf(b, i + a.length); if (j < 0) return null;
  return src.slice(i, j);
}
const FA = eval('(function(){ ' + extractBetween(appSrc, 'const AI_SYSTEM_FA =', 'const AI_SYSTEM_EN =') + ' return AI_SYSTEM_FA; })()');
console.log('پرامپت مغز: ' + FA.length + ' کاراکتر از app.js استخراج شد\n');

/* همان گرامر v0.63 (آینهٔ videoCtlParse در app.js — برای گزارش) */
function videoCtlParse(value) {
  const raw = String(value == null ? '' : value).trim().toLowerCase()
    .replace(/[«»"']/g, '').replace(/\s+/g, ' ');
  const POS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center', 'top', 'bottom', 'left', 'right'];
  const SIMP = ['play_pause', 'next', 'prev', 'stop', 'close', 'fullscreen', 'volume_up', 'volume_down', 'pin', 'unpin', 'grow', 'shrink'];
  if (/^move/.test(raw)) {
    let tail = raw.replace(/^move[:\s]*/, '').trim().replace(/[_/]/g, '-')
      .replace(/top\s*right/g, 'top-right').replace(/top\s*left/g, 'top-left')
      .replace(/bottom\s*right/g, 'bottom-right').replace(/bottom\s*left/g, 'bottom-left')
      .replace(/وسط|مرکز/g, 'center').replace(/بالا/g, 'top').replace(/پایین/g, 'bottom')
      .replace(/راست/g, 'right').replace(/چپ/g, 'left');
    if (POS.indexOf(tail) >= 0) return { action: 'move', arg: tail };
    return { action: 'move', arg: 'center' };
  }
  if (/^seek/.test(raw)) return { action: 'seek', arg: parseFloat(raw.replace(/^seek[:\s]*/, '').replace(/[^\d.-]/g, '')) || 10 };
  if (SIMP.indexOf(raw) >= 0) return { action: raw, arg: 0 };
  const ALIAS = { pause: 'play_pause', play: 'play_pause', resume: 'play_pause', bigger: 'grow', larger: 'grow', smaller: 'shrink', always_on_top: 'pin', ontop: 'pin', untop: 'unpin' };
  if (ALIAS[raw]) return { action: ALIAS[raw], arg: 0 };
  return null;
}
function stripThink(t) { const m = String(t || '').match(/^\s*(?:فکر|THINK)\s*[:：]\s*([^\n]*)\n?/i); return { think: m ? m[1].trim() : '', body: m ? String(t).replace(m[0], '').trim() : String(t || '').trim() }; }
function parseDo(t) {
  const m = String(t || '').match(/<<<DO>>>\s*([\s\S]*?)\s*<<<END>>>/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[1].replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
    const acts = Array.isArray(j.actions) ? j.actions.slice(0, 3).filter((x) => x && x.act) : [];
    return acts.length ? acts : null;
  } catch (_) { return null; }
}

const MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
let MODEL = null;
async function gemini(userText, extra) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: FA + (extra || '') }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 160));
  const j = await res.json();
  return (((j.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text).join('') || '';
}

/* ماتریس — فرمان‌های واقعی لاگ v0.62 + مرزی‌ها. exp: اکشن/اکشن‌های پذیرفته */
const CASES = [
  ['ویدیو رو ببند', ['video_ctl'], 'close'],
  ['ویدیو رو پین کن', ['video_ctl'], 'pin'],
  ['ویدیو رو ببر بالا سمت راست', ['video_ctl'], 'move'],
  ['ویدیو رو یه ذره ابعادشو بزرگتر کن', ['video_ctl'], 'grow'],
  ['ابعاد این پات پلیر که باز هست یکم کوچکتر کن', ['video_ctl'], 'shrink'],
  ['ویدیو رو فول اسکرین کن', ['video_ctl'], 'fullscreen'],
  ['ویدیو رو پاس کن', ['video_ctl'], 'next'],
  ['ویدیو رو پاز کن', ['video_ctl'], 'play_pause'],
  ['ویدیو رو پلی کن ادامه بده', ['video_ctl'], 'play_pause'],
  ['ویدیو رو برو جلو ۳۰ ثانیه', ['video_ctl'], 'seek'],
  ['ویدیو رو ۱۰ ثانیه عقب برو', ['video_ctl'], 'seek'],
  ['صدای ویدیو رو زیاد کن', ['video_ctl'], 'volume_up'],
  ['لینک یوتیوبی که کپی کردم رو تو پلیر پخش کن', ['video_play'], '__clipboard__'],
  ['این ویدیویی که برات کپی کردم لینکشو رو تو این پلیر پخش کن', ['video_play'], '__clipboard__'],
  ['یه ویدیو پلیر باز کن', ['open_app', 'run_custom'], null],
  ['تو یوتیوب برام دنبال آهنگ جدید شادمهر بگرد', ['yt_search'], null],
  ['سایت دیجی کالا رو باز کن', ['open_url'], null],
  ['اسم آهنگ جدید شادمهر چیه؟', [], null],
  ['یه جوک بگو', [], null],
  ['ویدیو رو دیگه همیشه رویر نباشه', ['video_ctl'], 'unpin'],
  ['ویدیو رو ببر گوشه پایین چپ', ['video_ctl'], 'move'],
  ['ویدیو رو ببر وسط صفحه', ['video_ctl'], 'move'],
  /* ---- v0.66 — ماتریس تکمیلی: جمله‌های تازهٔ لاگ v0.65 + پیام‌رسانی/بستن ---- */
  ['همین ویدیویی که یوتیوب دادم به تو برا من توی کی ام پلیر پخشش کن', ['video_play'], null],
  ['ویدیو رو خاموشش کن', ['video_ctl'], 'close'],
  ['پلیر رو ببندش', ['video_ctl'], 'close'],
  ['اپسیتی ویدیو رو یکم کم کن', [], null],
  ['دیسکورد رو میوت کن', ['discord_mute'], null],
  ['به علی در تلگرام پیام بده که سلام', ['open_url'], null],
  ['لینک یوتیوب کپی کردم برام توی ویدیو پلیر پخشش کن', ['video_play'], '__clipboard__'],
];

async function main() {
  /* v0.66 — حالت auth-only: از سرورهای بلاکِ محل هم کار می‌کند — فقط اعتبارِ
     کلید + کشف مدل را می‌سنجد (ریشه: کلید AQ.Ab8… کاربر با هدر x-goog-api-key
     احراز هویت شد ولی generateContent به محل حساس است). اجرا:
     node scripts/brain-gemini-test.mjs --auth-only کلید_تو */
  if (process.argv.includes('--auth-only')) {
    /* نکته: endpoint مدلِ بازنشسته (gemini-2.0-flash-lite) برای پروبِ auth —
       404 «model no longer available» یعنی لایهٔ احراز هویت کلید را پذیرفت
       (کلید AQ.Ab8… فقط با هدر x-goog-api-key پذیرفته می‌شود)؛ 400 «API key
       not valid» = کلید خراب؛ 400 «User location» = کلید سالم، مسیر فقط-محل. */
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }),
      signal: AbortSignal.timeout(20000),
    });
    const t = await res.text();
    if (res.status === 404) { console.log('AUTH=OK  کلید معتبر است (لایهٔ احراز هویت پذیرفت). تستِ کامل تولید را روی سیستم خودت اجرا کن: node scripts/brain-gemini-test.mjs کلید_تو'); process.exit(0); }
    if (/API key not valid/i.test(t)) { console.error('AUTH=FAIL  کلید نامعتبر است'); process.exit(1); }
    if (/User location/i.test(t)) { console.log('AUTH=OK-LOCATION  کلید سالم است؛ از این سرور فقط مسیر محل-بسته در دسترس است. تست کامل روی سیستم خودت.'); process.exit(0); }
    console.error('AUTH=UNKNOWN  HTTP ' + res.status + ' — ' + t.slice(0, 160)); process.exit(1);
  }
  /* انتخاب مدل اولین که جواب داد */
  for (const m of MODELS) {
    try { MODEL = m; await gemini('سلام'); console.log('مدل فعال: ' + m + '\n'); break; }
    catch (e) { console.log('مدل ' + m + ' نشد: ' + String(e.message).slice(0, 100)); MODEL = null; }
  }
  if (!MODEL) { console.error('هیچ مدلی با این کلید جواب نداد (کلید/شبکه/منطقه؟)'); process.exit(1); }

  let pass = 0; const fails = [];
  for (const [q, expActs, expVal] of CASES) {
    let out = '', acts = null, via = 'دور اول';
    try { out = await gemini(q); } catch (e) { fails.push('«' + q + '» شبکه: ' + String(e.message).slice(0, 80)); console.log('✗ ' + q + ' — شبکه'); continue; }
    const st = stripThink(out);
    acts = parseDo(st.body);
    /* همان دور ترمیم v0.63 */
    if (!acts && st.think && /(command|فرمان)/i.test(st.think.slice(0, 60))) {
      try {
        const out2 = await gemini(q, '\n[دور ترمیم — قانون مهم: در فکرِ قبلی خودت این درخواست را «فرمان/command» خواندی ولی بلوک DO ندادی. الان فقط یکی از این دو را بنویس: اگر واقعاً فرمانِ اجرایی است، فقط و فقط بلوک DO معتبر با act از فهرست مجاز؛ اگر اشتباه کردی و سوال/گفتگو بود، فکر را با question/سوال شروع کن و هیچ بلوکی نده.]');
        const st2 = stripThink(out2);
        const a2 = parseDo(st2.body);
        if (a2) { acts = a2; via = 'ترمیم'; }
      } catch (_) { /* noop */ }
    }
    let good = false, detail = '';
    if (expActs.length === 0) {
      good = !acts; detail = acts ? 'نوک‌زد: ' + acts.map((a) => a.act).join('+') : 'بدون بلوک ✓';
    } else if (!acts) {
      good = false; detail = 'بلوک DO نداد';
    } else {
      const a0 = acts[0];
      good = expActs.indexOf(a0.act) >= 0;
      if (good && expVal) {
        if (a0.act === 'video_ctl') {
          const p = videoCtlParse(a0.value);
          good = !!p && p.action === expVal;
          detail = 'video_ctl(' + a0.value + ') → ' + (p ? p.action : 'نامفهوم');
        } else if (a0.act === 'video_play') {
          good = /__clipboard__/i.test(a0.value) || /کلیپ|clipboard/i.test(a0.value) || !/youtube\.com\s*\/?\s*$/.test(String(a0.value).trim());
          detail = 'video_play(' + String(a0.value).slice(0, 40) + ')';
        } else detail = a0.act + '(' + String(a0.value || '').slice(0, 30) + ')';
      } else detail = a0.act + (a0.value ? '(' + String(a0.value).slice(0, 30) + ')' : '') + (via === 'ترمیم' ? ' [ترمیم]' : '');
    }
    if (good) { pass++; console.log('✓ ' + q + '  ← ' + detail); }
    else { fails.push('«' + q + '» → ' + detail); console.log('✗ ' + q + '  ← ' + detail); }
  }
  console.log('\n———————————————');
  console.log('PASS: ' + pass + '/' + CASES.length + '  مدل: ' + MODEL);
  if (fails.length) { console.log('\nخطاها:'); fails.forEach((f) => console.log(' - ' + f)); }
}
main();
