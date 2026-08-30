#!/usr/bin/env node
/* ============================================================
   v0.29.1 regression suite — THE RUNTIME-EXECUTION round
   ============================================================
   Root causes fixed in this release:
   1) ava-dc.ps1 contained a C-style comment (slash-star) — PowerShell does
      NOT have that syntax; the parser accepted it as a command line and at
      RUNTIME executed a Persian word from the comment as a command
      → "The term '????' is not recognized" → every Discord action died
      AFTER printing DBG:PROC. A PARSE-only test cannot catch this —
      so this suite EXECUTES the real script with the real pwsh binary
      and requires it to reach the switch dispatch (ERR:NO_DISCORD on Linux).
   2) wakeLoopStart silently unchecked the user's wakeAlways toggle when the
      offline pack was missing → "روشن کردم ولی کار نمیکنه". Now auto-downloads.
   3) aiAsk provider chain treated {ok:false} as truthy success → GLM never
      tried when Gemini was down, and the log lied "ai Gemini ok model=?".
   4) cloudFetch: main-process cloud traffic now goes through Chromium's
      network stack first (honors the Windows system proxy that VPN tools
      set + host-resolver-rules), node fetch (pinned DNS) as fallback.
   5) «آن میوت» (alef) unmute mapping.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  [' + String(extra).slice(0, 90) + ']' : '')); }
};
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const mainSrc = read('main.js');
const appSrc = read('renderer/js/app.js');
const htmlSrc = read('renderer/index.html');

/* ---- 1) Discord PS body: comment-syntax invariants ---- */
console.log('\n[1] ava-dc.ps1 comment syntax invariants');
const bodyM = mainSrc.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/);
ok('DISCORD_PS_BODY found', !!bodyM);
const body = bodyM ? bodyM[1] : '';
ok('body has NO C-style comment opener /*', !body.includes('/*'));
ok('body has NO C-style comment closer */', !body.includes('*/'));
ok('body stays curly-quote-free (v0.28.1 invariant)', !/[\u2018\u2019\u201C\u201D]/.test(body));
ok('UTF8 console hardening present (readable PS errors)', body.includes('[Console]::OutputEncoding = [System.Text.Encoding]::UTF8'));
ok('UIA comment block kept as # lines (v0.29 note)', body.includes('# v0.29.1') && body.includes('#   UIA='));
ok('switch dispatch intact (mute..decline)', body.includes("'mute'") && body.includes("'unmute'") && body.includes("'deafen'") && body.includes("'undeafen'") && body.includes("'hangup'") && body.includes("'answer'") && body.includes("'decline'"));

/* ---- 2) REAL pwsh EXECUTION regression (the test that was missing) ---- */
console.log('\n[2] real PowerShell EXECUTION (not just parse) of the shipped body');
const PWSH = '/home/z/my-project/scripts/pwsh/pwsh';
const hasPwsh = fs.existsSync(PWSH);
ok('portable pwsh 7.4.6 present', hasPwsh);
if (hasPwsh && body) {
  const tmp = '/home/z/my-project/scripts/ava-dc-v0291-exec.ps1';
  fs.writeFileSync(tmp, '\ufeff' + body, 'utf8'); /* exactly like runDiscordPs */
  let out = '', err = '';
  try {
    out = execFileSync(PWSH, ['-NoProfile', '-NonInteractive', '-File', tmp,
      '-Action', 'mute', '-Mode', 'bg', '-Name', '', '-WaitMs', '1'], { encoding: 'utf8', timeout: 90000 });
  } catch (e) {
    out = String((e && e.stdout) || '');
    err = String((e && e.stderr) || '');
  }
  const allOut = out + '\n' + err;
  /* v0.28.1 round proved the same harness reaches 'ERR:NO_DISCORD' on Linux
     (no Discord process here) — that means the script EXECUTED the switch.
     NOTE: DBG:PROC only prints when a Discord window exists (Linux has none). */
  ok('script EXECUTES to switch dispatch (ERR:NO_DISCORD)', out.includes('ERR:NO_DISCORD'), out.slice(0, 120));
  ok('NO runtime CommandNotFound ("The term ... not recognized")', !/The term .*not recognized/i.test(allOut), allOut.slice(0, 120));
  ok('NO script-level ERR:PS: escape', !out.includes('ERR:PS:'), out.slice(0, 120));

  /* NEGATIVE CONTROL: reintroduce the v0.29.0 bomb in-memory → the same
     harness MUST see the runtime CommandNotFound again (proves the test
     detects the bug class; a parse-only test could never do this). */
  const bomb = body.replace("$ErrorActionPreference = 'Stop'", "$ErrorActionPreference = 'Stop'\n/* v0.29 — سنسور آزمایشی بدون دزدیدن فوکوس: */");
  fs.writeFileSync(tmp, '\ufeff' + bomb, 'utf8');
  let out2 = '', err2 = '';
  try {
    out2 = execFileSync(PWSH, ['-NoProfile', '-NonInteractive', '-File', tmp,
      '-Action', 'mute', '-Mode', 'bg', '-Name', '', '-WaitMs', '1'], { encoding: 'utf8', timeout: 90000 });
  } catch (e) {
    out2 = String((e && e.stdout) || '');
    err2 = String((e && e.stderr) || '');
  }
  const bombOut = out2 + '\n' + err2;
  ok('NEGATIVE CONTROL: bomb body triggers runtime CommandNotFound in this harness', /not recognized/i.test(bombOut) || bombOut.includes('ERR:PS:'), bombOut.slice(0, 140));
  fs.writeFileSync(tmp, '\ufeff' + body, 'utf8'); /* restore good body */
}

/* ---- 3) wake-always: silent toggle-off is gone; auto-download in ---- */
console.log('\n[3] wake-always loop fixes');
ok('silent uncheck REMOVED from wakeLoopStart', !appSrc.includes("settings.wakeAlways = false; store.set('wakeAlways', false);"));
ok('wakeLoopStart auto-downloads the offline pack', appSrc.includes('wake-always: local pack missing → auto-download') && appSrc.includes('bridge.stt.localDownload()'));
ok('download retry cooldown (90s) present', appSrc.includes('wakeDlLastTry'));
ok('mic-unavailable keeps toggle ON + 30s retry', appSrc.includes('wake-always: mic unavailable — retry in 30s (toggle stays ON)') && appSrc.includes('30000'));
ok('pack-done event starts the loop', appSrc.includes("s.stage === 'done' && settings.wakeAlways && !wakeLoop"));
ok('boot auto-start no longer requires ready pack', appSrc.includes("if (settings.wakeAlways && !wakeLoop) wakeLoopStart();"));
ok('i18n wake.alwaysPreparing (fa+en dicts)', (appSrc.match(/'wake\.alwaysPreparing':/g) || []).length === 2);
ok('hint mentions first-time auto-download', appSrc.includes('بستهٔ آفلاین (~۸۰MB) خودکار دانلود می‌شود'));

/* ---- 4) AI provider chain: {ok:false} can no longer short-circuit ---- */
console.log('\n[4] AI provider chain honesty');
ok('tryGlm returns only ok results', /const tryGlm = async \(\) => \{[\s\S]*?if \(r && r\.ok && r\.text\) return r;[\s\S]*?return false;[\s\S]*?\};/.test(appSrc));
ok('tryGemini returns only ok results', /const tryGemini = async \(\) => \{[\s\S]*?if \(r && r\.ok && r\.text\) return r;[\s\S]*?return false;[\s\S]*?\};/.test(appSrc));
ok('tryOpenai returns only ok results', /const tryOpenai = async \(\) => \{[\s\S]*?if \(r && r\.ok && r\.text\) return r;[\s\S]*?return false;[\s\S]*?\};/.test(appSrc));
ok('old broken "|| false" success pattern REMOVED', !appSrc.includes('.catch(() => null)) || false;'));

/* behavioral simulation of the chain fix */
{
  const fakeBridge = (failG, okG) => ({
    gemini: async () => (failG ? { ok: false, error: 'fetch failed' } : { ok: true, text: 'gemini-answer', model: 'm1' }),
    chat: async () => (okG ? { ok: true, text: 'glm-answer', model: 'glm' } : { ok: false, error: 'no key' }),
  });
  const tryGeminiSim = async (b) => {
    const r = await b.gemini().catch(() => null);
    if (r && r.ok && r.text) return r;
    if (r && r.error) return { __err: r };
    return false;
  };
  const tryGlmSim = async (b) => {
    const r = await b.chat().catch(() => null);
    if (r && r.ok && r.text) return r;
    return false;
  };
  (async () => {
    const b1 = fakeBridge(true, true);
    const g1 = await tryGeminiSim(b1);
    ok('sim: failed Gemini no longer satisfies the chain', !g1 || !!g1.__err);
    const l1 = await tryGlmSim(b1);
    ok('sim: GLM tried after Gemini failure and answers', !!(l1 && l1.ok && l1.text === 'glm-answer'));
    const b2 = fakeBridge(false, true);
    const g2 = await tryGeminiSim(b2);
    ok('sim: healthy Gemini still wins', !!(g2 && !g2.__err && g2.text === 'gemini-answer'));
  })();
}

/* ---- 5) cloudFetch: proxy-aware dual-path ---- */
console.log('\n[5] cloudFetch dual path');
ok('cloudFetch helper exists', mainSrc.includes('async function cloudFetch(url, opts)'));
ok('first path = chromium net.fetch (system proxy honored)', mainSrc.includes('const r = await net.fetch(url, o);'));
ok('fallback = node fetch (pinned DNS), NOT self-recursion', /catch \(eCh\) \{\s*\n\s*const r = await fetch\(url, o\);/.test(mainSrc));
const cfCount = (mainSrc.match(/await cloudFetch\(/g) || []).length;
ok('cloud call sites swapped (>=14)', cfCount >= 14, cfCount);
ok('z.ai webview page-script fetches untouched', mainSrc.includes("await fetch('/api/models'") && mainSrc.includes("await fetch('/api/chat/completions'"));
ok('one-time via log (chromium/node)', mainSrc.includes("actLog('cloud fetch path: '"));
ok('netDeepDiag: system proxy probe logged', mainSrc.includes("actLog('net system proxy for googleapis: '"));
ok('netDeepDiag: real https-check of generativelanguage', mainSrc.includes('net https-check generativelanguage'));
ok('netDeepDiag hooked at boot', mainSrc.includes('setTimeout(netDeepDiag, 5000)'));
ok('gemtest reports the winning path (via)', mainSrc.includes('reply: txt.slice(0, 40), via: __cloudVia') && mainSrc.includes("via: __cloudVia || '?'"));
ok('gemtest failure hint mentions proxy/relay honestly', mainSrc.includes('هیچ پراکسی فعالی دیده نمی‌شود') && mainSrc.includes('پراکسی سیستم فعاله'));

/* ---- 6) «آن میوت» (alef) unmute mapping ---- */
console.log('\n[6] unmute mapping');
const unmuteMap = (s) => /(?:ا|آ)ن\s?میوت|وصل|روشن/.test(s) && !/(?:بیصدا|بی\s?صدا|قطع)/.test(s);
const gateRe = /(?:میوت|مایوت|بیصدا|بی صدا|(?:ا|آ)ن\s?میوت)/;
ok('behavior: «آن میوت کن» (with آ) maps to unmute', gateRe.test('دیسکورد من رو آن میوت کن') && unmuteMap('دیسکورد من رو آن میوت کن'));
ok('behavior: «ان میوت» (without آ) still unmute', gateRe.test('دیسکورد رو ان میوت کن') && unmuteMap('دیسکورد رو ان میوت کن'));
ok('behavior: «بیصدا کن» stays mute', gateRe.test('دیسکورد رو بیصدا کن') && !unmuteMap('دیسکورد رو بیصدا کن'));
ok('behavior: «میکروفون رو قطع کن» stays mute', !unmuteMap('میکروفون رو قطع کن'));
ok('behavior: «میکروفون رو وصل کن» maps to unmute', unmuteMap('میکروفون رو وصل کن'));
ok('app.js gate accepts alef variant', appSrc.includes('(ا|آ)ن\\s?میوت'));

/* ---- 7) versions ---- */
console.log('\n[7] versions');
const pkg = JSON.parse(read('package.json'));
ok('package.json 0.29.1', pkg.version === '0.29.1', pkg.version);
ok('index.html abVersion 0.29.1', htmlSrc.includes('v0.29.1'));
ok('app.js appVersion 0.29.1', appSrc.includes("let appVersion = '0.29.1';"));

setTimeout(() => {
  console.log(`\nRESULT: ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
}, 400);
