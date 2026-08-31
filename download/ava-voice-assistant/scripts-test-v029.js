/* v0.29.0 — regression suite:
   1) Discord actions are now UIA-first & state-aware (Press-Dc) with honest
      results (UIA / UACLICK / ALREADY / KEYS) — no more silent "OK" with no
      real action (PostMessage synthetic keys are ignored by Discord and
      SetForegroundWindow from a spawned PS usually fails silently).
   2) Gemini test-connection (ai:gemtest) + optional relay base URL honored in
      ai:gemini, stt:gemini and the test itself (Iran location-block workaround).
   3) Always-on offline wake word (VAD-gated local Whisper detection of «آوا»
      even when listening is off) — inspired by the Python repos the user sent
      (trigger_word_detection, hey-siri) but implemented natively in Electron.
   4) Intent protocol extended: discord_unmute/deafen/answer/decline actions. */
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS | ' + name); }
  else { fail++; console.log('FAIL | ' + name + (extra ? ' | ' + String(extra).slice(0, 140) : '')); }
}
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const mainSrc = read('main.js');
const preSrc = read('preload.js');
const appSrc = read('renderer/js/app.js');
const htmlSrc = read('renderer/index.html');
const cssSrc = read('renderer/css/styles.css');
const body = (mainSrc.match(/const DISCORD_PS_BODY = `([\s\S]*?)`;/) || ['', ''])[1];

/* ---- 1) Discord PS body: layered engine (v0.30 evolved) ---- */
ok('PS body: Press-Dc layered engine (state, verified-focus keys, UIA, click, flip-verify)', body.includes("function Press-Dc([string]$doRx, [string]$alrRx, [string]$label, [string]$combo = '', [bool]$keysFirst = $true)"));
ok('PS body: Get-DcWin UIA window finder', body.includes('function Get-DcWin'));
ok('PS body: keys engine fires ONLY after verified foreground (v0.30 Focus-DcHard + Test-Fg)', body.includes('function Try-Keys') && body.includes('function Focus-DcHard') && body.includes('return (Test-Fg)'));
ok('PS body: mute toggles exactly the "Mute" button (state-aware, no blind toggle)', body.includes("'mute'     { Write-Output (Press-Dc '^Mute$' '^Unmute$' 'MUTE' 'ctrl,shift,m') }"));
ok('PS body: unmute action exists', body.includes("'unmute'   { Write-Output (Press-Dc '^Unmute$' '^Mute$' 'UNMUTE' 'ctrl,shift,m') }"));
ok('PS body: deafen + undeafen actions exist', body.includes("'deafen'   { Write-Output (Press-Dc '^Deafen$' '^Undeafen$' 'DEAFEN' 'ctrl,shift,d') }") && body.includes("'undeafen' { Write-Output (Press-Dc '^Undeafen$' '^Deafen$' 'UNDEAFEN' 'ctrl,shift,d') }"));
ok('PS body: hangup UIA-first + keys, matches Disconnect/Leave Call/End Call', body.includes("'hangup'   { Write-Output (Press-Dc '^(Disconnect|Leave Call|Leave|End Call)$' '' 'HANGUP' 'ctrl,shift,h' $false) }"));
ok('PS body: answer matches Join Call/Answer (UIA-first)', body.includes("'answer'   { Write-Output (Press-Dc '^(Join Call|Answer|Accept|Join)$' '' 'ANSWER' 'ctrl,shift,a' $false) }"));
ok('PS body: decline matches Decline/Reject (UIA-first)', body.includes("'decline'  { Write-Output (Press-Dc '^(Decline|Reject|Deny)$' '' 'DECLINE' 'ctrl,shift,e' $false) }"));
ok('PS body: honest results UIA/UACLICK/ALREADY/KEYS (VERIFIED + UNVERIFIED)', body.includes(':KEYS-VERIFIED') && body.includes(":UIA')") && body.includes(":UACLICK')") && body.includes("-ALREADY')"));
ok('PS body: button-name dump for diagnosis (DBG:BTNAMES)', body.includes("Write-Output ('DBG:BTNAMES=' + $dump)"));
ok('PS body: InvokePattern tried before coordinate click', body.indexOf('InvokePattern]::Pattern)).Invoke()') < body.indexOf('Click-At ([int]($r.X + $r.Width / 2))'));
ok('PS body: STILL 100% curly-quote-free (v0.28.1 invariant)', !/[\u2018\u2019\u201C\u201D]/.test(body));
ok('PS body: v0.28.1 callswitch fix intact', body.includes("$name = ($Name -replace '[''\"]', '')"));

/* ---- 2) Gemini test + relay ---- */
ok('main: ai:gemtest handler exists', mainSrc.includes("ipcMain.handle('ai:gemtest'"));
ok('main: gemtest tries discovery+statics + marks bad keys (v0.39: 401/403 break, 429 continue)',
   mainSrc.includes('const discT = await gemDiscoverModels(keys[0], gbase);') &&
   /const models = \[\.\.\.new Set\(\[\.\.\.discT\.slice\(0, 4\), \.\.\.geminiModelChain\(''\)\.slice\(0, 4\)\]\)\]\.slice\(0, 6\)/.test(mainSrc) &&
   mainSrc.includes('badKeys.add(k)') &&
   mainSrc.includes('if (r.status === 429) continue;'));
ok('main: ai:gemini honors optional relay base', mainSrc.includes("const { key, model, messages, search, base } = p || {};") && mainSrc.includes("${gbase}/v1beta/models/"));
ok('main: stt:gemini honors optional relay base', mainSrc.includes("const { buf, key, model, lang, base } = p || {};"));
ok('preload: ai.gemTest bridge', preSrc.includes("gemTest: (payload) => ipcRenderer.invoke('ai:gemtest', payload)"));
ok('app: test button handler + result rendering', appSrc.includes("$('#btnGemTest')") && appSrc.includes("'set.ai.gemTestOk'") && appSrc.includes("'set.ai.gemTestFail'"));
ok('app: gemBase setting stored + saved + loaded', appSrc.includes("gemBase: store.get('gemBase', '')") && appSrc.includes("store.set('gemBase', settings.gemBase)"));
ok('app: chat + STT race pass the relay base', appSrc.includes("base: settings.gemBase || '' }).catch(() => null)") || appSrc.includes("search: true, base: settings.gemBase || ''"));
ok('html: gemTest button + output + relay field', htmlSrc.includes('id="btnGemTest"') && htmlSrc.includes('id="gemTestOut"') && htmlSrc.includes('id="optGemBase"'));
ok('css: .ok-note success style (solid color, SwiftShader-safe)', cssSrc.includes('.ok-note { color: #34d399'));

/* ---- 3) Always-on wake word ---- */
ok('app: wakeAlways setting persisted', appSrc.includes("wakeAlways: store.get('wakeAlways', false)"));
ok('app: wake loop lifecycle (start/stop/boot-retry)', appSrc.includes('async function wakeLoopStart()') && appSrc.includes('function wakeLoopStop()') && appSrc.includes('function wakeBootRetry()'));
ok('app: energy VAD with adaptive floor (AVE3 math reused)', appSrc.includes('function wakeOnFrame(f)') && appSrc.includes('wakeLoop.floor * 2.2 + 0.0035'));
ok('app: silence-gated wake check (650ms) + cooldowns', appSrc.includes('now - wakeLoop.lastVoice >= 650') && appSrc.includes('coolUntil'));
ok('app: wake check runs local whisper (stt.local) and matches آوا/اوا/ava', appSrc.includes('bridge.stt.local({ pcm: new Uint8Array(pcm16.buffer), rate: 16000') && (appSrc.includes('/(آوا|اوا|ava)/i.test(normFaFull(txt))') || appSrc.includes('wakeHitText(txt)'))); /* v0.36: fuzzy matcher */
ok('app: wake hit → chime + wake session + listening (v0.32: via wakePickup, one-breath aware)', appSrc.includes('playWakeChime();\n        wakeSessOpen();') && appSrc.includes('wakePickup(tail)') && appSrc.includes('function wakePickup(cmd)') && appSrc.includes('else startListening();'));
ok('app: loop idles during active listening/processing/own-TTS (zero CPU then)', appSrc.includes("if (state === 'listening' || state === 'processing' || dictation.active || wakeTtsBusy()) { wakeLoop.chunks.length = 0; wakeLoop.spoke = false; return; }"));
ok('app: mic change restarts the wake loop with the new device', appSrc.includes('const wakeWas = !!wakeLoop;') && appSrc.includes('if (wakeWas) wakeLoopStart();'));
ok('app: detachMic keeps the stream alive while the wake loop runs', appSrc.includes('if (isRecording || ave || wakeLoop) return;'));
ok('app: pack-ready hook starts the loop automatically', appSrc.includes("if (settings.wakeAlways && !wakeLoop) wakeLoopStart();"));
ok('app: boot hook starts the loop after init', appSrc.includes('setTimeout(() => { wakeBootRetry(); }, 2600);'));
ok('html: wakeAlways toggle exists', htmlSrc.includes('id="optWakeAlways"'));
ok('i18n: wakeAlways + woke + needPack keys in both dictionaries', (appSrc.match(/'toast\.wakeAlwaysOn': \[/g) || []).length === 2 && (appSrc.match(/'wake\.woke': \[/g) || []).length === 2 && (appSrc.match(/'wake\.alwaysNeedPack': \[/g) || []).length === 2);

/* ---- 4) Intent protocol: full Discord coverage ---- */
ok('DO_ACTS include unmute/deafen/answer/decline', appSrc.includes("'discord_call', 'discord_mute', 'discord_unmute', 'discord_deafen', 'discord_hangup', 'discord_answer', 'discord_decline', 'run_custom'"));
ok('executeDoActions handles the new acts', appSrc.includes("case 'discord_unmute':") && appSrc.includes("case 'discord_deafen':") && appSrc.includes("case 'discord_answer':") && appSrc.includes("case 'discord_decline':"));
ok('AI prompts advertise the new acts (fa+en)', appSrc.includes('discord_mute؛ discord_unmute؛ discord_deafen؛ discord_hangup؛ discord_answer') && appSrc.includes('discord_mute, discord_unmute, discord_deafen, discord_hangup, discord_answer, discord_decline, run_custom.'));
ok('voice: «ان/آن میوت/وصل کن» maps to real unmute (not blind toggle)', appSrc.includes("const unmute = /(ا|آ)ن\\s?میوت|وصل|روشن/.test(t0) && !/(بیصدا|بی\\s?صدا|قطع)/.test(t0);"));
ok('voice: ALREADY results reported honestly', appSrc.includes("if (r && r.ok && /-ALREADY/.test(String(r.result || ''))) return unmute ? t('disc.alreadyOn') : t('disc.alreadyMuted');") && appSrc.includes("if (r && r.ok && /-ALREADY/.test(String(r.result || ''))) return t('disc.alreadyDeaf');"));

/* ---- 5) versions ---- */
const pkg = JSON.parse(read('package.json'));
ok('package.json >= 0.29.0', pkg.version >= '0.29.0', pkg.version);
ok('index.html abVersion >= 0.29.0', /v0\.(29|3\d)\./.test(htmlSrc));
ok('app.js appVersion >= 0.29.0', /let appVersion = '0\.(29|[3-9]\d)/.test(appSrc));

console.log(`\nRESULT: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
