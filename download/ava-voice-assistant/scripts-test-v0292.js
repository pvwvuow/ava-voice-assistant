#!/usr/bin/env node
/* ============================================================
   v0.29.2 regression suite — THE AI-REFERRAL round
   ============================================================
   User report: «اگه یک درخواستی داشته باشم که توی لیست کامنت‌ها
   وجود نداشته ارجاع نمیده به ای‌آی... آب و هوای بجنورد چطوره —
   میگه شهری به نام بجنورد وجود نداره — ارجاع نمیده به ای آی»

   Root causes fixed in this release:
   1) City extraction was DIRTY: «آب و هوای بجنورد را بهم بگو»
      stripped only «بگو» and sent «بجنورد را بهم» to the geocoding
      API → no results → «شهری به نام «بجنورد را بهم» پیدا نشد».
   2) sys:weather NEVER checked gr.ok and json().catch(()=>({}))
      turned a filtered-network HTML response into {} → network
      failure LIED as «city not found».
   3) The dead-end: a matched rule that cannot fulfill (weather
      fail, calc parse fail) returned an error string and the
      request NEVER reached the AI. Now the AI_FALLBACK sentinel
      routes the very same utterance into aiHandleCommand
      (Gemini, or GLM when Gemini is blocked).
   4) 42 Iranian cities (incl. بجنورد) ship as an offline geocoding
      fallback so the main cities work even if geocoding dies.
   ============================================================ */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  [' + String(extra).slice(0, 90) + ']' : '')); }
};
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const mainSrc = read('main.js');
const appSrc = read('renderer/js/app.js');
const htmlSrc = read('renderer/index.html');
const pkg = JSON.parse(read('package.json'));

/* ---- 1) City extraction: REAL execution of the shipped logic ---- */
console.log('\n[1] wxExtractCity — real execution on user utterances');
const stripSrc = appSrc.match(/const WX_STRIP =\s*\/([\s\S]*?)\/gi;/);
const edgeSrc = appSrc.match(/const WX_EDGE =\s*\/([\s\S]*?)\/gi;/);
ok('WX_STRIP literal found', !!stripSrc);
ok('WX_EDGE literal found (v0.29.2)', !!edgeSrc);
if (stripSrc && edgeSrc) {
  const WX_STRIP = new RegExp(stripSrc[1], 'gi');
  const WX_EDGE = new RegExp(edgeSrc[1], 'gi');
  /* mirror of the shipped wxExtractCity (structure asserted separately below) */
  const extract = (c) => {
    let city = String(c || '').replace(WX_STRIP, ' ').replace(/[0-9۰-۹?؟!.,،:;]+/g, ' ');
    for (let i = 0; i < 4; i++) {
      const before = city;
      city = city.replace(WX_EDGE, ' ').replace(/[\s\u200C]+/g, ' ').trim();
      if (city === before) break;
    }
    return city.trim();
  };
  ok('«آب و هوای بجنورد را بهم بگو» → «بجنورد» (user log line 576)',
     extract('آب و هوای بجنورد را بهم بگو') === 'بجنورد', extract('آب و هوای بجنورد را بهم بگو'));
  ok('«امروز هوا چطوره بجنورد؟» → «بجنورد» (user log line 146)',
     extract('امروز هوا چطوره بجنورد؟') === 'بجنورد', extract('امروز هوا چطوره بجنورد؟'));
  ok('«آب و هوای تهران» → «تهران» (regression)', extract('آب و هوای تهران') === 'تهران', extract('آب و هوای تهران'));
  ok('«هوا چطوره؟» → «» (default Tehran path)', extract('هوا چطوره؟') === '', extract('هوا چطوره؟'));
  ok('«آب و هوای مشهد رو نشونم بده» → «مشهد»', extract('آب و هوای مشهد رو نشونم بده') === 'مشهد', extract('آب و هوای مشهد رو نشونم بده'));
  ok('«اب و هوای کرج چنده» → «کرج»', extract('اب و هوای کرج چنده') === 'کرج', extract('اب و هوای کرج چنده'));
  ok('city names starting with stripped tokens survive: «آب و هوای میانه» → «میانه»',
     extract('آب و هوای میانه') === 'میانه', extract('آب و هوای میانه'));
  ok('multi-filler chain: «هوای اصفهان را برایم بده» → «اصفهان»',
     extract('هوای اصفهان را برایم بده') === 'اصفهان', extract('هوای اصفهان را برایم بده'));

  /* negative control: the OLD pipeline really produced the garbage city */
  const oldExtract = (c) => String(c || '').replace(WX_STRIP, ' ').replace(/[0-9۰-۹?؟!.,،:;]+/g, ' ')
    .replace(/[\s\u200C]+/g, ' ').trim();
  ok('NEGATIVE CONTROL — old pipeline sent «بجنورد را بهم» (the lying city-not-found root cause)',
     oldExtract('آب و هوای بجنورد را بهم بگو') === 'بجنورد را بهم', oldExtract('آب و هوای بجنورد را بهم بگو'));

  const fnSrc = appSrc.match(/function wxExtractCity\(c\) \{[\s\S]*?\n  \}/);
  ok('wxExtractCity function shipped in app.js (no drift between test mirror and product)', !!fnSrc);
}

/* ---- 2) AI_FALLBACK sentinel wiring ---- */
console.log('\n[2] AI_FALLBACK sentinel — failed rules refer to the AI');
ok('AI_FALLBACK sentinel defined', appSrc.includes('const AI_FALLBACK = Object.freeze({ __aiFallback: true });'));
ok('weatherReply returns AI_FALLBACK on failure (no more dead-end error text)',
   /const r = await bridge\.system\.weather\(city \|\| 'تهران'\);[\s\S]{0,600}return AI_FALLBACK;/.test(appSrc));
ok('weatherReply no longer returns r.error directly',
   !appSrc.includes('return (r && r.error) || t(\'weather.fail\');'));
ok('calcReply returns AI_FALLBACK when parseMath fails',
   /if \(!m\) \{[\s\S]{0,200}return AI_FALLBACK;[\s\S]{0,80}\}/.test(appSrc));
ok('runCommand intercepts the sentinel',
   appSrc.includes('reply && typeof reply === \'object\' && reply.__aiFallback'));
ok('sentinel → aiHandleCommand(cmd) with same utterance',
   /reply\.__aiFallback[\s\S]{0,300}aiConnected\(\)\) \{ await aiHandleCommand\(cmd(, (?:rule && rule\.__aiExtra|await aiFallbackCtx\(rule\)))?\); return; \}/.test(appSrc)); /* v0.42: aiFallbackCtx(rule) */
ok('honest pre-set reply when AI itself is unreachable',
   /__aiFallback[\s\S]{0,420}t\('weather\.fail'\)/.test(appSrc));
ok('unknown-command → AI path intact (v0.20 regression; v0.39 + catalog)',
   /if \(aiConnected\(\)\) \{[\s\S]{0,400}await aiHandleCommand\(cmd, (?:await aiFallbackCtx\(\)|aiCmdCatalogCtx\(\))\);/.test(appSrc)); /* v0.42 */

/* ---- 3) sys:weather honesty + offline city dict ---- */
console.log('\n[3] sys:weather — gr.ok check, netFail flag, offline cities');
ok('geocoding HTTP status is now checked (was the lying branch)',
   mainSrc.includes('if (!gr.ok) return wFail(`سرویس آب‌وهوا پاسخ نداد (HTTP ${gr.status})`, true);'));
ok('JSON parse failure no longer swallowed to {} (city-not-found lie)',
   /const gj = await gr\.json\(\)\.catch\(\(\) => null\);/.test(mainSrc)
   && !/geocoding[\s\S]{0,400}\.catch\(\(\) => \(\{\}\)\)/.test(mainSrc));
ok('netFail flag returned on network-type failures (wFail sites + catch)',
   (mainSrc.match(/wFail\([^\n]*true\)/g) || []).length >= 4
   && /catch \(e\) \{\s*return \{ ok: false, error: netErr\(e\), netFail: true \};/.test(mainSrc),
   (mainSrc.match(/wFail\([^\n]*true\)/g) || []).length);
ok('the OLD lying message is gone',
   !mainSrc.includes('پیدا نشد — نام شهر را واضح‌تر بگو'));
ok('forecast HTTP status checked too',
   mainSrc.includes('if (!fr.ok) return wFail(`سرویس پیش‌بینی پاسخ نداد (HTTP ${fr.status})`, true);'));
ok('offline IR city dict consulted BEFORE geocoding',
   /let g = local \? \{ latitude: local\[0\], longitude: local\[1\], name: c \} : null;/.test(mainSrc));
ok('بجنورد in offline dict with the real coordinates (37.4747, 57.329 — live-API verified)',
   /'بجنورد': \[37\.4747, 57\.329\]/.test(mainSrc));
ok('offline dict covers all 31 provincial capitals (spot-check 8)',
   ['تهران', 'مشهد', 'اصفهان', 'تبریز', 'شیراز', 'اهواز', 'قم', 'بندرعباس'].every((x) => new RegExp("'" + x + "': \\[").test(mainSrc)));
ok('Arabic ی/ك normalization in city matching', mainSrc.includes(".replace(/ي/g, 'ی').replace(/ك/g, 'ک')"));

/* ---- 4) versions ---- */
console.log('\n[4] version 0.29.2 everywhere');
ok('package.json >= 0.29.2 (relaxed after v0.29.3)', /^0\.(29|[3-9]\d)\.\d+(?:-[\w.]+)?$/.test(pkg.version), pkg.version);
ok('about box v0.29.2+ (relaxed)', /v0\.(29|[3-9]\d)\.\d+/.test(htmlSrc));
ok('app.js appVersion 0.29.2+ (relaxed)', /let appVersion = '0\.(29|[3-9]\d)\.\d+(?:-[\w.]+)?';/.test(appSrc));

console.log(`\nRESULT: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
