/**
 * scripts-test-v028.js — standalone logic tests for v0.28 changes:
 * site direct-open helpers, wake session state machine, discord regexes,
 * gemini error mapping. Run: node scripts-test-v028.js
 */
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('PASS | ' + name); } else { fail++; console.log('FAIL | ' + name); } };

/* ---------- 1. Site helpers (copied verbatim from app.js) ---------- */
const faToEn = (s) => String(s).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const KNOWN_SITES = [
  ['دیجی کالا', 'https://www.digikala.com'], ['دیجی\u200Cکالا', 'https://www.digikala.com'], ['digikala', 'https://www.digikala.com'],
  ['آپارات', 'https://www.aparat.com'], ['اپارات', 'https://www.aparat.com'], ['aparat', 'https://www.aparat.com'],
  ['فیلیمو', 'https://www.filimo.com'], ['نماوا', 'https://www.namava.ir'], ['ترب', 'https://torob.com'],
  ['اسنپ', 'https://snapp.ir'], ['تپسی', 'https://tapsi.ir'], ['جیمیل', 'https://mail.google.com'],
  ['توییتر', 'https://x.com'], ['اینستاگرام', 'https://www.instagram.com'], ['گیت هاب', 'https://github.com'], ['github', 'https://github.com'],
];
const SITE_NAV_STRIP =
  /(لطفا|لطفاً|می\u200Cخوام|میخوام|برام|برای\s*من|وارد\s*شو\s*به|وارد\s*شو|وارد\s*کن|وارد|برو\s*به|برو\s*تو|برو|باز\s*کن|باز\s*بکن|بکن|کن\s*باز|رفتن|بریم|بساز)/gi;
const SITE_WORD_STRIP = /^(سایت|وب\s?سایت|سایتِ|website|web\s?site|the\s+site|site)\s*(از|ی|of|for)?\s*/gi;
const siteNorm = (s) => String(s || '')
  .replace(/[\u200C]/g, ' ')
  .replace(/[ك]/g, 'ک').replace(/[يی]/g, 'ی').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ؤ/g, 'و')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();
function knownSiteOf(cmd) {
  const s = siteNorm(faToEn(String(cmd || '')));
  if (!s) return null;
  for (const [name, url] of KNOWN_SITES) {
    const n = siteNorm(name);
    if (!n) continue;
    if (s === n || s.includes(n) || (n.includes(s) && s.length >= 3)) return url;
  }
  return null;
}
function siteDomainOf(cmd) {
  const s = siteNorm(faToEn(String(cmd || '')));
  const m = s.match(/(?:https?:\/\/)?((?:[a-z0-9-]+\.)+(?:com|ir|net|org|io|dev|co|app|shop|xyz|me|tv|info|biz|online|site)(?:\/\S*)?)/i);
  return m ? m[1] : null;
}
function cleanSiteQuery(cmd) {
  let s = String(cmd || '');
  s = s.replace(SITE_NAV_STRIP, ' ').replace(/[\s\u200C]+/g, ' ').trim(); /* v0.28.1: تریم قبل از ریشهٔ «سایت» */
  s = s.replace(SITE_WORD_STRIP, ' ');
  s = s.replace(/\s*(از|در|تو|توی)\s+(سایت|وب\s?سایت)\s*/gi, ' ');
  s = s.replace(/(سایت|وب\s?سایت)\s*(رو|را)?\s*$/gi, ' ');
  s = s.replace(/[\s\u200C]+/g, ' ').trim();
  s = s.replace(/^(رو|را|به|تو|ی)\s+/i, '').replace(/\s+(رو|را)$/i, '');
  return s.length >= 2 ? s.slice(0, 60) : '';
}

ok('digikala: «برو به سایت دیجی کالا» → https://www.digikala.com', knownSiteOf('برو به سایت دیجی کالا') === 'https://www.digikala.com');
ok('digikala ZWNJ variant «برو به سایت دیجی‌کالا»', knownSiteOf('برو به سایت دیجی\u200Cکالا') === 'https://www.digikala.com');
ok('aparat: «سایت آپارات رو باز کن»', knownSiteOf('سایت آپارات رو باز کن') === 'https://www.aparat.com');
ok('english: "open the github website"', knownSiteOf('open the github website') === 'https://github.com');
ok('unknown site returns null', knownSiteOf('برو به سایت فروشگاه من') === null);
ok('raw domain «باز کن example.ir» → example.ir', siteDomainOf('باز کن example.ir') === 'example.ir');
ok('no false domain in «برو به سایت دیجی کالا»', siteDomainOf('برو به سایت دیجی کالا') === null);
ok('cleanSiteQuery removes «برو به سایت»', cleanSiteQuery('برو به سایت دیجی کالا') === 'دیجی کالا');
ok('cleanSiteQuery removes «وارد شو به سایت»', cleanSiteQuery('وارد شو به سایت ترب شو') === 'ترب شو');
/* run decision for the site rule */
const siteRun = (c) => (/https?:\/\//i.test(c) ? 'web_open' : (knownSiteOf(c) || siteDomainOf(c) ? 'web_open' : 'web_search'));
ok('rule run: digikala → web_open', siteRun('برو به سایت دیجی کالا') === 'web_open');
ok('rule run: unknown → web_search (but cleaned arg)', siteRun('برو به سایت فروشگاه من') === 'web_search');
ok('rule arg for unknown: «فروشگاه من» not «برو به سایت فروشگاه من»', cleanSiteQuery('برو به سایت فروشگاه من') === 'فروشگاه من');

/* ---------- 2. Wake session state machine (mirrors app.js) ---------- */
let wakeSessUntil = 0;
const WAKE_SESS_MS = 90000;
const WAKE_WORD_RE = /^\s*(هی\s+آوا|آوا\s?جان|آوا|اوا|آوای|اوای|ava)[\s،,:-]*(.*)$/i;
const wakeSessActive = () => Date.now() < wakeSessUntil;
const wakeSessOpen = () => { wakeSessUntil = Date.now() + WAKE_SESS_MS; };
const NOW = Date.now();
/* simulate: no session → drop */
const gate1 = wakeSessActive(); ok('no session at start', !gate1);
/* say "آوا" → session opens, command extracted */
const m1 = 'آوا کروم رو باز کن'.match(WAKE_WORD_RE);
ok('«آوا کروم رو باز کن» → cmd=«کروم رو باز کن»', !!m1 && m1[2].trim() === 'کروم رو باز کن');
wakeSessOpen();
ok('session active after wake', wakeSessActive());
/* next utterance WITHOUT wake passes */
ok('session: «نرخ بورس چنده» needs no wake', wakeSessActive() && !WAKE_WORD_RE.test('نرخ بورس چنده'));
/* utterance WITH wake still strips it */
const m2 = 'آوا یوتیوب رو باز کن'.match(WAKE_WORD_RE);
ok('session + wake still strips «آوا»', !!m2 && m2[2].trim() === 'یوتیوب رو باز کن');
/* bare wake inside session → yes answer */
const m3 = 'آوا'.match(WAKE_WORD_RE);
ok('bare «آوا» → empty cmd', !!m3 && !(m3[2] || '').trim());
/* expiry */
wakeSessUntil = NOW - 1;
ok('expired session requires wake again', !wakeSessActive());
/* variants */
ok('«هی آوا» recognized', !!('هی آوا سلام'.match(WAKE_WORD_RE)));
ok('«ava open chrome» recognized', !!('ava open chrome'.match(WAKE_WORD_RE)));
ok('«آوا جان» recognized', !!('آوا جان ساعت چنده'.match(WAKE_WORD_RE)));
ok('plain word containing آوا does NOT match (آبشاران)', !WAKE_WORD_RE.test('آبشاران زیباست'));

/* ---------- 3. Discord regexes (mirrors app.js) ---------- */
const DISC_GATE = /زنگ\s*بزن|تماس|کال|call\b|دیسکورد|discord|میکروفون[^.]{0,10}(قطع|میوت)|دیفن|دی\s?فن|deafen/i;
const norm = (s) => String(s || '').replace(/(لطفا|لطفاً)/g, '').replace(/[\u200C]/g, ' ').trim();
const fa = (t) => /دیسکورد|دیسبورد|دیسکوردُ/.test(t);
const DEAFEN_RE = /(دیفن|دی\s?فن|کرافت|deafen)/i;
const MUTE_RE = /(میوت|مایوت|بیصدا|بی صدا|ان\s?میوت)/i;
ok('gate: «دیسکورد رو میوت کن»', DISC_GATE.test(norm('دیسکورد رو میوت کن')));
ok('gate: «دیسکورد رو دیفن کن»', DISC_GATE.test(norm('دیسکورد رو دیفن کن')));
ok('gate: «دیفن کن» (no discord word)', DISC_GATE.test(norm('دیفن کن')));
ok('deafen: «دیسکورد رو دیفن کن» → deafen action', DEAFEN_RE.test(norm('دیسکورد رو دیفن کن')));
ok('deafen: «صدای دیسکورد رو قطع کن» → deafen action', /صدای?[^.]{0,8}(دیسکورد|discord)/.test(norm('صدای دیسکورد رو قطع کن')) && /(قطع|وصل)/.test(norm('صدای دیسکورد رو قطع کن')));
ok('deafen: «صدای دیسکورد رو وصل کن» → deafen toggle', /صدای?[^.]{0,8}(دیسکورد|discord)/.test(norm('صدای دیسکورد رو وصل کن')) && /(قطع|وصل)/.test(norm('صدای دیسکورد رو وصل کن')));
ok('mute: «دیسکورد رو میوت کن» → mute action', (fa(norm('دیسکورد رو میوت کن')) && MUTE_RE.test(norm('دیسکورد رو میوت کن'))));
ok('mute: «میکروفون دیسکورد رو قطع کن»', /میکروفون/.test(norm('میکروفون دیسکورد رو قطع کن')) && /(قطع|وصل)/.test(norm('میکروفون دیسکورد رو قطع کن')));
ok('mute: «دیسکورد رو ان میوت کن»', MUTE_RE.test(norm('دیسکورد رو ان میوت کن')));
ok('hangup: «تماس رو قطع کن» matches gate (v0.28 fix)', DISC_GATE.test(norm('تماس رو قطع کن')));
ok('decline: «رد تماس» matches gate', DISC_GATE.test(norm('رد تماس')));
ok('answer: «جواب تماس» matches gate', DISC_GATE.test(norm('جواب تماس')));
ok('english: "call ali" matches gate', DISC_GATE.test(norm('call ali')));
ok('«دیسکورد رو باز کن» is open-intent (not blocked by off-branch)', !/(باز\s*کن|اجرا\s*کن|باز\s*شو|بیار\s*بالا|\b(open|run|launch)\b)/i.test(norm('دیسکورد رو میوت کن')));
ok('open-intent regex: «دیسکورد رو باز کن» detected as open', /(باز\s*کن|اجرا\s*کن|باز\s*شو|بیار\s*بالا|\b(open|run|launch)\b)/i.test(norm('دیسکورد رو باز کن')));
ok('call: «به علی زنگ بزن» still matches gate', DISC_GATE.test(norm('به علی زنگ بزن')));
/* system volume commands must NOT hit the discord gate */
ok('«صدا رو میوت کن» does NOT open discord gate', !DISC_GATE.test(norm('صدا رو میوت کن')));
ok('«صدای سیستم رو قطع کن» does NOT open discord gate', !DISC_GATE.test(norm('صدای سیستم رو قطع کن')));

/* ---------- 4. Gemini error mapping (mirrors main.js) ---------- */
const gemErrHuman = (status, raw) => {
  const s = String(raw || '');
  if (/API_?KEY_?INVALID|API key not valid|Please pass a valid API key/i.test(s)) return 'KEY';
  if (/location is not supported|not supported for the API use|user location/i.test(s)) return 'LOC';
  if (status === 429 || /quota|RESOURCE_EXHAUSTED|rate limit/i.test(s)) return 'QUOTA';
  if (status === 403) return 'FORB';
  return null;
};
ok('gemini: 400 API key not valid → KEY', gemErrHuman(400, 'API key not valid. Please pass a valid API key.') === 'KEY');
ok('gemini: 400 API_KEY_INVALID enum → KEY', gemErrHuman(400, 'API_KEY_INVALID') === 'KEY');
ok('gemini: location not supported → LOC', gemErrHuman(400, 'User location is not supported for the API use.') === 'LOC');
ok('gemini: 429 quota → QUOTA', gemErrHuman(429, 'RESOURCE_EXHAUSTED') === 'QUOTA');
ok('gemini: 403 permission → FORB', gemErrHuman(403, 'PERMISSION_DENIED') === 'FORB');
ok('gemini: 404 model → null (model chain handles it)', gemErrHuman(404, 'model not found') === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
