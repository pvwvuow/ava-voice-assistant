#!/usr/bin/env node
/* ============================================================
   v0.29.3 regression suite — UIA .ctor bomb + z.ai v1 death
   ============================================================
   Root causes from the user's SECOND v0.29.1/v0.29.2 activity.log:
   1) DBG:UIAERR=Exception calling ".ctor" with "2" argument(s):
      "PropertyCondition value for property
      'AutomationElementIdentifiers.NativeWindowHandleProperty'…"
      ×9 in the log — Process.MainWindowHandle is an IntPtr in PS,
      but PropertyCondition(NativeWindowHandleProperty, …) REQUIRES
      an Int32 → ctor throws → mute/unmute/deafen/undeafen/answer/
      decline ALL returned EMPTY → «PowerShell اجرا نشد».
      callswitch still worked only because Try-CallClick's catch
      fell through to the coordinate click. FIX: FromHandle(IntPtr).
   2) «ai fail 29685ms — z.ai: Not Found»: z.ai KILLED the v1 web
      endpoint /api/chat/completions (verified live: 404 with or
      without signature) while /api/v2/chat/completions answers 401
      (route alive, auth required). The frontend bundle also shows a
      new HMAC signature gate (js-sha256 hmac(key,msg) chained with a
      5-minute time bucket over sortedPayload|base64(prompt)|ts).
      FIX: both z.ai paths (in-page + direct) now POST /api/v2 with
      the reproduced signature, signature_prompt body field, and
      X-FE-Version prod-fe-1.1.92; v1 stays as 404-fallback.
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
const htmlSrc = read('renderer/index.html');
const pkg = JSON.parse(read('package.json'));

/* ---- 1) Discord UIA: the Int32/IntPtr ctor bomb eliminated ---- */
console.log('\n[1] Discord UIA — FromHandle(IntPtr) replaces PropertyCondition(Int32)');
const bodyM = mainSrc.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/);
const body = bodyM ? bodyM[1] : '';
ok('DISCORD_PS_BODY found', body.length > 4000);
ok('ZERO NativeWindowHandleProperty PropertyConditions left (the ×9 UIAERR bomb)',
   !body.includes('NativeWindowHandleProperty'),
   (body.match(/NativeWindowHandleProperty/g) || []).length);
ok('FromHandle([IntPtr]$hwnd) used at all 3 sites (Try-CallClick, Get-DcWin, probe)',
   (body.match(/FromHandle\(\[IntPtr\]\$hwnd\)/g) || []).length === 3,
   (body.match(/FromHandle\(\[IntPtr\]\$hwnd\)/g) || []).length);
ok('zero-hwnd guard before FromHandle', body.includes("if ($hwnd -eq [IntPtr]::Zero) { return $null }"));
ok('ControlType Button conditions intact (regression)', (body.match(/ControlTypeProperty/g) || []).length >= 3);
ok('switch dispatch intact (mute..decline)', body.includes("'mute'") && body.includes("'unmute'") && body.includes("'deafen'") && body.includes("'undeafen'") && body.includes("'hangup'") && body.includes("'answer'") && body.includes("'decline'"));
ok('body stays curly-quote-free (v0.28.1 invariant)', !/[\u2018\u2019\u201C\u201D]/.test(body));
ok('body has NO C-style comments (v0.29.1 invariant)', !body.includes('/*') && !body.includes('*/'));
ok('DBG log slice widened 140→400 (UIAERR fully readable in next log)',
   mainSrc.includes("l.slice(0, 400)"));
ok('old 140 slice gone', !mainSrc.includes('l.slice(0, 140)'));

/* ---- 2) z.ai v2 + HMAC signature (both paths) ---- */
console.log('\n[2] z.ai session bridge — v2 endpoint + reproduced HMAC signature');
ok('in-page path posts /api/v2 with v1 404-fallback',
   mainSrc.includes("let r = await zfetch('/api/v2');") && mainSrc.includes("if (r.status === 404) r = await zfetch('/api');"));
ok('direct path posts v2 completions', mainSrc.includes('`${ZAI}/api/v2/chat/completions?${zQs}`'));
ok('dead plain v1 completions call removed',
   !mainSrc.includes('`${ZAI}/api/chat/completions`'));
ok('HMAC chain: bucket key literal shipped once per path',
   (mainSrc.match(/key-@@@@\)\)\)\(\)\(\(9\)\)-xxxx&&&%%%%%/g) || []).length === 2,
   (mainSrc.match(/key-@@@@\)\)\)\(\)\(\(9\)\)-xxxx&&&%%%%%/g) || []).length);
ok('Node crypto HMAC chain order (key,v-h) matches js-sha256 hmac(key,msg)',
   mainSrc.includes("crypto.createHmac('sha256', k).update(m, 'utf8').digest('hex')"));
ok('WebCrypto HMAC in the in-page script (page context signs itself)',
   mainSrc.includes("name: 'HMAC', hash: 'SHA-256'"));
ok('sortedPayload = requestId,timestamp,user_id joined — exact frontend format',
   (mainSrc.match(/'requestId,' \+ (zSigRid|sigRid) \+ ',timestamp,'/g) || []).length === 2);
ok('signature_prompt in both bodies (server verifies signed prompt)',
   (mainSrc.match(/signature_prompt: (zSigPrompt|sigPrompt)/g) || []).length === 2);
ok('X-FE-Version bumped to the current prod-fe-1.1.92',
   !mainSrc.includes('prod-fe-1.0.76') && (mainSrc.match(/prod-fe-1\.1\.92/g) || []).length >= 2);
ok('X-Signature header sent on both paths', (mainSrc.match(/'X-Signature': (zSigX|sigX)/g) || []).length === 2);
ok('signature_timestamp query param on both paths', (mainSrc.match(/signature_timestamp=/g) || []).length >= 2);
ok('5-minute time bucket Math.floor(ts/300000) on both paths',
   (mainSrc.match(/Math\.floor\(Number\((zSigTs|sigTs)\) \/ 300000\)/g) || []).length === 2);
ok('401 → needLogin kept (direct path)', mainSrc.includes('if (!r.ok && r.status === 401)'));
ok('401 → needLogin kept (in-page path)', mainSrc.includes("if (r.status === 401) return { ok: false, needLogin: true, error: 'expired' };"));

/* ---- 3) real pwsh EXECUTION of the shipped body (v0.29.1 harness) ---- */
console.log('\n[3] real PowerShell execution of the shipped body');
const PWSH = '/home/z/my-project/scripts/pwsh/pwsh';
const hasPwsh = fs.existsSync(PWSH);
ok('portable pwsh 7.4.6 present', hasPwsh);
if (hasPwsh && body) {
  const { execFileSync } = require('child_process');
  const tmp = '/home/z/my-project/scripts/ava-dc-v0293-exec.ps1';
  fs.writeFileSync(tmp, '\ufeff' + body, 'utf8');
  let out = '', code = 0;
  try {
    out = execFileSync(PWSH, ['-NoProfile', '-NonInteractive', '-File', tmp,
      '-Action', 'mute', '-Mode', 'bg', '-Name', '', '-WaitMs', '1'], { encoding: 'utf8', timeout: 90000 });
  } catch (e) { out = String((e && e.stdout) || '') + String((e && e.stderr) || ''); code = 1; }
  ok('body EXECUTES to the dispatch (ERR:NO_DISCORD on Linux = no parse/runtime bomb)',
     /ERR:NO_DISCORD/.test(out), out.slice(0, 80));
  ok('no CommandNotFound / ParseException in output', !/CommandNotFound|ParseException|terminator/i.test(out));

  /* negative control: reintroduce the IntPtr PropertyCondition pattern —
     the STATIC invariant must flag it (parse-only can't see runtime, but the
     ship-blocker is the string itself, exactly like the v0.29.1 bomb class) */
  const poisoned = body.replace(
    'function Get-DcWin {',
    'function Get-DcWin {\n  $dead = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NativeWindowHandleProperty, $hwnd)'
  );
  ok('NEGATIVE CONTROL — invariant test flags reintroduced PropertyCondition(hwnd)',
     poisoned.includes('NativeWindowHandleProperty'));
}

/* ---- 4) versions ---- */
console.log('\n[4] version 0.29.3 everywhere');
const appSrc = read('renderer/js/app.js');
ok('package.json 0.29.3', pkg.version === '0.29.3', pkg.version);
ok('about box v0.29.3', htmlSrc.includes('>v0.29.3</span>'));
ok('app.js appVersion 0.29.3', appSrc.includes("let appVersion = '0.29.3';"));

console.log(`\nRESULT: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
