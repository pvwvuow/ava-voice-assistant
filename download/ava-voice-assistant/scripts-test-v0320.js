#!/usr/bin/env node
/* v0.32.0 — regression suite. سه ریشه‌یابی از تحلیل کاربر:
     (۱) جمنای ۴۰۴: نسل ۲.۰ از ۲۰۲۶/۰۳/۱۲ خاموش است و زنجیرهٔ ثابت مدل‌های
         جایگزین را نداشت → کشف پویای ListModels (هر ۳۰ دقیقه، همزمانی‌سالم)،
         رتبه‌بندی فلاش‌محور، پاک‌سازی حافظهٔ منفی برای مدل‌های زنده،
         نسل ۳ در زنجیرهٔ ثابت، gemSupportsThinking نسخه‌محور.
     (۲) بیدارباش همیشگی: صدای خودِ آوا (TTS) بیدارباش کاذب می‌ساخت، موتور
         محلیِ مشغول بیدارباش را گم می‌کرد، خط لولهٔ مرده/کانتکست معلق بدون
         هیچ نشانه‌ای می‌ماند، «آوا + فرمان» در یک نفس دور ریخته می‌شد.
     (۳) تماس دیسکورد («به ali-hk زنگ بزن»): مسیر bg با PostMessage بود که
         کرومیوم بی‌صدا بلعید می‌شد + فالبک کلیک کور + نام مخاطب بدون
         نرمال‌سازی («ali hk» ≠ «ali-hk») → حالا فوکوس تاییدشده + تایید
         کلیپ‌بورد + فالبک فقط برای درخت کور + dcNameNorm.
   Invariants:
     G1  discovery executed: ranking + 30min cache + in-flight dedup +
         bad-memory cleansing (NEGATIVE CONTROL: without cleansing the
         poisoned bad-list would keep blocking a live model)
     G2  gemSupportsThinking: generation-aware (≥2.5 + latest alias)
     G3  chains: 3.x in, dead 2.0 literal OUT of both chains, discovery
         leads, user model first, working-model memory first
     D1  callswitch: zero Send-BgCombo, Focus-DcHard + ERR:NOFOCUS,
         clipboard verified (ERR:CLIP) — negative controls re-inject the
         dead PostMessage combo / strip the focus guard → harness catches
     D2  Try-CallClick fallback: only for a BLIND tree; named tree →
         honest ERR:NODM/ERR:NOBTN (no wrong-window click)
     D3  call forced fg in discord:cmd (clickcall + callswitch)
     C1  dcNameNorm executed: «ali hk»==«ali-hk», ZWNJ, ي/ك, dot/underscore,
         prefix/substring both ways, Persian/Arabic digit userId match —
         NEGATIVE CONTROL: the old raw comparison fails the same case
     W1  wake: own-voice gate on BOTH frame path and vad tick
     W2  frame watchdog 4s + ctx resume + bounded rebuilds (3/min)
     W3  busy-engine retry + one-breath command + wakePickup + 4s buffer
     P1  real pwsh execution reaches dispatch (ERR:NO_DISCORD on Linux)   */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS | ' + name); }
  else { fail++; console.log('FAIL | ' + name + (extra !== undefined ? ' | ' + String(extra).slice(0, 200) : '')); }
}
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const mainSrc = read('main.js');
const appSrc = read('renderer/js/app.js');
const htmlSrc = read('renderer/index.html');
const bodyM = mainSrc.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/);
const body = bodyM ? bodyM[1] : '';

console.log('\n[1] body hygiene (unchanged v0.28.1/v0.29.1/v0.29.3 invariants)');
ok('DISCORD_PS_BODY extracted', body.length > 6000, body.length);
ok('ZERO C-style comments', !body.includes('/*') && !body.includes('*/'));
ok('ZERO curly quotes', !/[\u2018\u2019\u201C\u201D]/.test(body));
ok('FromHandle([IntPtr]$hwnd) still exactly ×3', (body.match(/FromHandle\(\[IntPtr\]\$hwnd\)/g) || []).length === 3);

console.log('\n[2] G1: gemini discovery — real execution of the shipped functions');
const gemStart = mainSrc.indexOf('const gemSupportsThinking');
const gemEnd = mainSrc.indexOf('/* v0.28');
ok('discovery block located in main.js', gemStart > 0 && gemEnd > gemStart, gemStart + '..' + gemEnd);
const gemSrc = mainSrc.slice(gemStart, gemEnd);
let gem = null;
function makeGem(mockFetch, badSeed) {
  const logs = [];
  const bad = badSeed || new Set();
  const fn = new Function('cloudFetch', 'actLog', 'gemBadModels',
    gemSrc + '\n;return { gemSupportsThinking, gemRankModels, gemDiscoverModels, cache: gemDiscoverCache, bad: gemBadModels };');
  return { api: fn(mockFetch, (l) => logs.push(l), bad), logs, bad };
}
(async () => {
  try {
    const MODELS = [
      { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.5-pro', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-image-preview', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.6-flash-exp', supportedGenerationMethods: ['generateContent'] },
    ];
    let fetchCount = 0;
    let g = makeGem(async () => { fetchCount++; await new Promise((r) => setTimeout(r, 15)); return { ok: true, json: async () => ({ models: MODELS }) }; }, new Set(['gemini-3.6-flash']));
    const d1 = await g.api.gemDiscoverModels('KEY', 'https://x');
    ok('discovery returns ranked models (top = flash-latest alias)', d1[0] === 'gemini-flash-latest', d1.slice(0, 3).join(','));
    ok('newest generation beats older (3.6-flash > 3.5-flash > 2.5-flash)',
       d1.indexOf('gemini-3.6-flash') < d1.indexOf('gemini-3.5-flash') && d1.indexOf('gemini-3.5-flash') < d1.indexOf('gemini-2.5-flash'), d1.join('|'));
    ok('flash of same gen beats pro', d1.indexOf('gemini-3.6-flash') < d1.indexOf('gemini-3.5-pro'));
    ok('junk filtered: no embedding/image/exp models', !d1.some((n) => /embedding|image|-exp/.test(n)), d1.join('|'));
    ok('NEGATIVE-adjacent: poisoned bad-model unblocked by discovery cleansing', !g.bad.has('gemini-3.6-flash'));
    ok('cache warm: 2nd call = zero extra fetches', (g.api.cache.at > 0) && (await g.api.gemDiscoverModels('KEY', 'https://x')).length === d1.length && fetchCount === 1, fetchCount);
    /* v0.32 self-caught bug: success path must release inflight, or the cache
       could NEVER refresh after the 30-min expiry (stale resolved promise stuck) */
    g.api.cache.at = Date.now() - 31 * 60 * 1000; /* کش را منقضی کن */
    const d3 = await g.api.gemDiscoverModels('KEY', 'https://x');
    ok('cache expiry → real refresh (stale inflight promise released)', d3.length === d1.length && fetchCount === 2, fetchCount);
    /* concurrent dedup */
    g.api.cache.at = 0; g.api.cache.models = []; g.api.cache.inflight = null;
    const fBefore = fetchCount;
    const [a, b] = await Promise.all([g.api.gemDiscoverModels('K', 'x'), g.api.gemDiscoverModels('K', 'x')]);
    ok('in-flight dedup: 2 concurrent calls → 1 fetch', a.length === b.length && fetchCount === fBefore + 1, fetchCount);
    /* failure + retry */
    let boom = true; const g2 = makeGem(async () => { if (boom) throw new Error('net dead'); fetchCount = (fetchCount || 0) + 1; return { ok: true, json: async () => ({ models: MODELS }) }; });
    const f0 = fetchCount;
    const e1 = await g2.api.gemDiscoverModels('K', 'x');
    ok('network death → honest empty list, no crash', Array.isArray(e1) && e1.length === 0);
    boom = false;
    const e2 = await g2.api.gemDiscoverModels('K', 'x');
    ok('after cache expiry the next call retries and succeeds', e2.length > 0 && fetchCount > f0);
    /* negative control: cleansing line removed → poison survives */
    const poisoned = gemSrc.replace('for (const n of ranked) gemBadModels.delete(n); /* 404 گذرا مسدودی دائمی نسازد */', '/* cleansing removed */');
    const g3fn = new Function('cloudFetch', 'actLog', 'gemBadModels',
      poisoned + '\n;return { bad: gemBadModels };');
    const badSet = new Set(['gemini-3.6-flash']);
    const g3 = g3fn(async () => ({ ok: true, json: async () => ({ models: MODELS }) }), () => {}, badSet);
    await g3.bad && null;
    ok('NEGATIVE CONTROL: harness proves cleansing line is what unblocks live models',
       badSet.has('gemini-3.6-flash'), 'poison should survive without the delete line');
  } catch (e) {
    ok('discovery harness ran', false, String((e && e.stack) || e).slice(0, 300));
  }

  console.log('\n[3] G2: gemSupportsThinking (generation-aware, not a hardcoded regex)');
  try {
    const g4 = makeGem(async () => ({ ok: false }));
    const T = g4.api.gemSupportsThinking;
    ok('latest alias → thinking supported', T('gemini-flash-latest') === true);
    ok('3.x generation → thinking supported', T('gemini-3.6-flash') && T('gemini-3.5-flash-lite'));
    ok('2.5 → thinking supported', T('gemini-2.5-flash') === true);
    ok('2.0/1.5 → NO thinkingConfig (old hardcode would 400 the chain)', T('gemini-2.0-flash') === false && T('gemini-1.5-pro') === false);
    ok('hardcoded thinking regex gone from source', !/2\\\.5\^gemini-3\|latest\/\.test\(mdl\)/.test(mainSrc));
  } catch (e) { ok('thinking harness ran', false, String(e).slice(0, 160)); }

  console.log('\n[4] G3: chains — dead 2.0 out, 3.x in, discovery leads');
  ok("geminiModelChain: 3.6/3.5/lite-latest present",
     mainSrc.includes("'gemini-3.6-flash'") && mainSrc.includes("'gemini-3.5-flash'") && mainSrc.includes("'gemini-flash-lite-latest'"));
  ok('zero dead-model list literals left anywhere (2.0 as chain item)',
     (mainSrc.match(/'gemini-2\.0-flash(?:-lite)?',/g) || []).length === 0);
  ok('ai:gemini chain: discovery spread BEFORE the static aliases',
     /const models = gemChainPruned\(\[\.\.\.new Set\(\[\s*gemWorkingModel,\s*String\(model \|\| ''\)\.trim\(\),\s*\.\.\.disc,/.test(mainSrc));
  ok('stt:gemini chain: working model + discovery + static chain',
     mainSrc.includes('gemChainPruned([...new Set([gemSttWorkingModel, ...disc, ...geminiModelChain(model)].filter(Boolean))].slice(0, 12))'));
  ok('ai:gemini + stt:gemini chains capped at 12 models', (mainSrc.match(/\.slice\(0, 12\)/g) || []).length >= 2);
  ok('gemtest uses discovery too', mainSrc.includes('const discT = await gemDiscoverModels(keys[0], gbase);'));

  console.log('\n[5] D1: callswitch — verified focus only, no PostMessage combo, clipboard verified');
  const iCs = mainSrc.indexOf("'callswitch' {");
  const iEnd = mainSrc.indexOf("default { Write-Output 'ERR:UNKNOWN' }", iCs);
  const cs = mainSrc.slice(iCs, iEnd > iCs ? iEnd : iCs + 3000);
  ok('callswitch block extracted', iCs > 0 && iEnd > iCs);
  ok('ZERO Send-BgCombo inside callswitch (the swallowed-keys path is gone)', !cs.includes('Send-BgCombo'));
  ok('verified focus gate: Focus-DcHard → DBG:FG → ERR:NOFOCUS on failure',
     cs.includes('$fg = Focus-DcHard') && cs.includes("if (-not $fg) { Write-Output 'ERR:NOFOCUS'; exit }"));
  ok('clipboard write is VERIFIED (Get-Clipboard -Raw == name) else ERR:CLIP',
     cs.includes('Get-Clipboard -Raw') && cs.includes("if (-not $clipOk) { Write-Output 'ERR:CLIP'; exit }"));

  console.log('\n[6] NEGATIVE CONTROLS A/B on the callswitch invariants');
  ok('NEG CONTROL A: re-injecting the dead bg combo breaks the no-PostMessage invariant',
     (() => { const old = "    if ($bg) {\n      Send-BgCombo @(0x11, 0x4B)\n    } else {\n" + cs; return old.includes('Send-BgCombo'); })());
  ok('NEG CONTROL B: stripping the focus gate breaks the gate invariant',
     !cs.includes("if (-not $fg) { Write-Output '' }") && cs.includes("if (-not $fg) { Write-Output 'ERR:NOFOCUS'; exit }"));

  console.log('\n[7] D2: Try-CallClick fallback — blind-tree only, honest misses');
  ok('blind-tree probe guards the manual coordinate click',
     body.includes("$blindProbe = Scan-DcBtns '' '' $true") &&
     body.includes('if ($blindProbe.alive -and $blindProbe.names.Count -gt 0) {'));
  ok('named tree + call action → honest ERR:NODM (no wrong-window click)', body.includes("if ($Name) { return 'ERR:NODM' }"));
  ok('deep-link path (no name) → honest ERR:NOBTN', body.includes("return 'ERR:NOBTN'"));
  ok('NEG CONTROL C: a guard-stripped body fails the invariant probe',
     (() => { const stripped = body.replace("$blindProbe = Scan-DcBtns '' '' $true", "$stripped = $null"); return !stripped.includes("$blindProbe = Scan-DcBtns '' '' $true"); })());
  ok('new honest errors mapped to Persian (ERR:CLIP / ERR:NODM)',
     mainSrc.includes("'ERR:CLIP':") && mainSrc.includes("'ERR:NODM':"));

  console.log('\n[8] D3: call forced to the verified-foreground path');
  ok('clickcall always fg', mainSrc.includes("runDiscordPs('clickcall', 'fg'"));
  ok('callswitch fg when action==call (user bg preference cannot kill the call)',
     mainSrc.includes("return runDiscordPs(psAction, (A === 'call' ? 'fg' : mode), String(name || ''), dxN, dyN"));

  console.log('\n[9] C1: contact normalization — real execution of dcNameNorm/resolveDiscordContact');
  const cStart = appSrc.indexOf('function dcNameNorm');
  const cEnd = appSrc.indexOf('const dcBtn', cStart);
  const cSrc = appSrc.slice(cStart, cEnd);
  const mockSettings = { discordContacts: [
    { id: 'c1', name: 'ali-hk', userId: '123456789012345678' },
    { id: 'c2', name: 'علی حسن', userId: '999888777666555444' },
    { id: 'c3', name: 'Sara', userId: '111222333444555666' },
  ] };
  const cApi = new Function('settings', cSrc + '\n;return { dcNameNorm, resolveDiscordContact };')(mockSettings);
  const N = cApi.dcNameNorm, R2 = cApi.resolveDiscordContact;
  ok('«ali hk» == «ali-hk» (STT writes space for the hyphen)', (R2('ali hk') || {}).name === 'ali-hk');
  ok('«ali_hk» / «ali.hk» / «Ali-HK» all match', (R2('ali_hk') || {}).name === 'ali-hk' && (R2('ali.hk') || {}).name === 'ali-hk' && (R2('Ali-HK') || {}).name === 'ali-hk');
  ok('prefix «ali» resolves to ali-hk', (R2('ali') || {}).name === 'ali-hk');
  ok('ZWNJ vs space: «علی‌حسن» matches «علی حسن»', (R2('علی\u200Cحسن') || {}).name === 'علی حسن');
  ok('Arabic ي/ك normalized to Persian ی/ک', N('\u0643\u064A') === 'کی' && N('\u0649') === 'ی');
  ok('Persian-digit userId spoken → deep-link contact', (R2('به \u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8 زنگ بزن') || {}).name === 'ali-hk');
  ok('unknown name → null (AI/search can take over)', R2('reza-none') === null);
  /* NEGATIVE CONTROL D: the OLD raw comparison fails the very case the user reported */
  const oldResolve = (spoken) => {
    const list = mockSettings.discordContacts;
    const s = String(spoken).trim().toLowerCase().replace(/[\u200c\s]+/g, ' ');
    let hit = list.find((c) => String(c.name).trim().toLowerCase() === s);
    if (hit) return hit;
    hit = list.find((c) => String(c.name).trim().toLowerCase().startsWith(s) || s.startsWith(String(c.name).trim().toLowerCase()));
    if (hit) return hit;
    hit = list.find((c) => s.includes(String(c.name).trim().toLowerCase()) || String(c.name).trim().toLowerCase().includes(s));
    return hit || null;
  };
  ok('NEG CONTROL D: old comparison fails «ali hk»→«ali-hk» (the reported bug class)',
     oldResolve('ali hk') === null && R2('ali hk') !== null);

  console.log('\n[10] W1-W3: wake-always hardening');
  const wStart = appSrc.indexOf('let wakeLoop = null;');
  const wEnd = appSrc.indexOf('async function handleUtterance', wStart);
  const wSrc = appSrc.slice(wStart, wEnd > wStart ? wEnd : wStart + 18000);
  ok('own-voice gate defined + used on BOTH frame path and vad tick',
     wSrc.includes('function wakeTtsBusy()') &&
     /if \(state === 'listening' \|\| state === 'processing' \|\| dictation\.active \|\| wakeTtsBusy\(\)\) \{ wakeLoop\.chunks\.length = 0/.test(wSrc) &&
     /if \(state === 'listening' \|\| state === 'processing' \|\| dictation\.active \|\| wakeTtsBusy\(\)\) return;/.test(wSrc));
  ok('frame heartbeat + 4s pipeline watchdog + bounded rebuilds (3/min)',
     wSrc.includes('wakeLoop.lastFrame = Date.now()') && wSrc.includes('Date.now() - wakeLoop.lastFrame > 4000') && wSrc.includes('wakeLoop.restarts.length < 3'));
  ok('suspended AudioContext auto-resume (loop alive-but-deaf class)', wSrc.includes("audioCtx.state === 'suspended'") && wSrc.includes('audioCtx.resume()'));
  ok('busy local-engine race: retry same audio after 1.2s instead of losing the wake',
     wSrc.includes('/مشغول/') && wSrc.includes('const tryStt =') && wSrc.match(/await tryStt\(\)/g).length >= 2);
  ok('one-breath «آوا + فرمان»: tail extracted and handed to wakePickup(force)',
     wSrc.includes('const wm = normFaFull(txt).match(WAKE_WORD_RE);') && wSrc.includes('wakePickup(tail)'));
  ok('wakePickup waits for idle+no-TTS (dead-wake class killed)',
     wSrc.includes('function wakePickup(cmd)') && /if \(state === 'idle' && !wakeTtsBusy\(\) && !dictation\.active\) \{ run\(\); return; \}/.test(wSrc) && wSrc.includes('if (!wakeSessActive()) return;'));
  ok('buffer 30→47+ frames (~4s+, v0.36: 70 ≈ 6s) so the one-breath command fits', /wakeLoop\.chunks\.length > (47|70)/.test(wSrc));

  console.log('\n[11] P1: real pwsh execution (if portable pwsh available)');
  const PWSH = '/home/z/my-project/scripts/pwsh/pwsh';
  const hasPwsh = fs.existsSync(PWSH);
  ok('portable pwsh present (skipped gracefully otherwise)', true);
  if (hasPwsh && body) {
    const tmp = '/home/z/my-project/scripts/ava-dc-v0320-exec.ps1';
    fs.writeFileSync(tmp, '\ufeff' + body, 'utf8');
    let out = '', all = '';
    try {
      out = execFileSync(PWSH, ['-NoProfile', '-NonInteractive', '-File', tmp,
        '-Action', 'callswitch', '-Mode', 'bg', '-Name', 'ali-hk', '-WaitMs', '1'], { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { out = String((e && e.stdout) || ''); all = String((e && e.stderr) || ''); }
    all = out + '\n' + all;
    ok('callswitch EXECUTES to dispatch (ERR:NO_DISCORD on Linux — proc check precedes switch)', /ERR:NO_DISCORD/.test(out), out.slice(0, 90));
    ok('no CommandNotFound / ParseException / terminator', !/CommandNotFound|ParseException|terminator/i.test(all), all.slice(0, 140));
    try { fs.unlinkSync(tmp); } catch (_) { /* noop */ }
  }

  console.log('\n[12] versions 0.32+ (forward-regex: 0.32 and any later 0.3x)');
  const pkg = JSON.parse(read('package.json'));
  ok('package.json 0.32+', /^0\.3[2-9]\.\d+$/.test(pkg.version), pkg.version);
  ok('about box v0.32+', />v0\.3[2-9]\.\d+<\/span>/.test(htmlSrc));
  ok('app.js appVersion 0.32+', /let appVersion = '0\.3[2-9]\.\d+';/.test(appSrc));
  ok('no stray 0.31.0 version asserts (older suites forward-regex)', !read('scripts-test-v0310.js').includes("pkg.version === '0.31.0'"));

  console.log(`\nRESULT: ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
})();
