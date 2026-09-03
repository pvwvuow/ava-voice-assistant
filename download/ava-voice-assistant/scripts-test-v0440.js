'use strict';
/* ============================================================
   آوا — scripts-test-v0440.js
   تست‌های «فهم-اول» (voiceUnderstand) + سبک‌سازی RAM
   ریشه: درخواست کاربر — «اول تحلیل کنه واقن میفهمه این چیه..
   اگ نفهمید بده gemini انجام بده کار رو» + «توی دیوار دنبال
   موتور بگرد نره گوگل سرچ کنه» + «برنامه رم زیادی مصرف میکنه»
   ============================================================ */
const fs = require('fs');
const path = require('path');
const R = __dirname; /* اسکریپت داخل ریشهٔ پروژه است */
let pass = 0, fail = 0;
const ok = (c, name) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + name); } };
const U = require(path.join(R, 'renderer', 'js', 'voiceUnderstand.js'));
const I = require(path.join(R, 'renderer', 'js', 'voiceIntent.js'));

/* ---------- ۱) تحلیل ساختاری جمله‌های واقعی کاربر ---------- */
const CASES = [
  /* [متن, {target, query, searchVerb}] */
  ['توی دیوار دنبال موتور بگرد', 'دیوار', 'موتور', true],
  ['آوا توی سایت دیوار سرچ کن خرید خونه', 'دیوار', 'خرید خونه', true],
  ['توی شیپور دنبال پراید بگرد', 'شیپور', 'پراید', true],
  ['برو به سایت همراه من', 'همراه من', '', false],
  ['توی دیجی کالا دنبال ساعت رولکس بگرد', 'دیجی کالا', 'ساعت رولکس', true],
  ['توی یوتیوب آهنگ شادمهر پلی کن', 'یوتیوب', '', false],
  ['توی آپارات ویدیو طنز پخش کن', 'آپارات', '', false],
];
for (const [txt, tgt, qry, sv] of CASES) {
  const a = U.analyze(txt);
  ok(a, 'analyze not null: ' + txt);
  ok(a.target && a.target.clean === tgt, `target(${txt}) = «${a.target ? a.target.clean : 'null'}» ≠ «${tgt}»`);
  if (qry) ok(a.query === qry, `query(${txt}) = «${a.query}» ≠ «${qry}»`);
  ok(a.searchVerb === sv, `searchVerb(${txt}) = ${a.searchVerb} ≠ ${sv}`);
}
/* جمله‌های بدون هدف — نباید هدف‌سازی کورکورانه شود */
for (const txt of ['هوا چطوره', 'سلام حالت خوبه', 'یه جوک بگو', 'چند تا تایمر فعال داریم']) {
  const a = U.analyze(txt);
  ok(!a || !a.hasInTarget, 'no-target clean: ' + txt);
}

/* ---------- ۲) منطق بلوکِ اجرای کورکورانه ---------- */
const notResolvable = () => false;      /* هدف در هیچ فهرست محلی نیست */
const yesResolvable = () => true;      /* سایت معروف/برنامهٔ نصب‌شده */
let a = U.analyze('توی دیوار دنبال موتور بگرد');
ok(U.blocksBlindAction(a, 'web_search', notResolvable) === true, 'دیوار+web_search+unknown → BLOCK (نره گوگل)');
ok(U.blocksBlindAction(a, 'site_search', notResolvable) === true, 'دیوار+site_search+unknown → BLOCK');
ok(U.blocksBlindAction(a, 'web_search', yesResolvable) === false, 'دیوار+resolvable → مسیر محلی مجاز');
ok(U.blocksBlindAction(a, 'yt_search', notResolvable) === false, 'قانون غیر-وب (yt_search) بلوک نمی‌شود');
const aNoT = U.analyze('هوا چطره');
ok(!aNoT || !U.blocksBlindAction(aNoT, 'web_search', notResolvable), 'بدون هدف → هرگز بلوک نشود');
const aDig = U.analyze('توی دیجی کالا دنبال ساعت بگرد');
ok(U.blocksBlindAction(aDig, 'site_search', yesResolvable) === false, 'دیجی‌کالا معروف → مسیر بومی محلی');

/* ---------- ۳) خلاصهٔ تحلیل برای AI ---------- */
const brief = U.briefForAi(U.analyze('توی سایت دیوار سرچ کن خرید خونه'));
ok(brief.includes('دیوار'), 'briefForAi نام هدف را دارد');
ok(brief.includes('خرید خونه'), 'briefForAi موضوع را دارد');
ok(brief.includes('گوگل'), 'briefForAi قانونِ «گوگلِ جایگزین ممنوع» را دارد');

/* ---------- ۴) داوری v0.43 سالم مانده (رگرسیون) ---------- */
const fakeRules = [
  { id: 'web_search', k: /سرچ|جستجو|بگرد|دنبال/i },
  { id: 'site_search', k: /سایت/i },
  { id: 'music_play', k: /پخش|پلی\s?کن|بزن/i },
];
const arb1 = I.arbitrate('توی سایت دیوار سرچ کن خرید خونه', fakeRules);
ok(arb1 && arb1.rule.id === 'site_search', 'arbitrate: جملهٔ دیوار → site_search (سپس گیت بلوک می‌کند)');
const arb2 = I.arbitrate('یوتیوب رو باز کن', [
  { id: 'open_youtube', k: /یوتیوب/i },
  { id: 'web_search', k: /سرچ|بگرد/i },
]);
ok(arb2 && arb2.rule.id === 'open_youtube', 'arbitrate: یوتیوب رو باز کن → open_youtube');

/* ---------- ۵) اتصال در app.js (نشان‌های منبع) ---------- */
const appSrc = fs.readFileSync(path.join(R, 'renderer', 'js', 'app.js'), 'utf8');
/* v0.45 — گیت حالا رزول‌شدنیِ «وبی» است (هدفِ برنامه‌ای برای قوانین وب کافی نیست) */
ok(appSrc.includes("AVAUnderstand.blocksBlindAction(_und, rule.id, targetResolvableSync)") || appSrc.includes("AVAUnderstand.blocksBlindAction(_und, rule.id, targetResolvableWebSync)"), 'app.js: گیت فهم-اول در runCommand وصل است');
ok(appSrc.includes("function targetResolvableSync"), 'app.js: targetResolvableSync هست');
ok(appSrc.includes('knownSiteOf(s) || siteDomainOf(s)'), 'app.js: حل هدف با سایت معروف/دامنه');
ok(appSrc.includes('matchSysApp(s)'), 'app.js: حل هدف با برنامهٔ نصب‌شده');
ok(appSrc.includes('قانون مهم ۵'), 'app.js: قانون ۵ فارسی (جستجوی درون-سایتی، نه گوگل)');
ok(appSrc.includes('Important rule 5'), 'app.js: قانون ۵ انگلیسی');
ok(appSrc.includes('function appsNamesCtx'), 'app.js: فهرست برنامه‌های نصب‌شده برای AI');
ok(appSrc.includes('appsNamesCtx()') && appSrc.includes('await avaStateCtx()'), 'app.js: فهرست برنامه‌ها داخل aiFallbackCtx (v0.50: نمونه‌های آموخته هم)');
ok(appSrc.includes('function pushChatHist'), 'app.js: سقف تاریخچهٔ چت');
ok(appSrc.includes('chatHist.length > 40'), 'app.js: سقف تاریخچهٔ چت (v0.82: DOM چت حذف شد، حافظهٔ کوتاه ماند)');
ok(!/chatHist\.push\(/.test(appSrc.replace(/function pushChatHist[\s\S]*?\n  \}/, '')) || appSrc.match(/chatHist\.push\(/g).length === 0, 'app.js: همهٔ pushهای چت از سقف‌دار می‌گذرند');
ok(appSrc.includes('js/voiceUnderstand.js') === false, 'app.js: (اسکریپت در index است نه app)');

/* ---------- ۶) سبک‌سازی RAM در main.js ---------- */
const mainSrc = fs.readFileSync(path.join(R, 'main.js'), 'utf8');
ok(mainSrc.includes("--max-old-space-size=512"), 'main.js: سقف هیپ V8 (512MB)');
ok(mainSrc.includes('offline engine unloaded'), 'main.js: تخلیهٔ خودکار whisper بیکار');
ok(mainSrc.includes('lastLocalSttAt > 10 * 60 * 1000'), 'main.js: آستانهٔ ۱۰ دقیقه بیکاری');
ok(mainSrc.includes('lastLocalSttAt = Date.now()'), 'main.js: ردیابی استفادهٔ موتور آفلاین');

/* ---------- ۷) index.html لود ماژول ---------- */
const idxSrc = fs.readFileSync(path.join(R, 'renderer', 'index.html'), 'utf8');
ok(/voiceIntent\.js[\s\S]*?voiceUnderstand\.js[\s\S]*?app\.js/.test(idxSrc), 'index.html: voiceUnderstand قبل از app.js لود می‌شود');

/* ---------- ۸) نسخه ---------- */
const pkg = JSON.parse(fs.readFileSync(path.join(R, 'package.json'), 'utf8'));
ok(/^0\.[4-9]/.test(pkg.version), 'package.json version forwards-compatible 0.4x+ = ' + pkg.version);

console.log(`\nv0.44 understand-first: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
